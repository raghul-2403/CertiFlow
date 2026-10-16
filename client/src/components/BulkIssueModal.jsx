import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { plural } from '../lib/format.js';
import { Badge, Button, ErrorNote, FileButton, Modal, cx } from './ui.jsx';

const SHEET_TYPES = '.xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';
const COLUMN_NAMES = { regNo: 'Register no.', name: 'Name', email: 'Email', college: 'College' };

// Issue certificates to everyone on an attendance list, without the Google Form
export default function BulkIssueModal({ open, event, onClose, onFinished }) {
  const [step, setStep] = useState('pick'); // pick | preview | running | done
  const [preview, setPreview] = useState(null);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const poll = useRef(null);

  useEffect(() => {
    if (open) {
      setStep('pick');
      setPreview(null);
      setJob(null);
      setError('');
    }
    return () => clearInterval(poll.current);
  }, [open]);

  async function read(file) {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/events/${event._id}/bulk/preview`, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } });
      setPreview({ ...data, fileName: file.name });
      setStep('preview');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post(`/events/${event._id}/bulk`, { people: preview.rows.filter((r) => r.status === 'ready') });
      setJob(data.job);
      setStep('running');
      poll.current = setInterval(async () => {
        try {
          const r = await api.get(`/events/${event._id}/bulk/${data.job.id}`);
          setJob(r.data.job);
          if (r.data.job.status !== 'running') {
            clearInterval(poll.current);
            setStep('done');
            onFinished?.();
          }
        } catch (err) {
          clearInterval(poll.current);
          setError(errorMessage(err));
        }
      }, 1000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = preview?.ready || 0;
  const left = preview?.emailsLeftToday;
  const footer = {
    pick: <Button variant="secondary" onClick={onClose}>Cancel</Button>,
    preview: (
      <>
        <Button variant="secondary" onClick={() => setStep('pick')}>Choose another file</Button>
        <Button disabled={!ready} loading={busy} onClick={start}>Issue {plural(ready, 'certificate')}</Button>
      </>
    ),
    running: <Button variant="secondary" onClick={onClose}>Hide (keeps going)</Button>,
    done: <Button onClick={onClose}>Done</Button>,
  }[step];

  return (
    <Modal open={open} wide title="Issue certificates from Excel" onClose={step === 'running' ? () => {} : onClose} footer={footer}>
      {step === 'pick' ? (
        <div className="space-y-4">
          <p className="text-[15px] text-ink-soft">
            For events where you already have the attendance list, like workshops and guest lectures. Everyone on the list gets
            a certificate of <b>{event.name}</b> by email; no form needed.
          </p>
          <div className="rounded-xl border-2 border-dashed border-line px-6 py-8 text-center">
            <FileSpreadsheet className="mx-auto size-9 text-faint" strokeWidth={1.5} />
            <p className="mt-2 font-medium">Excel (.xlsx) or CSV file</p>
            <p className="mt-1 text-sm text-muted">Columns with the headings Name, Register No and Email (College is optional), in any order.</p>
            <FileButton accept={SHEET_TYPES} onFile={read} icon={Upload} loading={busy} className="mt-4">Choose file</FileButton>
          </div>
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      {step === 'preview' && preview ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{preview.fileName}</span>
            {Object.entries(preview.columns).map(([k, v]) => <Badge key={k} tone="blue">{COLUMN_NAMES[k]}: {v}</Badge>)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-ok-wash px-4 py-3"><p className="heading text-3xl text-ok">{ready}</p><p className="text-sm text-ok">ready to issue</p></div>
            <div className="rounded-lg bg-canvas px-4 py-3"><p className="heading text-3xl text-ink">{preview.rows.length - ready}</p><p className="text-sm text-muted">skipped</p></div>
          </div>
          {left != null && ready > left ? (
            <p className="flex gap-2 rounded-lg bg-warn-wash px-4 py-3 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
              Gmail can send about {left} more emails today. The first {left} go now; the rest are sent automatically when the limit resets.
            </p>
          ) : null}
          <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-canvas text-muted">
                <tr><th className="px-3 py-2 font-medium">Row</th><th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Register no.</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {preview.rows.slice(0, 300).map((r) => (
                  <tr key={`${r.row}-${r.regNo}`} className={cx(r.status === 'skip' && 'text-muted')}>
                    <td className="px-3 py-2 tabular-nums">{r.row}</td>
                    <td className="max-w-40 truncate px-3 py-2">{r.name || '-'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.regNo || '-'}</td>
                    <td className="max-w-48 truncate px-3 py-2">{r.email || '-'}</td>
                    <td className="px-3 py-2">{r.status === 'ready' ? <Badge tone="ok">Ready</Badge> : <span className="text-warn">{r.reason}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 300 ? <p className="text-sm text-muted">Showing the first 300 of {preview.rows.length} rows.</p> : null}
          <ErrorNote>{error}</ErrorNote>
        </div>
      ) : null}

      {(step === 'running' || step === 'done') && job ? (
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-medium">{step === 'done' ? 'Finished' : 'Making certificates and emailing them…'}</span>
              <span className="tabular-nums text-muted">{job.done} / {job.total}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${job.total ? (job.done / job.total) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-canvas px-3 py-3"><p className="heading text-3xl">{job.issued}</p><p className="text-sm text-muted">issued</p></div>
            <div className="rounded-lg bg-ok-wash px-3 py-3"><p className="heading text-3xl text-ok">{job.emailed}</p><p className="text-sm text-ok">emailed</p></div>
            <div className="rounded-lg bg-canvas px-3 py-3"><p className="heading text-3xl">{job.emailWaiting}</p><p className="text-sm text-muted">email later</p></div>
          </div>
          {step === 'done' && !job.skipped.length ? (
            <p className="flex items-center gap-2 text-[15px] text-ok"><CheckCircle2 className="size-5" /> All done. The certificates are in Participants and on the Certificates page.</p>
          ) : null}
          {job.skipped.length ? (
            <div className="rounded-lg border border-line px-4 py-3 text-sm">
              <p className="font-medium">Not issued</p>
              <ul className="mt-1 space-y-0.5 text-muted">
                {job.skipped.slice(0, 20).map((s) => <li key={`${s.row}-${s.regNo}`}>Row {s.row}, {s.name || s.regNo}: {s.reason}</li>)}
              </ul>
            </div>
          ) : null}
          {job.emailWaiting ? <p className="text-sm text-muted">Emails that couldn&apos;t go out now are retried automatically.</p> : null}
          <ErrorNote>{error || job.error}</ErrorNote>
        </div>
      ) : null}
    </Modal>
  );
}
