import { fmtMoney, fmtPct } from '../model/currency';
import { maxAffordableDiscount } from '../model/pricing';
import { channelRetention, hardwareUnitEconomics } from '../model/waterfall';
import type { Assumptions, ChannelKind } from '../model/types';
import type { AssumptionsApi } from '../state';
import { Card, marginTone, Pill, Slider, Stat } from '../components/ui';
import { Waterfall } from '../components/Waterfall';

/** 把某通路的折扣換成指定值後,重算毛利率 —— 用於求折扣底線 */
function marginAtDiscount(a: Assumptions, kind: ChannelKind, discount: number): number {
  const patched: Assumptions = {
    ...a,
    channels: a.channels.map((c) =>
      c.kind === kind
        ? kind === 'twoTier'
          ? { ...c, resellerDiscount: discount }
          : kind === 'marketplace'
            ? { ...c, marketplaceFeeRate: discount }
            : { ...c, distributorDiscount: discount }
        : c,
    ),
  };
  return hardwareUnitEconomics(patched, { channelKind: kind }).grossMargin;
}

export function ChannelPage({ api }: { api: AssumptionsApi }) {
  const { a, update } = api;
  const channel = a.channels.find((c) => c.kind === a.activeChannelKind)!;
  const econ = hardwareUnitEconomics(a);

  const currentDiscount =
    channel.kind === 'twoTier' ? channel.resellerDiscount
      : channel.kind === 'marketplace' ? channel.marketplaceFeeRate
        : channel.kind === 'd2c' ? 0
          : channel.distributorDiscount;

  const ceiling = maxAffordableDiscount(
    (d) => marginAtDiscount(a, channel.kind, d),
    a.targetGrossMargin,
  );

  const setDiscount = (v: number) =>
    update({
      channels: a.channels.map((c) =>
        c.kind === channel.kind
          ? channel.kind === 'twoTier'
            ? { ...c, resellerDiscount: v }
            : channel.kind === 'marketplace'
              ? { ...c, marketplaceFeeRate: v }
              : { ...c, distributorDiscount: v }
          : c,
      ),
    });

  return (
    <div className="space-y-4">
      <Card title="折扣底線" subtitle={`${channel.name} — 在 ${fmtPct(a.targetGrossMargin, 0)} 目標毛利下,最多能讓出多少`}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`rounded-lg border-2 px-4 py-3 ${ceiling > 0 ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}`}>
            <div className={`text-xs ${ceiling > 0 ? 'text-emerald-700' : 'text-red-700'}`}>最大可讓折扣</div>
            <div className={`tabular mt-1 text-3xl font-bold ${ceiling > 0 ? 'text-emerald-900' : 'text-red-900'}`}>
              {fmtPct(ceiling, 1)}
            </div>
            <div className={`mt-0.5 text-xs ${ceiling > 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {ceiling > 0 ? '超過此折扣即跌破目標毛利' : '現行成本結構下已無讓利空間'}
            </div>
          </div>
          <Stat label="目前折扣" value={fmtPct(currentDiscount)} sub={currentDiscount > ceiling ? '已超過底線' : '在底線內'} tone={currentDiscount > ceiling ? 'bad' : 'good'} />
          <Stat label="目前毛利率" value={fmtPct(econ.grossMargin)} tone={marginTone(econ.grossMargin)} sub={fmtMoney(econ.grossProfitTWD, a)} />
        </div>

        {channel.kind !== 'd2c' && (
          <div className="mt-4 max-w-md">
            <Slider
              label={channel.kind === 'marketplace' ? '平台抽成' : channel.kind === 'twoTier' ? '經銷折扣' : '總代折扣'}
              value={currentDiscount}
              onChange={setDiscount}
              min={0}
              max={0.8}
              step={0.01}
              display={fmtPct(currentDiscount)}
            />
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="價格瀑布" subtitle="MSRP 一路扣到原廠毛利">
          <Waterfall econ={econ} a={a} />
        </Card>

        <Card title="各通路並排" subtitle="同一售價在不同通路結構下的結果">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2">通路</th>
                  <th className="pb-2 text-right">留存</th>
                  <th className="pb-2 text-right">實收</th>
                  <th className="pb-2 text-right">毛利</th>
                  <th className="pb-2 text-right">毛利率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {a.channels.map((c) => {
                  const e = hardwareUnitEconomics(a, { channelKind: c.kind });
                  return (
                    <tr key={c.kind} className={c.kind === a.activeChannelKind ? 'bg-blue-50' : ''}>
                      <td className="py-1.5 text-slate-700">{c.name}</td>
                      <td className="tabular py-1.5 text-right text-slate-500">{fmtPct(channelRetention(c))}</td>
                      <td className="tabular py-1.5 text-right">{fmtMoney(e.vendorGrossTWD, a)}</td>
                      <td className={`tabular py-1.5 text-right ${e.grossProfitTWD > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {fmtMoney(e.grossProfitTWD, a)}
                      </td>
                      <td className="tabular py-1.5 text-right">{fmtPct(e.grossMargin)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            三階的「留存」只反映總代折扣。總代以折後價進貨、再讓一手給經銷,
            經銷折扣決定的是通路內部怎麼分,不會再從原廠身上扣第二次。
          </p>
        </Card>
      </div>

      <Card title="折扣敏感度" subtitle="每 5% 折扣對毛利的影響">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="pb-2">折扣</th>
                {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((d) => (
                  <th key={d} className="pb-2 text-right">{fmtPct(d, 0)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5 text-slate-600">毛利率</td>
                {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((d) => {
                  const m = marginAtDiscount(a, channel.kind === 'd2c' ? 'threeTier' : channel.kind, d);
                  return (
                    <td key={d} className={`tabular py-1.5 text-right ${m >= a.targetGrossMargin ? 'text-emerald-600' : m > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                      {fmtPct(m)}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {channel.kind === 'd2c' && <p className="mt-2 text-xs text-slate-500">D2C 無通路折扣,上表以三階結構示意。</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="good">≥ 目標毛利</Pill>
          <Pill tone="warn">有毛利但未達標</Pill>
          <Pill tone="bad">虧損</Pill>
        </div>
      </Card>
    </div>
  );
}
