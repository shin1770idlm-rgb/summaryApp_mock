import { useEffect, useRef, useState, type ReactNode } from "react";
import { CATS, Calc, DOW, PM_CATS, State, ach, hn, pct, yen } from "@/lib/logic";
import NumInput from "./NumInput";
import { VendorName } from "./VendorName";

type Row = {
  sp?: boolean;                 // 空白の区切り行
  label?: ReactNode | null;     // 左の結合セル（nullなら出さない）
  rs?: number;                  // 結合する行数
  vt?: boolean;                 // 縦書きにする
  l2?: ReactNode | null;        // 取引先名・氏名などの列（null なら出さない＝上のセルが結合している）
  rs2?: number;                 // l2 を結合する行数
  l3?: ReactNode;               // l2 の右の小さい列（「勤務時間」「休憩時間」など、行の名前）
  g?: boolean;                  // 上に区切り線
  bk?: "top" | "mid" | "bot" | "one"; // 分類ごとの枠（上端・途中・下端・1行だけ）
  cell?: (r: any) => ReactNode; // eslint-disable-line @typescript-eslint/no-explicit-any
  tot?: ReactNode;              // 一番右（月合計）の列
};

type Props = {
  S: State; c: Calc; showPay: boolean;
  setVal: (day: number, key: string, value: string) => void;
  setClosed: (day: number, closed: boolean) => void;
  onVendor: (cat: string, id: number | null) => void;
  onPerson: (kind: "st" | "pt", id: number | null) => void;
  moveVendor: (cat: string, id: number, dir: -1 | 1) => void;
  movePerson: (kind: "st" | "pt", id: number, dir: -1 | 1) => void;
};

/** 縦書き風に、1文字ずつ縦に積む（フォントに依存せず、どの環境でも同じ見た目になる）。括弧は縦書き用の字形にする */
const VCH: Record<string, string> = { "（": "︵", "）": "︶", "(": "︵", ")": "︶" };
const vtext = (s: string) => <span className="vchars" role="img" aria-label={s}>{[...s].map((ch, i) => <span key={i}>{VCH[ch] ?? ch}</span>)}</span>;

// 列の幅(px)。固定して、1日〜8日が横スクロールなしで入るようにする
const COL_L1 = 24, COL_L2A = 78, COL_L2B = 46, COL_L2 = COL_L2A + COL_L2B, COL_DAY = 110, COL_TOT = 84;

const wk = (w: number) => (w === 0 ? "sun" : w === 6 ? "sat" : "");
const okp = (v: number) => (Number.isFinite(v) ? <span className={v >= 1 ? "ok" : "ng"}>{pct(v)}</span> : "–");

