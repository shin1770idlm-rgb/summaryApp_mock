"use client";
import { ReactNode, useEffect, useLayoutEffect, useRef } from "react";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** 枠に収まるまで文字を小さくして、改行させない（最小 min px） */
export function FitText({ text, max = 10.5, min = 5.5 }: { text: string; max?: number; min?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fit = () => {
    const el = ref.current, box = el?.parentElement;
    if (!el || !box) return;
    let fs = max;
    el.style.fontSize = fs + "px";
    while (el.scrollWidth > box.clientWidth + 0.5 && fs > min) { fs -= 0.5; el.style.fontSize = fs + "px"; }
  };
  useIsoLayoutEffect(fit, [text]);
  useEffect(() => { document.fonts?.ready.then(fit); }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref} className="fit" style={{ fontSize: max }}>{text}</span>;
}

/** 取引先名・氏名：名前（収まるよう自動で縮小）の下に補足、右に編集ボタンと並び替えボタン */
export function VendorName({ name, sub, onEdit, editTitle, onMove, stacked }: {
  name: string; sub?: ReactNode; onEdit: () => void; editTitle?: string; onMove: (d: -1 | 1) => void; stacked?: boolean;
}) {
  return (
    <div className={"vn" + (stacked ? " stacked" : "")}>
      <div className="vn-txt"><FitText text={name} />{sub}</div>
      <div className="vn-btns">
        <button className="pl" title={editTitle || "取引先名を編集"} onClick={onEdit}>✎</button>
        <span className="mvs">
          <button className="mv" title="上へ" onClick={() => onMove(-1)}>▲</button>
          <button className="mv" title="下へ" onClick={() => onMove(1)}>▼</button>
        </span>
      </div>
    </div>
  );
}
