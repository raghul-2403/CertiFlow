import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, Eye, Mail, Medal, RotateCcw, Search, ShieldOff, Trophy, UserPlus } from 'lucide-react';
import { api, errorMessage, openPdf } from '../lib/api.js';
import { fmtDateTime } from '../lib/format.js';
import { Avatar, Badge, Button, Card, DeliveryBadge, EmptyState, ErrorNote, Field, Input, Modal, Skeleton, cx, useToast } from './ui.jsx';

const ICONS = { first: Trophy, second: Medal, third: Medal, winner: Trophy, special: Award, volunteer: UserPlus, organiser: UserPlus };

function GiveAwardModal({ open, event, participants, preselect, onClose, onDone }) {
  const toast = useToast();
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('first');
  const [title, setTitle] = useState('');
  const [who, setWho] = useState('participant'); // participant | other
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [other, setOther] = useState({ name: '', email: '', regNo: '', college: '' });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    api.get('/events/meta/award-types').then((r) => setTypes(r.data.types)).catch(() => {});
    setError('');
    setTitle('');
    setQ('');
    setPicked(preselect || null);
    setWho(participants.length ? 'participant' : 'other');
    setOther({ name: '', email: '', regNo: '', college: '' });
  }, [open, preselect, participants.length]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = s ? participants.filter((f) => `${f.participant.name} ${f.participant.regNo} ${f.participant.college}`.toLowerCase().includes(s)) : participants;
    return all.slice(0, 50);
  }, [participants, q]);

  const current = types.find((t) => t.key === type);
  const name = who === 'participant' ? picked?.participant.name : other.name;

  async function give() {
    setError('');
    if (who === 'participant' && !picked) return setError('Choose who gets the award');
    setBusy('give');
    try {
      const body = { type, title: title.trim() || undefined, ...(who === 'participant' ? { feedbackId: picked._id } : { participant: other }) };
      const { data } = await api.post(`/events/${event._id}/awards`, body);
      const sent = data.certificate.delivery.status === 'sent';
      toast(sent ? `${data.certificate.award.title} certificate emailed to ${data.certificate.participant.name}` : `Certificate created. Email: ${data.certificate.delivery.lastError}`, sent ? 'ok' : 'bad');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  const preview = () => {
    const params = new URLSearchParams({ type, name: name || 'Sample Participant Name' });
    if (title.trim()) params.set('title', title.trim());
    openPdf(`/events/${event._id}/awards/preview.pdf?${params}`).catch((e) => toast(errorMessage(e), 'bad'));
  };

  return (
    <Modal
      open={open}
      wide
      title="Give an award"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" icon={Eye} onClick={preview}>Preview</Button>
          <Button icon={Mail} loading={busy === 'give'} onClick={give}>Create and email</Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-sm font-medium">Award</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {types.map((t) => {
              const Icon = ICONS[t.key] || Award;
              return (
                <button
                  key={t.key}
                  type="button"
                  aria-pressed={type === t.key}
                  onClick={() => setType(t.key)}
                  className={cx('rounded-lg border px-3 py-2.5 text-left text-sm transition-colors', type === t.key ? 'border-blue bg-blue-wash font-semibold text-ink' : 'border-line hover:border-ink-soft/40')}
                >
                  <Icon className={cx('mb-1 size-4', type === t.key ? 'text-gold-dark' : 'text-muted')} />
                  {t.label}
                </button>
              );
            })}
          </div>
          {current ? <p className="mt-2 text-sm text-muted">Printed as <b className="text-ink">{current.kicker}</b>, “{current.line} {event.name}”.</p> : null}
        </div>

        <Field label="Title on the ribbon (optional)" hint={`Leave empty for “${current?.title || ''}”. Example: Best Debugger.`}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder={current?.title} />
        </Field>

        <div>
          <div className="mb-2 flex gap-1 rounded-lg bg-canvas p-1 text-sm">
            {[['participant', 'A participant'], ['other', 'Someone else (volunteer, judge…)']].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setWho(k)} className={cx('flex-1 rounded-md px-3 py-1.5', who === k ? 'bg-paper font-semibold shadow-sm' : 'text-muted')}>{label}</button>
            ))}
          </div>
          {who === 'participant' ? (
            participants.length ? (
              <div className="rounded-lg border border-line">
                <div className="relative border-b border-line">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or register no." aria-label="Search participants for the award" className="h-10 w-full rounded-t-lg bg-paper pl-9 pr-3 text-[15px] focus:outline-none" />
                </div>
                <ul className="max-h-56 overflow-y-auto">
                  {list.map((f) => (
                    <li key={f._id}>
                      <button type="button" onClick={() => setPicked(f)} className={cx('flex w-full items-center gap-3 px-3 py-2 text-left text-sm', picked?._id === f._id ? 'bg-blue-wash' : 'hover:bg-canvas')}>
                        <Avatar name={f.participant.name} className="size-7 text-[11px]" />
                        <span className="min-w-0 flex-1 truncate"><b className="font-medium">{f.participant.name}</b> <span className="text-muted">{f.participant.regNo}, {f.participant.college}</span></span>
                        {picked?._id === f._id ? <Badge tone="blue">Chosen</Badge> : null}
                      </button>
                    </li>
                  ))}
                  {!list.length ? <li className="px-3 py-4 text-sm text-muted">Nobody matches.</li> : null}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted">No participants yet. Use “Someone else”.</p>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name on the certificate"><Input value={other.name} onChange={(e) => setOther({ ...other, name: e.target.value })} required /></Field>
              <Field label="Email"><Input type="email" value={other.email} onChange={(e) => setOther({ ...other, email: e.target.value })} required /></Field>
              <Field label="Register no. (optional)"><Input value={other.regNo} onChange={(e) => setOther({ ...other, regNo: e.target.value })} /></Field>
              <Field label="College (optional)"><Input value={other.college} onChange={(e) => setOther({ ...other, college: e.target.value })} /></Field>
            </div>
          )}
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

export default function AwardsTab({ event, participants, giveTo, onGiven }) {
  const toast = useToast();
  const [awards, setAwards] = useState(null);
  const [open, setOpen] = useState(false);
  const [preselect, setPreselect] = useState(null);

  const load = useCallback(() => api.get(`/events/${event._id}/awards`).then((r) => setAwards(r.data.awards)).catch((e) => toast(errorMessage(e), 'bad')), [event._id, toast]);
  useEffect(() => {
    load();
  }, [load]);
  // "Give award" from the Participants tab
  useEffect(() => {
    if (giveTo) {
      setPreselect(giveTo);
      setOpen(true);
    }
  }, [giveTo]);

  async function resend(c) {
    try {
      await api.post(`/certificates/${c._id}/resend`, {});
      toast(`Emailed to ${c.participant.email}`);
      load();
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  }
  async function setStatus(c, status) {
    if (status === 'revoked' && !window.confirm(`Revoke the ${c.award?.title} certificate of ${c.participant.name}?`)) return;
    try {
      await api.patch(`/certificates/${c._id}/status`, { status });
      load();
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  }

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 className="font-semibold">Awards</h2>
            <p className="text-sm text-muted">Certificates of merit for winners, and of appreciation for volunteers and the organising team.</p>
          </div>
          <Button icon={Trophy} onClick={() => { setPreselect(null); setOpen(true); }}>Give an award</Button>
        </div>
        {!awards ? (
          <div className="p-6"><Skeleton className="h-20" /></div>
        ) : awards.length ? (
          <ul className="divide-y divide-line">
            {awards.map((c) => (
              <li key={c._id} className={cx('flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4', c.status === 'revoked' && 'opacity-60')}>
                <div className="flex min-w-0 flex-1 basis-64 items-center gap-4">
                  <Avatar name={c.participant.name} />
                  <div className="min-w-0">
                    <p className="font-medium">{c.participant.name} <Badge tone="gold" className="ml-1 whitespace-nowrap align-middle"><Trophy className="size-3" /> {c.award?.title}</Badge></p>
                    <p className="truncate text-sm text-muted">{c.participant.email} · {c.certificateId} · {fmtDateTime(c.issuedAt)}</p>
                  </div>
                </div>
                <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
                  <DeliveryBadge cert={c} />
                  <div className="flex gap-1">
                    <IconBtn label="View PDF" icon={Eye} onClick={() => openPdf(`/certificates/${c._id}/download?inline=1`).catch((e) => toast(errorMessage(e), 'bad'))} />
                    {c.status === 'active' ? (
                      <>
                        <IconBtn label="Email again" icon={Mail} onClick={() => resend(c)} />
                        <IconBtn label="Revoke" icon={ShieldOff} danger onClick={() => setStatus(c, 'revoked')} />
                      </>
                    ) : (
                      <IconBtn label="Restore" icon={RotateCcw} onClick={() => setStatus(c, 'active')} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Trophy} title="No awards yet">
            Give winners a Certificate of Merit, and volunteers a Certificate of Appreciation. They are emailed straight away.
          </EmptyState>
        )}
      </Card>
      <GiveAwardModal
        open={open}
        event={event}
        participants={participants}
        preselect={preselect}
        onClose={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          load();
          onGiven?.();
        }}
      />
    </>
  );
}

function IconBtn({ label, icon: Icon, onClick, danger }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={cx('rounded-md p-2', danger ? 'text-muted hover:bg-bad-wash hover:text-bad' : 'text-muted hover:bg-canvas hover:text-ink')}>
      <Icon className="size-[18px]" />
    </button>
  );
}
