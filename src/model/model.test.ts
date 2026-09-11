import { describe, expect, it } from 'vitest';
import { DEFAULT_ASSUMPTIONS } from './defaults';
import { msrpForTargetMargin } from './pricing';
import { runForecast } from './forecast';
import {
  channelRetention, computePaymentFee, enterpriseSeatEconomics,
  hardwareUnitEconomics, subscriptionUnitEconomics, taxPortion, transactedAmount,
} from './waterfall';
import type { Assumptions, Region } from './types';

const A = DEFAULT_ASSUMPTIONS;
const clone = (): Assumptions => structuredClone(A);
const region = (code: string): Region => A.regions.find((r) => r.code === code)!;

describe('稅:含內 vs 外加', () => {
  // 這是全模型最容易寫反的地方。同樣 10% 稅率,兩種算法必須不同且各自正確。
  const inclusive: Region = { ...region('TW'), taxRate: 0.1, taxMode: 'inclusive' };
  const exclusive: Region = { ...region('US'), taxRate: 0.1, taxMode: 'exclusive' };

  it('含內稅制:1100 元售價的稅是 100,廠商實收 1000', () => {
    expect(taxPortion(1100, inclusive)).toBeCloseTo(100, 6);
  });

  it('外加稅制:稅不屬於廠商收入,taxPortion 為 0', () => {
    expect(taxPortion(1100, exclusive)).toBe(0);
  });

  it('外加稅制下,實際刷卡金額是含稅總額(手續費按總額計)', () => {
    expect(transactedAmount(1000, exclusive)).toBeCloseTo(1100, 6);
    expect(transactedAmount(1000, inclusive)).toBeCloseTo(1000, 6);
  });

  it('同售價同稅率,外加稅制的廠商淨收入高於含內(因為稅是另外跟消費者收的)', () => {
    const a = clone();
    a.regions = [inclusive, exclusive];
    a.activeChannelKind = 'd2c';
    const inc = hardwareUnitEconomics({ ...a, activeRegionCode: inclusive.code });
    const exc = hardwareUnitEconomics({ ...a, activeRegionCode: exclusive.code });
    expect(exc.netRevenueTWD).toBeGreaterThan(inc.netRevenueTWD);
  });
});

describe('通路折扣疊加順序', () => {
  // 三階時原廠實收只看總代折扣;把總代與經銷折扣連乘是典型錯誤。
  it('三階實收 = MSRP ×(1 − 總代折扣),不受經銷折扣影響', () => {
    const three = A.channels.find((c) => c.kind === 'threeTier')!;
    const retention = channelRetention(three);
    const expected = (1 - three.distributorDiscount) * (1 - three.annualRebateRate);
    expect(retention).toBeCloseTo(expected, 10);
  });

  it('改變經銷折扣不會改變原廠實收', () => {
    const three = A.channels.find((c) => c.kind === 'threeTier')!;
    const before = channelRetention(three);
    const after = channelRetention({ ...three, resellerDiscount: 0.05 });
    expect(after).toBeCloseTo(before, 10);
  });

  it('不可連乘:實收必須明顯高於兩折扣相乘的錯誤算法', () => {
    const three = A.channels.find((c) => c.kind === 'threeTier')!;
    const wrong = (1 - three.distributorDiscount) * (1 - three.resellerDiscount);
    expect(channelRetention(three)).toBeGreaterThan(wrong);
  });

  it('二階實收看的是經銷折扣', () => {
    const two = A.channels.find((c) => c.kind === 'twoTier')!;
    expect(channelRetention(two)).toBeCloseTo(1 - two.resellerDiscount, 10);
  });
});

describe('金流固定費', () => {
  // 超商/ATM 是固定費。低單價品項若用百分比估會嚴重低估。
  it('低單價時消費端手續費占比顯著高於高單價', () => {
    const tw = region('TW');
    const low = computePaymentFee(300, 'd2c', tw, A.payment);
    const high = computePaymentFee(3000, 'd2c', tw, A.payment);
    expect(low / 300).toBeGreaterThan(high / 3000);
  });

  it('企業端電匯的費率低於消費端刷卡', () => {
    const tw = region('TW');
    const consumer = computePaymentFee(20000, 'd2c', tw, A.payment) / 20000;
    const business = computePaymentFee(20000, 'threeTier', tw, A.payment) / 20000;
    expect(business).toBeLessThan(consumer);
  });

  it('B2B 電匯固定費須攤在整張訂單上,而非每台收一次', () => {
    const tw = region('TW');
    const a = clone();
    // 一張訂單 1 台 vs 200 台:每台分攤到的固定費應差 200 倍
    const perOne = computePaymentFee(1000, 'threeTier', tw, a.payment, 1);
    const perMany = computePaymentFee(1000, 'threeTier', tw, a.payment, 200);
    expect(perOne - perMany).toBeGreaterThan(200);
  });

  it('低單價訂閱不該被 B2B 固定費壓成負毛利', () => {
    // 這是實際跑起來後才發現的缺陷:NT$300 電匯費若按「每席每月」收,
    // 30 元的企業席次會出現 −1000% 毛利,那是模型假象而非定價問題。
    const a = clone();
    a.enterprisePerSeatMonthTWD = 300;
    const gp = enterpriseSeatEconomics(a, { channelKind: 'threeTier' }).grossProfitTWD;
    expect(gp).toBeGreaterThan(0);
  });

  it('跨境會加上換匯價差,費用高於本國', () => {
    const domestic = computePaymentFee(2000, 'd2c', region('TW'), A.payment);
    const overseas = computePaymentFee(2000, 'd2c', region('JP'), A.payment);
    expect(overseas).toBeGreaterThan(domestic);
  });
});

