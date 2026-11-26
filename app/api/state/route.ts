import { authorize } from "@/lib/server/auth";
import { pipeline, redis, redisConfigured } from "@/lib/server/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const P = "nikkei:v1:";
const UNIT = /^(settings|month:\d{4}-(0[1-9]|1[0-2]))$/;
const MAX_BYTES = 900_000;

// 版（rev）が合っているときだけ書き込む。確認と書き込みを1つの処理にして、同時の書き込みで上書きしないようにする
const CAS = `
local rev = tonumber(redis.call('GET', KEYS[2]) or '0')
if rev ~= tonumber(ARGV[1]) then return {0, rev} end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], rev + 1)
return {1, rev + 1}
`;

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function guard(req: Request) {
  if (!redisConfigured()) return json({ error: "not_configured" }, 503);
  const a = authorize(req);
  if (a === "unset") return json({ error: "no_access_code" }, 503);
  if (a === "denied") return json({ error: "unauthorized" }, 401);
  return null;
}

/** 全データ（または版だけ）を返す */
export async function GET(req: Request) {
  const g = guard(req);
  if (g) return g;
  try {
    const revsOnly = new URL(req.url).searchParams.get("revs") === "1";
    const months = ((await redis(["SMEMBERS", P + "months"])) as string[]).sort();
    const units = ["settings", ...months.map((m) => "month:" + m)];
    const cmds: (string | number)[][] = units.map((u) => ["GET", P + "r:" + u]);
    if (!revsOnly) units.forEach((u) => cmds.push(["GET", P + "d:" + u]));
    const res = await pipeline(cmds);
    const revs: Record<string, number> = {};
    const data: Record<string, unknown> = {};
    units.forEach((u, i) => {
      revs[u] = Number(res[i] ?? 0);
      const raw = revsOnly ? null : (res[units.length + i] as string | null);
      if (raw) data[u] = JSON.parse(raw);
    });
    return json({ revs, data });
  } catch {
    return json({ error: "redis_error" }, 502);
  }
}

/** 1つの単位（設定、または1か月分）を保存する */
export async function PUT(req: Request) {
  const g = guard(req);
  if (g) return g;
  let b: { unit?: unknown; baseRev?: unknown; value?: unknown };
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  if (typeof b.unit !== "string" || !UNIT.test(b.unit) || typeof b.baseRev !== "number" || !b.value || typeof b.value !== "object")
    return json({ error: "bad_request" }, 400);
  const text = JSON.stringify(b.value);
  if (text.length > MAX_BYTES) return json({ error: "too_large" }, 413);
  try {
    const [ok, rev] = (await redis(["EVAL", CAS, 2, P + "d:" + b.unit, P + "r:" + b.unit, b.baseRev, text])) as [number, number];
    if (ok !== 1) {
      const latest = (await redis(["GET", P + "d:" + b.unit])) as string | null;
      return json({ ok: false, rev, value: latest ? JSON.parse(latest) : null }, 409);
    }
    if (b.unit.startsWith("month:")) await redis(["SADD", P + "months", b.unit.slice(6)]);
    return json({ ok: true, rev });
  } catch {
    return json({ error: "redis_error" }, 502);
  }
}
