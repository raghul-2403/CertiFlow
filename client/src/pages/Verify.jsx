
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  GraduationCap,
  LoaderCircle,
  Search,
  ShieldCheck,
  ShieldX,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { api, errorMessage } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import SoftAurora from '../components/SoftAurora.jsx';

function AuroraBackground() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Midnight background */}
      <div className="absolute inset-0 bg-[#100D17]" />

      {/* Official React Bits Soft Aurora */}
      <div className="absolute inset-0">
        <SoftAurora
          speed={0.25}
          scale={1.5}
          brightness={0.8}
          color1="#8CAFD0"
          color2="#BBA7DB"
          bandHeight={0.5}
          bandSpread={1}
          noiseFrequency={1.2}
          noiseAmplitude={0.45}
          colorSpeed={0.4}
          enableMouseInteraction={true}
          mouseInfluence={0.15}
          clickPulse={false}
          intro={true}
          opacity={0.8}
        />
      </div>

      {/* Subtle dark gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#100D17]/10 via-[#100D17]/20 to-[#100D17]/80" />
    </div>
  );
}


function DetailRow({ label, value }) {
  return (
    <div className="grid gap-1.5 border-b border-white/[0.07] py-4 last:border-b-0 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-sm text-[#BDB5C8]">
        {label}
      </dt>

      <dd className="min-w-0 break-words text-sm font-medium text-[#F2EEF8]">
        {value ?? 'Not specified'}
      </dd>
    </div>
  );
}

function ResultCard({ status, cert }) {
  const valid = status === 'valid';

  return (
    <section
      className="overflow-hidden rounded-[22px] border border-white/[0.12] bg-[#1D1925]/95 shadow-[0_20px_65px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      aria-label="Certificate verification result"
    >
      <div
        className={
          valid
            ? 'border-b border-[#8CE0B7]/20 bg-[#8CE0B7]/[0.08] px-5 py-6 sm:px-7'
            : 'border-b border-[#F29BA5]/20 bg-[#F29BA5]/[0.08] px-5 py-6 sm:px-7'
        }
      >
        <div className="flex items-start gap-4">
          <div
            className={
              valid
                ? 'grid size-14 shrink-0 place-items-center rounded-2xl border border-[#8CE0B7]/25 bg-[#8CE0B7]/10 text-[#8CE0B7]'
                : 'grid size-14 shrink-0 place-items-center rounded-2xl border border-[#F29BA5]/25 bg-[#F29BA5]/10 text-[#F29BA5]'
            }
          >
            {valid ? (
              <BadgeCheck className="size-8" />
            ) : (
              <ShieldX className="size-8" />
            )}
          </div>

          <div className="min-w-0">
            <p
              className={
                valid
                  ? 'text-xs font-semibold uppercase tracking-[0.15em] text-[#91E4BD]'
                  : 'text-xs font-semibold uppercase tracking-[0.15em] text-[#F5AAB3]'
              }
            >
              {valid
                ? 'Verification successful'
                : 'Certificate revoked'}
            </p>

            <h2 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
              {valid
                ? 'This certificate is genuine'
                : 'This certificate has been revoked'}
            </h2>

            <p className="mt-2 text-sm leading-6 text-[#D2C9DC]">
              {valid
                ? `Issued by ${cert.organizer || 'CertiFlow'} on ${fmtDate(cert.issuedAt)}.`
                : 'This certificate has been withdrawn and is no longer valid.'}
            </p>
          </div>
        </div>
      </div>

      <dl className="px-5 py-1 sm:px-7">
        <DetailRow
          label="Awarded to"
          value={cert.name}
        />

        <DetailRow
          label="Register number"
          value={cert.regNo}
        />

        <DetailRow
          label="College"
          value={cert.college}
        />

        <DetailRow
          label="Event"
          value={cert.event}
        />

        {cert.award && (
          <DetailRow
            label="Award"
            value={
              <span className="inline-flex items-center gap-2 text-[#E9C885]">
                <Award className="size-4" />
                {cert.award}
              </span>
            }
          />
        )}

        <DetailRow
          label="Event date"
          value={fmtDate(cert.eventDate)}
        />

        <DetailRow
          label="Certificate ID"
          value={
            <span className="break-all font-mono tracking-wide text-[#CFB9E8]">
              {cert.certificateId}
            </span>
          }
        />
      </dl>

      <div className="flex items-center gap-2 border-t border-white/[0.07] px-5 py-4 text-xs text-[#BDB4C7] sm:px-7">
        <ShieldCheck className="size-4 text-[#BBA7DB]" />
        Verified against CertiFlow records
      </div>
    </section>
  );
}

export default function Verify() {
  const { certificateId } = useParams();
  const navigate = useNavigate();

  const [input, setInput] = useState(certificateId || '');

  const [state, setState] = useState({
    status: certificateId ? 'loading' : 'idle',
  });

  useEffect(() => {
    if (!certificateId) {
      setState({ status: 'idle' });
      setInput('');
      return;
    }

    let cancelled = false;

    setInput(certificateId);
    setState({ status: 'loading' });

    api
      .get(
        `/public/verify/${encodeURIComponent(certificateId)}`
      )
      .then(({ data }) => {
        if (cancelled) return;

        setState({
          status: data.valid ? 'valid' : 'revoked',
          cert: data.certificate,
        });
      })
      .catch(error => {
        if (cancelled) return;

        setState({
          status: 'invalid',
          message: errorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [certificateId]);

  function submit(event) {
    event.preventDefault();

    const id = input.trim().toUpperCase();

    if (id) {
      if (id === certificateId) {
        setState({ status: 'loading' });
        // Navigate to a fresh location to recheck the same ID.
        navigate('/verify', { replace: true });
        setTimeout(() => {
          navigate(`/verify/${encodeURIComponent(id)}`);
        }, 0);
      } else {
        navigate(`/verify/${encodeURIComponent(id)}`);
      }
    }
  }

  const { status, cert } = state;

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#100D17] font-sans text-[#F6F2FB]">

      {/* IMPORTANT: Mount the actual Prism background */}
      <AuroraBackground />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-9">
        <Link
          to="/"
          className="inline-flex items-center gap-3"
        >
          <span className="grid size-11 place-items-center rounded-xl border border-[#D6AC63]/25 bg-[#D6AC63]/10 text-[#D6AC63]">
            <Award className="size-6" />
          </span>

          <div>
            <p className="text-xl font-extrabold tracking-tight text-white">
              CertiFlow
            </p>

            <p className="text-[10px] tracking-wide text-[#B4ACBE]">
              CERTIFICATE VERIFICATION
            </p>
          </div>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#211B2B]/80 px-3 py-2.5 text-xs font-medium text-[#E2DCEB] backdrop-blur-xl transition-colors hover:border-[#BBA7DB]/40 hover:bg-[#30283B] sm:px-4 sm:text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </header>

      {/* Main content */}
      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-5 pb-12 pt-6 sm:px-8 sm:pt-10">

        {/* Hero */}
        <section className="mx-auto max-w-2xl text-center">

          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl border border-[#B9D7ED]/30 bg-[#B9D7ED]/10 text-[#B9D7ED] shadow-[0_0_40px_rgba(185,215,237,0.14)]">
            <ShieldCheck className="size-9" />
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-[-0.04em] text-white sm:text-5xl">
            Verify a{' '}
            <span className="bg-gradient-to-r from-[#F2F4FA] via-[#B9D7ED] to-[#C9B4E3] bg-clip-text text-transparent">
              certificate.
            </span>
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#D0C8D9] sm:text-base">
            Enter the certificate ID printed on your
            certificate, or scan its QR code, to check
            whether it's genuine.
          </p>
        </section>

        {/* Search card */}
        <section className="mx-auto mt-9 max-w-[620px]">
          <form
            onSubmit={submit}
            className="relative overflow-hidden rounded-[22px] border border-white/[0.13] bg-[#1D1925]/95 p-5 shadow-[0_25px_75px_rgba(0,0,0,0.40)] backdrop-blur-2xl sm:p-7"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#B9D7ED]/65 to-transparent"
              aria-hidden="true"
            />

            <label
              htmlFor="certificate-id"
              className="mb-3 block text-sm font-medium text-[#E9E5EF]"
            >
              Certificate ID
            </label>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#B9AFC3]" />

                <input
                  id="certificate-id"
                  type="text"
                  value={input}
                  onChange={event =>
                    setInput(event.target.value)
                  }
                  placeholder="CF-2026-7K3QXM"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  className="h-12 w-full rounded-xl border border-[#5A4D68] bg-[#292333] pl-12 pr-4 text-sm font-medium uppercase tracking-wider text-[#F6F2FB] placeholder:text-[#AFA5BD] focus:border-[#BDD6EB] focus:outline-none focus:ring-2 focus:ring-[#BDD6EB]/20"
                />
              </div>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#B9D7ED] px-6 text-sm font-semibold text-[#17212C] transition-colors hover:bg-[#D3E5F3]"
              >
                Verify
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        </section>

        {/* Verification results */}
        <div
          className="mx-auto mt-8 max-w-[620px]"
          aria-live="polite"
        >
          {status === 'loading' && (
            <div className="flex min-h-48 items-center justify-center rounded-[22px] border border-white/10 bg-[#1D1925]/90 backdrop-blur-xl">
              <div className="text-center">
                <LoaderCircle className="mx-auto size-9 animate-spin text-[#B9D7ED]" />
                <p className="mt-4 text-sm text-[#D0C7DA]">
                  Checking certificate records...
                </p>
              </div>
            </div>
          )}

          {(status === 'valid' ||
            status === 'revoked') &&
            cert && (
              <ResultCard
                status={status}
                cert={cert}
              />
            )}

          {status === 'invalid' && (
            <section className="flex items-start gap-4 rounded-[22px] border border-[#F29BA5]/25 bg-[#241B27]/95 p-6 shadow-[0_15px_40px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#F29BA5]/10 text-[#F29BA5]">
                <XCircle className="size-7" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-[#FFC2C9]">
                  Certificate not found
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#CFC4D0]">
                  {state.message ||
                    'We could not verify that certificate ID.'}
                </p>

                <p className="mt-2 text-xs text-[#ACA3B6]">
                  Check for typing mistakes or contact
                  the event organizer.
                </p>
              </div>
            </section>
          )}

          {status === 'idle' && (
            <p className="text-center text-xs text-[#C9BFCE]">
              Certificate IDs look like CF-2026-7K3QXM.
            </p>
          )}

          <div className="mt-9 flex flex-col items-center gap-3 text-center">
            <span className="grid size-11 place-items-center rounded-full border border-[#D6AC63]/25 bg-[#D6AC63]/10 text-[#D6AC63]">
              <GraduationCap className="size-5" />
            </span>

            <p className="text-sm text-[#D0C8D9]">
              Looking for your own certificates?
            </p>

            <Link
              to="/my-certificates"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#E5C582] transition-colors hover:text-[#F3DBA9]"
            >
              Find my certificates
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.07] bg-[#100D17]/75 px-5 py-5 text-center text-xs text-[#AFA6B9] backdrop-blur-lg">
        CertiFlow · R.M.K. College of Engineering and Technology
      </footer>
    </main>
  );
}
