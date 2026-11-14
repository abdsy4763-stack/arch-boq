import { useState, type ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-card border border-line bg-card ${className}`}>{children}</section>;
}

export function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const [warning, setWarning] = useState("");
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => {
          const next = event.target.value;
          if (/^-/.test(next)) {
            setWarning("القيمة لا يمكن أن تكون سالبة.");
            return;
          }
          const numeric = Number(next.replace(",", "."));
          setWarning(next && Number.isFinite(numeric) && numeric > 15 && /ارتفاع|height/i.test(label) ? "تنبيه: القيمة أكبر من 15 م، راجعها قبل التوليد." : "");
          onChange(next);
        }}
        inputMode="decimal"
        className="num h-11 w-full rounded-lg border border-line bg-input px-3 text-sm outline-none focus:border-teal"
      />
      {warning ? <span className="mt-1 block text-xs text-amber">{warning}</span> : null}
    </label>
  );
}

/** حقل نصي يقبل رقماً أو تعبيراً حسابياً بسيطاً مثل 3.33+5.04 أو 333/100، ويعرض ناتجه. */
export function ExprField({ label, value, onChange, placeholder, result }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; result?: number }) {
  const isExpr = /[+\-*/()×÷]/.test(value.trim().replace(/^-/, ""));
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} inputMode="text" dir="ltr" autoComplete="off" className="num h-11 w-full rounded-lg border border-line bg-input px-3 text-sm outline-none focus:border-teal" />
      {isExpr && result !== undefined ? <span className="num mt-1 block text-xs text-muted">= {Math.round(result * 100) / 100}</span> : null}
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-input px-3 text-sm outline-none focus:border-teal" />
    </label>
  );
}

export function Btn({ children, onClick, tone = "primary", type = "button" }: { children: ReactNode; onClick?: () => void; tone?: "primary" | "ghost" | "danger" | "navy"; type?: "button" | "submit" }) {
  const tones = { primary: "bg-teal text-on-teal", navy: "bg-navy text-on-navy", ghost: "border border-line bg-card text-ink", danger: "border border-danger/30 bg-danger-bg text-danger" };
  return <button type={type} onClick={onClick} className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold ${tones[tone]}`}>{children}</button>;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "تأكيد الحذف", onConfirm, onCancel }: { open: boolean; title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/60 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="w-full max-w-sm rounded-card border border-line bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
        <div className="mt-5 flex justify-end gap-2"><Btn tone="ghost" onClick={onCancel}>إلغاء</Btn><Btn tone="danger" onClick={onConfirm}>{confirmLabel}</Btn></div>
      </div>
    </div>
  );
}

export function InfoDialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/60 p-4" role="presentation">
    <div role="dialog" aria-modal="true" aria-labelledby="info-dialog-title" className="w-full max-w-lg rounded-card border border-line bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <h2 id="info-dialog-title" className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-muted">{children}</div>
      <div className="mt-5 flex justify-end"><Btn tone="ghost" onClick={onClose}>إغلاق</Btn></div>
    </div>
  </div>;
}
