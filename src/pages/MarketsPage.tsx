import { compliancePerUnit } from '../model/cogs';
import { fmtMoney, fmtPct } from '../model/currency';
import { msrpForTargetMargin } from '../model/pricing';
import { hardwareUnitEconomics } from '../model/waterfall';
import type { AssumptionsApi } from '../state';
import { Card, marginTone, Pill } from '../components/ui';

export function MarketsPage({ api }: { api: AssumptionsApi }) {
  const { a, update } = api;
  const channel = a.channels.find((c) => c.kind === a.activeChannelKind)!;

  // 等值定價:以目前市場的售價換算成 TWD 當基準,再換回各地當地幣。
  // 若直接把同一個數字(2,000)當成各地當地幣售價,等於在英國賣 2,000 英鎊、
  // 在越南賣 2,000 越南盾 —— 比較結果會完全失去意義。
  const activeRegion = a.regions.find((r) => r.code === a.activeRegionCode)!;
  const baseTWD = a.hardwareMsrpLocal * activeRegion.fxToTWD;

  const rows = a.regions
    .map((r) => {
      const msrpLocal = baseTWD / r.fxToTWD;
      const econ = hardwareUnitEconomics(a, { regionCode: r.code, msrpLocal });
      const target = msrpForTargetMargin(a, { regionCode: r.code });
      return { r, econ, target, msrpLocal, compliance: compliancePerUnit(r, a) };
    })
    .sort((x, y) => y.econ.grossProfitTWD - x.econ.grossProfitTWD);

  const best = rows[0];
  const worst = rows[rows.length - 1];

  return (
    <div className="space-y-4">
      <Card
        title="市場進入比較"
        subtitle={`等值定價 ${fmtMoney(baseTWD, a)} · ${channel.name} · 依單台毛利排序`}
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border-2 border-emerald-500 bg-emerald-50 px-4 py-3">
            <div className="text-xs text-emerald-700">毛利最高</div>
            <div className="mt-1 text-2xl font-bold text-emerald-900">{best.r.name}</div>
            <div className="tabular mt-0.5 text-xs text-emerald-700">
              {fmtMoney(best.econ.grossProfitTWD, a)} / 台 · {fmtPct(best.econ.grossMargin)}
            </div>
          </div>
          <div className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-600">毛利最低</div>
            <div className="mt-1 text-2xl font-bold text-slate-800">{worst.r.name}</div>
            <div className="tabular mt-0.5 text-xs text-slate-600">
              {fmtMoney(worst.econ.grossProfitTWD, a)} / 台 · {fmtPct(worst.econ.grossMargin)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">市場</th>
                <th className="pb-2 text-right">當地售價</th>
                <th className="pb-2">稅制</th>
                <th className="pb-2 text-right">稅率</th>
                <th className="pb-2 text-right">關稅</th>
                <th className="pb-2 text-right">原廠實收</th>
                <th className="pb-2 text-right">稅</th>
                <th className="pb-2 text-right">金流</th>
                <th className="pb-2 text-right">合規攤提</th>
                <th className="pb-2 text-right">單台毛利</th>
                <th className="pb-2 text-right">毛利率</th>
                <th className="pb-2 text-right">達標售價</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ r, econ, target, msrpLocal, compliance }) => (
                <tr
                  key={r.code}
                  className={`cursor-pointer hover:bg-slate-50 ${r.code === a.activeRegionCode ? 'bg-blue-50' : ''}`}
                  onClick={() => update({ activeRegionCode: r.code })}
                >
                  <td className="py-1.5">
                    <span className="font-medium text-slate-800">{r.name}</span>
                    <span className="ml-1 text-slate-400">{r.localCurrency}</span>
                  </td>
                  <td className="tabular py-1.5 text-right text-slate-600">
                    {msrpLocal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-1.5">
                    {r.taxMode === 'inclusive'
                      ? <Pill>內含</Pill>
                      : <Pill tone="warn">外加</Pill>}
                  </td>
                  <td className="tabular py-1.5 text-right">{fmtPct(r.taxRate, 0)}</td>
                  <td className="tabular py-1.5 text-right text-slate-500">
                    {r.importDutyRate > 0 ? `${fmtPct(r.importDutyRate, 0)} ${r.tradeTerm}` : '—'}
                  </td>
                  <td className="tabular py-1.5 text-right">{fmtMoney(econ.vendorGrossTWD, a)}</td>
                  <td className="tabular py-1.5 text-right text-red-500">
                    {econ.taxTWD > 0 ? `−${fmtMoney(econ.taxTWD, a)}` : '代收'}
                  </td>
                  <td className="tabular py-1.5 text-right text-red-500">−{fmtMoney(econ.paymentFeeTWD, a)}</td>
                  <td className="tabular py-1.5 text-right text-red-500">
                    {compliance > 0 ? `−${fmtMoney(compliance, a)}` : '—'}
                  </td>
                  <td className={`tabular py-1.5 text-right font-medium ${econ.grossProfitTWD > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmtMoney(econ.grossProfitTWD, a)}
                  </td>
                  <td className={`tabular py-1.5 text-right ${marginTone(econ.grossMargin) === 'good' ? 'text-emerald-600' : marginTone(econ.grossMargin) === 'warn' ? 'text-amber-600' : 'text-red-600'}`}>
                    {fmtPct(econ.grossMargin)}
                  </td>
                  <td className="tabular py-1.5 text-right text-slate-600">
                    {target.feasible
                      ? `${target.msrpLocal.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                      : <Pill tone="bad">無解</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          各市場採<strong>等值定價</strong>:以 {activeRegion.name} 的 {a.hardwareMsrpLocal.toLocaleString()} {activeRegion.localCurrency}
          ({fmtMoney(baseTWD, a)})為基準換算成當地幣,因此毛利差異來自稅制、金流、關稅與合規成本,而非定價高低。
          點一列即可切換為目前分析市場;「達標售價」為當地幣,對應目標毛利 {fmtPct(a.targetGrossMargin, 0)}。
        </p>
      </Card>

      <Card title="隱藏成本:當地稅籍登記" subtitle="小量進入新市場時,合規攤提常比關稅更傷">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {a.regions.filter((r) => r.needsTaxRegistration).map((r) => {
            const per = compliancePerUnit(r, a);
            const pct = baseTWD > 0 ? per / baseTWD : 0;
            return (
              <div key={r.code} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-800">{r.name}</span>
                  <span className={`tabular text-xs ${pct > 0.05 ? 'text-red-600' : 'text-slate-500'}`}>
                    {fmtPct(pct)} of MSRP
                  </span>
                </div>
                <div className="tabular mt-1 text-xs text-slate-600">
                  年 {fmtMoney(r.annualComplianceCostTWD, a)} → 每台 {fmtMoney(per, a)}
                </div>
                {r.note && <div className="mt-1 text-xs text-slate-400">{r.note}</div>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          攤提分母採用預測參數的年銷量({(a.forecast.startingUnitsPerMonth * 12).toLocaleString()} 台)。
          銷量越低,每台要背的合規成本越高 —— 這是「先進一個市場試水溫」最常被低估的一項。
        </p>
      </Card>
    </div>
  );
}
