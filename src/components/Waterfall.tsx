import { fmtMoney } from '../model/currency';
import type { Assumptions, UnitEconomics } from '../model/types';

/**
 * 價格瀑布。用純 CSS 長條而非圖表庫:每一階的「扣掉多少」與「還剩多少」要能同時讀,
 * 一般 bar chart 只能表達其中一個。
 */
export function Waterfall({ econ, a }: { econ: UnitEconomics; a: Assumptions }) {
  const start = econ.steps[0]?.running ?? 0;
  const scale = start > 0 ? start : 1;

  return (
    <div className="space-y-1.5">
      {econ.steps.map((s, i) => {
        const isResult = s.kind === 'result';
        const isStart = s.kind === 'start';
        const barPct = Math.max(0, Math.min(100, (Math.abs(s.running) / scale) * 100));
        const cutPct = Math.max(0, Math.min(100, (Math.abs(s.amount) / scale) * 100));
        const skipped = !isStart && !isResult && Math.abs(s.amount) < 0.005;

        return (
          <div key={`${s.label}-${i}`} className={skipped ? 'opacity-40' : ''}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className={isResult ? 'font-semibold text-slate-900' : 'text-slate-600'}>
                {s.label}
                {s.hint && <span className="ml-1.5 text-slate-400">{s.hint}</span>}
              </span>
              <span className="flex shrink-0 items-baseline gap-3">
                {!isStart && !isResult && (
                  <span className="tabular text-red-500">−{fmtMoney(Math.abs(s.amount), a)}</span>
                )}
                <span
                  className={`tabular w-24 text-right ${
                    isResult
                      ? s.running >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'
                      : 'text-slate-900'
                  }`}
                >
                  {fmtMoney(s.running, a)}
                </span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-100">
              <div className="flex h-full">
                <div
                  className={`h-full ${
                    isResult
                      ? s.running >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                      : isStart ? 'bg-slate-700' : 'bg-blue-500'
                  }`}
                  style={{ width: `${barPct}%` }}
                />
                {!isStart && !isResult && (
                  <div className="h-full bg-red-300" style={{ width: `${cutPct}%` }} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
