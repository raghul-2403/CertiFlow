import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { AlertTriangle, ArrowUpRight, CalendarPlus, ChevronRight, Inbox, Link2, Mail, MonitorPlay, QrCode, RefreshCw } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { fmtDate, plural, timeAgo } from '../lib/format.js';
import {
  Avatar, Badge, Button, Card, DeliveryBadge, EmptyState, ErrorNote, EventStatusBadge, Select, Skeleton, useToast,
} from '../components/ui.jsx';
import DesignThumb from '../components/DesignThumb.jsx';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// The event a coordinator most likely cares about right now
function pickSpotlight(events) {
  const now = Date.now();
  const open = events.filter((e) => e.feedbackOpen);
  const live = open.filter((e) => new Date(e.date).getTime() <= now).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (live.length) return { event: live[0], live: true };
  const next = open.filter((e) => new Date(e.date).getTime() > now).sort((a, b) => new Date(a.date) - new Date(b.date));
  return next.length ? { event: next[0], live: false } : null;
}

function LiveStatus({ google, intervalSec = 30 }) {
  if (!google.connected) {
    return (
      <span className="inline-flex items-center gap-2 text-muted">
        <span className="size-2.5 rounded-full bg-faint" aria-hidden="true" /> Google Form not connected yet
      </span>
    );
  }
  const failed = Boolean(google.lastSyncError);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
      <span className="inline-flex items-center gap-2 font-semibold text-ink">
        <span className={`size-2.5 rounded-full ${failed ? 'bg-bad' : 'live-dot bg-ok'}`} aria-hidden="true" />
        {failed ? 'Not reading responses' : 'Live'}
      </span>
      <span>
        {failed ? 'The last check failed.' : `Reading new responses every ${intervalSec >= 60 ? plural(Math.round(intervalSec / 60), 'minute') : `${intervalSec} seconds`}.`} Last checked {timeAgo(google.lastSyncAt)}.
      </span>
    </span>
  );
}

function Pipeline({ counts }) {
  const steps = [
    { n: counts.feedback, label: 'Feedback received', sub: `across ${plural(counts.events, 'event')}` },
    { n: counts.certificates, label: 'Certificates issued', sub: 'stored with their PDF' },
    { n: counts.emailed, label: 'Emailed to participants', sub: counts.emailFailed ? `${counts.emailFailed} failed to send` : counts.emailPending ? `${counts.emailPending} still sending` : 'every one delivered', warn: counts.emailFailed > 0 },
  ];
  const pct = counts.certificates ? Math.round((counts.emailed / counts.certificates) * 100) : 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-6 pt-5">
        <h2 className="font-semibold">Certificate pipeline</h2>
        <span className="text-sm text-muted">All events</span>
      </div>
      <ol className="grid sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.label} className="relative px-6 pb-5 pt-4">
            {i > 0 ? (
              <ChevronRight className="absolute -left-3 top-12 hidden size-6 text-line sm:block" strokeWidth={1.5} aria-hidden="true" />
            ) : null}
            <p className="text-sm text-muted">{s.label}</p>
            <p className="heading mt-1 text-[3.6rem] tabular-nums text-ink">{s.n}</p>
            <p className={`text-sm ${s.warn ? 'font-medium text-bad' : 'text-muted'}`}>{s.sub}</p>
          </li>
        ))}
      </ol>
      <div className="border-t border-line bg-canvas/60 px-6 py-3.5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">
            <b className="text-ink">{counts.emailed}</b> of {counts.certificates} certificates delivered
          </span>
          <span className="font-semibold tabular-nums text-ink">{pct}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Certificates delivered">
          <div className="h-full rounded-full bg-gold transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Card>
  );
}

