import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, ImageUp, Move, RefreshCw, Save } from 'lucide-react';
import '@fontsource/cinzel/700.css';
import '@fontsource/cormorant-garamond/700.css';
import '@fontsource/cormorant-garamond/700-italic.css';
import { api, errorMessage, openPdf } from '../lib/api.js';
import { toJpeg } from '../lib/image.js';
import { Badge, Button, Card, Field, Input, Modal, Select, Spinner, cx, useToast } from './ui.jsx';

const CSS_FONT = {
  cinzel: "'Cinzel', serif",
  cormorant: "'Cormorant Garamond', serif",
  'cormorant-italic': "'Cormorant Garamond', serif",
  times: "'Times New Roman', Times, serif",
  helvetica: 'Helvetica, Arial, sans-serif',
};
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function formatDate(date, format) {
  const d = new Date(date);
  const [day, m, y] = [d.getDate(), d.getMonth(), d.getFullYear()];
  if (format === 'DD/MM/YYYY') return `${String(day).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
  if (format === 'MMMM D, YYYY') return `${MONTHS[m]} ${day}, ${y}`;
  return `${day} ${MONTHS[m]} ${y}${format === 'D MMMM YYYY.' ? '.' : ''}`;
}

const LABELS = { name: 'Participant name', date: 'Event date', verify: 'Verify QR + ID' };
const SAMPLE_NAME = 'Sample Participant Name';

function Editor({ eventId, event, design, catalog, onSaved }) {
  const toast = useToast();
  const box = useRef(null);
  const drag = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [fields, setFields] = useState(design.fields);
  const [selected, setSelected] = useState('name');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setFields(design.fields);
    setDirty(false);
  }, [design]);

  useEffect(() => {
    let url;
    api.get(`/events/${eventId}/design/image`, { responseType: 'blob' }).then((r) => {
      url = URL.createObjectURL(r.data);
      setImgUrl(url);
    }).catch(() => {});
    return () => url && URL.revokeObjectURL(url);
  }, [eventId, design.imageId]);

  const update = (key, patch) => {
    setFields((f) => ({ ...f, [key]: { ...f[key], ...patch } }));
    setDirty(true);
  };

  const onPointerDown = (key) => (e) => {
    e.preventDefault();
    setSelected(key);
    const rect = box.current.getBoundingClientRect();
    drag.current = { key, rect, dx: e.clientX - (rect.left + fields[key].x * rect.width), dy: e.clientY - (rect.top + fields[key].y * rect.height) };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const x = Math.min(1, Math.max(0, (e.clientX - d.dx - d.rect.left) / d.rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - d.dy - d.rect.top) / d.rect.height));
    update(d.key, { x: Math.round(x * 10000) / 10000, y: Math.round(y * 10000) / 10000 });
  };
  const onPointerUp = () => { drag.current = null; };

  // Arrow keys nudge the selected item precisely
  const onKeyDown = (key) => (e) => {
    const step = e.shiftKey ? 0.01 : 0.002;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!moves[e.key]) return;
    e.preventDefault();
    const [mx, my] = moves[e.key];
    update(key, { x: Math.min(1, Math.max(0, fields[key].x + mx)), y: Math.min(1, Math.max(0, fields[key].y + my)) });
  };

  async function save() {
    setBusy('save');
    try {
      const { data } = await api.patch(`/events/${eventId}/design`, { fields });
      onSaved(data.design);
      toast('Positions saved. New certificates will use them.');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }
  async function preview() {
    setBusy('preview');
    try {
      // save unsaved positions first, so the preview shows them
      const before = dirty ? () => api.patch(`/events/${eventId}/design`, { fields }).then((r) => onSaved(r.data.design)) : undefined;
      await openPdf(`/events/${eventId}/design/preview.pdf`, { before });
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  const f = fields[selected];
  const textStyle = (key) => ({
    left: `${fields[key].x * 100}%`,
    top: `${fields[key].y * 100}%`,
    fontSize: `${fields[key].size * 100}cqw`,
    color: fields[key].color,
    fontFamily: CSS_FONT[fields[key].font],
    fontStyle: fields[key].font === 'cormorant-italic' ? 'italic' : 'normal',
    fontWeight: 700,
    lineHeight: 1,
    transform: 'translate(-50%, -80%)',
  });

  return (
    <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_250px]">
      <div>
        <div
          ref={box}
          className="relative w-full touch-none select-none overflow-hidden rounded-lg border border-line bg-canvas"
          style={{ aspectRatio: `${design.imageWidth} / ${design.imageHeight}`, containerType: 'inline-size' }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {imgUrl ? <img src={imgUrl} alt="Certificate design" className="absolute inset-0 size-full" draggable={false} /> : <Spinner />}

          {['name', 'date'].map((key) => (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-label={`${LABELS[key]}. Drag or use arrow keys to move.`}
              onPointerDown={onPointerDown(key)}
              onKeyDown={onKeyDown(key)}
              onFocus={() => setSelected(key)}
              className={cx(
                'absolute cursor-move whitespace-nowrap rounded px-1 outline-offset-2',
                selected === key ? 'outline-2 outline-dashed outline-blue' : 'hover:outline-1 hover:outline-dashed hover:outline-blue/60'
              )}
              style={textStyle(key)}
            >
              {key === 'name' ? (fields.name.uppercase ? SAMPLE_NAME.toUpperCase() : SAMPLE_NAME) : formatDate(event.date, fields.date.format)}
            </div>
          ))}

          {fields.verify.show ? (
            <div
              role="button"
              tabIndex={0}
              aria-label="Verify QR code. Drag or use arrow keys to move."
              onPointerDown={onPointerDown('verify')}
              onKeyDown={onKeyDown('verify')}
              onFocus={() => setSelected('verify')}
              className={cx(
                'absolute flex cursor-move items-center justify-center bg-white/90 text-blue',
                selected === 'verify' ? 'outline-2 outline-dashed outline-blue' : 'outline-1 outline-dashed outline-blue/50'
              )}
              style={{
                left: `${fields.verify.x * 100}%`,
                top: `${fields.verify.y * 100}%`,
                width: `${fields.verify.size * 100}%`,
                aspectRatio: '1',
                transform: 'translateX(-50%)',
                fontSize: `${fields.verify.size * 18}cqw`,
              }}
            >
              QR
            </div>
          ) : null}
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <Move className="size-4" /> Drag the name, date and QR into place. Arrow keys move the selected one precisely.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(LABELS).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cx('rounded-full px-3 py-1 text-sm font-medium', selected === key ? 'bg-blue text-white' : 'bg-canvas text-ink-soft hover:bg-line')}
            >
              {LABELS[key]}
            </button>
          ))}
        </div>

        {selected !== 'verify' ? (
          <>
            <Field label={`Text size (${(f.size * 100).toFixed(1)})`}>
              <input type="range" min="0.008" max="0.08" step="0.0005" value={f.size} onChange={(e) => update(selected, { size: Number(e.target.value) })} className="w-full accent-blue" />
            </Field>
            <Field label="Font">
              <Select value={f.font} onChange={(e) => update(selected, { font: e.target.value })}>
                {catalog.fonts.map((ft) => <option key={ft.key} value={ft.key}>{ft.label}</option>)}
              </Select>
            </Field>
            <Field label="Colour">
              <div className="flex gap-2">
                <input type="color" value={f.color} onChange={(e) => update(selected, { color: e.target.value })} className="h-10 w-12 cursor-pointer rounded border border-line bg-paper" aria-label="Pick colour" />
                <Input value={f.color} onChange={(e) => update(selected, { color: e.target.value })} aria-label="Colour code" />
              </div>
            </Field>
            {selected === 'name' ? (
              <>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.uppercase} onChange={(e) => update('name', { uppercase: e.target.checked })} className="size-4 accent-blue" />
                  Write names in CAPITALS
                </label>
                <Field label={`Longest line (${Math.round(f.maxWidth * 100)}% of width)`} hint="Long names shrink to fit">
                  <input type="range" min="0.1" max="0.95" step="0.01" value={f.maxWidth} onChange={(e) => update('name', { maxWidth: Number(e.target.value) })} className="w-full accent-blue" />
                </Field>
              </>
            ) : (
              <Field label="Date style">
                <Select value={f.format} onChange={(e) => update('date', { format: e.target.value })}>
                  {catalog.dateFormats.map((fmt) => <option key={fmt} value={fmt}>{formatDate(event.date, fmt)}</option>)}
                </Select>
              </Field>
            )}
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.show} onChange={(e) => update('verify', { show: e.target.checked })} className="size-4 accent-blue" />
              Print the verify QR code and certificate ID
            </label>
            {f.show ? (
              <Field label="QR size">
                <input type="range" min="0.03" max="0.15" step="0.002" value={f.size} onChange={(e) => update('verify', { size: Number(e.target.value) })} className="w-full accent-blue" />
              </Field>
            ) : null}
          </>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <Button icon={Save} loading={busy === 'save'} disabled={!dirty} onClick={save}>{dirty ? 'Save positions' : 'Saved'}</Button>
          <Button variant="secondary" icon={Eye} loading={busy === 'preview'} onClick={preview}>Preview certificate PDF</Button>
        </div>
      </div>
    </div>
  );
}

export default function DesignCard({ event }) {
  const toast = useToast();
  const fileInput = useRef(null);
  const [design, setDesign] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [busy, setBusy] = useState('');
  const [recreating, setRecreating] = useState(false);
  const [resend, setResend] = useState(true);
  const issued = event.stats?.certificatesIssued || 0;

  async function recreate() {
    setBusy('recreate');
    try {
      const { data } = await api.post(`/events/${event._id}/design/regenerate`, { resend });
      const r = data.result;
      toast(
        resend
          ? `${r.recreated} certificate(s) re-created and ${r.emailed} emailed again${r.emailFailed ? `, ${r.emailFailed} email(s) failed (see Certificates)` : ''}.`
          : `${r.recreated} certificate(s) re-created with this design.`,
        r.emailFailed ? 'bad' : 'ok'
      );
      setRecreating(false);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  const load = useCallback(async () => {
    const [d, c] = await Promise.all([api.get(`/events/${event._id}/design`), api.get('/designs')]);
    setDesign(d.data.design);
    setCatalog(c.data);
  }, [event._id]);

  useEffect(() => {
    load()
      .then(() => {
        // Coming from "New event" with an uploaded design: jump straight to the editor
        if (window.location.hash === '#design') setTimeout(() => document.getElementById('design')?.scrollIntoView({ behavior: 'smooth' }), 300);
      })
      .catch((err) => toast(errorMessage(err), 'bad'));
  }, [load, toast]);

  async function usePreset(key) {
    setBusy(key);
    try {
      const { data } = await api.post(`/events/${event._id}/design/preset`, { preset: key });
      setDesign(data.design);
      toast('Design applied. Check it with Preview certificate PDF.');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  async function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('upload');
    try {
      const blob = await toJpeg(file);
      const { data } = await api.put(`/events/${event._id}/design/image`, blob, { headers: { 'Content-Type': 'image/jpeg' } });
      setDesign(data.design);
      toast(data.adoptedResponses ? `Design uploaded. ${data.adoptedResponses} waiting response(s) got their certificates.` : 'Design uploaded. Now drag the name and date into place.');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  async function setMode(mode) {
    setBusy(mode);
    try {
      const { data } = await api.patch(`/events/${event._id}/design`, { mode });
      setDesign(data.design);
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  if (!design || !catalog) return <Card><Spinner label="Loading design" /></Card>;
  const usingImage = design.mode === 'image';

  return (
    <Card className="scroll-mt-6 p-6">
      <div id="design" className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Certificate design</h2>
            <Badge tone={usingImage ? 'gold' : 'muted'}>
              {usingImage ? (catalog.presets.find((p) => p.key === design.preset)?.label || 'Your own design') : 'CertiFlow standard'}
            </Badge>
          </div>
          <p className="mt-1 text-[15px] text-muted">
            {usingImage
              ? 'Each certificate gets the participant’s name and the event date printed on this design.'
              : 'Use your club’s own certificate design, or keep the standard one.'}
          </p>
        </div>
        <Button variant="secondary" icon={Eye} loading={busy === 'preview'} onClick={() => { setBusy('preview'); openPdf(`/events/${event._id}/design/preview.pdf`).catch((err) => toast(errorMessage(err), 'bad')).finally(() => setBusy('')); }}>
          Preview certificate PDF
        </Button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setMode('builtin')}
          disabled={!usingImage || busy}
          className={cx('rounded-lg border p-4 text-left', !usingImage ? 'border-blue bg-blue-wash' : 'border-line hover:border-ink-soft/40')}
        >
          <p className="font-semibold">Standard design</p>
          <p className="mt-0.5 text-sm text-muted">Uses the title and signatures from Edit event.</p>
        </button>
        {catalog.presets.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => usePreset(p.key)}
            disabled={Boolean(busy)}
            className={cx('rounded-lg border p-4 text-left', usingImage && design.preset === p.key ? 'border-blue bg-blue-wash' : 'border-line hover:border-ink-soft/40')}
          >
            <p className="font-semibold">{busy === p.key ? 'Applying…' : p.label}</p>
            <p className="mt-0.5 text-sm text-muted">Ready-made design with the name and date already placed.</p>
          </button>
        ))}
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={Boolean(busy)}
          className={cx('rounded-lg border border-dashed p-4 text-left', usingImage && !design.preset ? 'border-blue bg-blue-wash' : 'border-line hover:border-ink-soft/40')}
        >
          <p className="flex items-center gap-2 font-semibold"><ImageUp className="size-4" /> {busy === 'upload' ? 'Uploading…' : 'Upload your own'}</p>
          <p className="mt-0.5 text-sm text-muted">PNG or JPG of the certificate with the name and date left blank.</p>
        </button>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg" className="hidden" onChange={upload} />
      </div>

      {usingImage && design.hasImage ? (
        <Editor eventId={event._id} event={event} design={design} catalog={catalog} onSaved={setDesign} />
      ) : null}

      {issued ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold-wash px-4 py-3">
          <p className="text-sm text-ink-soft">
            <b>{issued} certificate{issued === 1 ? ' was' : 's were'} already issued</b> for this event. Changed the design? Re-create them so everyone gets the new one.
          </p>
          <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => setRecreating(true)}>Re-create certificates</Button>
        </div>
      ) : null}

      <Modal
        open={recreating}
        title="Re-create certificates"
        onClose={() => setRecreating(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRecreating(false)}>Cancel</Button>
            <Button icon={RefreshCw} loading={busy === 'recreate'} onClick={recreate}>Re-create {issued} certificate{issued === 1 ? '' : 's'}</Button>
          </>
        }
      >
        <p className="text-[15px] text-ink-soft">
          Every valid certificate for <b>{event.name}</b> is drawn again with the current design. Certificate IDs stay the same, so verification links keep working.
        </p>
        <label className="mt-4 flex items-start gap-2 text-[15px]">
          <input type="checkbox" checked={resend} onChange={(e) => setResend(e.target.checked)} className="mt-1 size-4 accent-blue" />
          <span>Email the new certificate to each participant again{issued > 90 ? ' (a free Gmail account sends about 100 emails a day)' : ''}</span>
        </label>
        {busy === 'recreate' ? <p className="mt-3 text-sm text-muted">Working… this takes a few seconds per certificate.</p> : null}
      </Modal>
    </Card>
  );
}
