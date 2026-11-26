"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { State, USE_SEED, ensureMonth, initialState } from "./logic";
import { notify } from "./notify";
import { stable, toUnits, unitLabel } from "./sync";

const KEY = process.env.NEXT_PUBLIC_STORE_KEY || "nikkei-hyo-next-v1";   // この端末の控え（オフライン用）
const CODE_KEY = KEY + ":access-code";
const INTERVAL = Number(process.env.NEXT_PUBLIC_SYNC_INTERVAL) || 60000; // 他のユーザーの更新を確認する間隔(ms)
const DEBOUNCE = 700;                                                    // 入力が止まってから保存するまで(ms)

export type SyncStatus = "loading" | "saved" | "saving" | "local" | "error" | "locked";
type Remote = { revs: Record<string, number>; data: Record<string, unknown> };

const thisMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; };

/**
 * 状態の保存：サーバー（Redis）に共有して保存する。サーバーが使えないときは、この端末のlocalStorageだけで動く。
 * - 設定と、1か月分ごとに保存し、版（rev）が合うときだけ書き込む（他の人の更新を黙って上書きしない）
 * - 一定時間ごと・画面に戻ったときに、他の人の更新を取り込む
 */
export function useStore() {
  const [S, setS] = useState<State>(initialState);
  const [status, setStatus] = useState<SyncStatus>("loading");
  const [note, setNote] = useState("");
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const sRef = useRef(S);
  const ctx = useRef({
    mode: "local" as "local" | "server", code: "", revs: {} as Record<string, number>,
    saved: {} as Record<string, string>, busy: false, again: false, timer: 0 as unknown as ReturnType<typeof setTimeout>,
  });

  const api = useCallback((path: string, init?: RequestInit) => {
    const code = ctx.current.code;
    return fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...(code ? { "x-access-code": code } : {}) } });
  }, []);

  const commit = (next: State) => { sRef.current = next; setS(next); };
  const cacheLocal = (s: State) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* 保存できない環境では無視 */ } };

  /** 他のユーザーの更新を取り込む（こちらに未保存の変更がある単位は取り込まない） */
  const applyRemote = useCallback((j: Remote) => {
    const c = ctx.current;
    let next = sRef.current;
    const mine = toUnits(next);
    for (const u of Object.keys(j.data)) {
      if (c.revs[u] === j.revs[u]) continue;
      if (c.saved[u] !== undefined && mine[u] !== c.saved[u]) continue; // 未保存の変更あり
      const v = j.data[u] as Record<string, unknown>;
      if (u === "settings") next = { ...next, ...(v as object), data: next.data, month: next.month } as State;
      else next = { ...next, data: { ...next.data, [u.slice(6)]: v as never } };
      c.revs[u] = j.revs[u]; c.saved[u] = stable(v);
    }
    if (next !== sRef.current) { next = structuredClone(next); ensureMonth(next, next.month); commit(next); cacheLocal(next); }
  }, []);

  /** サーバーから読み込む。initial=true は起動時 */
  const pull = useCallback(async (initial: boolean): Promise<"ok" | "locked" | "local"> => {
    const c = ctx.current;
    let r: Response;
    try { r = await api("/api/state"); } catch { c.mode = "local"; setNote("サーバーに接続できません"); if (initial) setStatus("local"); return "local"; }
    if (r.status === 401) { setStatus("locked"); return "locked"; }
    if (!r.ok) {
      c.mode = "local";
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setNote(j.error === "no_access_code" ? "ACCESS_CODE が未設定です" : j.error === "not_configured" || r.status === 404 ? "データベースが未接続です" : "サーバーに接続できません");
      if (initial) setStatus("local");
      return "local";
    }
    const j = (await r.json()) as Remote;
    c.mode = "server"; setNote("");
    if (!initial) { applyRemote(j); return "ok"; }
    c.revs = { ...j.revs }; c.saved = {};
    if (j.data.settings) { // サーバーにデータがある：それを使う（対象月はこの端末の選択を引き継ぐ）
      const base = { ...initialState(), ...(j.data.settings as object), month: sRef.current.month } as State;
      base.data = {};
      Object.keys(j.data).forEach((u) => { if (u.startsWith("month:")) base.data[u.slice(6)] = j.data[u] as never; });
      const next = structuredClone(base);
      ensureMonth(next, next.month);
      commit(next); cacheLocal(next);
      Object.keys(j.data).forEach((u) => (c.saved[u] = stable(j.data[u])));
      setStatus("saved");
    } else { // サーバーが空：この端末の内容を最初のデータとして保存する
      setStatus("saving");
      void flushRef.current();
    }
    return "ok";
  }, [api, applyRemote]);

  /** 変更のあった単位をサーバーに保存する */
  const flush = useCallback(async () => {
    const c = ctx.current;
    if (c.mode !== "server") return;
    if (c.busy) { c.again = true; return; }
    c.busy = true; setStatus("saving");
    try {
      do {
        c.again = false;
        const units = toUnits(sRef.current);
        for (const u of Object.keys(units)) {
          if (c.saved[u] === units[u]) continue;
          const r = await api("/api/state", { method: "PUT", body: JSON.stringify({ unit: u, baseRev: c.revs[u] ?? 0, value: JSON.parse(units[u]) }) });
          if (r.status === 401) { setStatus("locked"); return; }
          if (r.status === 409) { // 他のユーザーが先に更新していた：最新を取り込み、知らせる
            const j = (await r.json()) as { rev: number; value: unknown };
            if (j.value) {
              const v = j.value as Record<string, unknown>;
              let next = sRef.current;
              if (u === "settings") next = { ...next, ...(v as object), data: next.data, month: next.month } as State;
              else next = { ...next, data: { ...next.data, [u.slice(6)]: v as never } };
              next = structuredClone(next); ensureMonth(next, next.month); commit(next); cacheLocal(next);
              c.saved[u] = stable(v);
            }
            c.revs[u] = j.rev;
            notify(`他のユーザーが先に更新したため、「${unitLabel(u)}」を最新の内容に更新しました。必要なら、もう一度入力してください。`);
            continue;
          }
          if (!r.ok) { setStatus(r.status === 503 ? "local" : "error"); return; }
          const j = (await r.json()) as { rev: number };
          c.revs[u] = j.rev; c.saved[u] = units[u];
        }
      } while (c.again);
      setStatus("saved");
    } catch { setStatus("error"); } finally { c.busy = false; }
  }, [api]);

  flushRef.current = flush;

  const poll = useCallback(async () => {
    const c = ctx.current;
    if (c.mode !== "server" || c.busy || (typeof document !== "undefined" && document.hidden)) return;
    try {
      const r = await api("/api/state?revs=1");
      if (r.status === 401) { setStatus("locked"); return; }
      if (!r.ok) return;
      const { revs } = (await r.json()) as Remote;
      if (Object.keys(revs).some((u) => revs[u] !== c.revs[u])) await pull(false);
    } catch { /* 通信できないときは次回に */ }
  }, [api, pull]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const saved = { ...initialState(), ...JSON.parse(raw) } as State;
          Object.keys(saved.data).forEach((k) => ensureMonth(saved, k));
          ensureMonth(saved, saved.month);
          commit(saved);
        } else if (!USE_SEED) {
          const n = { ...sRef.current, month: thisMonth() };
          ensureMonth(n, n.month);
          commit(n);
        }
        ctx.current.code = localStorage.getItem(CODE_KEY) || "";
      } catch { /* 読み込めなければ初期データのまま */ }
      if (!alive) return;
      const res = await pull(true);
      if (res === "local" && alive) { setStatus("local"); }
    })();
    const tick = () => void poll();
    const timer = setInterval(tick, INTERVAL);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((fn: (d: State) => void) => {
    const next = structuredClone(sRef.current);
    fn(next);
    ensureMonth(next, next.month);
    commit(next);
    cacheLocal(next);
    const c = ctx.current;
    if (c.mode === "server") { setStatus("saving"); clearTimeout(c.timer); c.timer = setTimeout(() => void flush(), DEBOUNCE); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flush]);

  /** アクセスコードを入力したとき。正しければ読み込み直す */
  const submitCode = useCallback(async (code: string) => {
    ctx.current.code = code;
    const res = await pull(true);
    if (res === "locked") { ctx.current.code = ""; return false; }
    try { localStorage.setItem(CODE_KEY, code); } catch { /* 無視 */ }
    return true;
  }, [pull]);

  return { S, update, status, note, submitCode };
}
