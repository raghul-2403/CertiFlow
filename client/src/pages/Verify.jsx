import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Search, ShieldX } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { Button, Input, Skeleton } from '../components/ui.jsx';
import Logo from '../components/Logo.jsx';

// Gold rosette with a check, the same seal as in the CertiFlow logo
function Seal({ ok = true }) {
  return (
    <svg viewBox="24 24 14 14" className="size-14 shrink-0" aria-hidden="true">
      <path
        d="M31.00 24.10 L32.13 25.31 L33.64 24.63 L34.22 26.18 L35.88 26.12 L35.82 27.78 L37.37 28.36 L36.69 29.87 L37.90 31.00 L36.69 32.13 L37.37 33.64 L35.82 34.22 L35.88 35.88 L34.22 35.82 L33.64 37.37 L32.13 36.69 L31.00 37.90 L29.87 36.69 L28.36 37.37 L27.78 35.82 L26.12 35.88 L26.18 34.22 L24.63 33.64 L25.31 32.13 L24.10 31.00 L25.31 29.87 L24.63 28.36 L26.18 27.78 L26.12 26.12 L27.78 26.18 L28.36 24.63 L29.87 25.31Z"
        fill={ok ? '#B8892B' : '#B42318'}
      />
      {ok ? (
        <path d="M28.3 31.1l1.9 1.9 3.6-3.8" fill="none" stroke="#0E1B36" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M29 29l4 4M33 29l-4 4" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      )}
    </svg>
  );
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-3 text-[15px]">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}

export default function Verify() {
  const { certificateId } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(certificateId || '');
  const [state, setState] = useState({ status: certificateId ? 'loading' : 'idle' });

  useEffect(() => {
    if (!certificateId) {
      setState({ status: 'idle' });
      return;
    }
    setInput(certificateId);
    setState({ status: 'loading' });
    api
      .get(`/public/verify/${encodeURIComponent(certificateId)}`)
      .then((r) => setState({ status: r.data.valid ? 'valid' : 'revoked', cert: r.data.certificate }))
      .catch((err) => setState({ status: 'invalid', message: errorMessage(err) }));
  }, [certificateId]);

  const submit = (e) => {
    e.preventDefault();
    const id = input.trim().toUpperCase();
    if (id) navigate(`/verify/${id}`);
  };

  const { status, cert } = state;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="relative bg-ink text-white">
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gold" aria-hidden="true" />
        <div className="mx-auto max-w-2xl px-5 pb-16 pt-8">
          <Logo light />
          <h1 className="heading mt-12 text-[2.8rem]">Certificate verification</h1>
          <p className="mt-2 max-w-md text-[15px] text-white/70">
            Enter the ID printed at the bottom of the certificate, or scan the QR code on it, to confirm it was really issued.
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-2xl px-5 pb-16">
        <form onSubmit={submit} className="flex gap-2 rounded-xl bg-paper p-2 shadow-[0_10px_30px_-12px_rgb(14_27_54_/_0.3)] ring-1 ring-line">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="CF-2026-7K3QXM"
            aria-label="Certificate ID"
            className="h-12 border-0 text-lg uppercase tracking-wide focus:ring-0"
          />
          <Button type="submit" icon={Search} className="h-12 px-5">Check</Button>
        </form>

        <div className="mt-8">
          {status === 'loading' ? <Skeleton className="h-80 rounded-xl" /> : null}

          {status === 'valid' || status === 'revoked' ? (
            <section className="overflow-hidden rounded-xl border border-line bg-paper">
              <div className={`flex items-center gap-4 px-6 py-5 ${status === 'valid' ? 'bg-ok-wash' : 'bg-bad-wash'}`}>
                <Seal ok={status === 'valid'} />
                <div>
                  <p className={`heading text-[1.9rem] ${status === 'valid' ? 'text-ok' : 'text-bad'}`}>
                    {status === 'valid' ? 'This certificate is genuine' : 'This certificate has been revoked'}
                  </p>
                  <p className="text-[15px] text-ink-soft">
                    {status === 'valid' ? `Issued by ${cert.organizer} on ${fmtDate(cert.issuedAt)}` : `${cert.organizer} has withdrawn it. It is no longer valid.`}
                  </p>
                </div>
              </div>
              <dl className="divide-y divide-line px-6 py-1">
                <Row label="Awarded to" value={cert.name} />
                <Row label="Register no." value={cert.regNo} />
                <Row label="College" value={cert.college} />
                <Row label="Event" value={cert.event} />
                {cert.award ? <Row label="Award" value={<span className="font-semibold text-gold-dark">{cert.award}</span>} /> : null}
                <Row label="Event date" value={fmtDate(cert.eventDate)} />
                <Row label="Certificate ID" value={<span className="tracking-wide">{cert.certificateId}</span>} />
              </dl>
            </section>
          ) : null}

          {status === 'invalid' ? (
            <section className="flex items-start gap-4 rounded-xl border border-bad/20 bg-paper px-6 py-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-bad-wash"><ShieldX className="size-5 text-bad" /></span>
              <div>
                <p className="heading text-[1.7rem] text-bad">Not a valid certificate</p>
                <p className="mt-0.5 text-[15px] text-ink-soft">{state.message}. Check the ID for typos, or ask the organiser.</p>
              </div>
            </section>
          ) : null}

          {status === 'idle' ? (
            <p className="text-center text-sm text-muted">Certificate IDs look like CF-2026-7K3QXM.</p>
          ) : null}
          <p className="mt-10 text-center text-sm text-muted">
            Lost your own certificate? <Link to="/my-certificates" className="link">Find all your certificates</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
