import { effectiveCOGS } from './cogs';
import type { Assumptions } from './types';
import { blendedHardwareGrossProfit, enterpriseSeatEconomics, hardwareUnitEconomics, subscriptionUnitEconomics } from './waterfall';

export interface MonthRow {
  month: number;
  newUnits: number;
  activeSubs: number;
  hardwareRevenue: number;
  hardwareGP: number;
  subscriptionRevenue: number;
  subscriptionGP: number;
  cac: number;
  opex: number;
  /** 認列損益(不考慮收款時點) */
  netProfit: number;
  cumulativeProfit: number;
  /** 實際現金(收款延後 paymentTermsDays,備料先付) */
  cashFlow: number;
  cumulativeCash: number;
}

export interface ForecastResult {
  rows: MonthRow[];
  totalRevenue: number;
  totalGP: number;
  cumulativeProfit: number;
  /** 現金最低點 —— 硬體生意最常忽略的一項 */
  minCumulativeCash: number;
  minCashMonth: number;
  ltvTWD: number;
  cacTWD: number;
  ltvToCac: number;
  /** CAC 回收月數;無法回收時為 null */
  cacPaybackMonths: number | null;
  breakEvenMonth: number | null;
}

/**
 * 36 個月 cohort 預測。
 *
 * 兩個刻意的建模選擇:
 *  1. 訂閱以「活躍裝置數」推進:每月 = 上月 × (1−churn) + 新增 × attach,而不是把整年營收
 *     一次認列 —— 否則 churn 幾乎不會影響結果,那就失去意義了。
 *  2. 現金流與損益分開算:備料成本在出貨當月付出,貨款依 paymentTermsDays 延後收到。
 *     硬體訂閱公司死於現金缺口而非毛利,這條曲線要能看見。
 */
export function runForecast(a: Assumptions): ForecastResult {
  const f = a.forecast;
  const hwUnit = hardwareUnitEconomics(a);
  const hwGPBlended = blendedHardwareGrossProfit(a);
  const cogs = effectiveCOGS(a.hardware);

  // 以年繳方案作為訂閱經濟的代表,換算成每月
  const annual = a.plans.find((p) => p.days >= 365) ?? a.plans[a.plans.length - 1];
  const annualEcon = subscriptionUnitEconomics(a, annual);
  const subGPPerMonth = annual.days > 0 ? annualEcon.grossProfitTWD / (annual.days / 30) : 0;
  const subRevPerMonth = annual.days > 0 ? annualEcon.listPriceTWD / (annual.days / 30) : 0;

  const rows: MonthRow[] = [];
  let activeSubs = 0;
  let cumulativeProfit = 0;
  let cumulativeCash = 0;
  let minCumulativeCash = Number.POSITIVE_INFINITY;
  let minCashMonth = 1;
  let breakEvenMonth: number | null = null;

  const termMonths = Math.max(0, Math.round(f.paymentTermsDays / 30));

  for (let m = 1; m <= f.months; m++) {
    const newUnits = f.startingUnitsPerMonth * Math.pow(1 + f.monthlyGrowthRate, m - 1);
    activeSubs = activeSubs * (1 - f.monthlyChurnRate) + newUnits * f.subscriptionAttachRate;

    const hardwareRevenue = newUnits * hwUnit.netRevenueTWD;
    const hardwareGP = newUnits * hwGPBlended;
    const subscriptionRevenue = activeSubs * subRevPerMonth;
    const subscriptionGP = activeSubs * subGPPerMonth;
    const cac = newUnits * f.cacPerUnitTWD;
    const opex = f.fixedOpexPerMonthTWD;

    const netProfit = hardwareGP + subscriptionGP - cac - opex;
    cumulativeProfit += netProfit;

    // 現金:備料當月付,硬體貨款延後收;訂閱多為預收,視同當月入帳
    //
    // 索引注意:此刻 rows 只有第 1..m−1 月(index 0..m−2),本月尚未 push。
    // 帳期 0 代表當月即收,必須直接用本月營收,不能去查 rows(會抓到 undefined,
    // 造成硬體貨款永遠收不到)。
    const materialOut = newUnits * cogs;
    let hardwareCollected: number;
    if (termMonths === 0) {
      hardwareCollected = hardwareRevenue;
    } else {
      const idx = m - termMonths - 1;
      hardwareCollected = idx >= 0 && idx < rows.length ? rows[idx].hardwareRevenue : 0;
    }
    const cashFlow = hardwareCollected + subscriptionRevenue - materialOut - cac - opex;
    cumulativeCash += cashFlow;

    if (cumulativeCash < minCumulativeCash) {
      minCumulativeCash = cumulativeCash;
      minCashMonth = m;
    }
    if (breakEvenMonth === null && cumulativeProfit > 0) breakEvenMonth = m;

    rows.push({
      month: m, newUnits, activeSubs,
      hardwareRevenue, hardwareGP, subscriptionRevenue, subscriptionGP,
      cac, opex, netProfit, cumulativeProfit, cashFlow, cumulativeCash,
    });
  }

  const ltv = f.monthlyChurnRate > 0 ? subGPPerMonth / f.monthlyChurnRate : subGPPerMonth * f.months;
  const totalRevenue = rows.reduce((s, r) => s + r.hardwareRevenue + r.subscriptionRevenue, 0);
  const totalGP = rows.reduce((s, r) => s + r.hardwareGP + r.subscriptionGP, 0);

  // CAC 回收:硬體毛利先抵一部分,其餘靠每月訂閱毛利補
  const residualCac = f.cacPerUnitTWD - hwGPBlended;
  const cacPaybackMonths =
    residualCac <= 0 ? 0 : subGPPerMonth > 0 ? residualCac / subGPPerMonth : null;

  return {
    rows,
    totalRevenue,
    totalGP,
    cumulativeProfit,
    minCumulativeCash: Number.isFinite(minCumulativeCash) ? minCumulativeCash : 0,
    minCashMonth,
    ltvTWD: ltv,
    cacTWD: f.cacPerUnitTWD,
    ltvToCac: f.cacPerUnitTWD > 0 ? ltv / f.cacPerUnitTWD : 0,
    cacPaybackMonths,
    breakEvenMonth,
  };
}

/** 企業版每席每月毛利 —— 用來檢驗 Portal 目前的 NT$1/席/天 佔位值 */
export function enterpriseSeatMonthlyGP(a: Assumptions): number {
  return enterpriseSeatEconomics(a).grossProfitTWD;
}