export default function DayTable({ S, c, showPay, setVal, setClosed, onVendor, onPerson, moveVendor, movePerson }: Props) {
  const t = c.t, mo = +S.month.split("-")[1], month = S.data[S.month];
  const x = (r: any, k: string) => +r.a[k] || 0; // eslint-disable-line @typescript-eslint/no-explicit-any
  const sumKey = (k: string) => c.rows.reduce((s, r) => s + (+r.a[k] || 0), 0);

  const inp = (r: any, k: string, cls?: string) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
    <NumInput className={cls} value={r.a[k] as number | string | undefined} onChange={(v) => setVal(r.d, k, v)} />
  );
  /** 前半・後半を横に並べた入力欄（pays があれば、その下に給与を出す） */
  const pair = (r: any, k1: string, k2: string, _step?: string, pays?: [number, number]) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
    <>{([[k1, "前半"], [k2, "後半"]] as const).map(([k, cap], i) => (
      <span key={k} className="hp"><i>{cap}</i>{inp(r, k, "h")}{pays && <b className="pay">{yen(pays[i])}円</b>}</span>
    ))}</>
  );
  /** 前半・後半の入力欄だけ（見出しは別の行に出す）。pays があれば、その下に給与を出す */
  const bare = (r: any, k1: string, k2: string, pays?: [number, number]) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
    <>{[k1, k2].map((k, i) => <span key={k} className="hp">{inp(r, k, "h")}{pays && <b className="pay">{yen(pays[i])}円</b>}</span>)}</>
  );
  const capCells = () => <><span className="hp cap">前半</span><span className="hp cap">後半</span></>;
  /** 昨年同日（保存済みの昨年データ）を、前半・後半の数値だけで表示する */
  const lyPair = (r: any, k1: string, k2: string) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
    <>{([[k1, "前半"], [k2, "後半"]] as const).map(([k, cap]) => (
      <span key={k} className="hp"><i>{cap}</i><b className="u">{r.hasLy ? yen(r[k]) : "–"}</b></span>
    ))}</>
  );
  const lyTot = (k1: string, k2: string) => (c.hasLy ? `${yen(t[k1])} / ${yen(t[k2])}` : "–");
  const mv = (on: (d: -1 | 1) => void) => (
    <span className="mvs"><button className="mv" title="上へ" onClick={() => on(-1)}>▲</button><button className="mv" title="下へ" onClick={() => on(1)}>▼</button></span>
  );
  const C = (label: string, cell: (r: any) => ReactNode, tot: ReactNode, g?: boolean): Row => ({ label, cell, tot, g }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const H = (label: string, k1: string, k2: string): Row => ({ label, cell: (r) => pair(r, k1, k2), tot: `${yen(t[k1])} / ${yen(t[k2])}` });
  const I = (label: string, k: string): Row => ({ label, cell: (r) => inp(r, k), tot: yen(t[k]) });

  /** 枠で囲むための印を付ける */
  const boxed = (rows: Row[]): Row[] => rows.map((r, i) => ({ ...r, bk: rows.length === 1 ? "one" : i === 0 ? "top" : i === rows.length - 1 ? "bot" : "mid" }));

  /** 取引先ごとに行を持つ経費ブロック（左の結合セルに項目名と＋ボタン） */
  const block = (cat: string): Row[] => {
    const vv = month?.vends[cat] ?? [];
    const withPm = PM_CATS.includes(cat);
    const out: Row[] = [
      ...vv.map((v): Row => {
        const tag = [withPm ? v.pm : "", v.cls].filter(Boolean).join("・"); // 支払い方法・分類は詳細情報表示のときだけ
        return {
          label: null,
          l2: <VendorName name={v.n} sub={showPay && tag ? <div className="pm">（{tag}）</div> : null}
            onEdit={() => onVendor(cat, v.id)} onMove={(d) => moveVendor(cat, v.id, d)} />,
          cell: (r) => inp(r, cat + "_" + v.id), tot: yen(sumKey(cat + "_" + v.id)),
        };
      }),
      { label: null, l2: "合計", cell: (r) => yen(r[cat]), tot: yen(t[cat]) },
    ];
    out[0] = { ...out[0], label: <>{vtext(CATS[cat])}<button className="pl" title="取引先を追加" onClick={() => onVendor(cat, null)}>＋</button></>, vt: true, rs: out.length, g: true };
    return boxed(out);
  };

  /** 社員勤怠・アルバイト勤怠ブロック（給与・時給・人件費の金額は「詳細情報表示」を押したときだけ出す） */
  const labor = (kind: "st" | "pt"): Row[] => {
    const L = kind === "st" ? S.staffs : S.parts, pre = kind === "st" ? "s" : "p";
    const key = kind === "st" ? "staff" : "ab", nm = kind === "st" ? "社員人件費" : "アルバイト人件費";
    const out: Row[] = [
      { label: null, l2: "氏名", cell: () => "", tot: "" },
      ...L.flatMap((m): Row[] => {
        const q = (kind === "st" ? c.st[m.id] : c.pt[m.id]) as { h: number; cost: number; rest: number; ot?: number; d?: number };
        const fk = pre + m.id + "f", bk = pre + m.id + "b", rk = pre + m.id + "rf", rb = pre + m.id + "rb";
        // 氏名のセルを3行ぶん結合し、その右に「前半・後半」「勤務時間」「休憩時間」の3行を並べる
        const name = <VendorName stacked name={m.n} editTitle="編集（パスワードが必要です）" onEdit={() => onPerson(kind, m.id)} onMove={(d) => movePerson(kind, m.id, d)}
          sub={showPay ? <div className="pay">{kind === "st" ? `給与 ${yen(m.sal || 0)}円` : `時給 ${yen(m.w || 0)}円`}</div> : null} />;
        return [
          { label: null, l2: name, rs2: 3, l3: "", cell: capCells, tot: "" },
          {
            label: null, l2: null, l3: "勤務時間",
            cell: (r) => kind === "st"
              ? <>{bare(r, fk, bk)}{showPay && <div className="pay">{yen(r.sc[m.id] || 0)}円</div>}</>
              : bare(r, fk, bk, showPay ? [r.pcs[m.id]?.f || 0, r.pcs[m.id]?.b || 0] : undefined),
            tot: <>
              <div>勤務時間 {hn(q.h)}h</div>
              {kind === "st" && <><div>残業時間 {hn(q.ot ?? 0)}h</div><div>出勤日数 {q.d ?? 0}日</div></>}
              {showPay && <div className="pay">給与 {yen(q.cost)}円</div>}
            </>,
          },
          { label: null, l2: null, l3: "休憩時間", cell: (r) => bare(r, rk, rb), tot: <div>休憩時間 {hn(q.rest)}h</div> },
        ];
      }),
      ...(showPay ? [{ label: null, l2: nm, cell: (r: any) => yen(r[key]), tot: yen(t[key]) } as Row] : []), // eslint-disable-line @typescript-eslint/no-explicit-any
      { label: null, l2: nm + "率", cell: (r) => pct(r.as ? r[key] / r.as : NaN), tot: pct(t.as ? t[key] / t.as : NaN) },
    ];
    out[0] = { ...out[0], label: <>{vtext(kind === "st" ? "社員勤怠" : "アルバイト勤怠")}<button className="pl" title="追加" onClick={() => onPerson(kind, null)}>＋</button></>, vt: true, rs: out.length, g: true };
    return boxed(out);
  };

  /** 客単価：目標（客単価目標・税抜）以上なら緑、下回れば赤 */
  const uc = (v: number) => (Number.isFinite(v) ? (v >= S.unitT ? "ok" : "ng") : "");
  const uval = (v: number) => <span className={uc(v)}>{yen(v)}</span>;
  const unit = (r: any, a: string, b: string, cc: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const v = x(r, cc) ? ((x(r, a) + x(r, b)) * c.tx) / x(r, cc) : NaN;
    return <span className="hp"><i>{cc === "c1" ? "前半" : "後半"}</i><b className="u">{uval(v)}</b></span>;
  };
  /** 率を目標と比べ、超えたら赤、以内なら緑 */
  const rate = (v: number, has: boolean, tg: number) => (Number.isFinite(v) && has ? <span className={v * 100 <= tg ? "ok" : "ng"}>{pct(v)}</span> : pct(v));
  const lyHalf = (label: string, k1: string, k2: string): Row => ({ label, cell: (r) => lyPair(r, k1, k2), tot: lyTot(k1, k2) });
  const lyTotal = (label: string, f: (r: any) => number, tot: number): Row => ({ label, cell: (r) => (r.hasLy ? yen(f(r)) : "–"), tot: c.hasLy ? yen(tot) : "–" }); // eslint-disable-line @typescript-eslint/no-explicit-any
  const lyUnit = (r: any, a: string, b: string, cap: string) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
    <span key={cap} className="hp"><i>{cap}</i><b className="u">{r.hasLy && r[b] ? yen(r[a] / r[b]) : "–"}</b></span>
  );
  const half = (r: any, a: string, b: string, cap: string) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
    <span key={cap} className="hp"><i>{cap}</i><b className="u">{yen(x(r, a) + x(r, b))}</b></span>
  );

  const sp: Row = { sp: true };
  const joined = (cats: string[]): Row[] => cats.flatMap((cat, i) => (i ? [sp, ...block(cat)] : block(cat)));
  const tu1 = t.c1 ? ((t.g1 + t.x1) * c.tx) / t.c1 : NaN, tu2 = t.c2 ? ((t.g2 + t.x2) * c.tx) / t.c2 : NaN;

  const rows: Row[] = [
    C("目標来客", (r) => (r.cl ? "休" : yen(r.tC)), yen(t.tC), true),
    { label: "来客", cell: (r) => pair(r, "c1", "c2"), tot: `${yen(t.c1)} / ${yen(t.c2)}` },
    C("実績来客", (r) => yen(r.ac), yen(t.ac)),
    C("来客達成率", (r) => okp(ach(r.ac, r.tC)), okp(ach(t.ac, t.doneC))),
    lyHalf("昨年来客", "lyc1", "lyc2"),
    lyTotal("昨年来客計", (r) => r.lyc, t.lyc),
    C("昨年来客対比", (r) => okp(ach(r.ac, r.lyc)), okp(ach(t.ac, t.doneLyc))),
    C("目標売上(税抜)", (r) => (r.cl ? "休" : yen(r.tS)), yen(t.tS), true),
    H("現計(税込)", "g1", "g2"), H("信計(税込)", "x1", "x2"),
    { label: "売上計(税込)", cell: (r) => <>{half(r, "g1", "x1", "前半")}{half(r, "g2", "x2", "後半")}</>, tot: `${yen(t.g1 + t.x1)} / ${yen(t.g2 + t.x2)}` },
    I("外売り(税込)", "o"),
    C("実績売上(税抜)", (r) => yen(r.as), yen(t.as)),
    C("売上達成率", (r) => okp(ach(r.as, r.tS)), okp(ach(t.as, t.doneS))),
    lyHalf("昨年売上(税抜)", "ly1", "ly2"),
    lyTotal("昨年売上計", (r) => r.ly, t.ly),
    C("昨年売上対比", (r) => okp(ach(r.as, r.ly)), okp(ach(t.as, t.doneLy))),
    C("客単価(税抜)", (r) => uval(r.ac && r.as ? r.as / r.ac : NaN), uval(t.ac ? t.as / t.ac : NaN), true),
    C("詳細客単価", (r) => <>{unit(r, "g1", "x1", "c1")}{unit(r, "g2", "x2", "c2")}</>, <>{uval(tu1)} / {uval(tu2)}</>),
    { label: "昨年客単価", cell: (r) => <>{lyUnit(r, "ly1", "lyc1", "前半")}{lyUnit(r, "ly2", "lyc2", "後半")}</>,
      tot: c.hasLy ? `${yen(t.lyc1 ? t.ly1 / t.lyc1 : NaN)} / ${yen(t.lyc2 ? t.ly2 / t.lyc2 : NaN)}` : "–" },
    lyTotal("昨年客単価計", (r) => (r.lyc ? r.ly / r.lyc : NaN), t.lyc ? t.ly / t.lyc : NaN),
    C("現金経費計", (r) => yen(r.out), yen(t.out), true),
    C("現金売上(税込)", (r) => yen(r.cash), yen(t.cash)),
    C("送金金額", (r) => yen(r.remit), yen(t.remit)),
    sp,
    ...joined(["cf", "cd", "cs", "ch", "co"]),
    sp,
    ...joined(["rf", "rd", "ro"]),
    sp,
    C("当日飲食原価率", (r) => rate(r.as ? r.food / r.as : NaN, r.as > 0, S.foodT), rate(t.as ? t.food / t.as : NaN, t.as > 0, S.foodT)),
    sp,
    ...labor("st"),
    sp,
    ...labor("pt"),
    ...(showPay ? [C("人件費計", (r) => yen(r.staff + r.ab), yen(t.staff + t.ab), true)] : []),
    C("人件費率", (r) => rate(r.as ? (r.staff + r.ab) / r.as : NaN, r.as > 0, S.laborT), rate(t.as ? (t.staff + t.ab) / t.as : NaN, t.as > 0, S.laborT), !showPay),
  ];

  const head = (label: string, cell: (r: any) => ReactNode, isDate = true) => ( // eslint-disable-line @typescript-eslint/no-explicit-any
    <tr><th colSpan={3} className={isDate ? "dh" : undefined}>{label}</th>
      {c.rows.map((r) => <th key={r.d} className={(isDate ? "dh " : "") + wk(r.w)}>{cell(r)}</th>)}
      <th className="tot">{label === "日付" ? "月合計" : ""}</th></tr>
  );

  // 表の上にも横スクロールバーを出す（下のバーと同期）
  const topRef = useRef<HTMLDivElement>(null);
  const botRef = useRef<HTMLDivElement>(null);
  const tblRef = useRef<HTMLTableElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = tblRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.scrollWidth));
    ro.observe(el);
    setW(el.scrollWidth);
    return () => ro.disconnect();
  }, []);
  const sync = (from: "top" | "bot") => () => {
    const a = from === "top" ? topRef.current : botRef.current, b = from === "top" ? botRef.current : topRef.current;
    if (a && b && b.scrollLeft !== a.scrollLeft) b.scrollLeft = a.scrollLeft;
  };

  return (
    <div className="tblbox">
      <div className="topscroll" ref={topRef} onScroll={sync("top")}><div style={{ width: w, height: 1 }} /></div>
      <div className="wrap" ref={botRef} onScroll={sync("bot")}>
        <table ref={tblRef} style={{ tableLayout: "fixed", width: COL_L1 + COL_L2 + COL_DAY * c.rows.length + COL_TOT }}>
          <colgroup>
            <col style={{ width: COL_L1 }} /><col style={{ width: COL_L2A }} /><col style={{ width: COL_L2B }} />
            {c.rows.map((r) => <col key={r.d} style={{ width: COL_DAY }} />)}
            <col style={{ width: COL_TOT }} />
          </colgroup>
          <thead>
            {head("日付", (r) => `${mo}/${r.d}`)}
            {head("曜日", (r) => DOW[r.w])}
            {head("店休日", (r) => <input type="checkbox" checked={r.cl} onChange={(e) => setClosed(r.d, e.target.checked)} />, false)}
            {head("天候", (r) => (
              <select value={(r.a.w as string) ?? ""} onChange={(e) => setVal(r.d, "w", e.target.value)}>
                {["", "晴れ", "曇り", "雨", "雪"].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ), false)}
          </thead>
          <tbody>
            {rows.map((s, i) =>
              s.sp ? (
                <tr key={i} className="sp"><th colSpan={c.rows.length + 4} /></tr>
              ) : (
                <tr key={i} className={[s.g ? "grp" : "", s.bk ? "bk bk-" + s.bk : ""].filter(Boolean).join(" ") || undefined}>
                  {s.l2 !== undefined ? (
                    <>
                      {s.label !== null && <th rowSpan={s.rs || 1} className={s.vt ? "vt" : undefined}>{s.label}</th>}
                      {s.l2 !== null && <th className="v2" colSpan={s.l3 !== undefined ? 1 : 2} rowSpan={s.rs2 || 1}>{s.l2}</th>}
                      {s.l3 !== undefined && <th className="v3">{s.l3}</th>}
                    </>
                  ) : (
                    <th colSpan={3}>{s.label}</th>
                  )}
                  {c.rows.map((r) => <td key={r.d} className={wk(r.w)}>{s.cell?.(r)}</td>)}
                  <td className="tot">{s.tot}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
