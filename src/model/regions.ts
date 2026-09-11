import type { Region } from './types';

/**
 * 地區稅制 preset。
 *
 * 所有數值皆為**可編輯的起始值**,依一般公開資訊填寫,非即時報價或稅務意見。
 * 實際稅率、關稅稅則與登記門檻請以當地會計師確認後覆寫。
 *
 * 兩個容易踩的點:
 *  1. 美國是 exclusive(結帳外加),其餘多為 inclusive(售價含稅)。弄反會差一整個稅率。
 *  2. 多數 IT 產品在 ITA 協定下進口關稅為 0,但東南亞部分國家仍課徵。
 */
export const REGION_PRESETS: Region[] = [
  {
    code: 'TW', name: '台灣', localCurrency: 'TWD', fxToTWD: 1,
    taxRate: 0.05, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: false, annualComplianceCostTWD: 0,
    withholdingRate: 0, tradeTerm: 'DDP', intlCardSurcharge: 0,
    note: '本國市場,營業稅 5% 內含',
  },
  {
    code: 'SG', name: '新加坡', localCurrency: 'SGD', fxToTWD: 24,
    taxRate: 0.09, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 60000,
    withholdingRate: 0, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
    note: 'GST 9%;年營業額超過門檻須登記',
  },
  {
    code: 'MY', name: '馬來西亞', localCurrency: 'MYR', fxToTWD: 7,
    taxRate: 0.1, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 50000,
    withholdingRate: 0.08, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
    note: 'SST 10%;軟體權利金有預扣稅',
  },
  {
    code: 'TH', name: '泰國', localCurrency: 'THB', fxToTWD: 0.9,
    taxRate: 0.07, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 50000,
    withholdingRate: 0.05, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
  },
  {
    code: 'VN', name: '越南', localCurrency: 'VND', fxToTWD: 0.0013,
    taxRate: 0.1, taxMode: 'inclusive', importDutyRate: 0.05,
    needsTaxRegistration: true, annualComplianceCostTWD: 50000,
    withholdingRate: 0.1, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
    note: '硬體仍有進口關稅;外國承包商稅較複雜',
  },
  {
    code: 'ID', name: '印尼', localCurrency: 'IDR', fxToTWD: 0.002,
    taxRate: 0.11, taxMode: 'inclusive', importDutyRate: 0.05,
    needsTaxRegistration: true, annualComplianceCostTWD: 55000,
    withholdingRate: 0.1, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
  },
  {
    code: 'EU', name: '歐盟(代表值)', localCurrency: 'EUR', fxToTWD: 34.5,
    taxRate: 0.21, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 120000,
    withholdingRate: 0, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
    note: 'VAT 各國 19–27%,此為代表值;B2C 數位服務須 OSS 登記代收',
  },
  {
    code: 'UK', name: '英國', localCurrency: 'GBP', fxToTWD: 40,
    taxRate: 0.2, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 80000,
    withholdingRate: 0, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
  },
  {
    code: 'US', name: '美國', localCurrency: 'USD', fxToTWD: 32,
    taxRate: 0.07, taxMode: 'exclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 150000,
    withholdingRate: 0, tradeTerm: 'DAP', intlCardSurcharge: 0,
    note: 'Sales tax 結帳外加、各州不同;達 economic nexus 門檻須各州登記',
  },
  {
    code: 'JP', name: '日本', localCurrency: 'JPY', fxToTWD: 0.21,
    taxRate: 0.1, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 100000,
    withholdingRate: 0, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
    note: '消費稅 10%;B2C 數位服務須登録番号',
  },
  {
    code: 'KR', name: '韓國', localCurrency: 'KRW', fxToTWD: 0.023,
    taxRate: 0.1, taxMode: 'inclusive', importDutyRate: 0,
    needsTaxRegistration: true, annualComplianceCostTWD: 80000,
    withholdingRate: 0, tradeTerm: 'DAP', intlCardSurcharge: 0.015,
  },
];

export function findRegion(regions: Region[], code: string): Region {
  const r = regions.find((x) => x.code === code);
  if (!r) throw new Error(`unknown region: ${code}`);
  return r;
}
