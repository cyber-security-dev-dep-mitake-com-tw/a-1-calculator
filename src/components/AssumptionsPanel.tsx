import { effectiveCOGS } from '../model/cogs';
import { fmtMoney } from '../model/currency';
import type { AssumptionsApi } from '../state';
import { NumberField, PercentField, Section } from './ui';

export function AssumptionsPanel({ api }: { api: AssumptionsApi }) {
  const { a, update, updateSection } = api;
  const region = a.regions.find((r) => r.code === a.activeRegionCode)!;

  const setRegion = (patch: Partial<typeof region>) =>
    update({ regions: a.regions.map((r) => (r.code === region.code ? { ...r, ...patch } : r)) });

  const setChannel = (kind: string, patch: Record<string, number>) =>
    update({ channels: a.channels.map((c) => (c.kind === kind ? { ...c, ...patch } : c)) });

  return (
    <div className="divide-y divide-slate-200">
      <Section title="硬體成本" defaultOpen>
        <NumberField label="BOM" value={a.hardware.bomTWD} onChange={(v) => updateSection('hardware', { bomTWD: v })} step={10} suffix="元" />
        <NumberField label="PCBA / 組裝" value={a.hardware.pcbaTWD} onChange={(v) => updateSection('hardware', { pcbaTWD: v })} step={10} suffix="元" />
        <NumberField label="外殼 + 包材" value={a.hardware.enclosurePackagingTWD} onChange={(v) => updateSection('hardware', { enclosurePackagingTWD: v })} step={10} suffix="元" />
        <NumberField label="每台運費" value={a.hardware.freightPerUnitTWD} onChange={(v) => updateSection('hardware', { freightPerUnitTWD: v })} step={10} suffix="元" />
        <NumberField label="認證總額" value={a.hardware.certTotalTWD} onChange={(v) => updateSection('hardware', { certTotalTWD: v })} step={50000} suffix="元" hint="CE / FCC / BSMI / NCC" />
        <NumberField label="認證攤提台數" value={a.hardware.certAmortUnits} onChange={(v) => updateSection('hardware', { certAmortUnits: v })} step={1000} suffix="台" />
        <NumberField label="模具總額" value={a.hardware.toolingTotalTWD} onChange={(v) => updateSection('hardware', { toolingTotalTWD: v })} step={50000} suffix="元" />
        <NumberField label="模具攤提台數" value={a.hardware.toolingAmortUnits} onChange={(v) => updateSection('hardware', { toolingAmortUnits: v })} step={1000} suffix="台" />
        <PercentField label="RMA 保固準備" value={a.hardware.rmaReserveRate} onChange={(v) => updateSection('hardware', { rmaReserveRate: v })} />
        <PercentField label="呆滯報廢率" value={a.hardware.scrapRate} onChange={(v) => updateSection('hardware', { scrapRate: v })} />
        <div className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
          有效 COGS <span className="tabular float-right font-semibold text-slate-900">{fmtMoney(effectiveCOGS(a.hardware), a)}</span>
        </div>
      </Section>

      <Section title="訂閱價格與成本">
        {a.plans.map((p) => (
          <NumberField
            key={p.id}
            label={p.name}
            value={p.priceTWD}
            step={50}
            suffix="元"
            onChange={(v) => update({ plans: a.plans.map((x) => (x.id === p.id ? { ...x, priceTWD: v } : x)) })}
          />
        ))}
        <NumberField label="企業版 每席每月" value={a.enterprisePerSeatMonthTWD} onChange={(v) => update({ enterprisePerSeatMonthTWD: v })} step={10} suffix="元" hint="Portal 目前為 NT$1/席/天 ≈ 30 元" />
        <div className="pt-1" />
        <NumberField label="雲端 /裝置/月" value={a.subscriptionCost.cloudPerDeviceMonthTWD} onChange={(v) => updateSection('subscriptionCost', { cloudPerDeviceMonthTWD: v })} suffix="元" />
        <NumberField label="客服 /裝置/月" value={a.subscriptionCost.supportPerDeviceMonthTWD} onChange={(v) => updateSection('subscriptionCost', { supportPerDeviceMonthTWD: v })} suffix="元" />
        <NumberField label="情資 /裝置/月" value={a.subscriptionCost.intelPerDeviceMonthTWD} onChange={(v) => updateSection('subscriptionCost', { intelPerDeviceMonthTWD: v })} suffix="元" />
      </Section>

      <Section title="通路結構">
        {a.channels.map((c) => (
          <div key={c.kind} className="rounded border border-slate-200 p-2">
            <div className="mb-1 text-xs font-medium text-slate-700">{c.name}</div>
            {(c.kind === 'threeTier' || c.kind === 'msp') && (
              <PercentField label="總代折扣" value={c.distributorDiscount} onChange={(v) => setChannel(c.kind, { distributorDiscount: v })} hint="三階時原廠實收只看這一項" />
            )}
            {(c.kind === 'twoTier' || c.kind === 'threeTier') && (
              <PercentField label="經銷折扣" value={c.resellerDiscount} onChange={(v) => setChannel(c.kind, { resellerDiscount: v })} hint="三階時只影響通路內部分配" />
            )}
            {c.kind === 'marketplace' && (
              <PercentField label="平台抽成" value={c.marketplaceFeeRate} onChange={(v) => setChannel(c.kind, { marketplaceFeeRate: v })} />
            )}
            <PercentField label="續約分潤" value={c.renewalCommissionRate} onChange={(v) => setChannel(c.kind, { renewalCommissionRate: v })} hint="最常被漏算的長期侵蝕項" />
            <PercentField label="年度 rebate" value={c.annualRebateRate} onChange={(v) => setChannel(c.kind, { annualRebateRate: v })} />
            <NumberField label="銷量占比" value={c.mixPercent} onChange={(v) => setChannel(c.kind, { mixPercent: v })} step={5} suffix="%" />
          </div>
        ))}
      </Section>

      <Section title="金流">
        <div className="text-xs font-medium text-slate-500">消費端(B2C)</div>
        {a.payment.consumer.map((m) => (
          <div key={m.id} className="rounded border border-slate-200 p-2">
            <div className="mb-1 text-xs text-slate-700">{m.name}</div>
            <PercentField label="費率" value={m.rate} onChange={(v) => updateSection('payment', { consumer: a.payment.consumer.map((x) => (x.id === m.id ? { ...x, rate: v } : x)) })} step={0.1} />
            <NumberField label="固定費" value={m.fixedTWD} onChange={(v) => updateSection('payment', { consumer: a.payment.consumer.map((x) => (x.id === m.id ? { ...x, fixedTWD: v } : x)) })} suffix="元" />
            <NumberField label="占比" value={m.mixPercent} onChange={(v) => updateSection('payment', { consumer: a.payment.consumer.map((x) => (x.id === m.id ? { ...x, mixPercent: v } : x)) })} step={5} suffix="%" />
          </div>
        ))}
        <div className="pt-1 text-xs font-medium text-slate-500">企業端(B2B)</div>
        {a.payment.business.map((m) => (
          <div key={m.id} className="rounded border border-slate-200 p-2">
            <div className="mb-1 text-xs text-slate-700">{m.name}</div>
            <PercentField label="費率" value={m.rate} onChange={(v) => updateSection('payment', { business: a.payment.business.map((x) => (x.id === m.id ? { ...x, rate: v } : x)) })} step={0.05} />
            <NumberField label="固定費" value={m.fixedTWD} onChange={(v) => updateSection('payment', { business: a.payment.business.map((x) => (x.id === m.id ? { ...x, fixedTWD: v } : x)) })} step={50} suffix="元" />
            <NumberField label="占比" value={m.mixPercent} onChange={(v) => updateSection('payment', { business: a.payment.business.map((x) => (x.id === m.id ? { ...x, mixPercent: v } : x)) })} step={5} suffix="%" />
          </div>
        ))}
        <NumberField label="B2B 每單位數" value={a.payment.b2bUnitsPerOrder} onChange={(v) => updateSection('payment', { b2bUnitsPerOrder: v })} step={50} suffix="台" hint="一張通路訂單涵蓋幾台/幾席 —— 電匯固定費攤在這麼多單位上" />
        <PercentField label="跨境換匯價差" value={a.payment.fxSpread} onChange={(v) => updateSection('payment', { fxSpread: v })} step={0.1} />
        <PercentField label="退款 / 拒付率" value={a.payment.chargebackRate} onChange={(v) => updateSection('payment', { chargebackRate: v })} step={0.1} />
      </Section>

      <Section title={`地區稅制 — ${region.name}`}>
        <PercentField label="VAT / GST / Sales tax" value={region.taxRate} onChange={(v) => setRegion({ taxRate: v })} />
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600">稅制</span>
          <select
            value={region.taxMode}
            onChange={(e) => setRegion({ taxMode: e.target.value as 'inclusive' | 'exclusive' })}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="inclusive">內含(售價已含稅)</option>
            <option value="exclusive">外加(結帳時加)</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-slate-600">貿易條件</span>
          <select
            value={region.tradeTerm}
            onChange={(e) => setRegion({ tradeTerm: e.target.value as 'DDP' | 'DAP' | 'EXW' })}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="DDP">DDP(原廠負擔關稅)</option>
            <option value="DAP">DAP(進口商負擔)</option>
            <option value="EXW">EXW(進口商負擔)</option>
          </select>
        </label>
        <PercentField label="進口關稅" value={region.importDutyRate} onChange={(v) => setRegion({ importDutyRate: v })} />
        <NumberField label={`匯率 1 ${region.localCurrency} =`} value={region.fxToTWD} onChange={(v) => setRegion({ fxToTWD: v })} step={0.1} suffix="元" />
        <NumberField label="當地合規年成本" value={region.annualComplianceCostTWD} onChange={(v) => setRegion({ annualComplianceCostTWD: v })} step={10000} suffix="元" />
        <PercentField label="跨境卡附加" value={region.intlCardSurcharge} onChange={(v) => setRegion({ intlCardSurcharge: v })} step={0.1} />
        {region.note && <p className="pt-1 text-xs text-slate-500">{region.note}</p>}
      </Section>

      <Section title="預測參數">
        <NumberField label="起始月銷量" value={a.forecast.startingUnitsPerMonth} onChange={(v) => updateSection('forecast', { startingUnitsPerMonth: v })} step={50} suffix="台" />
        <PercentField label="月成長率" value={a.forecast.monthlyGrowthRate} onChange={(v) => updateSection('forecast', { monthlyGrowthRate: v })} />
        <PercentField label="訂閱綁定率" value={a.forecast.subscriptionAttachRate} onChange={(v) => updateSection('forecast', { subscriptionAttachRate: v })} />
        <PercentField label="月流失率" value={a.forecast.monthlyChurnRate} onChange={(v) => updateSection('forecast', { monthlyChurnRate: v })} />
        <NumberField label="每台 CAC" value={a.forecast.cacPerUnitTWD} onChange={(v) => updateSection('forecast', { cacPerUnitTWD: v })} step={50} suffix="元" />
        <NumberField label="固定營運費 /月" value={a.forecast.fixedOpexPerMonthTWD} onChange={(v) => updateSection('forecast', { fixedOpexPerMonthTWD: v })} step={100000} suffix="元" />
        <NumberField label="通路付款天數" value={a.forecast.paymentTermsDays} onChange={(v) => updateSection('forecast', { paymentTermsDays: v })} step={15} suffix="天" hint="影響現金缺口,不影響認列損益" />
      </Section>
    </div>
  );
}
