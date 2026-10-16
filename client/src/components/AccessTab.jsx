import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, KeyRound, Search, ShieldCheck, Trash2, Upload, Users } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { plural } from '../lib/format.js';
import { Badge, Button, Card, EmptyState, FileButton, Select, Skeleton, Switch, useToast } from './ui.jsx';

const SHEET_TYPES = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

// Big code with a countdown, refreshed when it changes
function LiveCode({ eventId }) {
  const [code, setCode] = useState(null);
  const [now, setNow] = useState(Date.now());
  const load = useCallback(() => api.get(`/events/${eventId}/code`).then((r) => setCode(r.data)).catch(() => {}), [eventId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      if (code?.changesAt && Date.now() >= new Date(code.changesAt).getTime()) load();
    }, 1000);
    return () => clearInterval(t);
  }, [code, load]);
  if (!code?.enabled) return null;
  const secs = Math.max(0, Math.round((new Date(code.changesAt).getTime() - now) / 1000));
  return (
    <div className="mt-4 flex items-center justify-between rounded-lg bg-ink px-5 py-3 text-white">
      <div>
        <p className="text-xs text-white/60">Code right now</p>
        <p className="heading text-[2.2rem] leading-none tracking-[0.2em] text-gold">{code.code}</p>
      </div>
      <p className="text-right text-sm text-white/70">changes in<br /><span className="tabular-nums text-white">{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span></p>
    </div>
  );
}

