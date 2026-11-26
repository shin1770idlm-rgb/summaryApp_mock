"use client";
import { useEffect, useState } from "react";
import { notify } from "@/lib/notify";
import { normalizeNum } from "@/lib/logic";

export function AlertBar() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => { setMsg((e as CustomEvent<string>).detail); clearTimeout(timer); timer = setTimeout(() => setMsg(""), 3500); };
    window.addEventListener("app-alert", on);
    return () => { window.removeEventListener("app-alert", on); clearTimeout(timer); };
  }, []);
  return msg ? <div className="alertbar" role="alert" onClick={() => setMsg("")}>{msg}</div> : null;
}

type Props = {
  value: string | number | undefined;
  onChange: (v: string) => void;   // 検証を通った文字列（空もあり）
  className?: string;
  readOnly?: boolean;
};

/** 全角数字は半角に直し、数字と小数点以外が入ったら注意を出して入力を取り消す */
export default function NumInput({ value, onChange, className, readOnly }: Props) {
  const [draft, setDraft] = useState<string | null>(null); // 入力中の文字（「1.」など途中の状態を保つ）
  const apply = (raw: string) => {
    const r = normalizeNum(raw);
    if (r === null) { notify("数値以外の文字は入力できません。半角の数字で入力してください（小数点は使えます）。"); setDraft(null); return; }
    setDraft(r);
    onChange(r);
  };
  return (
    <input type="text" inputMode="decimal" autoComplete="off" className={className} readOnly={readOnly}
      value={draft ?? (value === undefined || value === null ? "" : String(value))}
      onChange={(e) => { if ((e.nativeEvent as InputEvent).isComposing) setDraft(e.target.value); else apply(e.target.value); }}
      onCompositionEnd={(e) => apply(e.currentTarget.value)}
      onBlur={() => setDraft(null)} />
  );
}
