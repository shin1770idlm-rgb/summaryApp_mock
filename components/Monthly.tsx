import { CATS, MONTHLY_CATS, State, monthlyTotal, yen } from "@/lib/logic";
import Fold from "./Fold";
import NumInput from "./NumInput";
import { VendorName } from "./VendorName";

type Props = {
  S: State;
  showDetail: boolean;
  update: (fn: (d: State) => void) => void;
  onVendor: (cat: string, id: number | null) => void;
  onMove: (cat: string, id: number, dir: -1 | 1) => void;
};

/** 月に1回入力する経費。項目ごとに列を分けて4列で表示する（タイトルのクリックで開閉） */
export default function Monthly({ S, showDetail, update, onVendor, onMove }: Props) {
  const m = S.data[S.month];
  const setAmt = (key: string, value: string) =>
    update((d) => { const mm = d.data[d.month]; if (value === "") delete mm.monthly[key]; else mm.monthly[key] = +value; });
  return (
    <Fold title="月次の経費（月額）">
      <div className="mcols">
        {MONTHLY_CATS.map((cat) => {
          const vv = m?.vends[cat] ?? [];
          return (
            <div className="mcol" key={cat}>
              <div className="mhead">{CATS[cat]}<button className="pl" title="取引先を追加" onClick={() => onVendor(cat, null)}>＋</button></div>
              {vv.length === 0 && <div className="mnone">取引先がありません</div>}
              {vv.map((v) => (
                <div className="mrow" key={v.id}>
                  <VendorName name={v.n} sub={showDetail && v.pm ? <div className="pm">（{v.pm}）</div> : null}
                    onEdit={() => onVendor(cat, v.id)} onMove={(d) => onMove(cat, v.id, d)} />
                  <NumInput value={m.monthly[cat + "_" + v.id]} onChange={(val) => setAmt(cat + "_" + v.id, val)} />
                </div>
              ))}
              <div className="msum">合計 {yen(monthlyTotal(m, cat))}円</div>
            </div>
          );
        })}
      </div>
      <div className="mall">月額合計 {yen(monthlyTotal(m))}円</div>
    </Fold>
  );
}
