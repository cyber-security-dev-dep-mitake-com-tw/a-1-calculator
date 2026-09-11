import { compliancePerUnit, effectiveCOGS } from './cogs';
import { findChannel } from './defaults';
import { findRegion } from './regions';
import { channelRetention, paymentFeeCoefficients } from './waterfall';
import type { Assumptions, ChannelKind } from './types';

export interface ReversePricing {
  /** 達到目標毛利所需的 MSRP(當地幣) */
  msrpLocal: number;
  msrpTWD: number;
  /** 對應的原廠實收 */
  vendorGrossTWD: number;
  /** 是否無解(成本結構下不可能達標) */
  feasible: boolean;
  reason?: string;
}

/**
 * 由目標毛利率反推 MSRP。
 *
 * 推導(令 V = 原廠實收):
 *   淨收入      = V × netFactor            netFactor = 含稅制 ? 1/(1+t) : 1
 *   金流費      = V × k × rate + fixed     k = 外加稅制 ? (1+t) : 1
 *   關稅(DDP)  = V × dutyRate / retention  關稅按 MSRP 計,而 MSRP = V / retention
 *   毛利        = V × (netFactor − k×rate − dutyFactor) − fixed − COGS − 合規
 *
 * 令 毛利 = 目標毛利率 × 淨收入,整理得:
 *   V = (fixed + COGS + 合規) / ( netFactor×(1−目標) − k×rate − dutyFactor )
 *
 * 分母 ≤ 0 表示無論售價多高都達不到目標(每多賣一元,被抽走的比留下的多),
 * 此時回傳 feasible=false 而不是硬算出一個天價數字。
 */
export function msrpForTargetMargin(
  a: Assumptions,
  overrides?: { regionCode?: string; channelKind?: ChannelKind; targetMargin?: number },
): ReversePricing {
  const region = findRegion(a.regions, overrides?.regionCode ?? a.activeRegionCode);
  const channel = findChannel(a, overrides?.channelKind ?? a.activeChannelKind);
  const target = overrides?.targetMargin ?? a.targetGrossMargin;

  const retention = channelRetention(channel);
  const { rate, fixed } = paymentFeeCoefficients(channel.kind, region, a.payment);

  const netFactor = region.taxMode === 'inclusive' ? 1 / (1 + region.taxRate) : 1;
  const k = region.taxMode === 'exclusive' ? 1 + region.taxRate : 1;
  const dutyFactor =
    region.tradeTerm === 'DDP' && retention > 0 ? region.importDutyRate / retention : 0;

  const fixedCosts = fixed + effectiveCOGS(a.hardware) + compliancePerUnit(region, a);
  const denominator = netFactor * (1 - target) - k * rate - dutyFactor;

  if (retention <= 0) {
    return { msrpLocal: 0, msrpTWD: 0, vendorGrossTWD: 0, feasible: false, reason: '通路折扣已達 100%,原廠實收為零' };
  }
  if (denominator <= 0) {
    return {
      msrpLocal: 0, msrpTWD: 0, vendorGrossTWD: 0, feasible: false,
      reason: '在此通路與稅費結構下,目標毛利率無解 —— 每增加一元售價,被抽走的多於留下的',
    };
  }

  const vendorGross = fixedCosts / denominator;
  const msrpTWD = vendorGross / retention;
  return {
    msrpLocal: msrpTWD / region.fxToTWD,
    msrpTWD,
    vendorGrossTWD: vendorGross,
    feasible: true,
  };
}

/**
 * 在目標毛利下,最多能讓給通路多少折扣(「折扣底線」)。
 * 以二分搜尋求解:折扣越大,毛利越低,單調關係成立。
 */
export function maxAffordableDiscount(
  marginAt: (discount: number) => number,
  targetMargin: number,
): number {
  if (marginAt(0) < targetMargin) return 0;
  let lo = 0;
  let hi = 0.95;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (marginAt(mid) >= targetMargin) lo = mid;
    else hi = mid;
  }
  return lo;
}
