import { SEED } from "./seed";

export type Vendor = { id: number; n: string; pm?: string; cls?: string };
export type Person = { id: number; n: string; sal?: number; w?: number };
export type Day = Record<string, string | number>;
export type MonthData = {
  closed: Record<number, boolean>;
  days: Record<number, Day>;
  vends: Record<string, Vendor[]>;
  monthly: Record<string, number>; // 固定費・光熱費・広告費の月額（"fx_1" のように 項目_取引先ID）
};
export type State = {
  month: string; store: string;
  salesT: number; custT: number; unitT: number;
  foodT: number; shokuT: number; drinkT: number; laborT: number; tax: number;
  minH: number; maxOT: number; maxMOT: number; otRate: number; holPay: number; holiday: number;
  staffs: Person[]; parts: Person[]; pw: string;
  data: Record<string, MonthData>;
};
export const DOW = ["日", "月", "火", "水", "木", "金", "土"];
export const CATS: Record<string, string> = {
  cf: "食材（現金）", cd: "飲料（現金）", cs: "消耗品（現金）", ch: "店舗衛生（現金）", co: "その他（現金）",
  rf: "食材（掛け払い）", rd: "飲料（掛け払い）", ad: "広告費", fx: "固定費", ut: "光熱費", ro: "その他（掛け払い）",
  hm: "店舗衛生管理費", // 末尾に置く（seedの並びと対応させるため）
};
export const CAT_KEYS = Object.keys(CATS);
export const PM_CATS = ["rf", "rd", "ad", "fx", "ut", "ro", "hm"]; // 支払い方法を選ぶ項目
export const PAY = ["クレジットカード", "振り込み", "引き落とし"];
export const MONTHLY_CATS = ["fx", "ut", "ad", "hm"]; // 月に1回入力する経費
export const DAILY_VEND_CATS = CAT_KEYS.filter((c) => !MONTHLY_CATS.includes(c));
export const CLS_CATS = ["cf", "cd", "rf", "rd", "cs", "ch", "co", "ro"]; // 取引先の分類を選ぶ項目
export const CLASSES = ["肉", "魚", "野菜", "乾物、調味料", "飲料", "マグロ", "馬肉", "白レバー、地鶏", "日本酒", "グランドメニュー（ドリンク）", "修繕費", "消耗品", "食材（その他）", "コピー代", "店舗衛生費", "その他"];

export function swap<T>(L: T[], i: number, dir: number) {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= L.length) return;
  [L[i], L[j]] = [L[j], L[i]];
}

/* ---------- 表示用の整形 ---------- */
export const yen = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString("ja-JP") : "–");
export const pct = (v: number) => (Number.isFinite(v) ? (v * 100).toFixed(1) + "%" : "–");
export const ach = (a: number, b: number) => (b > 0 && a > 0 ? a / b : NaN);
export const hn = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown) => +(v as number) || 0;

/* ---------- 初期データ ---------- */
export function emptyMonth(): MonthData {
  const vends: Record<string, Vendor[]> = {};
  CAT_KEYS.forEach((c) => (vends[c] = []));
  return { closed: {}, days: {}, vends, monthly: {} };
}

export function seedMonth(): MonthData {
  const m = emptyMonth();
  const base = ["c1", "c2", "g1", "g2", "x1", "x2", "o"];
  const mon: Record<string, { s: number; n: number }> = {};
  SEED.forEach((r, i) => {
    const a: Day = { w: r[19] as string };
    base.forEach((k, j) => { if (r[j]) a[k] = r[j] as number; });
    CAT_KEYS.slice(0, 11).forEach((c, j) => { // 元データの11項目（店舗衛生管理費は含まない）
      const v = +r[7 + j];
      if (!v) return;
      if (MONTHLY_CATS.includes(c)) { const q = (mon[c] ??= { s: 0, n: 0 }); q.s += v; q.n++; }
      else a[c + "_1"] = v;
    });
    m.days[i + 1] = a;
  });
  CAT_KEYS.forEach((c) => {
    const has = MONTHLY_CATS.includes(c) ? !!mon[c] : Object.values(m.days).some((a) => a[c + "_1"]);
    if (has) m.vends[c] = [{ id: 1, n: "取引先未設定", pm: PM_CATS.includes(c) ? "" : undefined }];
  });
  // 日割りで入っていた固定費などは、1日あたりの平均×30日の月額にする
  MONTHLY_CATS.forEach((c) => { if (mon[c]) m.monthly[c + "_1"] = Math.round((mon[c].s / mon[c].n) * 30); });
  return m;
}

