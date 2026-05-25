import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Minimal shadcn-style primitives — kept dependency-free and local. */

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const styles = {
    primary: 'bg-olive-600 text-white hover:bg-olive-700 disabled:opacity-40',
    ghost: 'bg-transparent text-stone-700 hover:bg-stone-200 disabled:opacity-40',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-40',
  }[variant];
  return (
    <button
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
      {...props}
    />
  );
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    neutral: 'bg-stone-200 text-stone-700',
    active: 'bg-olive-100 text-olive-700',
    cancelled: 'bg-amber-100 text-amber-800',
    archived: 'bg-stone-300 text-stone-600',
    success: 'bg-emerald-100 text-emerald-700',
    error: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${tones[tone] ?? tones.neutral}`}>
      {children}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-stone-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-stone-400">{hint}</div>}
    </Card>
  );
}
