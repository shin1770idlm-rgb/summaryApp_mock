import type { ReactNode } from "react";
import { Calc, State, ach, pct, yen } from "@/lib/logic";

const sign = (v: number) => (v > 0 ? "+" : "");
/** 良いときは緑(ok)、悪いときは赤(ng)。比較できないときは色なし */
const tone = (known: boolean, good: boolean) => (known ? (good ? "ok" : "ng") : "");

function Card({ title, main, mc, className, children }: { title: string; main: ReactNode; mc?: string; className?: string; children?: ReactNode }) {
  return (
    <div className={className || "sc"}>
      <div className="sl">{title}</div>
      <div className={"sv " + (mc || "")}>{main}</div>
      {children}
    </div>
  );
}
const Line = ({ children }: { children: ReactNode }) => <div className="ss">{children}</div>;

/** 原価率カード（飲食・食材・飲料で共通） */
function CostCard({ label, amt, sales, tg }: { label: string; amt: number; sales: number; tg: number }) {
  const r = sales ? amt / sales : NaN;
  const c = tone(sales > 0, r * 100 <= tg);
  const d = r * 100 - tg, e = amt - (sales * tg) / 100;
  return (
    <Card title={label} mc={c} main={`${pct(r)}（税抜 ${yen(amt)}円）`}>
      <Line>
        目標との差分 <span className={c}>{sign(d)}{Number.isFinite(r) ? d.toFixed(1) + "pt" : "–"}（税抜 {sign(e)}{yen(e)}円）</span>
      </Line>
      <Line>目標原価率 {tg}%（税抜 {yen((sales * tg) / 100)}円）</Line>
    </Card>
  );
}

/** 売上・来客・客単価：独立した領域に大きく表示 */
export function Kpi({ S, c }: { S: State; c: Calc }) {
  const t = c.t;
  const sc = tone(t.doneS > 0, t.as >= t.doneS);
  const cc = tone(t.doneC > 0, t.ac >= t.doneC);
  const uA = t.ac ? t.as / t.ac : NaN;
  const uT = t.doneC ? t.doneS / t.doneC : NaN;
  const uLy = t.doneLyc ? t.doneLy / t.doneLyc : NaN;
  const ul1 = t.doneLyc1 ? t.doneLy1 / t.doneLyc1 : NaN;
  const ul2 = t.doneLyc2 ? t.doneLy2 / t.doneLyc2 : NaN;
  const u1 = t.c1 ? ((t.g1 + t.x1) * c.tx) / t.c1 : NaN;
  const u2 = t.c2 ? ((t.g2 + t.x2) * c.tx) / t.c2 : NaN;
  const uc = tone(Number.isFinite(uT) && Number.isFinite(uA), uA >= uT);
  return (
    <div className="kpis">
      <Card className="kpi" title="売上（税抜）" mc={sc} main={`${yen(t.as)}円（${pct(ach(t.as, t.doneS))}）`}>
        <Line>日割り目標との差額 <span className={sc}>{sign(t.as - t.doneS)}{yen(t.as - t.doneS)}円</span></Line>
        <Line>目標 {yen(S.salesT)}円（{pct(t.as / S.salesT)}）</Line>
        <Line>昨年同日 {yen(t.doneLy || NaN)}円（{pct(ach(t.as, t.doneLy))}）</Line>
      </Card>
      <Card className="kpi" title="来客" mc={cc} main={`${yen(t.ac)}人（${pct(ach(t.ac, t.doneC))}）`}>
        <Line>日割り目標との差分 <span className={cc}>{sign(t.ac - t.doneC)}{yen(t.ac - t.doneC)}人</span></Line>
        <Line>目標 {yen(S.custT)}人（{pct(t.ac / S.custT)}）</Line>
        <Line>昨年同日 {yen(t.doneLyc || NaN)}人（{pct(ach(t.ac, t.doneLyc))}）</Line>
        <Line>前半 {yen(t.c1)}人（{pct(ach(t.c1, t.doneLyc1))}）　後半 {yen(t.c2)}人（{pct(ach(t.c2, t.doneLyc2))}）</Line>
      </Card>
      <Card className="kpi" title="客単価（税抜）" mc={uc} main={`${yen(uA)}円（${pct(ach(uA, uT))}）`}>
        <Line>日割り目標との差分 <span className={uc}>{sign(uA - uT)}{yen(uA - uT)}円</span></Line>
        <Line>目標 {yen(S.unitT)}円（{pct(uA / S.unitT)}）</Line>
        <Line>昨年同日 {yen(uLy)}円（{pct(ach(uA, uLy))}）</Line>
        <Line>前半 {yen(u1)}円（{pct(ach(u1, ul1))}）　後半 {yen(u2)}円（{pct(ach(u2, ul2))}）</Line>
      </Card>
    </div>
  );
}

/** 原価率・人件費率・総経費・営業利益 */
export default function Summary({ S, c }: { S: State; c: Calc }) {
  const t = c.t;
  const labor = t.ab + t.staff;
  const lr = t.as ? labor / t.as : NaN;
  const lc = tone(t.as > 0, lr * 100 <= S.laborT);
  const xc = tone(t.doneLyx > 0, t.cost <= t.doneLyx);
  const pf = t.as - t.cost, lp = t.doneLy - t.doneLyx, lh = t.doneLy > 0 && t.doneLyx > 0;
  const pcl = tone(lh, pf >= lp);
  return (
    <div className="sum">
      <CostCard label="飲食原価率" amt={t.food} sales={t.as} tg={S.foodT} />
      <CostCard label="食材原価率" amt={t.cf + t.rf} sales={t.as} tg={S.shokuT} />
      <CostCard label="飲料原価率" amt={t.cd + t.rd} sales={t.as} tg={S.drinkT} />

      <Card title="人件費率" mc={lc} main={`${pct(lr)}（${yen(labor)}円）`}>
        <Line>
          目標との差分 <span className={lc}>{sign(lr * 100 - S.laborT)}{Number.isFinite(lr) ? (lr * 100 - S.laborT).toFixed(1) + "pt" : "–"}（{sign(labor - (t.as * S.laborT) / 100)}{yen(labor - (t.as * S.laborT) / 100)}円）</span>
        </Line>
        <Line>目標 {S.laborT}%（{yen((t.as * S.laborT) / 100)}円）</Line>
        <Line>社員人件費率 {pct(t.as ? t.staff / t.as : NaN)}（{yen(t.staff)}円）</Line>
        <Line>アルバイト人件費率 {pct(t.as ? t.ab / t.as : NaN)}（{yen(t.ab)}円）</Line>
      </Card>

      <Card title="総経費" mc={xc} main={`${yen(t.cost)}円（${pct(t.as ? t.cost / t.as : NaN)}）`}>
        <Line>
          昨年同日 {yen(t.doneLyx || NaN)}円（<span className={xc}>{t.doneLyx > 0 ? `${sign(t.cost - t.doneLyx)}${yen(t.cost - t.doneLyx)}円` : "–"}</span>）
        </Line>
      </Card>

      <Card title="営業利益" mc={pcl} main={`${yen(pf)}円（${pct(t.as ? pf / t.as : NaN)}）`}>
        <Line>
          昨年同日 {lh ? <>{yen(lp)}円（<span className={pcl}>{sign(pf - lp)}{yen(pf - lp)}円</span>）</> : "–円（–）"}
        </Line>
      </Card>
    </div>
  );
}
