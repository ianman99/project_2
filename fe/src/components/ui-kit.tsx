import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/** 베벨 패널 — DESIGN.md Elevation 1 */
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="plate mb-4">
      {title && (
        <div className="slab px-3 py-1.5">
          <span className="legend text-amber">{title}</span>
        </div>
      )}
      <div className="p-3">{children}</div>
    </section>
  );
}

/** 눌리는 물리 버튼 — DESIGN.md Elevation 2 */
export function Chip({
  variant = 'amber',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'amber' | 'signal' }) {
  const bg = variant === 'signal' ? 'bg-signal' : 'bg-amber';
  return (
    <button
      {...props}
      className={`chip legend min-h-11 px-4 text-carbon disabled:opacity-50 ${bg} ${className}`}
    />
  );
}

export function Field({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mb-3 block">
      <span className="legend mb-1 block text-carbon">{label}</span>
      <input {...props} className="inset min-h-11 w-full px-2 text-[12px] text-carbon" />
    </label>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p className="inset mb-3 border-l-4 border-l-brand-red p-2 text-[11px] text-brand-red">
      {children}
    </p>
  ) : null;
}