function Spotlight({ spot, googleConnected }) {
  const navigate = useNavigate();
  const [qr, setQr] = useState(null);
  const ev = spot?.event;

  useEffect(() => {
    setQr(null);
    if (!ev || !googleConnected) return;
    api.get(`/events/${ev._id}/qr`).then((r) => setQr(r.data.qrDataUrl)).catch(() => {});
  }, [ev?._id, googleConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ev) {
    return (
      <section className="rounded-xl bg-ink p-6 text-white">
        <p className="heading text-[1.9rem]">No event collecting feedback</p>
        <p className="mt-2 text-sm text-white/65">Create an event to get its QR code. Show it at the end of the event and certificates go out by themselves.</p>
        <Button icon={CalendarPlus} className="mt-5 bg-gold text-ink hover:bg-gold/90" onClick={() => navigate('/events?new=1')}>
          Create event
        </Button>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-xl bg-ink text-white">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gold" aria-hidden="true" />
      <div className="p-6">
        <p className="flex items-center gap-2 text-sm text-white/70">
          {spot.live ? <span className="live-dot size-2 rounded-full bg-ok" aria-hidden="true" /> : null}
          {spot.live ? 'Collecting feedback now' : `Next event, ${fmtDate(ev.date)}`}
        </p>
        <h2 className="heading mt-2 text-[2.1rem]">{ev.name}</h2>
        <p className="mt-1 text-sm text-white/60">{ev.organizer}</p>

        <div className="mt-5 flex items-center gap-5">
          <div className="grid size-[124px] shrink-0 place-items-center rounded-lg bg-white p-2">
            {qr ? (
              <img src={qr} alt={`QR code for ${ev.name}`} className="size-full" />
            ) : (
              <QrCode className="size-10 text-ink/25" aria-label={googleConnected ? 'Loading QR code' : 'QR code appears after connecting Google Form'} />
            )}
          </div>
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-white/55">Responses</dt>
              <dd className="heading text-3xl tabular-nums">{ev.stats.feedbackCount}</dd>
            </div>
            <div>
              <dt className="text-white/55">Certificates emailed</dt>
              <dd className="heading text-3xl tabular-nums">{ev.stats.emailed ?? 0}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button icon={MonitorPlay} className="bg-gold text-ink hover:bg-gold/90" onClick={() => navigate(`/events/${ev._id}/present`)} disabled={!googleConnected}>
            Present QR
          </Button>
          <Button variant="ghost" icon={ArrowUpRight} className="text-white/80 hover:bg-white/10 hover:text-white" onClick={() => navigate(`/events/${ev._id}`)}>
            Open event
          </Button>
        </div>
        {!googleConnected ? <p className="mt-3 text-xs text-white/55">Connect your Google Form in Settings to get the QR code.</p> : null}
      </div>
    </section>
  );
}

// Responses held back by the Attendance check of an event
const HELD = {
  not_registered: 'Held by “registered students only”. Approve if they really attended.',
  wrong_code: 'Held by the event code check. Approve if they really attended.',
};

function Issues({ issues, events, onChanged }) {
  const toast = useToast();
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(null);

  async function assign(issue, eventId = choice[issue._id]) {
    setBusy(issue._id);
    try {
      await api.post(`/dashboard/issues/${issue._id}/assign`, { eventId });
      toast(`Certificate issued to ${issue.answers?.name || 'participant'}`);
      onChanged();
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy(null);
    }
  }
  async function dismiss(issue) {
    setBusy(issue._id);
    try {
      await api.post(`/dashboard/issues/${issue._id}/dismiss`);
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center gap-2.5 border-b border-line px-6 py-4">
        <span className="grid size-8 place-items-center rounded-full bg-warn-wash text-warn"><AlertTriangle className="size-4" /></span>
        <h2 className="font-semibold">Responses that need you</h2>
        <Badge tone="warn">{issues.length}</Badge>
      </div>
      <ul className="divide-y divide-line">
        {issues.map((issue) => (
          <li key={issue._id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4">
            <Avatar name={issue.answers?.name || '?'} />
            <div className="min-w-48 flex-1">
              <p className="font-medium">
                {issue.answers?.name || 'Unnamed'} <span className="font-normal text-muted">{issue.answers?.regNo || ''}</span>
              </p>
              <p className="text-sm text-warn">{issue.reason}</p>
              {HELD[issue.code] ? <p className="mt-0.5 text-xs text-muted">{HELD[issue.code]}</p> : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {HELD[issue.code] && issue.event?._id ? (
                <Button size="sm" loading={busy === issue._id} onClick={() => assign(issue, issue.event._id)}>Approve and issue</Button>
              ) : null}
              {issue.code === 'unknown_event' || issue.code === 'feedback_closed' ? (
                <>
                  <Select
                    className="h-9 w-52 text-sm"
                    value={choice[issue._id] || ''}
                    onChange={(e) => setChoice({ ...choice, [issue._id]: e.target.value })}
                    aria-label="Choose event"
                  >
                    <option value="">Choose the right event</option>
                    {events.map((ev) => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
                  </Select>
                  <Button size="sm" disabled={!choice[issue._id]} loading={busy === issue._id} onClick={() => assign(issue)}>Issue certificate</Button>
                </>
              ) : null}
              <Button size="sm" variant="ghost" disabled={busy === issue._id} onClick={() => dismiss(issue)}>Dismiss</Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading overview">
      <Skeleton className="h-12 w-80" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Skeleton className="h-64" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const toast = useToast();
  const { admin } = useAuth();
  const [data, setData] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([api.get('/dashboard'), api.get('/events')]);
      setData(d.data);
      setAllEvents(e.data.events);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const spot = useMemo(() => pickSpotlight(allEvents), [allEvents]);

  async function syncNow() {
    setSyncing(true);
    try {
      const { data: r } = await api.post('/settings/sync');
      if (r.result.error) toast(r.result.error, 'bad');
      else if (r.result.skipped) toast(r.result.reason, 'bad');
      else toast(r.result.issued ? `${plural(r.result.issued, 'new certificate')} issued` : 'No new responses');
      load();
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setSyncing(false);
    }
  }

  if (!data) return error ? <ErrorNote>{error}</ErrorNote> : <DashboardSkeleton />;
  const { counts, google } = data;
  const firstName = (admin?.name || '').split(' ')[0];
  const others = allEvents.filter((e) => e._id !== spot?.event._id).slice(0, 4);

  return (
    <>
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="heading mt-1 text-[2.8rem] text-ink">{greeting()}{firstName && firstName !== 'Coordinator' ? `, ${firstName}` : ''}</h1>
          <p className="mt-2 text-[15px]"><LiveStatus google={google} intervalSec={data.syncIntervalSec} /></p>
        </div>
        {google.connected ? (
          <Button variant="secondary" icon={RefreshCw} loading={syncing} onClick={syncNow}>Check for responses now</Button>
        ) : null}
      </header>

      <div className="space-y-4">
        {!google.connected ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 border-gold/40 bg-gold-wash px-6 py-5">
            <div>
              <p className="font-semibold text-ink">Connect your Google Form to start collecting feedback</p>
              <p className="mt-0.5 text-sm text-ink-soft">It takes about three minutes. CertiFlow creates the form for you.</p>
            </div>
            <Link to="/settings"><Button icon={Link2}>Connect Google Form</Button></Link>
          </Card>
        ) : null}
        {google.connected && google.scriptVersion < google.latestScriptVersion ? (
          <Card className="flex flex-wrap items-center justify-between gap-4 border-gold/40 bg-gold-wash px-6 py-4">
            <p className="text-[15px] text-ink-soft">
              <b className="text-ink">Update your Google script</b>{' '}
              {google.scriptVersion < 2
                ? 'so participants can verify certificates by scanning the QR on their phone, and to use the event code.'
                : 'to use the rotating event code (it adds an optional “Event Code” question to your form).'}
            </p>
            <Link to="/settings"><Button size="sm">Show me how</Button></Link>
          </Card>
        ) : null}
        {data.email?.waitingForLimit ? (
          <Card className="flex items-start gap-3 border-warn/30 bg-warn-wash px-6 py-4">
            <Mail className="mt-0.5 size-5 shrink-0 text-warn" />
            <p className="text-[15px] text-ink">
              <b>{plural(data.email.waitingForLimit, 'certificate is', 'certificates are')} waiting</b> because Gmail&apos;s daily email limit was reached.
              CertiFlow sends them automatically once the limit resets (within 24 hours).
            </p>
          </Card>
        ) : data.email?.leftToday != null && data.email.leftToday < 25 ? (
          <Card className="flex items-start gap-3 border-warn/30 bg-warn-wash px-6 py-4">
            <Mail className="mt-0.5 size-5 shrink-0 text-warn" />
            <p className="text-[15px] text-ink">
              <b>Gmail can send about {data.email.leftToday} more emails today.</b> Certificates beyond that are sent automatically when the limit resets.
              For bigger events, set up SMTP (see <code className="text-sm">server/.env.example</code>).
            </p>
          </Card>
        ) : null}
        {google.lastSyncError ? (
          <ErrorNote>
            Couldn&apos;t read the Google Form: {google.lastSyncError}{' '}
            <Link to="/settings" className="font-semibold underline">Open Settings</Link>
          </ErrorNote>
        ) : null}
      </div>

      <div className="mt-2 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Pipeline counts={counts} />
          {data.issues.length ? <Issues issues={data.issues} events={allEvents} onChanged={load} /> : null}

          <Card>
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="font-semibold">Latest certificates</h2>
              <Link to="/certificates" className="link text-sm">View all</Link>
            </div>
            {data.recentCertificates.length ? (
              <ul className="divide-y divide-line">
                {data.recentCertificates.slice(0, 6).map((c) => (
                  <li key={c._id} className="flex items-center gap-3.5 px-6 py-3">
                    <Avatar name={c.participant.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.participant.name}</p>
                      <p className="truncate text-sm text-muted">{c.eventSnapshot.name}, {timeAgo(c.issuedAt)}</p>
                    </div>
                    <DeliveryBadge cert={c} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Inbox} title="No certificates yet">They appear here as soon as participants submit the form.</EmptyState>
            )}
          </Card>
        </div>

        <aside className="space-y-6 max-lg:order-first">
          <Spotlight spot={spot} googleConnected={google.connected} />
          {others.length ? (
            <Card>
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 className="font-semibold">Other events</h2>
                <Link to="/events" className="link text-sm">All events</Link>
              </div>
              <ul className="divide-y divide-line">
                {others.map((ev) => (
                  <li key={ev._id}>
                    <Link to={`/events/${ev._id}`} className="flex items-center gap-3.5 px-5 py-3 hover:bg-canvas">
                      <DesignThumb event={ev} className="w-[52px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{ev.name}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">{fmtDate(ev.date)} <EventStatusBadge event={ev} /></p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </aside>
      </div>
    </>
  );
}
