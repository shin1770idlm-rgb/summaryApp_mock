import { Calc, State, pct, pieData, yen } from "@/lib/logic";
import Fold from "./Fold";

const COLORS = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948", "#b07aa1", "#ff9da7", "#9c755f", "#8c8c8c", "#2f4b7c", "#a05195"];
type Item = { k: string; v: number };

/** 円グラフ。大きいスライスは円の中に「分類」と金額、小さいスライスは線を引いて円の外に表示する */
function Pie({ title, data, denom }: { title: string; data: Item[]; denom?: number }) {
  const total = data.reduce((q, x) => q + x.v, 0);
  const den = denom || total;
  const W = 440, H = 300, cx = W / 2, cy = H / 2, R = 80, GAP = 25;
  let ang = -Math.PI / 2;
  const slices = data.map((x, i) => {
    const a0 = ang, a1 = ang + (x.v / total) * Math.PI * 2;
    ang = a1;
    const mid = (a0 + a1) / 2, big = a1 - a0 > Math.PI ? 1 : 0;
    const pt = (a: number, r: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
    return {
      ...x, i, mid, color: COLORS[i % COLORS.length], share: x.v / total, full: data.length === 1,
      pct: pct(x.v / den),
      d: `M ${cx} ${cy} L ${pt(a0, R)} A ${R} ${R} 0 ${big} 1 ${pt(a1, R)} Z`,
      inside: false, // 項目・金額・割合はすべて円の外に出す
    };
  });
  // 円の外に出すラベル（左右に分け、重ならないよう縦にずらす）
  const outer = slices.filter((s) => !s.inside).map((s) => ({
    s, side: Math.cos(s.mid) >= 0 ? 1 : -1, y: cy + (R + 14) * Math.sin(s.mid),
  }));
  ([1, -1] as const).forEach((side) => {
    const L = outer.filter((o) => o.side === side).sort((a, b) => a.y - b.y);
    L.forEach((o, i) => { o.y = Math.max(o.y, 14, i > 0 ? L[i - 1].y + GAP : 0); });
    for (let i = L.length - 1; i >= 0; i--) {
      if (L[i].y > H - 14) L[i].y = H - 14;
      if (i < L.length - 1 && L[i].y > L[i + 1].y - GAP) L[i].y = L[i + 1].y - GAP;
    }
  });
  return (
    <div className="pie">
      <div className="sl">{title}</div>
      {total <= 0 ? (
        <div className="ss">データがありません</div>
      ) : (
        <svg className="pie-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
          {slices.map((s) => (s.full
            ? <circle key={s.k} cx={cx} cy={cy} r={R} fill={s.color} />
            : <path key={s.k} d={s.d} fill={s.color} stroke="#fff" strokeWidth="1"><title>{`${s.k} ${yen(s.v)}円`}</title></path>))}
          {outer.map(({ s, side, y }) => {
            const x0 = cx + R * Math.cos(s.mid), y0 = cy + R * Math.sin(s.mid);
            const x1 = cx + (R + 10) * Math.cos(s.mid), y1 = cy + (R + 10) * Math.sin(s.mid);
            const x2 = cx + side * (R + 30); // ラベルは円の外側の列にそろえる（円に重ならないように）
            return (
              <g key={s.k}>
                <polyline points={`${x0},${y0} ${x1},${y1} ${x2},${y} ${x2 + side * 3},${y}`} fill="none" stroke="#8a93a3" strokeWidth="1" />
                <text x={x2 + side * 6} y={y} textAnchor={side === 1 ? "start" : "end"} fontSize="10.5" fontWeight="400" fill="currentColor">
                  <tspan x={x2 + side * 6} dy="-0.2em">{s.k}</tspan>
                  <tspan x={x2 + side * 6} dy="1.2em">{yen(s.v)}円（{s.pct}）</tspan>
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/** 売上に対する、それぞれの経費の割合（月次の経費を含む）。残りは営業利益 */
function ExpensePie({ c }: { c: Calc }) {
  const t = c.t;
  const parts: Item[] = [
    { k: "食材", v: t.cf + t.rf }, { k: "飲料", v: t.cd + t.rd }, { k: "消耗品", v: t.cs },
    { k: "店舗衛生", v: t.ch }, { k: "その他", v: t.co + t.ro },
    { k: "社員人件費", v: t.staff }, { k: "アルバイト人件費", v: t.ab },
    { k: "固定費", v: t.fx }, { k: "光熱費", v: t.ut }, { k: "広告費", v: t.ad }, { k: "店舗衛生管理費", v: t.hm },
  ].filter((x) => x.v > 0);
  const profit = t.as - t.cost;
  if (profit > 0) parts.push({ k: "営業利益", v: profit });
  return <Pie title={`売上（税抜）${yen(t.as)}円に対する割合`} data={parts} denom={t.as} />;
}

/** 売上に対する経費の割合と、食材・飲料それぞれの仕入れの分類別内訳（タイトルのクリックで開閉） */
export default function Pies({ S, c }: { S: State; c: Calc }) {
  const food = pieData(S, "food"), drink = pieData(S, "drink");
  const sum = (d: Item[]) => d.reduce((q, x) => q + x.v, 0);
  return (
    <Fold title="円グラフ（経費の割合・仕入れの分類別内訳）">
      <div className="pies3">
        <ExpensePie c={c} />
        <Pie title={`仕入れの分類別内訳：食材（合計 ${yen(sum(food))}円）`} data={food} />
        <Pie title={`仕入れの分類別内訳：飲料（合計 ${yen(sum(drink))}円）`} data={drink} />
      </div>
    </Fold>
  );
}
