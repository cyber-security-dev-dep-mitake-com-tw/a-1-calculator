/** 幣別:NTD 為記帳本位,USD 僅供顯示換算。 */
export type Currency = 'TWD' | 'USD';

/**
 * 稅的計算方式 — 這是全模型最容易寫反的地方。
 * inclusive:售價已含稅(台灣、歐盟、日本)→ 廠商實收 = 售價 / (1 + 稅率)
 * exclusive:售價未含稅,結帳時外加(美國 sales tax)→ 廠商實收 = 售價,稅是代收代付
 */
export type TaxMode = 'inclusive' | 'exclusive';

/**
 * 貿易條件,決定關稅與進口稅由誰吸收。
 * DDP  — 原廠負擔,計入原廠成本
 * DAP/EXW — 進口商(代理商)負擔,不計入原廠成本(但通常已反映在通路折扣裡)
 */
export type TradeTerm = 'DDP' | 'DAP' | 'EXW';

export interface Region {
  code: string;
  name: string;
  localCurrency: string;
  /** 1 單位當地幣 = ? TWD */
  fxToTWD: number;
  /** VAT / GST / Sales tax,0.05 = 5% */
  taxRate: number;
  taxMode: TaxMode;
  /** 硬體進口關稅 */
  importDutyRate: number;
  /** 是否需在當地辦稅籍登記(隱藏合規成本) */
  needsTaxRegistration: boolean;
  /** 當地合規/稅務代理年成本(TWD),攤提到每台 */
  annualComplianceCostTWD: number;
  /** 軟體/權利金預扣稅 */
  withholdingRate: number;
  tradeTerm: TradeTerm;
  /** 跨境信用卡附加費(非本國發卡) */
  intlCardSurcharge: number;
  note?: string;
}

export type ChannelKind = 'd2c' | 'marketplace' | 'twoTier' | 'threeTier' | 'msp';

export interface ChannelPath {
  kind: ChannelKind;
  name: string;
  /**
   * 總代理折扣(off MSRP)。三階時原廠實收 = MSRP × (1 − 此值);
   * 經銷折扣只決定通路內部如何分,不再影響原廠實收。
   */
  distributorDiscount: number;
  /** 經銷商折扣(off MSRP)。二階時原廠直接賣經銷,實收 = MSRP × (1 − 此值)。 */
  resellerDiscount: number;
  /** 電商平台抽成(對零售價) */
  marketplaceFeeRate: number;
  /** 訂閱續約分潤 — 最常被漏算、長期侵蝕 MRR 的一項 */
  renewalCommissionRate: number;
  /** 年度達標回饋(對原廠實收) */
  annualRebateRate: number;
  /** 銷量占比,用於 blended 計算 */
  mixPercent: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  /** 百分比費率 */
  rate: number;
  /** 固定費(TWD)— 超商/ATM 是固定費,用百分比會算錯 */
  fixedTWD: number;
  /** 此方式在該情境的占比 */
  mixPercent: number;
}

export interface PaymentAssumptions {
  /** B2C 消費者付款組合 */
  consumer: PaymentMethod[];
  /** B2B 通路付款組合(電匯為主,費率低很多) */
  business: PaymentMethod[];
  /**
   * 一張 B2B 訂單涵蓋幾個單位(台數或席次×月數)。
   * 電匯固定費是「每筆匯款」收的,不是每台收的 —— 通路一次訂 200 台,
   * 那筆 300 元匯費要攤在 200 台上。少了這一項,單價低的品項會被固定費壓成負毛利。
   */
  b2bUnitsPerOrder: number;
  /** 跨境換匯價差 */
  fxSpread: number;
  /** 退款 / 拒付率(直接視為損失) */
  chargebackRate: number;
}

export interface HardwareCost {
  bomTWD: number;
  pcbaTWD: number;
  enclosurePackagingTWD: number;
  freightPerUnitTWD: number;
  /** 認證總額(CE/FCC/BSMI/NCC 等)與攤提台數 */
  certTotalTWD: number;
  certAmortUnits: number;
  toolingTotalTWD: number;
  toolingAmortUnits: number;
  /** 保固 RMA 準備金(對實體成本的比率) */
  rmaReserveRate: number;
  /** 呆滯報廢率 */
  scrapRate: number;
}

export interface SubscriptionCost {
  cloudPerDeviceMonthTWD: number;
  supportPerDeviceMonthTWD: number;
  intelPerDeviceMonthTWD: number;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  days: number;
  priceTWD: number;
}

export interface ForecastAssumptions {
  startingUnitsPerMonth: number;
  monthlyGrowthRate: number;
  /** 買硬體後開訂閱的比例 */
  subscriptionAttachRate: number;
  /** 每月流失率 */
  monthlyChurnRate: number;
  cacPerUnitTWD: number;
  fixedOpexPerMonthTWD: number;
  /** 通路付款條件(天),影響現金流缺口 */
  paymentTermsDays: number;
  months: number;
}

export interface Assumptions {
  hardware: HardwareCost;
  subscriptionCost: SubscriptionCost;
  plans: SubscriptionPlan[];
  /** 企業版每席每月(TWD) */
  enterprisePerSeatMonthTWD: number;
  /** 硬體建議售價,以當地幣計 */
  hardwareMsrpLocal: number;
  channels: ChannelPath[];
  payment: PaymentAssumptions;
  regions: Region[];
  activeRegionCode: string;
  activeChannelKind: ChannelKind;
  forecast: ForecastAssumptions;
  /** 顯示幣別;TWD 為記帳本位 */
  displayCurrency: Currency;
  usdToTWD: number;
  /** 目標毛利率,用於反推定價 */
  targetGrossMargin: number;
  corporateTaxRate: number;
}

export interface WaterfallStep {
  label: string;
  /** 對毛利的影響(TWD),負值為扣除 */
  amount: number;
  /** 此步驟後的累計餘額 */
  running: number;
  kind: 'start' | 'deduction' | 'result';
  hint?: string;
}

export interface UnitEconomics {
  listPriceTWD: number;
  vendorGrossTWD: number;
  netRevenueTWD: number;
  taxTWD: number;
  paymentFeeTWD: number;
  cogsTWD: number;
  dutyTWD: number;
  complianceTWD: number;
  grossProfitTWD: number;
  grossMargin: number;
  steps: WaterfallStep[];
}
