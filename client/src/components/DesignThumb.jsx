import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { cx } from './ui.jsx';

// Preview of an event's certificate design, so you can see at a glance which one it uses.
// `cover` = full-width version for event cards.
export default function DesignThumb({ event, className, cover = false }) {
  const design = event.certificate?.design;
  const usesImage = design?.mode === 'image' && design?.templateFileId;
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (!usesImage) return undefined;
    let url;
    let cancelled = false;
    api.get(`/events/${event._id}/design/image`, { responseType: 'blob' })
      .then((r) => {
        if (cancelled) return;
        url = URL.createObjectURL(r.data);
        setSrc(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [event._id, usesImage, design?.templateFileId]);

  const box = cx(
    'aspect-[1.414] shrink-0 overflow-hidden bg-paper',
    cover ? 'w-full' : 'w-[76px] rounded-[3px] border border-line',
    className
  );

  if (usesImage) {
    return src ? (
      <img src={src} alt="" className={cx(box, 'object-cover')} />
    ) : (
      <div className={cx(box, 'animate-pulse bg-line/50')} aria-hidden="true" />
    );
  }

  // Standard design, card cover: a miniature of CertiFlow's plain certificate with the event's own title
  if (cover) {
    const sigs = event.certificate?.signatories?.length || 2;
    return (
      <div className={cx(box, 'relative flex flex-col items-center justify-center px-8 text-center')} aria-hidden="true">
        <span className="absolute inset-y-0 left-0 w-[7px] bg-blue" />
        <span className="absolute inset-y-0 left-[7px] w-[2px] bg-gold" />
        <span className="absolute inset-[10px] left-[18px] border border-gold/50" />
        <span className="text-[10px] text-muted">{event.organizer}</span>
        <span className="heading mt-1 text-[1.15rem] leading-tight text-ink">{event.certificate?.title || 'Certificate of Participation'}</span>
        <span className="mt-1.5 h-px w-10 bg-gold" />
        <span className="heading mt-2 text-[0.95rem] italic text-blue">Participant name</span>
        <span className="mt-1 text-[10px] text-ink-soft">{event.name}</span>
        <span className="mt-4 flex gap-6">
          {Array.from({ length: Math.min(sigs, 3) }, (_, i) => <span key={i} className="h-px w-12 bg-ink/40" />)}
        </span>
      </div>
    );
  }

  // Standard design, small thumbnail
  const s = 1;
  return (
    <div className={cx(box, 'relative flex flex-col items-center justify-center')} style={{ gap: 3 * s }} aria-hidden="true">
      <span className="absolute inset-y-0 left-0 bg-blue" style={{ width: 3 * s }} />
      <span className="absolute inset-y-0 bg-gold" style={{ left: 3 * s, width: s }} />
      <span className="rounded bg-ink/70" style={{ height: 3 * s, width: 32 * s }} />
      <span className="rounded bg-gold" style={{ height: 2 * s, width: 20 * s }} />
      <span className="rounded bg-blue/60" style={{ height: 3 * s, width: 40 * s, marginTop: 2 * s }} />
      <span className="rounded bg-line" style={{ height: 2 * s, width: 36 * s }} />
    </div>
  );
}
