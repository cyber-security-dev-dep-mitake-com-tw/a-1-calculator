import { REGION_PRESETS } from './regions';
import type { Assumptions, ChannelPath, PaymentAssumptions } from './types';

/**
 * 預設通路結構。
 *
 * 三階的關鍵:原廠實收只看**總代折扣**。總代以 (1−distributorDiscount) 進貨,
 * 再以 (1−resellerDiscount) 賣給經銷,經銷以 MSRP 賣終端 —— 經銷折扣決定的是
 * 通路內部怎麼分,不會再從原廠身上多扣一次。把兩個折扣連乘是常見錯誤。
 */
export const DEFAULT_CHANNELS: ChannelPath[] = [
  {
    kind: 'd2c', name: '官網直售 D2C',
    distributorDiscount: 0, resellerDiscount: 0, marketplaceFeeRate: 0,
    renewalCommissionRate: 0, annualRebateRate: 0, mixPercent: 20,
  },
  {
    kind: 'marketplace', name: '電商平台',
    distributorDiscount: 0, resellerDiscount: 0, marketplaceFeeRate: 0.08,
    renewalCommissionRate: 0, annualRebateRate: 0, mixPercent: 15,
  },
  {
    kind: 'twoTier', name: '二階(原廠→經銷)',
    distributorDiscount: 0, resellerDiscount: 0.3, marketplaceFeeRate: 0,
    renewalCommissionRate: 0.15, annualRebateRate: 0, mixPercent: 25,
  },
  {
    kind: 'threeTier', name: '三階(原廠→總代→經銷)',
    distributorDiscount: 0.45, resellerDiscount: 0.3, marketplaceFeeRate: 0,
    renewalCommissionRate: 0.2, annualRebateRate: 0.03, mixPercent: 30,
  },
  {
    kind: 'msp', name: 'MSP 託管服務商',
    distributorDiscount: 0.4, resellerDiscount: 0.4, marketplaceFeeRate: 0,
    renewalCommissionRate: 0.2, annualRebateRate: 0.02, mixPercent: 10,
  },
];

/**
 * 金流組合。消費端與企業端分開 —— 這是模型的重點之一:
 * B2C 刷卡約 2–3%,B2B 電匯是「固定費為主」,在高單價訂單幾乎可忽略。
 * 超商與 ATM 是固定費,若用百分比估會在低單價品項嚴重低估。
 */
export const DEFAULT_PAYMENT: PaymentAssumptions = {
  consumer: [
    { id: 'card', name: '信用卡 (Stripe)', rate: 0.029, fixedTWD: 10, mixPercent: 60 },
    { id: 'linepay', name: 'LINE Pay', rate: 0.028, fixedTWD: 0, mixPercent: 20 },
    { id: 'atm', name: 'ATM 轉帳', rate: 0, fixedTWD: 15, mixPercent: 12 },
    { id: 'cvs', name: '超商代收', rate: 0, fixedTWD: 30, mixPercent: 8 },
  ],
  business: [
    { id: 'wire', name: '電匯 / 月結', rate: 0.0015, fixedTWD: 300, mixPercent: 80 },
    { id: 'check', name: '支票 / 承兌', rate: 0, fixedTWD: 0, mixPercent: 20 },
  ],
  b2bUnitsPerOrder: 200,
  fxSpread: 0.015,
  chargebackRate: 0.003,
};

/**
 * 預設假設。
 *
 * 訂閱價格為 A1 Portal 目前**實際硬編碼**的方案(Portal/server.mjs),不是估計值:
 *   personal-30 = 299 / personal-90 = 799 / personal-365 = 2,499
 * 企業版 30 元/席/月 來自 Portal 的 `seat_count × term_days × 100`(即 NT$1/席/天),
 * 那是 POC 佔位值 —— 用本工具算過就會看到它的毛利有多不合理。
 *
 * 硬體成本為小量產推估,請以實際報價覆寫。
 */
export const DEFAULT_ASSUMPTIONS: Assumptions = {
  hardware: {
    bomTWD: 280,
    pcbaTWD: 90,
    enclosurePackagingTWD: 70,
    freightPerUnitTWD: 40,
    certTotalTWD: 800000,
    certAmortUnits: 10000,
    toolingTotalTWD: 500000,
    toolingAmortUnits: 20000,
    rmaReserveRate: 0.03,
    scrapRate: 0.02,
  },
  subscriptionCost: {
    cloudPerDeviceMonthTWD: 8,
    supportPerDeviceMonthTWD: 12,
    intelPerDeviceMonthTWD: 5,
  },
  plans: [
    { id: 'personal-1', name: '試用 1 天', days: 1, priceTWD: 0 },
    { id: 'personal-30', name: '個人 30 天', days: 30, priceTWD: 299 },
    { id: 'personal-90', name: '個人 90 天', days: 90, priceTWD: 799 },
    { id: 'personal-365', name: '個人 365 天', days: 365, priceTWD: 2499 },
  ],
  enterprisePerSeatMonthTWD: 30,
  hardwareMsrpLocal: 2000,
  channels: DEFAULT_CHANNELS,
  payment: DEFAULT_PAYMENT,
  regions: REGION_PRESETS,
  activeRegionCode: 'TW',
  activeChannelKind: 'threeTier',
  forecast: {
    startingUnitsPerMonth: 200,
    monthlyGrowthRate: 0.08,
    subscriptionAttachRate: 0.6,
    monthlyChurnRate: 0.03,
    cacPerUnitTWD: 600,
    fixedOpexPerMonthTWD: 800000,
    paymentTermsDays: 45,
    months: 36,
  },
  displayCurrency: 'TWD',
  usdToTWD: 32,
  targetGrossMargin: 0.5,
  corporateTaxRate: 0.2,
};

export function findChannel(a: Assumptions, kind: string) {
  const c = a.channels.find((x) => x.kind === kind);
  if (!c) throw new Error(`unknown channel: ${kind}`);
  return c;
}
