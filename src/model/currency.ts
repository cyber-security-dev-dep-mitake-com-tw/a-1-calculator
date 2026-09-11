import type { Assumptions } from './types';

/** TWD 為記帳本位;顯示時可切 USD。 */
export function toDisplay(twd: number, a: Assumptions): number {
  return a.displayCurrency === 'USD' ? twd / a.usdToTWD : twd;
}

export function currencySymbol(a: Assumptions): string {
  return a.displayCurrency === 'USD' ? 'US$' : 'NT$';
}

export function fmtMoney(twd: number, a: Assumptions, digits = 0): string {
  const v = toDisplay(twd, a);
  const d = a.displayCurrency === 'USD' && Math.abs(v) < 100 ? Math.max(digits, 2) : digits;
  return `${currencySymbol(a)}${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}

export function fmtCompact(twd: number, a: Assumptions): string {
  const v = toDisplay(twd, a);
  const abs = Math.abs(v);
  if (abs >= 1e8) return `${currencySymbol(a)}${(v / 1e8).toFixed(2)}億`;
  if (abs >= 1e4) return `${currencySymbol(a)}${(v / 1e4).toFixed(1)}萬`;
  return fmtMoney(twd, a);
}

export const fmtPct = (x: number, digits = 1): string => `${(x * 100).toFixed(digits)}%`;
