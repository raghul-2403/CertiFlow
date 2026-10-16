import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Maximize, Minimize, X } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { orgLogoUrl, useOrg } from '../lib/org.jsx';
import { LogoMark } from '../components/Logo.jsx';

const POLL_MS = 8000;
const SYNC_MS = 20000;

// Number that briefly lifts when it changes, so the room notices certificates going out
function LiveNumber({ value }) {
  const [bump, setBump] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 700);
      prev.current = value;
      return () => clearTimeout(t);
    }
    return undefined;
  }, [value]);
  return <span className={`heading inline-block tabular-nums transition-transform duration-500 ${bump ? 'scale-110 text-gold' : ''}`}>{value}</span>;
}

const shortName = (name = '') => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

// Full-screen QR for the hall projector, with live counters
export default function Present() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { org } = useOrg();
  const logo = orgLogoUrl(org);
  const [event, setEvent] = useState(null);
  const [qr, setQr] = useState(null);
  const [latest, setLatest] = useState(null);
  const [error, setError] = useState('');
  const [full, setFull] = useState(Boolean(document.fullscreenElement));
  const [code, setCode] = useState(null);
  const [now, setNow] = useState(Date.now());

  // Rotating event code (Attendance check tab): fetched again each time it changes
  const loadCode = useCallback(() => api.get(`/events/${id}/code`).then((r) => setCode(r.data)).catch(() => {}), [id]);
  useEffect(() => {
    loadCode();
    const t = setInterval(() => setNow(Date.now()), 1000);
    const again = setInterval(loadCode, 30000); // notices the code being switched on or off
    return () => {
      clearInterval(t);
      clearInterval(again);
    };
  }, [loadCode]);
  useEffect(() => {
    if (code?.enabled && now >= new Date(code.changesAt).getTime()) loadCode();
  }, [code, now, loadCode]);
  const codeSecs = code?.enabled ? Math.max(0, Math.round((new Date(code.changesAt).getTime() - now) / 1000)) : 0;

  const refresh = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([
        api.get(`/events/${id}`),
        api.get('/certificates', { params: { event: id, delivery: 'sent', limit: 1 } }),
      ]);
      setEvent(e.data.event);
      setLatest(c.data.certificates[0] || null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, [id]);

  useEffect(() => {
    refresh();
    api.get(`/events/${id}/qr`).then((r) => setQr(r.data)).catch((err) => setError(errorMessage(err)));
    const poll = setInterval(refresh, POLL_MS);
    // read the Google Form more often while the QR is on screen
    const sync = setInterval(() => api.post('/settings/sync').catch(() => {}), SYNC_MS);
    return () => {
      clearInterval(poll);
      clearInterval(sync);
    };
  }, [id, refresh]);

  // Keep the projector laptop from going to sleep
  useEffect(() => {
    let lock;
    navigator.wakeLock?.request('screen').then((l) => { lock = l; }).catch(() => {});
    return () => lock?.release?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) navigate(`/events/${id}`);
    };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('keydown', onKey);
    };
  }, [id, navigate]);

  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.()).catch?.(() => {});

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink p-4 text-ink sm:p-8">
      <div className="absolute right-4 top-4 flex gap-2">
        <button type="button" onClick={toggleFull} className="rounded-full bg-white/10 p-2.5 text-white/80 hover:bg-white/20 hover:text-white" aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen'}>
          {full ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
        </button>
        <button type="button" onClick={() => navigate(`/events/${id}`)} className="rounded-full bg-white/10 p-2.5 text-white/80 hover:bg-white/20 hover:text-white" aria-label="Close" title="Close (Esc)">
          <X className="size-5" />
        </button>
      </div>

      {error && !event ? (
        <p className="max-w-md text-center text-white">{error}</p>
      ) : (
        // Framed like the certificate: paper panel, gold double rule
        <div className="w-full max-w-[1280px] rounded-sm bg-[#fbfaf6] p-3 shadow-2xl sm:p-4">
          <div className="relative isolate overflow-hidden border-[3px] border-double border-gold/80 p-6 sm:p-10 lg:p-14">
            {/* College crest as a faint watermark behind the text (the QR sits on its own white card) */}
            {logo ? (
              <img src={logo} alt="" aria-hidden="true" className="pointer-events-none absolute -bottom-[12%] left-[18%] -z-10 w-[min(44%,520px)] opacity-[0.06] grayscale" />
            ) : null}
            <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex items-center gap-3 text-ink-soft">
                  {logo ? (
                    <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white p-1.5 ring-2 ring-gold/70">
                      <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
                    </span>
                  ) : (
                    <LogoMark className="size-9 text-blue" />
                  )}
                  <span className="text-[15px] sm:text-lg">{[org.name, org.unit].filter(Boolean).join(', ') || event?.organizer}</span>
                </div>
                <h1 className="heading mt-6 text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.95] text-ink">{event?.name || ' '}</h1>
                <p className="mt-5 max-w-xl text-[clamp(1.1rem,1.8vw,1.6rem)] leading-snug text-ink-soft">
                  {code?.enabled
                    ? 'Scan the QR, type the event code shown here, and share your feedback. Your e‑certificate arrives by email in a few minutes.'
                    : 'Scan the code to share your feedback. Your e‑certificate arrives by email in a few minutes.'}
                </p>

                <dl className="mt-10 flex flex-wrap gap-x-14 gap-y-6">
                  <div>
                    <dt className="text-[15px] text-muted sm:text-lg">Responses</dt>
                    <dd className="text-[clamp(3rem,5vw,4.6rem)] leading-none text-ink"><LiveNumber value={event?.stats.feedbackCount ?? 0} /></dd>
                  </div>
                  <div>
                    <dt className="text-[15px] text-muted sm:text-lg">Certificates emailed</dt>
                    <dd className="text-[clamp(3rem,5vw,4.6rem)] leading-none text-ink"><LiveNumber value={event?.stats.emailed ?? 0} /></dd>
                  </div>
                </dl>
                <p className="mt-6 flex min-h-7 items-center gap-2 text-[15px] text-muted sm:text-lg" aria-live="polite">
                  <span className="live-dot size-2.5 rounded-full bg-ok" aria-hidden="true" />
                  <span>{latest ? <>Latest certificate sent to <b className="font-semibold text-ink">{shortName(latest.participant.name)}</b></> : 'Waiting for the first response'}</span>
                </p>
              </div>

              <div className={`mx-auto w-full ${code?.enabled ? "max-w-[min(48vh,420px)]" : "max-w-[min(62vh,460px)]"}`}>
                <div className="rounded-2xl bg-white p-4 shadow-[0_0_0_1px_rgb(14_27_54_/_0.08),0_20px_50px_-20px_rgb(14_27_54_/_0.35)]">
                  {qr ? (
                    <img src={qr.qrDataUrl} alt={`QR code to give feedback for ${event?.name}`} className="w-full" />
                  ) : (
                    <div className="aspect-square animate-pulse rounded-lg bg-line/60" />
                  )}
                </div>
                {code?.enabled ? (
                  <div className="mt-4 overflow-hidden rounded-2xl bg-ink text-center text-white">
                    <p className="pt-3 text-sm uppercase tracking-[0.25em] text-white/60">Event code</p>
                    <p className="heading pb-1 text-[clamp(3rem,7vw,5.2rem)] leading-none tracking-[0.25em] text-gold" aria-live="polite">{code.code}</p>
                    <p className="pb-3 text-sm text-white/60">changes in {Math.floor(codeSecs / 60)}:{String(codeSecs % 60).padStart(2, '0')}</p>
                    <div className="h-1 bg-white/10"><div className="h-full bg-gold transition-[width] duration-1000 ease-linear" style={{ width: `${(codeSecs / (code.minutes * 60)) * 100}%` }} /></div>
                  </div>
                ) : null}
                {error && qr === null ? <p className="mt-3 text-center text-sm text-bad">{error}</p> : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
