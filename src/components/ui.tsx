import type { ReactNode } from 'react';
import { useState } from 'react';

export function Card({ title, subtitle, children, className = '' }: {
  title?: string; subtitle?: string; children: ReactNode; className?: string;
}) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {title && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'neutral' }: {
  label: string; value: string; sub?: string; tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const toneCls =
    tone === 'good' ? 'text-emerald-600'
      : tone === 'warn' ? 'text-amber-600'
        : tone === 'bad' ? 'text-red-600'
          : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`tabular mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Section({ title, children, defaultOpen = false }: {
  title: string; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-1 py-2.5 text-left text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        <span>{title}</span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="space-y-2 pb-3">{children}</div>}
    </div>
  );
}

export function NumberField({ label, value, onChange, step = 1, suffix, hint, min }: {
  label: string; value: number; onChange: (v: number) => void;
  step?: number; suffix?: string; hint?: string; min?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="flex-1 text-slate-600" title={hint}>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          step={step}
          min={min}
          onChange={(e) => onChange(Number(e.target.value))}
          className="tabular w-24 rounded border border-slate-300 px-2 py-1 text-right focus:border-blue-500 focus:outline-none"
        />
        {suffix && <span className="w-8 text-slate-400">{suffix}</span>}
      </span>
    </label>
  );
}

/** 百分比欄位:內部存小數(0.45),介面顯示 45 */
export function PercentField({ label, value, onChange, hint, step = 0.5 }: {
  label: string; value: number; onChange: (v: number) => void; hint?: string; step?: number;
}) {
  return (
    <NumberField
      label={label}
      value={Number((value * 100).toFixed(4))}
      onChange={(v) => onChange(v / 100)}
      step={step}
      suffix="%"
      hint={hint}
    />
  );
}

export function Slider({ label, value, onChange, min = 0, max = 0.9, step = 0.01, display }: {
  label: string; value: number; onChange: (v: number) => void;
  min?: number; max?: number; step?: number; display: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="tabular font-medium text-slate-900">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
    </div>
  );
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const cls =
    tone === 'good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : tone === 'warn' ? 'bg-amber-50 text-amber-700 border-amber-200'
        : tone === 'bad' ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function marginTone(m: number): 'good' | 'warn' | 'bad' {
  if (m >= 0.4) return 'good';
  if (m >= 0.15) return 'warn';
  return 'bad';
}
