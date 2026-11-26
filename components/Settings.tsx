import { Calc, State } from "@/lib/logic";
import Fold from "./Fold";
import NumInput from "./NumInput";

type Update = (fn: (d: State) => void) => void;

export default function Settings({ S, c, update }: { S: State; c: Calc; update: Update }) {
  const field = (k: keyof State, label: string) => (
    <label key={k}>
      {label}
      <NumInput value={S[k] as number} onChange={(v) => update((d) => { (d as unknown as Record<string, number>)[k] = +v || 0; })} />
    </label>
  );
  return (
    <>
      <Fold title="月の設定">
        <div className="one">
          {field("salesT", "月間売上目標（円・税抜）")}
          {field("custT", "月間来客目標（人）")}
          {field("unitT", "客単価目標（円・税抜）")}
          {field("foodT", "飲食原価率目標（%）")}
          {field("shokuT", "食材原価率目標（%）")}
          {field("drinkT", "飲料原価率目標（%）")}
          {field("laborT", "人件費率目標（%）")}
          {field("tax", "消費税率（%）")}
        </div>
      </Fold>

      <Fold title="勤務形態の設定">
        <div className="one one7">
          {field("minH", "社員1日最低勤務時間（時間）")}
          {field("maxOT", "社員1日最大残業時間（時間）")}
          {field("maxMOT", "社員月間最大残業時間（時間）")}
          {field("otRate", "社員残業時時給（円）")}
          {field("holPay", "休日出勤手当（円）")}
          {field("holiday", "社員公休日数（日）")}
          <label>社員合計給与（円）<NumInput readOnly value={c.totSal} onChange={() => {}} /></label>
        </div>
      </Fold>
    </>
  );
}
