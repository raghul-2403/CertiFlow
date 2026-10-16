import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Copy, Download, ExternalLink, FileDown, FileSpreadsheet, FileText, Lock, MapPin, MonitorPlay, Pencil, Printer, QrCode, Search, Trash2, Trophy, Unlock } from 'lucide-react';
import { api, downloadFile, errorMessage, openPdf } from '../lib/api.js';
import { fmtDate, fmtDateTime, plural } from '../lib/format.js';
import { Avatar, Badge, Button, Card, DeliveryBadge, EmptyState, ErrorNote, EventStatusBadge, Skeleton, Tabs, useToast } from '../components/ui.jsx';
import EventForm from '../components/EventForm.jsx';
import DesignCard from '../components/DesignCard.jsx';
import AccessTab from '../components/AccessTab.jsx';
import AwardsTab from '../components/AwardsTab.jsx';
import BulkIssueModal from '../components/BulkIssueModal.jsx';
import { orgLogoUrl, useOrg } from '../lib/org.jsx';
import { downloadQrPng } from '../lib/qr.js';

const REVIEWS = ['Excellent', 'Very Good', 'Good', 'Average', 'Poor'];

function QrPanel({ event }) {
  const toast = useToast();
  const navigate = useNavigate();
  const { org } = useOrg();
  const logo = orgLogoUrl(org);
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/events/${event._id}/qr`).then((r) => setQr(r.data)).catch((e) => setError(errorMessage(e)));
  }, [event._id, event.name, org.logoVersion]);

  if (error) {
    return (
      <Card className="p-6">
        <span className="grid size-11 place-items-center rounded-full bg-canvas"><QrCode className="size-5 text-muted" /></span>
        <p className="mt-4 font-semibold">QR code not ready</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
        <Link to="/settings"><Button size="sm" className="mt-4">Open Settings</Button></Link>
      </Card>
    );
  }
  if (!qr) return <Skeleton className="h-[440px] rounded-xl" />;

  return (
    <Card className="overflow-hidden">
      {/* Printable poster: only this block shows when printing */}
      <div id="qr-poster" className="relative isolate overflow-hidden px-6 pb-5 pt-6 text-center">
        {logo ? (
          <img src={logo} alt="" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 -z-10 w-[78%] -translate-x-1/2 -translate-y-1/2 opacity-[0.06] grayscale" />
        ) : null}
        {org.name ? <p className="text-xs font-medium uppercase tracking-[0.14em] text-gold-dark">{org.name}</p> : null}
        <p className="heading mt-1 text-[1.7rem]">{event.name}</p>
        <p className="mt-1 text-sm text-muted">Scan to share feedback and get your certificate</p>
        <div className="mx-auto mt-4 max-w-[240px] rounded-xl border-2 border-gold/60 bg-white p-2 shadow-sm">
          <img src={qr.qrDataUrl} alt={`QR code for ${event.name} feedback form`} className="w-full" />
        </div>
      </div>
      <div className="no-print space-y-2 border-t border-line p-4">
        <Button icon={MonitorPlay} className="w-full" onClick={() => navigate(`/events/${event._id}/present`)}>Present on projector</Button>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="secondary" icon={Download} onClick={() => downloadQrPng(qr.qrDataUrl, `${event.slug}-qr.png`)}>
            Save QR
          </Button>
          <Button size="sm" variant="secondary" icon={Printer} onClick={() => window.print()}>Print poster</Button>
          <Button size="sm" variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(qr.formLink).then(() => toast('Form link copied'))}>
            Copy link
          </Button>
          <a href={qr.formLink} target="_blank" rel="noreferrer">
            <Button size="sm" variant="secondary" icon={ExternalLink} className="w-full">Open form</Button>
          </a>
        </div>
      </div>
    </Card>
  );
}

function Bars({ title, rows, total, color }) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-ink">{title}</p>
      <ul className="space-y-2.5">
        {rows.map(([label, n]) => (
          <li key={label} className="grid grid-cols-[84px_1fr_32px] items-center gap-3 text-sm">
            <span className="text-ink-soft">{label}</span>
            <span className="h-2 overflow-hidden rounded-full bg-canvas">
              <span className={`block h-full rounded-full ${color}`} style={{ width: total ? `${(n / total) * 100}%` : 0 }} />
            </span>
            <span className="text-right tabular-nums text-muted">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stars({ n }) {
  if (!n) return null;
  return (
    <span aria-label={`${n} out of 5`}>
      <span className="text-gold">{'★'.repeat(n)}</span>
      <span className="text-line">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function KeyNumbers({ event, a }) {
  const issued = event.stats.certificatesIssued;
  const emailed = event.stats.emailed ?? 0;
  const items = [
    { label: 'Participants', value: a.total },
    { label: 'Average rating', value: a.averageRating ?? '–', suffix: a.averageRating ? '/ 5' : '' },
    { label: 'Certificates issued', value: issued },
    { label: 'Emailed', value: emailed, suffix: issued ? `${Math.round((emailed / issued) * 100)}%` : '' },
    { label: 'Colleges', value: a.colleges },
  ];
  return (
    <Card className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
      {items.map((it) => (
        <div key={it.label} className="px-5 py-4">
          <p className="text-sm text-muted">{it.label}</p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className="heading text-[2.4rem] tabular-nums text-ink">{it.value}</span>
            {it.suffix ? <span className="text-sm text-faint">{it.suffix}</span> : null}
          </p>
        </div>
      ))}
    </Card>
  );
}

function OverviewTab({ event, fb, onShowParticipants }) {
  const a = fb.analytics;
  const comments = fb.feedback.filter((f) => f.comments).slice(0, 4);
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <div className="self-start"><QrPanel event={event} /></div>
      <div className="no-print space-y-6">
        <Card className="p-6">
          <h2 className="font-semibold">What participants said</h2>
          {a.rated ? (
            <div className="mt-5 grid gap-8 md:grid-cols-2">
              <Bars title="How was the event?" rows={REVIEWS.map((r) => [r, a.reviewCounts[r] || 0])} total={a.rated} color="bg-blue" />
              <Bars title="Rating" rows={[5, 4, 3, 2, 1].map((r) => [`${r} star${r > 1 ? 's' : ''}`, a.ratingCounts[r - 1]])} total={a.rated} color="bg-gold" />
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">
              Ratings and reviews appear here once participants submit the form. New responses are read every {plural(30, 'second')}.
            </p>
          )}
        </Card>
        {comments.length ? (
          <Card>
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="font-semibold">Comments</h2>
              <button type="button" className="link text-sm" onClick={onShowParticipants}>See all responses</button>
            </div>
            <ul className="divide-y divide-line">
              {comments.map((f) => (
                <li key={f._id} className="px-6 py-4">
                  <p className="heading text-xl italic leading-snug text-ink">“{f.comments}”</p>
                  <p className="mt-2 text-sm text-muted">{f.participant.name}, {f.participant.college} <Stars n={f.rating} /></p>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function ParticipantsTab({ event, fb, onBulk, onAward }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return fb.feedback;
    return fb.feedback.filter((f) => `${f.participant.name} ${f.participant.regNo} ${f.participant.college} ${f.participant.email}`.toLowerCase().includes(s));
  }, [fb.feedback, q]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, register no., college"
            aria-label="Search participants"
            className="h-10 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-[15px] placeholder:text-faint focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" icon={FileSpreadsheet} onClick={onBulk}>Issue from Excel</Button>
          {fb.feedback.length ? (
            <Button size="sm" variant="secondary" icon={FileDown} onClick={() => downloadFile(`/events/${event._id}/export.csv`, `${event.slug}-feedback.csv`).catch((e) => toast(errorMessage(e), 'bad'))}>
              Export to Excel (CSV)
            </Button>
          ) : null}
        </div>
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map((f) => (
            <li key={f._id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-6 py-4">
              <Avatar name={f.participant.name} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {f.participant.name} <span className="font-normal text-muted">{f.participant.regNo}</span>
                </p>
                <p className="truncate text-sm text-muted">{[f.participant.college !== '-' && f.participant.college, f.participant.email].filter(Boolean).join(', ')}</p>
                {f.source === 'excel' ? (
                  <p className="mt-1 text-sm text-muted">Added from an attendance list</p>
                ) : (
                  <p className="mt-1 text-sm">
                    <Stars n={f.rating} />
                    <span className="ml-2 text-ink-soft">{f.review}</span>
                    {f.comments ? <span className="text-muted">: “{f.comments}”</span> : null}
                  </p>
                )}
                <button type="button" className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-gold-dark hover:underline" onClick={() => onAward(f)}>
                  <Trophy className="size-3.5" /> Give award
                </button>
              </div>
              <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                {f.certificate ? (
                  <>
                    <DeliveryBadge cert={f.certificate} />
                    <button type="button" className="link text-sm" onClick={() => openPdf(`/certificates/${f.certificate._id}/download?inline=1`).catch((e) => toast(errorMessage(e), 'bad'))}>
                      {f.certificate.certificateId}
                    </button>
                  </>
                ) : (
                  <Badge tone="warn">No certificate</Badge>
                )}
                <span className="text-xs text-faint">{fmtDateTime(f.submittedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={fb.feedback.length ? 'Nobody matches that search' : 'No responses yet'}>
          {fb.feedback.length ? 'Check the spelling or search by register number.' : 'Show the QR code at the end of the event; responses appear here within 30 seconds. Or issue certificates from an attendance list with “Issue from Excel”.'}
        </EmptyState>
      )}
    </Card>
  );
}

function DateTile({ date }) {
  const d = new Date(date);
  return (
    <div className="flex w-[68px] shrink-0 flex-col items-center overflow-hidden rounded-xl bg-paper text-center ring-1 ring-line">
      <span className="w-full bg-ink py-1 text-xs font-semibold text-white">{d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}</span>
      <span className="heading pb-1 pt-1.5 text-[2rem] text-ink">{d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
    </div>
  );
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [event, setEvent] = useState(null);
  const [fb, setFb] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [giveTo, setGiveTo] = useState(null);
  const tab = ['overview', 'participants', 'awards', 'access', 'design'].includes(params.get('tab')) ? params.get('tab') : 'overview';
  const setTab = (t) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });

  const load = useCallback(async () => {
    try {
      const [e, f] = await Promise.all([api.get(`/events/${id}`), api.get(`/events/${id}/feedback`)]);
      setEvent(e.data.event);
      setFb(f.data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Saved changes come back without the emailed count; keep the one we have
  const keepEmailed = (next) => setEvent((prev) => ({ ...next, stats: { ...next.stats, emailed: prev?.stats?.emailed ?? 0 } }));

  async function toggleOpen() {
    setBusy('toggle');
    try {
      const { data } = await api.patch(`/events/${id}`, { feedbackOpen: !event.feedbackOpen });
      keepEmailed(data.event);
      toast(data.event.feedbackOpen ? 'Feedback reopened' : 'Feedback closed. New responses will not get certificates.');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  async function downloadReport() {
    setBusy('report');
    try {
      await downloadFile(`/events/${id}/report.pdf`, `${event.slug}-report.pdf`);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${event.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/events/${id}`);
      toast('Event deleted');
      navigate('/events');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  }

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!event || !fb) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <>
      <div className="no-print">
        <Link to="/events" className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> All events
        </Link>
        <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-5">
            <DateTile date={event.date} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="heading text-[2.6rem] text-ink">{event.name}</h1>
                <EventStatusBadge event={event} />
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[15px] text-muted">
                <span>{event.organizer}</span>
                <span>{fmtDate(event.date)}</span>
                {event.venue ? <span className="inline-flex items-center gap-1"><MapPin className="size-4" />{event.venue}</span> : null}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={MonitorPlay} onClick={() => navigate(`/events/${event._id}/present`)}>Present QR</Button>
            <Button variant="secondary" icon={FileText} loading={busy === 'report'} onClick={downloadReport}>Report</Button>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit</Button>
            <Button variant="secondary" icon={event.feedbackOpen ? Lock : Unlock} loading={busy === 'toggle'} onClick={toggleOpen}>
              {event.feedbackOpen ? 'Close feedback' : 'Reopen feedback'}
            </Button>
            {event.stats.certificatesIssued === 0 ? (
              <Button variant="danger" icon={Trash2} onClick={remove} aria-label="Delete event" title="Delete event" />
            ) : null}
          </div>
        </header>

        <KeyNumbers event={event} a={fb.analytics} />

        <Tabs
          className="mb-6 mt-8"
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview' },
            { key: 'participants', label: 'Participants', count: fb.feedback.length },
            { key: 'awards', label: 'Awards', count: event.stats.awardsIssued || undefined },
            { key: 'access', label: 'Attendance check' },
            { key: 'design', label: 'Certificate design' },
          ]}
        />
      </div>

      {tab === 'overview' ? <OverviewTab event={event} fb={fb} onShowParticipants={() => setTab('participants')} /> : null}
      {tab === 'participants' ? (
        <ParticipantsTab
          event={event}
          fb={fb}
          onBulk={() => setBulkOpen(true)}
          onAward={(f) => {
            setGiveTo({ ...f, at: Date.now() });
            setTab('awards');
          }}
        />
      ) : null}
      {tab === 'awards' ? <div className="no-print"><AwardsTab event={event} participants={fb.feedback} giveTo={giveTo} onGiven={load} /></div> : null}
      {tab === 'access' ? <div className="no-print"><AccessTab event={event} /></div> : null}
      {tab === 'design' ? <div className="no-print"><DesignCard event={event} /></div> : null}

      <BulkIssueModal open={bulkOpen} event={event} onClose={() => setBulkOpen(false)} onFinished={load} />

      <EventForm
        open={editing}
        event={event}
        onClose={() => setEditing(false)}
        onSaved={(data) => {
          setEditing(false);
          keepEmailed(data.event);
          toast('Changes saved. New certificates will use them.');
        }}
      />

      <style>{`@media print { #qr-poster { padding-top: 15vh } #qr-poster p:first-child { font-size: 40px } #qr-poster div { max-width: 440px } }`}</style>
    </>
  );
}
