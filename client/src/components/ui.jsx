import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

export const cx = (...c) => c.filter(Boolean).join(' ');

const BTN = {
  primary: 'bg-blue text-white hover:bg-blue-dark disabled:bg-blue/50',
  secondary: 'bg-paper text-ink border border-line hover:border-ink-soft/40 hover:bg-canvas disabled:opacity-50',
  ghost: 'text-ink-soft hover:bg-canvas hover:text-ink disabled:opacity-50',
  danger: 'bg-paper text-bad border border-bad/30 hover:bg-bad-wash disabled:opacity-50',
};

export function Button({ variant = 'primary', size = 'md', loading, icon: Icon, children, className, ...props }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed',
        size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-[15px]',
        BTN[variant],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" strokeWidth={2.2} /> : null}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-sm text-bad">{error}</span> : hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}

const INPUT = 'w-full rounded-lg border border-line bg-paper px-3 text-[15px] text-ink placeholder:text-faint focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/20';

export const Input = ({ className, ...p }) => <input className={cx(INPUT, 'h-10', className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx(INPUT, 'py-2 leading-relaxed', className)} {...p} />;
export const Select = ({ className, children, ...p }) => (
  <select className={cx(INPUT, 'h-10 pr-8', className)} {...p}>{children}</select>
);

const BADGE = {
  blue: 'bg-blue-wash text-blue',
  gold: 'bg-gold-wash text-gold-dark',
  ok: 'bg-ok-wash text-ok',
  warn: 'bg-warn-wash text-warn',
  bad: 'bg-bad-wash text-bad',
  muted: 'bg-canvas text-muted',
};
export const Badge = ({ tone = 'muted', children, className }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGE[tone], className)}>{children}</span>
);

const DELIVERY = { sent: ['ok', 'Emailed'], pending: ['warn', 'Sending'], failed: ['bad', 'Email failed'] };
export function DeliveryBadge({ cert }) {
  if (cert?.status === 'revoked') return <Badge tone="bad">Revoked</Badge>;
  const [tone, label] = DELIVERY[cert?.delivery?.status] || ['muted', 'Unknown'];
  return <Badge tone={tone}>{label}</Badge>;
}

export const Card = ({ className, children, ...rest }) => (
  <section {...rest} className={cx('rounded-xl border border-line bg-paper', className)}>{children}</section>
);

export function PageHeader({ title, description, actions }) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="heading text-[2.6rem] text-ink">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon ? <Icon className="mb-3 size-8 text-faint" strokeWidth={1.6} /> : null}
      <p className="font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 max-w-sm text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

// Grey placeholder shaped like the content that is loading
export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-md bg-line/70', className)} aria-hidden="true" />;
}

// Round initials badge, tinted by name so the same person always gets the same colour
const AVATAR_TONES = ['bg-blue-wash text-blue', 'bg-gold-wash text-gold-dark', 'bg-ok-wash text-ok', 'bg-[#efe9f6] text-[#5b3f86]', 'bg-[#e6f1f5] text-[#1f5d73]'];
export function Avatar({ name = '', className }) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className={cx('inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', AVATAR_TONES[h % AVATAR_TONES.length], className)} aria-hidden="true">
      {initials}
    </span>
  );
}

// Underlined tabs with a gold indicator
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div role="tablist" className={cx('no-scrollbar flex gap-5 overflow-x-auto border-b border-line sm:gap-6', className)}>
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cx(
              '-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 pt-1 text-[15px] transition-colors',
              active ? 'border-gold font-semibold text-ink' : 'border-transparent text-muted hover:text-ink'
            )}
          >
            {t.label}
            {t.count != null ? <span className={cx('rounded-full px-2 text-xs tabular-nums', active ? 'bg-ink text-white' : 'bg-canvas text-muted')}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

// On/off switch with a label next to it
export function Switch({ checked, onChange, label, disabled, busy }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
      className={cx('inline-flex items-center gap-3 text-left disabled:cursor-not-allowed disabled:opacity-50')}
    >
      <span className={cx('relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-ok' : 'bg-line')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
      {label ? <span className="text-[15px] font-medium text-ink">{label}</span> : null}
      {busy ? <Loader2 className="size-4 animate-spin text-muted" /> : null}
    </button>
  );
}

// Picks a file with a hidden <input type="file">
export function FileButton({ accept, onFile, children, ...props }) {
  const ref = useRef(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onFile(f);
        }}
      />
      <Button {...props} onClick={() => ref.current?.click()}>{children}</Button>
    </>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted" role="status">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return <div className="rounded-lg border border-bad/20 bg-bad-wash px-3.5 py-2.5 text-sm text-bad" role="alert">{children}</div>;
}

export function Modal({ open, title, onClose, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    (ref.current?.querySelector('input, textarea, select') || ref.current?.querySelector('button'))?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center" onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('my-8 w-full rounded-xl bg-paper shadow-xl', wide ? 'max-w-2xl' : 'max-w-md')}
      >
        <div className="edge-band h-1 rounded-t-xl" />
        <div className="flex items-center justify-between px-6 pt-5">
          <h2 className="heading text-2xl">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-canvas" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer ? <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

// ---- Toasts ----
const ToastContext = createContext(() => {});
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="no-print fixed bottom-5 right-5 z-[60] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('rounded-lg border-l-4 bg-ink px-4 py-3 text-sm text-white shadow-lg', t.tone === 'bad' ? 'border-bad' : 'border-gold')}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Event status: closed (grey), upcoming (gold), collecting feedback (green)
export function eventStatus(ev) {
  if (!ev.feedbackOpen) return { tone: 'muted', label: 'Feedback closed' };
  if (new Date(ev.date) > new Date()) return { tone: 'gold', label: 'Upcoming' };
  return { tone: 'ok', label: 'Collecting feedback' };
}

export function EventStatusBadge({ event }) {
  const s = eventStatus(event);
  return <Badge tone={s.tone}>{s.label}</Badge>;
}
