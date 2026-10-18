import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { CalendarPlus, MapPin, Search } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { Button, Card, EmptyState, ErrorNote, EventStatusBadge, PageHeader, Skeleton, Tabs, eventStatus, useToast } from '../components/ui.jsx';
import DesignThumb from '../components/DesignThumb.jsx';
import EventForm from '../components/EventForm.jsx';

const FILTERS = [
  { key: 'all', label: 'All events', test: () => true },
  { key: 'live', label: 'Collecting feedback', test: (e) => eventStatus(e).label === 'Collecting feedback' },
  { key: 'upcoming', label: 'Upcoming', test: (e) => eventStatus(e).label === 'Upcoming' },
  { key: 'closed', label: 'Closed', test: (e) => !e.feedbackOpen },
];

function DateTile({ date }) {
  const d = new Date(date);
  return (
    <div className="flex w-14 flex-col items-center overflow-hidden rounded-lg bg-paper text-center shadow-sm ring-1 ring-ink/10">
      <span className="w-full bg-ink py-0.5 text-[11px] font-semibold text-white">
        {d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'Asia/Kolkata' })}
      </span>
      <span className="heading py-1 text-2xl text-ink">{d.toLocaleDateString('en-IN', { day: 'numeric', timeZone: 'Asia/Kolkata' })}</span>
    </div>
  );
}

function EventCard({ ev }) {
  const issued = ev.stats.certificatesIssued;
  const emailed = ev.stats.emailed ?? 0;
  const pct = issued ? Math.round((emailed / issued) * 100) : 0;
  return (
    <Link
      to={`/events/${ev._id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-line bg-paper transition-[border-color,box-shadow] hover:border-ink/25 hover:shadow-[0_8px_30px_-12px_rgb(14_27_54_/_0.25)]"
    >
      <div className="relative border-b border-line bg-canvas p-3">
        <div className="overflow-hidden rounded-[3px] shadow-sm ring-1 ring-ink/5">
          <DesignThumb event={ev} cover />
        </div>
        <div className="absolute left-5 top-5">
          <DateTile date={ev.date} />
        </div>
        <div className="absolute right-5 top-5">
          <EventStatusBadge event={ev} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="heading text-[1.6rem] text-ink group-hover:underline group-hover:decoration-gold group-hover:decoration-2 group-hover:underline-offset-4">{ev.name}</h3>
        <p className="mt-1 text-sm text-muted">{ev.organizer}</p>
        {ev.venue ? (
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted"><MapPin className="size-3.5" /> {ev.venue}</p>
        ) : null}
        <div className="mt-auto pt-5">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-muted">Responses</dt><dd className="text-lg font-semibold tabular-nums">{ev.stats.feedbackCount}</dd></div>
            <div><dt className="text-muted">Certificates</dt><dd className="text-lg font-semibold tabular-nums">{issued}</dd></div>
            <div><dt className="text-muted">Emailed</dt><dd className="text-lg font-semibold tabular-nums">{emailed}</dd></div>
          </dl>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}


export default function Events() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const jarvisDraft = location.state?.jarvisDraft || null;

  const [params, setParams] = useSearchParams();
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const creating = params.get('new') === '1';


  useEffect(() => {
    api.get('/events').then((r) => setEvents(r.data.events)).catch((e) => setError(errorMessage(e)));
  }, []);

  const shown = useMemo(() => {
    if (!events) return [];
    const f = FILTERS.find((x) => x.key === filter);
    const q = query.trim().toLowerCase();
    // What matters now first: collecting feedback, then upcoming (soonest first), then closed (latest first)
    const rank = (e) => ({ 'Collecting feedback': 0, Upcoming: 1 })[eventStatus(e).label] ?? 2;
    const time = (e) => new Date(e.date).getTime();
    return events
      .filter((e) => f.test(e) && (!q || `${e.name} ${e.organizer} ${e.venue || ''}`.toLowerCase().includes(q)))
      .sort((a, b) => rank(a) - rank(b) || (rank(a) === 1 ? time(a) - time(b) : time(b) - time(a)));
  }, [events, filter, query]);

  return (
    <>
      <PageHeader
        title="Events"
        description="Each event has its own QR code and certificate design. Show the QR at the end of the event and certificates go out automatically."
      />
      <ErrorNote>{error}</ErrorNote>

      {!events ? (
        error ? null : (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[380px] rounded-xl" />)}
          </div>
        )
      ) : events.length === 0 ? (
        <Card>
          <EmptyState icon={CalendarPlus} title="No events yet" action={<Button onClick={() => setParams({ new: '1' })}>Create your first event</Button>}>
            Add the event name, date and certificate design. The QR code is ready straight away.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <Tabs
              className="flex-1"
              value={filter}
              onChange={setFilter}
              tabs={FILTERS.map((f) => ({ key: f.key, label: f.label, count: events.filter(f.test).length }))}
            />
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search events"
                aria-label="Search events"
                className="h-10 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-[15px] placeholder:text-faint focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15"
              />
            </div>
          </div>
          {shown.length ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((ev) => <EventCard key={ev._id} ev={ev} />)}
            </div>
          ) : (
            <Card><EmptyState title="No events match">Try another filter or clear the search.</EmptyState></Card>
          )}
        </>
      )}

      <EventForm
        open={creating}
        initialDraft={jarvisDraft}
        onClose={() => setParams({})}
        onSaved={(data) => {
          if (data.designError) toast(`Event created, but the design image failed: ${data.designError}. Upload it again under Certificate design.`, 'bad');
          else if (data.uploadedDesign) toast('Event created. Now drag the name and date into place under Certificate design.');
          else toast(data.adoptedResponses ? `Event created. ${data.adoptedResponses} waiting response(s) got their certificates.` : 'Event created');
          navigate(`/events/${data.event._id}${data.uploadedDesign || data.designError ? '?tab=design' : ''}`);
        }}
      />
    </>
  );
}
