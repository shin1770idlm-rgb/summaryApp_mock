"use client";
import { useMemo, useState } from "react";
import { calc, swap } from "@/lib/logic";
import { useStore } from "@/lib/useStore";
import DayTable from "./DayTable";
import { AccessDialog, PasswordDialog, PersonDialog, VendorDialog } from "./Dialogs";
import Monthly from "./Monthly";
import { AlertBar } from "./NumInput";
import Pies from "./Pies";
import Settings from "./Settings";
import Summary, { Kpi } from "./Summary";

type PersonTarget = { kind: "st" | "pt"; id: number | null };

export default function App() {
  const { S, update, status, note, submitCode } = useStore();
  const c = useMemo(() => calc(S), [S]);
  const [vendor, setVendor] = useState<{ cat: string; id: number | null } | null>(null);
  const [person, setPerson] = useState<PersonTarget | null>(null);
  const [auth, setAuth] = useState<{ run: () => void } | null>(null); // パスワード確認のあとに実行する処理
  const [showPay, setShowPay] = useState(false);                     // 給与の表示（保存しない）

  const setVal = (day: number, key: string, value: string) =>
    update((d) => {
      const days = d.data[d.month].days;
      (days[day] ??= {})[key] = key === "w" ? value : value === "" ? "" : +value;
    });
  const setClosed = (day: number, closed: boolean) =>
    update((d) => { const m = d.data[d.month]; if (closed) m.closed[day] = true; else delete m.closed[day]; });
  const moveVendor = (cat: string, id: number, dir: -1 | 1) =>
    update((d) => { const L = d.data[d.month].vends[cat]; swap(L, L.findIndex((v) => v.id === id), dir); });
  const movePerson = (kind: "st" | "pt", id: number, dir: -1 | 1) =>
    update((d) => { const L = kind === "st" ? d.staffs : d.parts; swap(L, L.findIndex((p) => p.id === id), dir); });

  /** 追加はそのまま、編集（✎）はパスワード確認のあとにダイアログを開く */
  const onPerson = (kind: "st" | "pt", id: number | null) =>
    id == null ? setPerson({ kind, id }) : setAuth({ run: () => setPerson({ kind, id }) });
  /** 詳細情報（給与・時給、支払い方法、分類、人件費の金額）の表示はパスワード確認が必要。非表示にするときは不要 */
  const togglePay = () => (showPay ? setShowPay(false) : setAuth({ run: () => setShowPay(true) }));
  const onVendor = (cat: string, id: number | null) => setVendor({ cat, id });
  const [yy, mm] = S.month.split("-");
  const ymLabel = `${yy}年${+mm}月`;

  const badge: Record<string, string> = {
    loading: "読み込み中…", saving: "保存中…", saved: "共有データに保存済み", error: "保存できませんでした（再試行します）",
    locked: "アクセスコードが必要です", local: "この端末だけに保存" + (note ? `（${note}）` : ""),
  };

  if (status === "loading" || status === "locked") { // 読み込みが終わるまで（サーバー側の描画とも同じ見た目）
    return (
      <main>
        <h1>日計表</h1>
        <p className="sub">{badge[status]}</p>
        {status === "locked" && <AccessDialog onSubmit={submitCode} />}
      </main>
    );
  }

  return (
    <main>
      <AlertBar />
      <div className="top">
        <h1>{S.store} 日計表　{ymLabel}</h1>
        <div className="topbtns">
          <span className={"sync sync-" + status} title="データの保存状態">{badge[status]}</span>
          <label className="topmonth">対象月
            <input type="month" value={S.month} onChange={(e) => e.target.value && update((d) => { d.month = e.target.value; })} />
          </label>
          <button className="paybtn" onClick={togglePay}>{showPay ? "詳細情報非表示" : "詳細情報表示"}</button>
        </div>
      </div>

      <Kpi S={S} c={c} />
      <section><h2>月間サマリー</h2><Summary S={S} c={c} /></section>
      <Pies S={S} c={c} />
      <Monthly S={S} showDetail={showPay} update={update} onVendor={onVendor} onMove={moveVendor} />
      <Settings S={S} c={c} update={update} />

      <section>
        <h2>日計表</h2>
        <DayTable S={S} c={c} showPay={showPay} setVal={setVal} setClosed={setClosed} onVendor={onVendor} onPerson={onPerson}
          moveVendor={moveVendor} movePerson={movePerson} />
      </section>

      {vendor && <VendorDialog key={`${vendor.cat}-${vendor.id}`} S={S} cat={vendor.cat} id={vendor.id} update={update} onClose={() => setVendor(null)} />}
      {person && <PersonDialog key={`${person.kind}-${person.id}`} S={S} kind={person.kind} id={person.id} update={update} onClose={() => setPerson(null)} />}
      {auth && <PasswordDialog S={S} update={update} onOk={() => { const f = auth.run; setAuth(null); f(); }} onClose={() => setAuth(null)} />}
    </main>
  );
}
