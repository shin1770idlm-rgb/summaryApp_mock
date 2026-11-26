"use client";
import { ReactNode, useState } from "react";
import NumInput from "./NumInput";
import { CATS, CLASSES, CLS_CATS, PAY, PM_CATS, State, hashPw, similar } from "@/lib/logic";

type Update = (fn: (d: State) => void) => void;

function Modal({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="ov" role="dialog" aria-modal="true">
      <div className="md"><div className="dl"><b>{title}</b>{children}</div></div>
    </div>
  );
}
const Warn = ({ text }: { text: string }) => (text ? <div className="warn">{text}</div> : null);

/* ---------- 取引先の追加・編集 ---------- */
export function VendorDialog({ S, cat, id, update, onClose }: { S: State; cat: string; id: number | null; update: Update; onClose: () => void }) {
  const list = S.data[S.month].vends[cat];
  const cur = id == null ? null : list.find((v) => v.id === id) ?? null;
  const [name, setName] = useState(cur?.n ?? "");
  const [pm, setPm] = useState(cur?.pm ?? "");
  const [cls, setCls] = useState(cur?.cls ?? "");
  const [warn, setWarn] = useState("");
  const [armed, setArmed] = useState(false);   // 似た名称の確認済み
  const [delArmed, setDelArmed] = useState(false);
  const withPm = PM_CATS.includes(cat);
  const withCls = CLS_CATS.includes(cat);
  const act = cur ? "保存" : "追加";

  function save() {
    const n = name.trim();
    if (!n) return;
    if (withPm && !pm) { setWarn("支払い方法を選択してください。"); return; }
    const sim = list.filter((v) => v.id !== id && similar(v.n, n));
    if (sim.length && !armed) {
      setArmed(true);
      setWarn(`似た名称の取引先があります：「${sim.map((v) => v.n).join("」「")}」。このまま${act}しますか？`);
      return;
    }
    update((d) => {
      const L = d.data[d.month].vends[cat];
      if (id == null) L.push({ id: Math.max(0, ...L.map((v) => v.id)) + 1, n, pm: withPm ? pm : undefined, cls: withCls && cls ? cls : undefined });
      else { const v = L.find((x) => x.id === id); if (v) { v.n = n; if (withPm) v.pm = pm; if (withCls) v.cls = cls || undefined; } }
    });
    onClose();
  }
  function remove() {
    if (!delArmed) { setDelArmed(true); return; }
    update((d) => {
      const m = d.data[d.month];
      m.vends[cat] = m.vends[cat].filter((v) => v.id !== id);
      Object.values(m.days).forEach((a) => delete a[cat + "_" + id]);
      delete m.monthly[cat + "_" + id];
    });
    onClose();
  }

  return (
    <Modal title={`${CATS[cat]}の取引先${cur ? "名を編集" : "を追加"}`}>
      <input type="text" placeholder="取引先名" maxLength={30} autoFocus value={name}
        onChange={(e) => { setName(e.target.value); setArmed(false); setWarn(""); }}
        onKeyDown={(e) => e.key === "Enter" && save()} />
      {withPm && (
        <label>支払い方法
          <select value={pm} onChange={(e) => { setPm(e.target.value); if (!armed) setWarn(""); }}>
            <option value="">選択してください</option>
            {PAY.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
      )}
      {withCls && (
        <label>分類
          <select value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">選択してください</option>
            {CLASSES.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      )}
      <Warn text={warn} />
      <div className="dr">
        {cur && <button style={{ marginRight: "auto" }} onClick={remove}>{delArmed ? "本当に削除" : "削除"}</button>}
        <button onClick={onClose}>キャンセル</button>
        <button onClick={save}>{armed ? `このまま${act}` : act}</button>
      </div>
    </Modal>
  );
}

/* ---------- 社員・アルバイトの追加・編集（給与・時給はここでだけ扱う） ---------- */
export function PersonDialog({ S, kind, id, update, onClose }: { S: State; kind: "st" | "pt"; id: number | null; update: Update; onClose: () => void }) {
  const isSt = kind === "st";
  const list = isSt ? S.staffs : S.parts;
  const cur = id == null ? null : list.find((p) => p.id === id) ?? null;
  const [name, setName] = useState(cur?.n ?? "");
  const [val, setVal] = useState(cur ? String(isSt ? cur.sal : cur.w) : "");
  const [warn, setWarn] = useState("");
  const [delArmed, setDelArmed] = useState(false);
  const lab = isSt ? "社員" : "アルバイト";

  function save() {
    const n = name.trim(), v = +val;
    if (!n || val === "" || !(v >= 0)) { setWarn(`氏名と${isSt ? "給与" : "時給"}を入力してください。`); return; }
    update((d) => {
      const L = isSt ? d.staffs : d.parts;
      if (id == null) L.push({ id: Math.max(0, ...L.map((p) => p.id)) + 1, n, ...(isSt ? { sal: v } : { w: v }) });
      else { const p = L.find((x) => x.id === id); if (p) { p.n = n; if (isSt) p.sal = v; else p.w = v; } }
    });
    onClose();
  }
  function remove() {
    if (!delArmed) { setDelArmed(true); return; }
    const pre = isSt ? "s" : "p";
    update((d) => {
      if (isSt) d.staffs = d.staffs.filter((p) => p.id !== id); else d.parts = d.parts.filter((p) => p.id !== id);
      Object.values(d.data).forEach((m) => Object.values(m.days).forEach((a) => { delete a[pre + id + "f"]; delete a[pre + id + "b"]; delete a[pre + id + "rf"]; delete a[pre + id + "rb"]; }));
    });
    onClose();
  }

  return (
    <Modal title={lab + (cur ? "情報を編集" : "を追加")}>
      <label>氏名<input type="text" maxLength={30} autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label>{isSt ? "給与（円）" : "時給（円）"}<NumInput value={val} onChange={setVal} /></label>
      {isSt && <div className="note" style={{ margin: 0, textAlign: "left" }}>社員給与は基本給、役職手当、職務手当の合計額とする</div>}
      <Warn text={warn} />
      <div className="dr">
        {cur && <button style={{ marginRight: "auto" }} onClick={remove}>{delArmed ? "本当に削除" : "削除"}</button>}
        <button onClick={onClose}>キャンセル</button>
        <button onClick={save}>{cur ? "保存" : "追加"}</button>
      </div>
    </Modal>
  );
}

/* ---------- パスワード（初回は設定、以後は確認） ---------- */
export function PasswordDialog({ S, update, onOk, onClose }: { S: State; update: Update; onOk: () => void; onClose: () => void }) {
  const [pw, setPw] = useState("");
  const [warn, setWarn] = useState("");
  const first = !S.pw;

  async function submit() {
    if (!pw) { setWarn("パスワードを入力してください。"); return; }
    const h = await hashPw(pw);
    if (first) update((d) => { d.pw = h; });
    else if (S.pw !== h) { setWarn("パスワードが違います。"); return; }
    onOk();
  }
  return (
    <Modal title={first ? "パスワードを設定" : "パスワードを入力"}>
      <div className="note" style={{ margin: 0, textAlign: "left" }}>
        {first ? "編集用のパスワードを設定してください。次回からこのパスワードで編集します。" : "編集するにはパスワードが必要です。"}
      </div>
      <input type="password" autoComplete="off" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <Warn text={warn} />
      <div className="dr"><button onClick={onClose}>キャンセル</button><button onClick={submit}>OK</button></div>
    </Modal>
  );
}

/* ---------- アクセスコード（共有データベースを使うとき） ---------- */
export function AccessDialog({ onSubmit }: { onSubmit: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState("");
  const [warn, setWarn] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!code || busy) return;
    setBusy(true);
    const ok = await onSubmit(code);
    setBusy(false);
    if (!ok) setWarn("アクセスコードが違います。");
  }
  return (
    <Modal title="アクセスコードを入力">
      <div className="note" style={{ margin: 0 }}>共有データを開くには、アクセスコードが必要です。</div>
      <input type="password" autoComplete="off" autoFocus value={code} onChange={(e) => { setCode(e.target.value); setWarn(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} />
      <Warn text={warn} />
      <div className="dr"><button onClick={submit} disabled={busy}>開く</button></div>
    </Modal>
  );
}
