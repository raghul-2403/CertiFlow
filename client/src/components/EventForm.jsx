import { useEffect, useRef, useState } from 'react';
import { Check, ImageUp, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { toJpeg } from '../lib/image.js';
import { toLocalInput } from '../lib/format.js';
import { Button, ErrorNote, Field, Input, Modal, Textarea, cx } from './ui.jsx';

const EMPTY = {
  name: '',
  organizer: '',
  venue: '',
  date: '',
  description: '',
  certificate: { title: 'Certificate of Participation', signatories: [{ name: '', designation: '' }] },
};

function DesignOption({ selected, onSelect, title, text, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cx(
        'relative rounded-lg border p-3.5 text-left transition-colors',
        selected ? 'border-blue bg-blue-wash' : 'border-line bg-paper hover:border-ink-soft/40'
      )}
    >
      {selected ? <Check className="absolute right-3 top-3 size-4 text-blue" strokeWidth={3} /> : null}
      <p className="flex items-center gap-2 pr-5 text-[15px] font-semibold">{Icon ? <Icon className="size-4" /> : null}{title}</p>
      <p className="mt-0.5 text-sm text-muted">{text}</p>
    </button>
  );
}

export default function EventForm({
  open,
  event,
  initialDraft,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [presets, setPresets] = useState([]);
  const [design, setDesign] = useState('builtin'); // preset key | 'builtin' | 'upload'
  const [designFile, setDesignFile] = useState(null);
  const fileInput = useRef(null);
  const creating = !event;

  
useEffect(() => {
  if (!open) return;

  setError('');
  setDesignFile(null);

  setForm(
    event
      ? {
          name: event.name,
          organizer: event.organizer,
          venue: event.venue || '',
          date: toLocalInput(event.date),
          description: event.description || '',
          certificate: {
            title:
              event.certificate?.title ||
              EMPTY.certificate.title,
            signatories:
              event.certificate?.signatories?.length
                ? event.certificate.signatories
                : [{ name: '', designation: '' }],
          },
        }
      : {
          ...EMPTY,
          name: initialDraft?.name || '',
          organizer: initialDraft?.organizer || '',
          venue: initialDraft?.venue || '',
          date: initialDraft?.date || '',
          description: initialDraft?.description || '',
          certificate: {
            title: 'Certificate of Participation',
            signatories: [
              { name: '', designation: '' },
            ],
          },
        }
  );

  if (!event) {
    api.get('/designs')
      .then((r) => {
        setPresets(r.data.presets);
        setDesign(r.data.presets[0]?.key || 'builtin');
      })
      .catch(() => setDesign('builtin'));
  }
}, [open, event, initialDraft]);


  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const sigs = form.certificate.signatories;
  const setSig = (i, k, v) =>
    setForm({ ...form, certificate: { ...form.certificate, signatories: sigs.map((s, j) => (j === i ? { ...s, [k]: v } : s)) } });

  async function save(e) {
    e.preventDefault();
    if (creating && design === 'upload' && !designFile) {
      setError('Choose your certificate design image, or pick another design option.');
      return;
    }
    setBusy(true);
    setError('');
    const body = { ...form, date: form.date ? new Date(form.date).toISOString() : '' };
    try {
      if (!creating) {
        const { data } = await api.patch(`/events/${event._id}`, body);
        onSaved(data);
        return;
      }
      if (presets.some((p) => p.key === design)) body.designPreset = design;
      if (design === 'upload') body.uploadingDesign = true;
      const { data } = await api.post('/events', body);
      if (design === 'upload') {
        try {
          const blob = await toJpeg(designFile);
          const up = await api.put(`/events/${data.event._id}/design/image`, blob, { headers: { 'Content-Type': 'image/jpeg' } });
          data.adoptedResponses = up.data.adoptedResponses;
          data.uploadedDesign = true;
        } catch (err) {
          data.designError = errorMessage(err);
        }
      }
      onSaved(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const usesOwnDesign = creating ? design !== 'builtin' : event?.certificate?.design?.mode === 'image';

  return (
    <Modal
      open={open}
      wide
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="event-form" loading={busy}>{event ? 'Save changes' : 'Create event'}</Button>
        </>
      }
    >
      <form id="event-form" onSubmit={save} className="space-y-4">
        <Field label="Event name" hint="Participants see this on the form and on their certificate. Must be unique.">
          <Input value={form.name} onChange={set('name')} placeholder="e.g. Query Quest" required maxLength={150} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organised by" hint="Club or department">
            <Input value={form.organizer} onChange={set('organizer')} placeholder="e.g. CSE Student Chapter Association" required />
          </Field>
          <Field label="Date and time">
            <Input type="datetime-local" value={form.date} onChange={set('date')} required />
          </Field>
        </div>
        <Field label="Venue (optional)">
          <Input value={form.venue} onChange={set('venue')} placeholder="e.g. Seminar Hall A" />
        </Field>
        <Field label="Description (optional)">
          <Textarea rows={2} value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>

        {creating ? (
          <div>
            <p className="mb-1.5 text-sm font-medium">Certificate design</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {presets.map((p) => (
                <DesignOption
                  key={p.key}
                  selected={design === p.key}
                  onSelect={() => setDesign(p.key)}
                  title={p.label}
                  text="Your college design. Name and date are filled in automatically."
                />
              ))}
              <DesignOption
                selected={design === 'upload'}
                onSelect={() => {
                  setDesign('upload');
                  if (!designFile) fileInput.current?.click();
                }}
                icon={ImageUp}
                title={designFile ? designFile.name : 'Upload a new design'}
                text={designFile ? 'Click to choose a different image.' : 'PNG or JPG with the name and date left blank.'}
              />
              <DesignOption
                selected={design === 'builtin'}
                onSelect={() => setDesign('builtin')}
                title="Simple design"
                text="CertiFlow's plain layout with the title and signatures below."
              />
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) {
                  setDesignFile(f);
                  setDesign('upload');
                }
              }}
            />
            {design === 'upload' && designFile ? (
              <p className="mt-2 text-sm text-muted">After creating the event, drag the name and date into place on the event page.</p>
            ) : null}
          </div>
        ) : null}

        {usesOwnDesign ? (
          creating ? null : (
            <p className="rounded-lg bg-gold-wash px-4 py-3 text-sm text-ink-soft">
              This event uses its own certificate design, so the title and signatures come from the design image.
              Change it under Certificate design on the event page.
            </p>
          )
        ) : (
          <div className="rounded-lg border border-line bg-canvas/60 p-4">
            <p className="font-semibold">On the certificate</p>
            <Field label="Certificate title" className="mt-3">
              <Input
                value={form.certificate.title}
                onChange={(e) => setForm({ ...form, certificate: { ...form.certificate, title: e.target.value } })}
                required
              />
            </Field>
            <p className="mt-4 text-sm font-medium">Signatures (up to 3)</p>
            <div className="mt-2 space-y-2">
              {sigs.map((s, i) => (
                // eslint-disable-next-line react/no-array-index-key
                <div key={i} className="flex gap-2">
                  <Input aria-label="Signatory name" placeholder="Name" value={s.name} onChange={(e) => setSig(i, 'name', e.target.value)} />
                  <Input aria-label="Designation" placeholder="Designation, e.g. HOD, CSE" value={s.designation} onChange={(e) => setSig(i, 'designation', e.target.value)} />
                  <button
                    type="button"
                    className="rounded-md px-2 text-muted hover:bg-paper hover:text-bad"
                    aria-label="Remove signature"
                    onClick={() => setForm({ ...form, certificate: { ...form.certificate, signatories: sigs.filter((_, j) => j !== i) } })}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            {sigs.length < 3 ? (
              <Button
                size="sm"
                variant="ghost"
                icon={Plus}
                className="mt-2"
                onClick={() => setForm({ ...form, certificate: { ...form.certificate, signatories: [...sigs, { name: '', designation: '' }] } })}
              >
                Add signature
              </Button>
            ) : null}
          </div>
        )}
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Modal>
  );
}