/** 本番（Vercelなど）では、元のExcelの入力データ（seed）を入れない。デモ用に入れたいときだけ NEXT_PUBLIC_USE_SEED=true を設定する */
export const USE_SEED = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_USE_SEED === "true";

export function initialState(): State {
  return {
    month: "2026-11", store: "たくみっちゃん 南柏店",
    salesT: 6800000, custT: 2090, unitT: 3300,
    foodT: 35, shokuT: 21.5, drinkT: 13, laborT: 27, tax: 10,
    minH: 10, maxOT: 12, maxMOT: 20, otRate: 1494, holPay: 13000, holiday: 6,
    staffs: [], parts: [], pw: "",
    // 条件を式のまま書くことで、本番ビルドでは seed のデータごと取り除かれる
    data: process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_USE_SEED === "true" ? { "2026-11": seedMonth() } : {},
  };
}

/** 月のデータが無ければ作り、足りない項目を補う（日割り入力だった固定費などは月額に直す） */
export function ensureMonth(S: State, month: string) {
  const m = (S.data[month] ??= emptyMonth());
  CAT_KEYS.forEach((c) => (m.vends[c] ??= []));
  if (!m.monthly) {
    m.monthly = {};
    const [y, mo] = month.split("-").map(Number);
    const n = new Date(y, mo, 0).getDate();
    MONTHLY_CATS.forEach((c) => m.vends[c].forEach((v) => {
      const k = c + "_" + v.id;
      const vals = Object.values(m.days).map((a) => num(a[k])).filter((x) => x > 0);
      if (vals.length) m.monthly[k] = Math.round((vals.reduce((q, x) => q + x, 0) / vals.length) * n);
      Object.values(m.days).forEach((a) => delete a[k]);
    }));
  }
}

/* ---------- 数値入力の検証 ---------- */
/** 全角数字を半角にし、数字と小数点だけなら文字列を返す。それ以外の文字があれば null */
export function normalizeNum(raw: string): string | null {
  const s = raw.normalize("NFKC").replace(/[,\s]/g, "");
  return /^\d*\.?\d*$/.test(s) ? s : null;
}

/* ---------- 取引先名の類似チェック ---------- */
const norm = (s: string) =>
  s.normalize("NFKC").toLowerCase()
    .replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)/g, "")
    .replace(/[\s\u3000・･\-ー_.,、。()]/g, "")
    .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 96));

function lev(a: string, b: string) {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function similar(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) < 2) return false;
  if (x.includes(y) || y.includes(x)) return true;
  return lev(x, y) <= (Math.max(x.length, y.length) >= 6 ? 2 : 1);
}

/* ---------- 編集用パスワード（ブラウザ内の簡易確認） ---------- */
export async function hashPw(p: string) {
  const t = "nikkei-hyo:" + p;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0;
  return "d" + h;
}

/* ---------- 集計 ---------- */
const vsum = (m: MonthData, a: Day, c: string) =>
  (m.vends[c] || []).reduce((q, v) => q + num(a[c + "_" + v.id]), 0);
export const monthlyTotal = (m?: MonthData, cat?: string) =>
  Object.entries(m?.monthly ?? {}).reduce((q, [k, v]) => q + (!cat || k.startsWith(cat + "_") ? num(v) : 0), 0);

