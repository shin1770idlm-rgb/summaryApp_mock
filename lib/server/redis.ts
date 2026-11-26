/** Upstash Redis（Vercel の Redis / KV）の REST API を直接呼ぶ。追加のパッケージは不要。 */
function cfg() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}
export const redisConfigured = () => cfg() !== null;

async function post(path: string, body: unknown) {
  const c = cfg();
  if (!c) throw new Error("Redis is not configured");
  const r = await fetch(c.url + path, {
    method: "POST", cache: "no-store",
    headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error((j && j.error) || "Redis error " + r.status);
  return j;
}

export async function redis(args: (string | number)[]): Promise<unknown> {
  const j = await post("", args);
  if (j.error) throw new Error(j.error);
  return j.result;
}

/** 複数のコマンドを1回の通信でまとめて実行する */
export async function pipeline(cmds: (string | number)[][]): Promise<unknown[]> {
  const j = (await post("/pipeline", cmds)) as { result?: unknown; error?: string }[];
  return j.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}
