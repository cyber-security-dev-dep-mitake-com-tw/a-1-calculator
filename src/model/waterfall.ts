import { compliancePerUnit, effectiveCOGS } from './cogs';
import { findChannel } from './defaults';
import { findRegion } from './regions';
import type {
  Assumptions, ChannelKind, ChannelPath, PaymentAssumptions,
  PaymentMethod, Region, SubscriptionPlan, UnitEconomics, WaterfallStep,
} from './types';

/**
 * 原廠實收占 MSRP 的比例。
 *
 * 三階時只扣**總代折扣**:總代以 (1−distributorDiscount) 向原廠進貨,再以
 * (1−resellerDiscount) 轉賣經銷。經銷折扣決定通路內部分配,不會再從原廠身上扣一次。
 * 把兩個折扣連乘(0.55 × 0.70)是典型錯誤,會讓原廠實收憑空少掉三成。
 */
export function channelRetention(c: ChannelPath): number {
  let afterDiscount: number;
  switch (c.kind) {
    case 'd2c':
      afterDiscount = 1;
      break;
    case 'marketplace':
      afterDiscount = 1 - c.marketplaceFeeRate;
      break;
    case 'twoTier':
      afterDiscount = 1 - c.resellerDiscount;
      break;
    case 'threeTier':
    case 'msp':
      afterDiscount = 1 - c.distributorDiscount;
      break;
  }
  return afterDiscount * (1 - c.annualRebateRate);
}

export function isConsumerChannel(kind: ChannelKind): boolean {
  return kind === 'd2c' || kind === 'marketplace';
}

export function paymentMixFor(kind: ChannelKind, p: PaymentAssumptions): PaymentMethod[] {
  return isConsumerChannel(kind) ? p.consumer : p.business;
}

/**
 * 把金流費拆成「百分比係數 + 固定費」兩個數。
 *
 * 正算(瀑布)與反算(由目標毛利反推售價)共用這一份定義,兩邊才不會各自寫一套而悄悄分歧 ——
 * `pricing.test.ts` 的 round-trip 測試就是靠這點成立的。
 *
 * 固定費(超商/ATM/電匯)以加權計入:在低單價品項,固定費占比會遠高於刷卡的百分比費。
 * 跨境時加換匯價差;國際卡附加費只對「有百分比費率」的方式(視為卡類)加權。拒付僅發生在消費端。
 */
export function paymentFeeCoefficients(
  kind: ChannelKind,
  region: Region,
  p: PaymentAssumptions,
  unitsPerOrder?: number,
): { rate: number; fixed: number } {
  const methods = paymentMixFor(kind, p);
  const totalMix = methods.reduce((s, m) => s + m.mixPercent, 0);
  if (totalMix <= 0) return { rate: 0, fixed: 0 };

  // 消費端是一人一筆結帳,固定費就是每單位一次;企業端一張訂單涵蓋多個單位,
  // 固定費(電匯手續費)必須攤提,否則低單價品項會被固定費壓成假性負毛利。
  const perOrder = isConsumerChannel(kind) ? 1 : Math.max(1, unitsPerOrder ?? p.b2bUnitsPerOrder);

  let rate = 0;
  let fixed = 0;
  let cardShare = 0;
  for (const m of methods) {
    const w = m.mixPercent / totalMix;
    rate += w * m.rate;
    fixed += (w * m.fixedTWD) / perOrder;
    if (m.rate > 0) cardShare += w;
  }

  if (region.code !== 'TW') {
    rate += p.fxSpread;
    rate += region.intlCardSurcharge * cardShare;
  }
  if (isConsumerChannel(kind)) {
    rate += p.chargebackRate;
  }
  return { rate, fixed };
}