function RegisteredList({ eventId, version }) {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => {
      api.get(`/events/${eventId}/registrations`, { params: { search: q } }).then((r) => setData(r.data)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [eventId, q, version]);
  if (!data) return <Skeleton className="h-40 rounded-xl" />;
  if (!data.total) return null;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <h2 className="flex items-center gap-2 font-semibold"><Users className="size-5 text-muted" /> Registered students <Badge>{data.total}</Badge></h2>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the list"
            aria-label="Search registered students"
            className="h-10 w-full rounded-lg border border-line bg-paper pl-9 pr-3 text-[15px] placeholder:text-faint focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15"
          />
        </div>
      </div>
      {data.registrations.length ? (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
          {data.registrations.map((r) => (
            <li key={r._id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-3 text-[15px]">
              <div className="min-w-0">
                <p className="font-medium">{r.name || <span className="text-muted">No name in the list</span>} <span className="font-normal text-muted">{r.regNo}</span></p>
                {r.email || r.college ? <p className="truncate text-sm text-muted">{[r.college, r.email].filter(Boolean).join(', ')}</p> : null}
              </div>
              {r.attended ? <Badge tone="ok"><CheckCircle2 className="size-3.5" /> Gave feedback</Badge> : <Badge>Not yet</Badge>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-6 py-6 text-sm text-muted">Nobody on the list matches “{q}”.</p>
      )}
      {data.total > data.registrations.length && !q ? (
        <p className="border-t border-line px-6 py-3 text-sm text-muted">Showing the first {data.registrations.length}. Search to find anyone else.</p>
      ) : null}
    </Card>
  );
}

export default function AccessTab({ event }) {
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState('');
  const [version, setVersion] = useState(0);

  const load = useCallback(() => api.get(`/events/${event._id}/access`).then((r) => setInfo(r.data)).catch((e) => toast(errorMessage(e), 'bad')), [event._id, toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function update(change, key) {
    setBusy(key);
    try {
      const { data } = await api.patch(`/events/${event._id}/access`, change);
      setInfo((i) => ({ ...i, access: data.access }));
      if (data.released) toast(`${plural(data.released, 'held response')} released and emailed`);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  async function upload(file) {
    setBusy('upload');
    try {
      const { data } = await api.post(`/events/${event._id}/registrations`, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      setInfo((i) => ({ ...i, access: data.access }));
      setVersion((v) => v + 1);
      const parts = [`${plural(data.added, 'student')} added`];
      if (data.updated) parts.push(`${data.updated} updated`);
      if (data.released) parts.push(`${plural(data.released, 'held certificate')} released`);
      toast(parts.join(', '));
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  async function clearList() {
    if (!window.confirm('Remove everyone from the registered list? "Registered students only" will be switched off.')) return;
    setBusy('clear');
    try {
      const { data } = await api.delete(`/events/${event._id}/registrations`);
      setInfo((i) => ({ ...i, access: data.access }));
      setVersion((v) => v + 1);
      toast('Registered list cleared');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  if (!info) return <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  const { access, scriptSupportsCode } = info;

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-[15px] text-muted">
        Stop people who didn&apos;t attend from getting a certificate through a forwarded QR code. Responses that don&apos;t pass a check
        wait in <Link to="/" className="link">Responses that need you</Link> on the overview, where you can still approve them.
      </p>

      {access.held ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warn/30 bg-warn-wash px-6 py-4">
          <p className="flex items-center gap-2 text-[15px] text-ink"><AlertTriangle className="size-5 text-warn" /> {plural(access.held, 'response is', 'responses are')} being held back for this event.</p>
          <Link to="/"><Button size="sm" variant="secondary">Review them</Button></Link>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="size-5 text-muted" /> Registered students only</h2>
          <p className="mt-1 text-sm text-muted">
            Upload the registration list (Excel or CSV with a Register No column). Only register numbers on the list get a certificate automatically.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <FileButton accept={SHEET_TYPES} onFile={upload} variant="secondary" icon={Upload} loading={busy === 'upload'}>
              {access.registered ? 'Add more from a file' : 'Upload registration list'}
            </FileButton>
            {access.registered ? (
              <>
                <Badge tone="blue"><FileSpreadsheet className="size-3.5" /> {plural(access.registered, 'student')} on the list</Badge>
                <Button size="sm" variant="ghost" icon={Trash2} loading={busy === 'clear'} onClick={clearList}>Clear list</Button>
              </>
            ) : null}
          </div>
          <div className="mt-auto border-t border-line pt-5">
            <div className="mt-5">
              <Switch
                checked={access.registeredOnly}
                disabled={!access.registered}
                busy={busy === 'registeredOnly'}
                onChange={(v) => update({ registeredOnly: v }, 'registeredOnly')}
                label={access.registeredOnly ? 'On: only registered students' : 'Off: anyone who fills the form'}
              />
              {!access.registered ? <p className="mt-2 text-sm text-faint">Upload the list to turn this on.</p> : null}
            </div>
          </div>
        </Card>

        <Card className="flex flex-col p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="size-5 text-muted" /> Event code on the projector</h2>
          <p className="mt-1 text-sm text-muted">
            A 4-digit code shows on the Present QR screen and changes every few minutes. Participants type it into the form, so only people in the hall can claim a certificate.
          </p>
          {!scriptSupportsCode ? (
            <div className="mt-4 rounded-lg border border-gold/40 bg-gold-wash px-4 py-3 text-sm text-ink-soft">
              <b className="text-ink">Update your Google script first.</b> The new version adds an optional “Event Code” question to your form.
              {' '}<Link to="/settings" className="link">Open Settings</Link> → Copy script → paste it in Apps Script → Deploy → Manage deployments → Edit → New version.
            </div>
          ) : null}
          <LiveCode key={`${access.codeRequired}-${access.codeMinutes}`} eventId={event._id} />
          <div className="mt-auto border-t border-line pt-5">
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <Switch
                checked={access.codeRequired}
                disabled={!scriptSupportsCode && !access.codeRequired}
                busy={busy === 'codeRequired'}
                onChange={(v) => update({ codeRequired: v }, 'codeRequired')}
                label={access.codeRequired ? 'On: code needed' : 'Off: no code needed'}
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                Changes every
                <Select className="h-9 w-28 text-sm" value={access.codeMinutes} onChange={(e) => update({ codeMinutes: Number(e.target.value) }, 'minutes')} aria-label="Code changes every">
                  {[3, 5, 10, 15].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                </Select>
              </label>
            </div>
          </div>
        </Card>
      </div>

      <RegisteredList eventId={event._id} version={version} />
      {!access.registered ? (
        <Card>
          <EmptyState icon={FileSpreadsheet} title="No registration list yet">
            Any Excel or CSV file works. CertiFlow finds the Register No, Name, Email and College columns by their headings, in any order.
          </EmptyState>
        </Card>
      ) : null}
    </div>
  );
}
