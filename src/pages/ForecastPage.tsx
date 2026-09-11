import {
  Area, AreaChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { fmtCompact, fmtMoney, fmtPct, toDisplay } from '../model/currency';
import { runForecast } from '../model/forecast';
import type { AssumptionsApi } from '../state';
import { Card, Stat } from '../components/ui';

export function ForecastPage({ api }: { api: AssumptionsApi }) {
  const { a } = api;
  const f = runForecast(a);

  const chartData = f.rows.map((r) => ({
    month: r.month,
    累計損益: Math.round(toDisplay(r.cumulativeProfit, a)),
    累計現金: Math.round(toDisplay(r.cumulativeCash, a)),
    活躍訂閱: Math.round(r.activeSubs),
    月營收: Math.round(toDisplay(r.hardwareRevenue + r.subscriptionRevenue, a)),
  }));

  const ltvCacTone = f.ltvToCac >= 3 ? 'good' : f.ltvToCac >= 1 ? 'warn' : 'bad';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="36 個月累計損益"
          value={fmtCompact(f.cumulativeProfit, a)}
          tone={f.cumulativeProfit > 0 ? 'good' : 'bad'}
          sub={f.breakEvenMonth ? `第 ${f.breakEvenMonth} 月轉正` : '期間內未轉正'}
        />
        <Stat
          label="現金最低點"
          value={fmtCompact(f.minCumulativeCash, a)}
          tone={f.minCumulativeCash < 0 ? 'bad' : 'good'}
          sub={`第 ${f.minCashMonth} 月 — 需準備的營運資金`}
        />
        <Stat
          label="LTV : CAC"
          value={f.ltvToCac.toFixed(2)}
          tone={ltvCacTone}
          sub={`LTV ${fmtMoney(f.ltvTWD, a)} / CAC ${fmtMoney(f.cacTWD, a)}`}
        />
        <Stat
          label="CAC 回收"
          value={f.cacPaybackMonths === null ? '無法回收' : f.cacPaybackMonths === 0 ? '硬體即回收' : `${f.cacPaybackMonths.toFixed(1)} 個月`}
          tone={f.cacPaybackMonths === null ? 'bad' : f.cacPaybackMonths <= 12 ? 'good' : 'warn'}
          sub="硬體毛利先抵,餘額由訂閱補"
        />
      </div>

      <Card title="累計損益 vs 累計現金" subtitle="兩條線的落差就是被通路帳期與備料墊走的營運資金">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip
                formatter={(v) => fmtMoney(a.displayCurrency === 'USD' ? Number(v) * a.usdToTWD : Number(v), a)}
                labelFormatter={(l) => `第 ${l} 月`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="累計損益" stroke="#2563eb" fill="#bfdbfe" strokeWidth={2} />
              <Area type="monotone" dataKey="累計現金" stroke="#dc2626" fill="#fecaca" strokeWidth={2} fillOpacity={0.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        {f.minCumulativeCash < 0 && (
          <p className="mt-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
            現金在第 {f.minCashMonth} 月觸底 {fmtCompact(f.minCumulativeCash, a)}。
            這是硬體加訂閱模式最容易致命的地方:帳面有毛利,但備料先付、貨款
            {a.forecast.paymentTermsDays} 天後才收 —— 需要先備妥這筆營運資金。
          </p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="活躍訂閱數" subtitle={`月流失率 ${fmtPct(a.forecast.monthlyChurnRate)} 下的累積曲線`}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip labelFormatter={(l) => `第 ${l} 月`} />
                <Line type="monotone" dataKey="活躍訂閱" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="月營收" subtitle="硬體 + 訂閱合計">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                <Tooltip
                  formatter={(v) => fmtMoney(a.displayCurrency === 'USD' ? Number(v) * a.usdToTWD : Number(v), a)}
                  labelFormatter={(l) => `第 ${l} 月`}
                />
                <Line type="monotone" dataKey="月營收" stroke="#7c3aed" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="逐月明細" subtitle="每 3 個月取樣">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">月</th>
                <th className="pb-2 text-right">新增台數</th>
                <th className="pb-2 text-right">活躍訂閱</th>
                <th className="pb-2 text-right">硬體毛利</th>
                <th className="pb-2 text-right">訂閱毛利</th>
                <th className="pb-2 text-right">CAC</th>
                <th className="pb-2 text-right">當月損益</th>
                <th className="pb-2 text-right">累計損益</th>
                <th className="pb-2 text-right">累計現金</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {f.rows.filter((r) => r.month % 3 === 0).map((r) => (
                <tr key={r.month}>
                  <td className="py-1.5 text-slate-700">{r.month}</td>
                  <td className="tabular py-1.5 text-right">{Math.round(r.newUnits).toLocaleString()}</td>
                  <td className="tabular py-1.5 text-right">{Math.round(r.activeSubs).toLocaleString()}</td>
                  <td className="tabular py-1.5 text-right">{fmtCompact(r.hardwareGP, a)}</td>
                  <td className="tabular py-1.5 text-right">{fmtCompact(r.subscriptionGP, a)}</td>
                  <td className="tabular py-1.5 text-right text-red-500">−{fmtCompact(r.cac, a)}</td>
                  <td className={`tabular py-1.5 text-right ${r.netProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmtCompact(r.netProfit, a)}
                  </td>
                  <td className={`tabular py-1.5 text-right ${r.cumulativeProfit > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmtCompact(r.cumulativeProfit, a)}
                  </td>
                  <td className={`tabular py-1.5 text-right ${r.cumulativeCash > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {fmtCompact(r.cumulativeCash, a)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