export function computePaymentFee(
  amountTWD: number,
  kind: ChannelKind,
  region: Region,
  p: PaymentAssumptions,
  unitsPerOrder?: number,
): number {
  if (amountTWD <= 0) return 0;
  const { rate, fixed } = paymentFeeCoefficients(kind, region, p, unitsPerOrder);
  return amountTWD * rate + fixed;
}

/** 售價中的稅額。inclusive 時稅內含須扣出;exclusive 時稅是外加代收,不屬廠商收入。 */
export function taxPortion(grossTWD: number, region: Region): number {
  return region.taxMode === 'inclusive'
    ? grossTWD - grossTWD / (1 + region.taxRate)
    : 0;
}

/** 實際刷過金流的金額:外加稅制下,消費者付的是含稅總額,手續費按總額計。 */
export function transactedAmount(vendorGrossTWD: number, region: Region): number {
  return region.taxMode === 'exclusive'
    ? vendorGrossTWD * (1 + region.taxRate)
    : vendorGrossTWD;
}

function buildSteps(rows: Array<{ label: string; amount: number; hint?: string }>): WaterfallStep[] {
  const steps: WaterfallStep[] = [];
  let running = 0;
  rows.forEach((r, i) => {
    running += r.amount;
    steps.push({
      label: r.label,
      amount: r.amount,
      running,
      kind: i === 0 ? 'start' : 'deduction',
      hint: r.hint,
    });
  });
  steps.push({ label: '單台毛利', amount: running, running, kind: 'result' });
  return steps;
}

/** 硬體單台經濟模型:MSRP 一路扣到原廠毛利。 */
export function hardwareUnitEconomics(
  a: Assumptions,
  overrides?: { regionCode?: string; channelKind?: ChannelKind; msrpLocal?: number },
): UnitEconomics {
  const region = findRegion(a.regions, overrides?.regionCode ?? a.activeRegionCode);
  const channel = findChannel(a, overrides?.channelKind ?? a.activeChannelKind);
  const msrpLocal = overrides?.msrpLocal ?? a.hardwareMsrpLocal;

  const listPriceTWD = msrpLocal * region.fxToTWD;
  const vendorGross = listPriceTWD * channelRetention(channel);
  const channelCut = listPriceTWD - vendorGross;

  const tax = taxPortion(vendorGross, region);
  const paymentFee = computePaymentFee(transactedAmount(vendorGross, region), channel.kind, region, a.payment);
  const cogs = effectiveCOGS(a.hardware);
  const duty = region.tradeTerm === 'DDP' ? listPriceTWD * region.importDutyRate : 0;
  const compliance = compliancePerUnit(region, a);

  const netRevenue = vendorGross - tax;
  const grossProfit = netRevenue - paymentFee - cogs - duty - compliance;

  const channelLabel =
    channel.kind === 'marketplace' ? `平台抽成 ${(channel.marketplaceFeeRate * 100).toFixed(0)}%`
      : channel.kind === 'twoTier' ? `經銷折扣 ${(channel.resellerDiscount * 100).toFixed(0)}%`
        : channel.kind === 'd2c' ? '無通路折扣'
          : `總代折扣 ${(channel.distributorDiscount * 100).toFixed(0)}%`;

  const steps = buildSteps([
    { label: `建議售價 MSRP`, amount: listPriceTWD, hint: `${msrpLocal.toLocaleString()} ${region.localCurrency}` },
    { label: channelLabel, amount: -channelCut, hint: channel.annualRebateRate > 0 ? `含年度 rebate ${(channel.annualRebateRate * 100).toFixed(1)}%` : undefined },
    { label: region.taxMode === 'inclusive' ? `${region.code} 稅(內含)` : `${region.code} 稅(外加代收)`, amount: -tax, hint: `${(region.taxRate * 100).toFixed(1)}%` },
    { label: '金流手續費', amount: -paymentFee, hint: isConsumerChannel(channel.kind) ? '消費端組合' : '企業端電匯為主' },
    { label: '進口關稅', amount: -duty, hint: region.tradeTerm === 'DDP' ? 'DDP 由原廠負擔' : `${region.tradeTerm} 由進口商負擔` },
    { label: '當地合規攤提', amount: -compliance, hint: region.needsTaxRegistration ? '需當地稅籍登記' : '免登記' },
    { label: '硬體 COGS', amount: -cogs },
  ]);

  return {
    listPriceTWD,
    vendorGrossTWD: vendorGross,
    netRevenueTWD: netRevenue,
    taxTWD: tax,
    paymentFeeTWD: paymentFee,
    cogsTWD: cogs,
    dutyTWD: duty,
    complianceTWD: compliance,
    grossProfitTWD: grossProfit,
    grossMargin: netRevenue > 0 ? grossProfit / netRevenue : 0,
    steps,
  };
}

