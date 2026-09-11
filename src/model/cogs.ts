import type { Assumptions, HardwareCost, Region } from './types';

/** 認證費用攤提到每台 */
export function certAmortPerUnit(h: HardwareCost): number {
  return h.certAmortUnits > 0 ? h.certTotalTWD / h.certAmortUnits : 0;
}

/** 模具費用攤提到每台 */
export function toolingAmortPerUnit(h: HardwareCost): number {
  return h.toolingAmortUnits > 0 ? h.toolingTotalTWD / h.toolingAmortUnits : 0;
}

/**
 * 有效 COGS:實體成本先加上 RMA 準備與呆滯,再加上一次性費用的攤提。
 * 攤提項不乘 RMA/呆滯 —— 認證費不會因為退貨而變多。
 */
export function effectiveCOGS(h: HardwareCost): number {
  const material = h.bomTWD + h.pcbaTWD + h.enclosurePackagingTWD;
  const landed = material + h.freightPerUnitTWD;
  const riskAdjusted = landed * (1 + h.rmaReserveRate + h.scrapRate);
  return riskAdjusted + certAmortPerUnit(h) + toolingAmortPerUnit(h);
}

/**
 * 當地合規成本攤提到每台。
 * 以該地區年銷量為分母(取 forecast 的每月台數 × 12 作為代理值)。
 * 小量進入新市場時這一項會非常可觀 —— 這正是要讓它顯示出來的原因。
 */
export function compliancePerUnit(region: Region, a: Assumptions): number {
  if (!region.needsTaxRegistration) return 0;
  const annualUnits = Math.max(1, a.forecast.startingUnitsPerMonth * 12);
  return region.annualComplianceCostTWD / annualUnits;
}
