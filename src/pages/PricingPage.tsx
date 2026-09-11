import { fmtMoney, fmtPct } from '../model/currency';
import { msrpForTargetMargin } from '../model/pricing';
import { enterpriseSeatEconomics, hardwareUnitEconomics, subscriptionUnitEconomics } from '../model/waterfall';
import type { AssumptionsApi } from '../state';
import { Card, marginTone, Pill, Slider, Stat } from '../components/ui';
import { Waterfall } from '../components/Waterfall';

export function PricingPage({ api }: { api: AssumptionsApi }) {
  const { a, update } = api;
  const region = a.regions.find((r) => r.code === a.activeRegionCode)!;
  const channel = a.channels.find((c) => c.kind === a.activeChannelKind)!;

  const target = msrpForTargetMargin(a);
  const current = hardwareUnitEconomics(a);
  const enterprise = enterpriseSeatEconomics(a);

  return (
    <div className="space-y-4">
      <Card
        title="目標毛利反推售價"
        subtitle={`${region.name} · ${channel.name} — 要達到目標毛利,MSRP 應該訂多少`}
      >
        <div className="mb-4 max-w-md">
          <Slider
            label="目標毛利率"
            value={a.targetGrossMargin}
            onChange={(v) => update({ targetGrossMargin: v })}
            min={0}
            max={0.85}
            step={0.01}
            display={fmtPct(a.targetGrossMargin, 0)}
          />
        </div>

        {target.feasible ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border-2 border-blue-500 bg-blue-50 px-4 py-3">
              <div className="text-xs text-blue-700">建議 MSRP({region.localCurrency})</div>
              <div className="tabular mt-1 text-3xl font-bold text-blue-900">
                {target.msrpLocal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
              <div className="mt-0.5 text-xs text-blue-700">
                {region.taxMode === 'inclusive' ? '含稅標價' : '未稅標價(結帳另加稅)'}
              </div>
            </div>
            <Stat label="換算 TWD" value={fmtMoney(target.msrpTWD, a)} sub="建議售價" />
            <Stat label="原廠實收" value={fmtMoney(target.vendorGrossTWD, a)} sub={`通路留存 ${fmtPct(target.vendorGrossTWD / target.msrpTWD)}`} />
          </div>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>無解</strong> — {target.reason}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="現行定價的實際毛利" subtitle={`目前設定 MSRP ${a.hardwareMsrpLocal.toLocaleString()} ${region.localCurrency}`}>
          <div className="mb-3 grid grid-cols-2 gap-3">
            <Stat label="單台毛利" value={fmtMoney(current.grossProfitTWD, a)} tone={current.grossProfitTWD > 0 ? 'good' : 'bad'} />
            <Stat label="毛利率" value={fmtPct(current.grossMargin)} tone={marginTone(current.grossMargin)} />
          </div>
          <Waterfall econ={current} a={a} />
        </Card>

        <div className="space-y-4">
          <Card title="訂閱方案實際毛利" subtitle={`價格取自 A1 Portal 現行設定 · ${channel.name}`}>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2">方案</th>
                  <th className="pb-2 text-right">售價</th>
                  <th className="pb-2 text-right">毛利</th>
                  <th className="pb-2 text-right">毛利率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.plans.filter((p) => p.priceTWD > 0).map((p) => {
                  const e = subscriptionUnitEconomics(a, p);
                  return (
                    <tr key={p.id}>
                      <td className="py-1.5 text-slate-700">{p.name}</td>
                      <td className="tabular py-1.5 text-right">{fmtMoney(p.priceTWD, a)}</td>
                      <td className={`tabular py-1.5 text-right ${e.grossProfitTWD > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtMoney(e.grossProfitTWD, a)}
                      </td>
                      <td className="tabular py-1.5 text-right">{fmtPct(e.grossMargin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          <Card title="企業版每席每月">
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="每席月毛利"
                value={fmtMoney(enterprise.grossProfitTWD, a)}
                tone={enterprise.grossProfitTWD > 0 ? 'good' : 'bad'}
                sub={`售價 ${fmtMoney(a.enterprisePerSeatMonthTWD, a)}`}
              />
              <Stat label="毛利率" value={fmtPct(enterprise.grossMargin)} tone={marginTone(enterprise.grossMargin)} />
            </div>
            {enterprise.grossProfitTWD <= 0 && (
              <p className="mt-3 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                目前的每席價格來自 Portal 的 <code className="font-mono">seat_count × term_days × 100</code>,
                即 NT$1/席/天。扣掉每裝置每月的雲端、客服與情資成本
                {' '}({fmtMoney(
                  a.subscriptionCost.cloudPerDeviceMonthTWD +
                  a.subscriptionCost.supportPerDeviceMonthTWD +
                  a.subscriptionCost.intelPerDeviceMonthTWD, a)})
                {' '}與通路分潤後為負值 —— 這個數字是 POC 佔位值,不是可上市的定價。
              </p>
            )}
            <div className="mt-3">
              <Waterfall econ={enterprise} a={a} />
            </div>
          </Card>
        </div>
      </div>

      <Card title="各通路所需售價" subtitle={`在 ${fmtPct(a.targetGrossMargin, 0)} 目標毛利下,不同通路各要訂多少價`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">通路</th>
                <th className="pb-2 text-right">通路留存</th>
                <th className="pb-2 text-right">所需 MSRP</th>
                <th className="pb-2 text-right">原廠實收</th>
                <th className="pb-2 text-right">現價毛利率</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {a.channels.map((c) => {
                const t = msrpForTargetMargin(a, { channelKind: c.kind });
                const cur = hardwareUnitEconomics(a, { channelKind: c.kind });
                return (
                  <tr key={c.kind} className={c.kind === a.activeChannelKind ? 'bg-blue-50' : ''}>
                    <td className="py-1.5 text-slate-700">{c.name}</td>
                    <td className="tabular py-1.5 text-right text-slate-500">
                      {t.feasible ? fmtPct(t.vendorGrossTWD / t.msrpTWD) : '—'}
                    </td>
                    <td className="tabular py-1.5 text-right font-medium">
                      {t.feasible ? `${t.msrpLocal.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${region.localCurrency}` : <Pill tone="bad">無解</Pill>}
                    </td>
                    <td className="tabular py-1.5 text-right">{t.feasible ? fmtMoney(t.vendorGrossTWD, a) : '—'}</td>
                    <td className={`tabular py-1.5 text-right ${cur.grossMargin >= a.targetGrossMargin ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmtPct(cur.grossMargin)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
