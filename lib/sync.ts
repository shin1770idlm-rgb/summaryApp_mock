import type { State } from "./logic";

/** キーの順番に左右されない文字列化（保存済みかどうかの比較に使う） */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return "{" + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}";
  }
  return JSON.stringify(v) ?? "null";
}

/** 共有する設定（対象月は端末ごとなので含めない）。月ごとのデータは別々に保存する */
export function settingsOf(S: State) {
  const rest: Record<string, unknown> = { ...S };
  delete rest.data;
  delete rest.month;
  return rest;
}

/** 保存の単位ごとの文字列： "settings" と "month:2026-11" など */
export function toUnits(S: State): Record<string, string> {
  const u: Record<string, string> = { settings: stable(settingsOf(S)) };
  Object.keys(S.data).forEach((k) => (u["month:" + k] = stable(S.data[k])));
  return u;
}

export const unitLabel = (u: string) => (u === "settings" ? "設定" : u.slice(6).replace("-", "年") + "月のデータ");