/** 分類ごとの仕入れ額（kind: 食材 / 飲料）。円グラフ用 */
export function pieData(S: State, kind: "food" | "drink") {
  const m = S.data[S.month];
  if (!m) return [];
  const acc: Record<string, number> = {};
  (kind === "food" ? ["cf", "rf"] : ["cd", "rd"]).forEach((c) => (m.vends[c] || []).forEach((v) => {
    const amt = Object.values(m.days).reduce((q, a) => q + num(a[c + "_" + v.id]), 0);
    if (amt > 0) { const k = v.cls || "未分類"; acc[k] = (acc[k] || 0) + amt; }
  }));
  return Object.entries(acc).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v);
}

/** 0.5時間刻みにする（0.5時間に満たない端数は切り捨て） */
export const step05 = (h: number) => Math.floor(h * 2 + 1e-9) / 2;

type Ly = { rows: any[]; monthly: number }; // eslint-disable-line @typescript-eslint/no-explicit-any

function core(S: State, ly: Ly | null) {
  const [y, mo] = S.month.split("-").map(Number);
  const n = new Date(y, mo, 0).getDate();
  const D = S.data[S.month] ?? emptyMonth();
  const tx = 1 / (1 + S.tax / 100); // 売上は税込で入力し、税抜に換算して使う
  let N = 0;
  for (let d = 1; d <= n; d++) if (!D.closed[d]) N++;
  const odd = N % 2 === 1;
  // 曜日ごとの基準値（元シートに合わせ、営業日数が奇数のとき土曜は1.7）
  const fac = (w: number) => (w >= 1 && w <= 4 ? 0.75 : w === 5 || w === 0 ? 1.25 : odd ? 1.7 : 1.5);
  let sS = 0, sC = 0;
  for (let d = 1; d <= n; d++)
    if (!D.closed[d] && N) { const f = fac(new Date(y, mo - 1, d).getDay()); sS += (S.salesT / N) * f; sC += (S.custT / N) * f; }

  const SL = S.staffs, PL = S.parts, wd = n - S.holiday;
  const totSal = SL.reduce((q, p) => q + (p.sal || 0), 0);
  const base = SL.length && wd > 0 ? totSal / (SL.length * wd) : 0; // 社員1日あたりの基本額
  const st: Record<number, { h: number; ot: number; d: number; cost: number; rest: number }> = {};
  const pt: Record<number, { h: number; cost: number; rest: number }> = {};
  SL.forEach((p) => (st[p.id] = { h: 0, ot: 0, d: 0, cost: 0, rest: 0 }));
  PL.forEach((p) => (pt[p.id] = { h: 0, cost: 0, rest: 0 }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = [];
  let last = 0;
  for (let d = 1; d <= n; d++) {
    const a = D.days[d] || {}, w = new Date(y, mo - 1, d).getDay(), cl = !!D.closed[d];
    const g = (k: string) => num(a[k]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = { d, w, cl, a, sc: {}, pcs: {} };
    if (!cl && N) { const f = fac(w); r.tS = (S.salesT / N) * f - (sS - S.salesT) / N; r.tC = (S.custT / N) * f - (sC - S.custT) / N; }
    else { r.tS = 0; r.tC = 0; }
    r.ac = g("c1") + g("c2");
    r.cash = g("g1") + g("g2") + g("o");          // 現金売上（税込）
    r.as = (r.cash + g("x1") + g("x2")) * tx;      // 実績売上（税抜）
    CAT_KEYS.forEach((c) => (r[c] = vsum(D, a, c)));
    r.out = r.cf + r.cd + r.cs + r.ch + r.co;
    r.remit = r.cash - r.out;
    r.food = r.cf + r.cd + r.rf + r.rd;

    let sc = 0, pc = 0;
    SL.forEach((p) => {
      const q = st[p.id], h = g("s" + p.id + "f") + g("s" + p.id + "b");
      q.rest += g("s" + p.id + "rf") + g("s" + p.id + "rb"); // 休憩時間（前半・後半）の合計
      if (h <= 0) return;
      q.d++; q.h += h;
      const oh = Math.max(0, h - S.minH);
      let c1 = 0;
      if (q.d > wd) { // 休日出勤
        if (h >= S.minH) c1 = S.holPay; else if (h >= S.minH / 2) c1 = S.holPay / 2;
      } else if (h >= S.minH) { // 通常勤務（残業あり）
        const pay = Math.min(oh, S.maxOT, Math.max(0, S.maxMOT - q.ot));
        c1 = base + pay * S.otRate; q.ot += oh;
      } else if (h >= S.minH / 2) c1 = base / 2; // 半休
      r.sc[p.id] = c1; q.cost += c1; sc += c1;
    });
    PL.forEach((p) => {
      const f = g("p" + p.id + "f"), b = g("p" + p.id + "b");
      pt[p.id].rest += g("p" + p.id + "rf") + g("p" + p.id + "rb"); // 休憩時間（前半・後半）の合計
      if (f + b <= 0) return;
      // 0.5時間刻みで時給を加算する（端数は切り捨て）。後半（22時以降）は1.25倍
      const pf = step05(f) * (p.w || 0), pb = step05(b) * (p.w || 0) * 1.25;
      r.pcs[p.id] = { f: pf, b: pb }; pt[p.id].h += f + b; pt[p.id].cost += pf + pb; pc += pf + pb;
    });
    r.staff = sc; r.ab = pc;
    r.cost = r.out + r.rf + r.rd + r.ro + r.ab + r.staff;

    // 昨年同日（保存してある昨年のデータから取得）
    const p = ly?.rows[d - 1];
    r.hasLy = !!p;
    r.ly = p ? p.as : 0;
    r.ly1 = p ? (num(p.a.g1) + num(p.a.x1)) * tx : 0;
    r.ly2 = p ? (num(p.a.g2) + num(p.a.x2)) * tx : 0;
    r.lyc1 = p ? num(p.a.c1) : 0;
    r.lyc2 = p ? num(p.a.c2) : 0;
    r.lyc = r.lyc1 + r.lyc2;
    r.lyx = p ? p.cost : 0;
    if (r.as > 0) last = d;
    rows.push(r);
  }

  const SUMK = [...CAT_KEYS, "c1", "c2", "g1", "g2", "x1", "x2", "o", "tS", "tC", "ac", "cash", "as", "out", "remit", "cost", "food", "staff", "ab", "ly", "ly1", "ly2", "lyc", "lyc1", "lyc2"];
  const t: Record<string, number> = { doneS: 0, doneC: 0, doneLy: 0, doneLy1: 0, doneLy2: 0, doneLyc: 0, doneLyc1: 0, doneLyc2: 0, doneLyx: 0 };
  SUMK.forEach((k) => (t[k] = 0));
  let cs = 0, ct = 0, cc = 0;
  rows.forEach((r) => {
    if (r.d <= last) { // 入力済みの日までの累計
      cs += r.as; ct += r.tS; cc += r.ac;
      r.cumS = cs; r.cumT = ct; r.cumA = ct ? cs / ct : NaN; r.cumU = cc ? cs / cc : NaN;
      t.doneS += r.tS; t.doneC += r.tC;
      t.doneLy += r.ly; t.doneLy1 += r.ly1; t.doneLy2 += r.ly2;
      t.doneLyc += r.lyc; t.doneLyc1 += r.lyc1; t.doneLyc2 += r.lyc2; t.doneLyx += r.lyx;
    }
    SUMK.forEach((k) => (t[k] += k in r ? r[k] : num(r.a[k])));
  });
  // 固定費・光熱費・広告費は月額を、入力済みの日数ぶんだけ日割りで経費に入れる
  const frac = n ? last / n : 0;
  MONTHLY_CATS.forEach((c) => (t[c] = monthlyTotal(D, c) * frac));
  t.cost += MONTHLY_CATS.reduce((q, c) => q + t[c], 0);
  if (ly) t.doneLyx += ly.monthly * frac;
  return { rows, t, n, N, odd, last, st, pt, totSal, tx, hasLy: !!ly };
}

export function calc(S: State) {
  const [y, mm] = S.month.split("-");
  const pk = `${+y - 1}-${mm}`;
  const pm = S.data[pk];
  const ly = pm ? { rows: core({ ...S, month: pk }, null).rows, monthly: monthlyTotal(pm) } : null;
  return core(S, ly);
}
export type Calc = ReturnType<typeof calc>;
