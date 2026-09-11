import { useState } from 'react';
import { AssumptionsPanel } from './components/AssumptionsPanel';
import { ArchitecturePage } from './pages/ArchitecturePage';
import { ChannelPage } from './pages/ChannelPage';
import { ForecastPage } from './pages/ForecastPage';
import { MarketsPage } from './pages/MarketsPage';
import { PricingPage } from './pages/PricingPage';
import { useAssumptions } from './state';
import type { ChannelKind } from './model/types';

type Tab = 'pricing' | 'channel' | 'markets' | 'forecast' | 'architecture';

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'pricing', label: '定價決策', hint: 'MSRP 該訂多少' },
  { id: 'channel', label: '通路折扣底線', hint: '最多能讓幾 %' },
  { id: 'markets', label: '市場進入比較', hint: '先進哪個國家' },
  { id: 'forecast', label: '3 年財務預測', hint: '現金夠不夠' },
  { id: 'architecture', label: '訂閱架構設計', hint: '定價結構從哪來' },
];

export default function App() {
  const api = useAssumptions();
  const { a, update, saveScenario, loadScenario, deleteScenario, scenarioNames, reset } = api;
  const [tab, setTab] = useState<Tab>('pricing');
  const [panelOpen, setPanelOpen] = useState(true);
  const [scenarioName, setScenarioName] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1600px] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold">A-1 通路利潤試算機</h1>
              <p className="text-xs text-slate-500">硬體 + 訂閱 · 多階通路 · 金流手續費 · 海外稅制</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={a.activeRegionCode}
                onChange={(e) => update({ activeRegionCode: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                {a.regions.map((r) => (
                  <option key={r.code} value={r.code}>{r.name}</option>
                ))}
              </select>

              <select
                value={a.activeChannelKind}
                onChange={(e) => update({ activeChannelKind: e.target.value as ChannelKind })}
                className="rounded border border-slate-300 px-2 py-1.5 text-sm"
              >
                {a.channels.map((c) => (
                  <option key={c.kind} value={c.kind}>{c.name}</option>
                ))}
              </select>

              <div className="flex overflow-hidden rounded border border-slate-300">
                {(['TWD', 'USD'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update({ displayCurrency: c })}
                    className={`px-3 py-1.5 text-sm ${a.displayCurrency === c ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {panelOpen ? '隱藏假設' : '顯示假設'}
              </button>
            </div>
          </div>

          <nav className="mt-3 flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-t border-b-2 px-3 py-2 text-sm transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 font-medium text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
                <span className="ml-1.5 hidden text-xs text-slate-400 sm:inline">{t.hint}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1600px] gap-4 px-4 py-4">
        {panelOpen && tab !== 'architecture' && (
          <aside className="w-72 shrink-0">
            <div className="sticky top-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="mb-2 text-sm font-semibold">情境</div>
                <div className="flex gap-1">
                  <input
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="情境名稱"
                    className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    disabled={!scenarioName.trim()}
                    onClick={() => { saveScenario(scenarioName.trim()); setScenarioName(''); }}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-40"
                  >
                    存
                  </button>
                </div>
                {scenarioNames.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {scenarioNames.map((n) => (
                      <li key={n} className="flex items-center justify-between gap-1 text-xs">
                        <button type="button" onClick={() => loadScenario(n)} className="flex-1 truncate text-left text-blue-600 hover:underline">
                          {n}
                        </button>
                        <button type="button" onClick={() => deleteScenario(n)} className="text-slate-400 hover:text-red-500">×</button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" onClick={reset} className="mt-2 w-full rounded border border-slate-300 py-1 text-xs text-slate-600 hover:bg-slate-50">
                  回到預設值
                </button>
              </div>

              <div className="max-h-[calc(100vh-13rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white px-3 shadow-sm">
                <AssumptionsPanel api={api} />
              </div>
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">
          {tab === 'pricing' && <PricingPage api={api} />}
          {tab === 'channel' && <ChannelPage api={api} />}
          {tab === 'markets' && <MarketsPage api={api} />}
          {tab === 'forecast' && <ForecastPage api={api} />}
          {tab === 'architecture' && <ArchitecturePage />}

          <p className="mt-6 text-xs text-slate-400">
            訂閱價格預設值取自 A1 Portal 現行設定(299 / 799 / 2,499,企業版 NT$1/席/天)。
            成本、稅率、匯率與通路折扣為可編輯的起始假設,非市場調查或稅務意見 —— 請以實際報價與會計師確認後覆寫。
          </p>
        </div>
      </main>
    </div>
  );
}