describe('反推定價與正算瀑布互為逆運算', () => {
  it.each(['d2c', 'twoTier', 'threeTier', 'marketplace'] as const)(
    '%s:反推的 MSRP 代回瀑布應得到目標毛利率',
    (kind) => {
      const a = clone();
      const target = 0.5;
      const rev = msrpForTargetMargin(a, { channelKind: kind, targetMargin: target });
      expect(rev.feasible).toBe(true);
      const econ = hardwareUnitEconomics(a, { channelKind: kind, msrpLocal: rev.msrpLocal });
      expect(econ.grossMargin).toBeCloseTo(target, 6);
    },
  );

  it('跨境市場同樣成立(含匯率與合規攤提)', () => {
    const a = clone();
    const rev = msrpForTargetMargin(a, { regionCode: 'JP', channelKind: 'threeTier', targetMargin: 0.45 });
    expect(rev.feasible).toBe(true);
    const econ = hardwareUnitEconomics(a, { regionCode: 'JP', channelKind: 'threeTier', msrpLocal: rev.msrpLocal });
    expect(econ.grossMargin).toBeCloseTo(0.45, 6);
  });

  it('折扣過深時回報無解,而不是算出一個天價', () => {
    const a = clone();
    a.channels = a.channels.map((c) =>
      c.kind === 'threeTier' ? { ...c, distributorDiscount: 1 } : c,
    );
    const rev = msrpForTargetMargin(a, { channelKind: 'threeTier', targetMargin: 0.5 });
    expect(rev.feasible).toBe(false);
    expect(rev.reason).toBeTruthy();
  });
});

describe('幣別換算', () => {
  it('當地幣→TWD→當地幣 來回一致', () => {
    const jp = region('JP');
    const local = 9800;
    const twd = local * jp.fxToTWD;
    expect(twd / jp.fxToTWD).toBeCloseTo(local, 6);
  });

  it('同一 TWD 定價在不同匯率地區,反推的當地幣售價不同', () => {
    const a = clone();
    const jp = msrpForTargetMargin(a, { regionCode: 'JP', targetMargin: 0.4 });
    const us = msrpForTargetMargin(a, { regionCode: 'US', targetMargin: 0.4 });
    expect(jp.msrpLocal).not.toBeCloseTo(us.msrpLocal, 0);
  });
});

describe('sanity:通路越深,原廠毛利越低', () => {
  it('D2C 毛利 > 二階 > 三階', () => {
    const a = clone();
    const d2c = hardwareUnitEconomics(a, { channelKind: 'd2c' }).grossProfitTWD;
    const two = hardwareUnitEconomics(a, { channelKind: 'twoTier' }).grossProfitTWD;
    const three = hardwareUnitEconomics(a, { channelKind: 'threeTier' }).grossProfitTWD;
    expect(d2c).toBeGreaterThan(two);
    expect(two).toBeGreaterThan(three);
  });

  it('瀑布各步驟加總等於毛利', () => {
    const econ = hardwareUnitEconomics(clone());
    const sum = econ.steps.filter((s) => s.kind !== 'result').reduce((t, s) => t + s.amount, 0);
    expect(sum).toBeCloseTo(econ.grossProfitTWD, 6);
  });
});

describe('Portal 現行價格的實際毛利', () => {
  it('年繳 2,499 在 D2C 的毛利明顯高於走三階通路', () => {
    const a = clone();
    const plan = a.plans.find((p) => p.id === 'personal-365')!;
    const d2c = subscriptionUnitEconomics(a, plan, { channelKind: 'd2c' }).grossProfitTWD;
    const three = subscriptionUnitEconomics(a, plan, { channelKind: 'threeTier' }).grossProfitTWD;
    expect(d2c).toBeGreaterThan(three);
  });

  it('企業版 NT$30/席/月 扣掉服務成本後幾乎無毛利(揭露 POC 佔位價的問題)', () => {
    const a = clone();
    const gp = enterpriseSeatEconomics(a, { channelKind: 'threeTier' }).grossProfitTWD;
    const serviceCost =
      a.subscriptionCost.cloudPerDeviceMonthTWD +
      a.subscriptionCost.supportPerDeviceMonthTWD +
      a.subscriptionCost.intelPerDeviceMonthTWD;
    expect(serviceCost).toBe(25);
    // 30 元售價扣 20% 通路分潤、5% 稅、金流與 25 元成本後應為負
    expect(gp).toBeLessThan(0);
  });
});

describe('預測模型', () => {
  it('churn 越高,36 個月後的活躍訂閱數越少', () => {
    const low = clone();
    low.forecast.monthlyChurnRate = 0.01;
    const high = clone();
    high.forecast.monthlyChurnRate = 0.08;
    const lowEnd = runForecast(low).rows.at(-1)!.activeSubs;
    const highEnd = runForecast(high).rows.at(-1)!.activeSubs;
    expect(lowEnd).toBeGreaterThan(highEnd);
  });

  it('付款條件拉長會壓低現金最低點,但不影響認列損益', () => {
    const fast = clone();
    fast.forecast.paymentTermsDays = 0;
    const slow = clone();
    slow.forecast.paymentTermsDays = 90;
    const f = runForecast(fast);
    const s = runForecast(slow);
    expect(s.minCumulativeCash).toBeLessThan(f.minCumulativeCash);
    expect(s.cumulativeProfit).toBeCloseTo(f.cumulativeProfit, 6);
  });

  it('產生完整 36 個月', () => {
    expect(runForecast(clone()).rows).toHaveLength(36);
  });
});
