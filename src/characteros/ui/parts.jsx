import React from 'react';

export function Panel({ title, subtitle, right, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      {(title || right) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 gap-1.5">{right}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Meter({ label, value, hint, color = '#7dd3fc' }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="mb-1 flex items-baseline justify-between text-[11px]">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums text-slate-400">{hint ?? `${pct}%`}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function Chip({ children, tone = 'slate' }) {
  const tones = {
    slate: 'border-white/15 bg-white/5 text-slate-300',
    good: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    bad: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    info: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Toggle({ on, onClick, children, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition
        ${on ? 'border-sky-400/50 bg-sky-400/15 text-sky-100' : 'border-white/12 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]'}
        ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1 block text-[11px] font-medium text-slate-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] leading-snug text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded-lg border border-white/12 bg-black/30 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-600 focus:border-sky-400/50';