/** 訂閱方案單筆經濟模型。通路的續約分潤是這裡的主要侵蝕項。 */
export function subscriptionUnitEconomics(
  a: Assumptions,
  plan: SubscriptionPlan,
  overrides?: { regionCode?: string; channelKind?: ChannelKind },
): UnitEconomics {
  const region = findRegion(a.regions, overrides?.regionCode ?? a.activeRegionCode);
  const channel = findChannel(a, overrides?.channelKind ?? a.activeChannelKind);

  const listPriceTWD = plan.priceTWD;
  const commission = listPriceTWD * channel.renewalCommissionRate;
  const vendorGross = listPriceTWD - commission;

  const tax = taxPortion(vendorGross, region);
  const paymentFee = computePaymentFee(transactedAmount(vendorGross, region), channel.kind, region, a.payment);

  const months = plan.days / 30;
  const c = a.subscriptionCost;
  const serviceCost =
    (c.cloudPerDeviceMonthTWD + c.supportPerDeviceMonthTWD + c.intelPerDeviceMonthTWD) * months;

  const netRevenue = vendorGross - tax;
  const grossProfit = netRevenue - paymentFee - serviceCost;

  const steps = buildSteps([
    { label: `${plan.name} 售價`, amount: listPriceTWD, hint: `${plan.days} 天` },
    { label: '通路續約分潤', amount: -commission, hint: `${(channel.renewalCommissionRate * 100).toFixed(0)}%` },
    { label: region.taxMode === 'inclusive' ? `${region.code} 稅(內含)` : `${region.code} 稅(外加代收)`, amount: -tax },
    { label: '金流手續費', amount: -paymentFee },
    { label: '服務成本(雲端+客服+情資)', amount: -serviceCost, hint: `${months.toFixed(1)} 個月` },
  ]);

  return {
    listPriceTWD,
    vendorGrossTWD: vendorGross,
    netRevenueTWD: netRevenue,
    taxTWD: tax,
    paymentFeeTWD: paymentFee,
    cogsTWD: serviceCost,
    dutyTWD: 0,
    complianceTWD: 0,
    grossProfitTWD: grossProfit,
    grossMargin: netRevenue > 0 ? grossProfit / netRevenue : 0,
    steps,
  };
}

/** 企業版每席每月 */
export function enterpriseSeatEconomics(a: Assumptions, overrides?: { channelKind?: ChannelKind }): UnitEconomics {
  return subscriptionUnitEconomics(
    a,
    { id: 'enterprise-seat', name: '企業版每席', days: 30, priceTWD: a.enterprisePerSeatMonthTWD },
    overrides,
  );
}

/** 依通路 mix 加權的硬體毛利 */
export function blendedHardwareGrossProfit(a: Assumptions): number {
  const totalMix = a.channels.reduce((s, c) => s + c.mixPercent, 0);
  if (totalMix <= 0) return 0;
  return a.channels.reduce((sum, c) => {
    const e = hardwareUnitEconomics(a, { channelKind: c.kind });
    return sum + (c.mixPercent / totalMix) * e.grossProfitTWD;
  }, 0);
}
