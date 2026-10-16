import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Award, Download, Eye, FileDown, Mail, RotateCcw, Search, ShieldOff, Trophy } from 'lucide-react';
import { api, downloadFile, errorMessage, openPdf } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import {
  Avatar, Badge, Button, Card, DeliveryBadge, EmptyState, ErrorNote, Field, Input, Modal, PageHeader, Select, Skeleton, useToast,
} from '../components/ui.jsx';

function ResendModal({ cert, onClose, onDone }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (cert) {
      setEmail(cert.participant.email);
      setError('');
    }
  }, [cert]);

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/certificates/${cert._id}/resend`, { email });
      toast(`Certificate emailed to ${email}`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={Boolean(cert)}
      title="Email certificate again"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="resend-form" icon={Mail} loading={busy}>Send email</Button>
        </>
      }
    >
      <form id="resend-form" onSubmit={send} className="space-y-4">
        <p className="text-[15px] text-ink-soft">
          Sends <b>{cert?.certificateId}</b> to {cert?.participant.name}. Fix the address here if they typed it wrong.
        </p>
        <Field label="Email address">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Modal>
  );
}

export default function Certificates() {
  const toast = useToast();
  const [events, setEvents] = useState([]);
  const [params] = useSearchParams();
  const [filters, setFilters] = useState({ search: params.get('search') || '', event: '', delivery: '', status: '', kind: '' });
  const [query, setQuery] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(null);

  useEffect(() => {
    api.get('/events').then((r) => setEvents(r.data.events)).catch(() => {});
  }, []);

  // Searching from the top bar while already on this page
  const urlSearch = params.get('search') || '';
  useEffect(() => {
    setFilters((f) => (f.search === urlSearch ? f : { ...f, search: urlSearch }));
  }, [urlSearch]);

  // Wait until typing pauses before searching
  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(filters);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [filters]);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get('/certificates', { params: { ...query, page, limit: 25 } });
      setData(d);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(cert, status) {
    if (status === 'revoked' && !window.confirm(`Revoke ${cert.certificateId}? The verify page will show it as not valid.`)) return;
    try {
      await api.patch(`/certificates/${cert._id}/status`, { status });
      toast(status === 'revoked' ? 'Certificate revoked' : 'Certificate restored');
      load();
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  }

  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const exportParams = new URLSearchParams(Object.entries(query).filter(([, v]) => v)).toString();

  return (
    <>
      <PageHeader
        title="Certificates"
        description="Every certificate issued, with its PDF stored in the database. Open, re-send or revoke any of them."
        actions={
          <Button
            variant="secondary"
            icon={FileDown}
            onClick={() => downloadFile(`/certificates/export.csv?${exportParams}`, 'certificates.csv').catch((e) => toast(errorMessage(e), 'bad'))}
          >
            Export to Excel (CSV)
          </Button>
        }
      />

      <Card className="mb-4 grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input className="pl-9" placeholder="Search name, register no, email or ID" value={filters.search} onChange={set('search')} aria-label="Search certificates" />
        </div>
        <Select value={filters.event} onChange={set('event')} aria-label="Filter by event">
          <option value="">All events</option>
          {events.map((ev) => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
        </Select>
        <Select value={filters.delivery} onChange={set('delivery')} aria-label="Filter by email status">
          <option value="">Any email status</option>
          <option value="sent">Emailed</option>
          <option value="pending">Sending</option>
          <option value="failed">Email failed</option>
        </Select>
        <Select value={filters.kind} onChange={set('kind')} aria-label="Filter by type">
          <option value="">Participation and awards</option>
          <option value="participation">Participation only</option>
          <option value="award">Awards only</option>
        </Select>
        <Select value={filters.status} onChange={set('status')} aria-label="Filter by validity">
          <option value="">Valid and revoked</option>
          <option value="active">Valid only</option>
          <option value="revoked">Revoked only</option>
        </Select>
      </Card>

      <ErrorNote>{error}</ErrorNote>
      {!data ? (
        error ? null : <Skeleton className="h-80 rounded-xl" />
      ) : data.certificates.length === 0 ? (
        <Card>
          <EmptyState icon={Award} title={Object.values(query).some(Boolean) ? 'No certificates match these filters' : 'No certificates yet'}>
            {Object.values(query).some(Boolean) ? 'Try clearing the search or filters.' : 'They are created automatically when participants submit the Google Form.'}
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* Phones: one card per certificate */}
          <Card className="divide-y divide-line md:hidden">
            {data.certificates.map((c) => (
              <div key={c._id} className={`p-4 ${c.status === 'revoked' ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={c.participant.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.participant.name}</p>
                    <p className="truncate text-sm text-muted">{c.participant.regNo}, {c.participant.email}</p>
                    <p className="mt-1 text-sm text-ink-soft">{c.eventSnapshot.name}, issued {fmtDate(c.issuedAt)}</p>
                    {c.kind === 'award' ? <Badge tone="gold" className="mt-1"><Trophy className="size-3" /> {c.award?.title}</Badge> : null}
                    <p className="mt-1 text-sm font-medium tabular-nums">{c.certificateId}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <DeliveryBadge cert={c} />
                  <CertActions cert={c} toast={toast} onResend={setResending} onStatus={setStatus} />
                </div>
                {c.delivery.status === 'failed' && c.status !== 'revoked' ? (
                  <p className="mt-2 text-xs text-bad">{c.delivery.lastError}</p>
                ) : null}
              </div>
            ))}
          </Card>

          <Card className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] text-left text-[15px]">
              <thead className="border-b border-line text-sm text-muted">
                <tr>
                  <th className="px-6 py-3 font-medium">Participant</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                  <th className="px-4 py-3 font-medium">Certificate ID</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.certificates.map((c) => (
                  <tr key={c._id} className={c.status === 'revoked' ? 'opacity-60' : ''}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                      <Avatar name={c.participant.name} />
                      <div className="min-w-0">
                      <p className="font-medium">{c.participant.name}</p>
                      <p className="text-sm text-muted">{c.participant.regNo}, {c.participant.email}</p>
                      </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p>{c.eventSnapshot.name}{c.kind === 'award' ? <Badge tone="gold" className="ml-2"><Trophy className="size-3" /> {c.award?.title}</Badge> : null}</p>
                      <p className="text-sm text-muted">Issued {fmtDate(c.issuedAt)}</p>
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">{c.certificateId}</td>
                    <td className="px-4 py-3">
                      <DeliveryBadge cert={c} />
                      {c.delivery.status === 'failed' && c.status !== 'revoked' ? (
                        <p className="mt-1 max-w-48 truncate text-xs text-bad" title={c.delivery.lastError}>{c.delivery.lastError}</p>
                      ) : null}
                    </td>
                    <td className="px-6 py-3">
                      <CertActions cert={c} toast={toast} onResend={setResending} onStatus={setStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-4 flex items-center justify-between text-sm text-muted">
            <span>{data.total} certificate{data.total === 1 ? '' : 's'}</span>
            {data.pages > 1 ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                <span>Page {page} of {data.pages}</span>
                <Button size="sm" variant="secondary" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</Button>
              </div>
            ) : null}
          </div>
        </>
      )}

      <ResendModal cert={resending} onClose={() => setResending(null)} onDone={() => { setResending(null); load(); }} />
    </>
  );
}

function CertActions({ cert: c, toast, onResend, onStatus }) {
  return (
    <div className="flex justify-end gap-1">
      <IconBtn label="View PDF" icon={Eye} onClick={() => openPdf(`/certificates/${c._id}/download?inline=1`).catch((e) => toast(errorMessage(e), 'bad'))} />
      <IconBtn label="Download PDF" icon={Download} onClick={() => downloadFile(`/certificates/${c._id}/download`, `${c.certificateId}.pdf`).catch((e) => toast(errorMessage(e), 'bad'))} />
      {c.status === 'active' ? (
        <>
          <IconBtn label="Email again" icon={Mail} onClick={() => onResend(c)} />
          <IconBtn label="Revoke" icon={ShieldOff} danger onClick={() => onStatus(c, 'revoked')} />
        </>
      ) : (
        <IconBtn label="Restore" icon={RotateCcw} onClick={() => onStatus(c, 'active')} />
      )}
    </div>
  );
}

function IconBtn({ label, icon: Icon, onClick, danger }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`rounded-md p-2 ${danger ? 'text-muted hover:bg-bad-wash hover:text-bad' : 'text-muted hover:bg-canvas hover:text-ink'}`}
    >
      <Icon className="size-[18px]" />
    </button>
  );
}
