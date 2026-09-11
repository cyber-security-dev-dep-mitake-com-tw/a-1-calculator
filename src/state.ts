import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ASSUMPTIONS } from './model/defaults';
import type { Assumptions } from './model/types';

const STORAGE_KEY = 'a1-calc:assumptions';
const SCENARIO_KEY = 'a1-calc:scenarios';

/** 深層合併預設值,讓舊存檔在新增欄位後仍可讀。 */
function mergeDefaults(saved: unknown): Assumptions {
  if (!saved || typeof saved !== 'object') return DEFAULT_ASSUMPTIONS;
  const s = saved as Partial<Assumptions>;
  return {
    ...DEFAULT_ASSUMPTIONS,
    ...s,
    hardware: { ...DEFAULT_ASSUMPTIONS.hardware, ...(s.hardware ?? {}) },
    subscriptionCost: { ...DEFAULT_ASSUMPTIONS.subscriptionCost, ...(s.subscriptionCost ?? {}) },
    forecast: { ...DEFAULT_ASSUMPTIONS.forecast, ...(s.forecast ?? {}) },
    payment: { ...DEFAULT_ASSUMPTIONS.payment, ...(s.payment ?? {}) },
    plans: s.plans?.length ? s.plans : DEFAULT_ASSUMPTIONS.plans,
    channels: s.channels?.length ? s.channels : DEFAULT_ASSUMPTIONS.channels,
    regions: s.regions?.length ? s.regions : DEFAULT_ASSUMPTIONS.regions,
  };
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export interface ScenarioStore {
  [name: string]: Assumptions;
}

export function useAssumptions() {
  const [a, setA] = useState<Assumptions>(() => mergeDefaults(readStorage(STORAGE_KEY, null)));
  const [scenarios, setScenarios] = useState<ScenarioStore>(() => readStorage<ScenarioStore>(SCENARIO_KEY, {}));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    } catch {
      /* 隱私模式或配額用盡時略過,不影響試算 */
    }
  }, [a]);

  const update = useCallback((patch: Partial<Assumptions>) => {
    setA((prev) => ({ ...prev, ...patch }));
  }, []);

  /** 更新巢狀區塊,例如 updateSection('hardware', { bomTWD: 300 }) */
  const updateSection = useCallback(
    <K extends keyof Assumptions>(key: K, patch: Partial<Assumptions[K]>) => {
      setA((prev) => ({ ...prev, [key]: { ...(prev[key] as object), ...patch } as Assumptions[K] }));
    },
    [],
  );

  const persistScenarios = useCallback((next: ScenarioStore) => {
    setScenarios(next);
    try {
      localStorage.setItem(SCENARIO_KEY, JSON.stringify(next));
    } catch {
      /* 同上 */
    }
  }, []);

  const saveScenario = useCallback(
    (name: string) => persistScenarios({ ...scenarios, [name]: a }),
    [a, scenarios, persistScenarios],
  );

  const loadScenario = useCallback(
    (name: string) => {
      const s = scenarios[name];
      if (s) setA(mergeDefaults(s));
    },
    [scenarios],
  );

  const deleteScenario = useCallback(
    (name: string) => {
      const next = { ...scenarios };
      delete next[name];
      persistScenarios(next);
    },
    [scenarios, persistScenarios],
  );

  const reset = useCallback(() => setA(DEFAULT_ASSUMPTIONS), []);

  const scenarioNames = useMemo(() => Object.keys(scenarios).sort(), [scenarios]);

  return { a, setA, update, updateSection, saveScenario, loadScenario, deleteScenario, scenarioNames, reset };
}

export type AssumptionsApi = ReturnType<typeof useAssumptions>;
