
import { useState } from 'react';
import { Link } from 'react-router';
import { Input } from '../components/ui.jsx';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  Download,
  GraduationCap,
  Mail,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
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
      <div className="absolute inset-0 bg-[#100D17]" />

      <div className="absolute inset-0">
        <SoftAurora
          speed={0.25}
          scale={1.5}
          brightness={0.85}
          color1="#A995D2"
          color2="#D5D6E3"
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

      <div className="absolute inset-0 bg-gradient-to-b from-[#100D17]/10 via-[#100D17]/30 to-[#100D17]/85" />
    </div>
  );
}

function CertificateCard({ certificate }) {
  const c = certificate;

  return (
    <article className="group relative overflow-hidden rounded-[20px] border border-white/[0.10] bg-[#201B2A]/90 p-5 shadow-[0_14px_45px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#BBA7DB]/50 hover:shadow-[0_20px_55px_rgba(0,0,0,0.38)] sm:p-6">
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-36 rounded-full bg-[#BBA7DB]/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="grid size-12 place-items-center rounded-xl border border-[#D6AC63]/20 bg-[#D6AC63]/10 text-[#D6AC63]">
          {c.award ? (
            <Trophy className="size-6" />
          ) : (
            <Award className="size-6" />
          )}
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#84D4B0]/20 bg-[#84D4B0]/10 px-3 py-1.5 text-[11px] font-semibold text-[#9AE1C1]">
          <BadgeCheck className="size-3.5" />
          Issued
        </span>
      </div>

      <div className="relative mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.17em] text-[#BBA7DB]">
          Certificate of {c.award ? 'Achievement' : 'Participation'}
        </p>

        <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight text-[#F6F1FA]">
          {c.event}
        </h3>

        {c.award && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-[#E7C785]">
            <Trophy className="size-4" />
            {c.award}
          </p>
        )}

        <p className="mt-3 text-sm text-[#BEB5CB]">
          {c.organizer || 'Event organizer'}
        </p>
      </div>

      <div className="relative mt-5 space-y-2 border-t border-white/[0.08] pt-4">
        <div className="flex items-center gap-2 text-xs text-[#BEB5CB]">
          <CalendarDays className="size-4 text-[#C8B2E0]" />
          {fmtDate(c.eventDate)}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#BEB5CB]">
          <ShieldCheck className="size-4 text-[#C8B2E0]" />
          <span className="break-all">{c.certificateId}</span>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        <a
          href={c.download}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#D6AC63] px-4 py-3 text-sm font-semibold text-[#19131D] transition-colors hover:bg-[#E9C789]"
        >
          <Download className="size-4" />
          Download PDF
        </a>

        <Link
          to={`/verify/${encodeURIComponent(c.certificateId)}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-medium text-[#E7E0EE] transition-colors hover:bg-white/[0.10]"
        >
          <BadgeCheck className="size-4" />
          Verify
        </Link>
      </div>
    </article>
  );
}

export default function MyCertificates() {
  const [form, setForm] = useState({
    regNo: '',
    email: '',
  });

  const [state, setState] = useState({
    status: 'idle',
  });

  async function search(event) {
    event.preventDefault();

    if (state.status === 'loading') return;

    setState({ status: 'loading' });

    try {
      const { data } = await api.post(
        '/public/my-certificates',
        {
          regNo: form.regNo.replace(/\s/g, '').toUpperCase(),
          email: form.email.trim().toLowerCase(),
        }
      );

      setState({
        status: 'done',
        ...data,
      });
    } catch (error) {
      setState({
        status: 'error',
        message: errorMessage(error),
      });
    }
  }

  function updateField(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));

    if (state.status !== 'idle') {
      setState({ status: 'idle' });
    }
  }

  const certificates =
    state.status === 'done' &&
    Array.isArray(state.certificates)
      ? state.certificates
      : [];

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#100D17] font-sans text-[#F6F1FA]">
      <AuroraBackground />

      {/* Navigation */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-9">
        <Link
          to="/"
          className="inline-flex items-center gap-3 text-[#F6F1FA]"
        >
          <span className="grid size-11 place-items-center rounded-xl border border-[#D6AC63]/25 bg-[#D6AC63]/10 text-[#D6AC63]">
            <Award className="size-6" />
          </span>

          <div>
            <p className="text-xl font-extrabold tracking-tight">
              CertiFlow
            </p>
            <p className="text-[10px] tracking-wide text-[#B3ABBE]">
              STUDENT PORTAL
            </p>
          </div>
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#211B2B]/70 px-3 py-2.5 text-xs font-medium text-[#DED5E8] backdrop-blur-xl transition-colors hover:border-[#BBA7DB]/40 hover:bg-[#2F263C] sm:px-4 sm:text-sm"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-14 pt-4 sm:px-8 sm:pt-6">
        {/* Hero */}
        <section className="mx-auto max-w-2xl text-center">

          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl border border-[#BBA7DB]/30 bg-[#BBA7DB]/10 text-[#D1BCEB] shadow-[0_0_45px_rgba(187,167,219,0.14)]">
            <GraduationCap className="size-9" />
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-[-0.045em] text-white sm:text-4xl">
            Your achievements,{' '}
            <span className="bg-gradient-to-r from-[#F0E7FB] via-[#C4A8E7] to-[#B5C9DF] bg-clip-text text-transparent">
              all in one place.
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-[#C8BFCE] sm:text-base">
            Find the certificates you've earned, download
            your PDFs and verify their authenticity.
          </p>
        </section>

        {/* Lookup form */}
        <section className="mx-auto mt-6 max-w-[600px]">
          <form
            onSubmit={search}
            className="relative overflow-hidden rounded-[24px] border border-white/[0.13] bg-[#1D1826]/90 p-6 shadow-[0_25px_85px_rgba(0,0,0,0.40)] backdrop-blur-2xl sm:p-8"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#BBA7DB]/70 to-transparent"
              aria-hidden="true"
            />

            <div className="mb-7">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-xl border border-[#BBA7DB]/20 bg-[#BBA7DB]/10 text-[#CEB7EA]">
                  <Search className="size-5" />
                </div>

                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Find my certificates
                  </h2>
                  <p className="mt-1 text-xs text-[#BEB4CC]">
                    No student account required
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-[#C6BDCE]">
                Enter your college register number and the
                email address you used during event feedback.
              </p>
            </div>

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="student-regno"
                  className="mb-2 block text-sm font-medium text-[#E7DCEC]"
                >
                  Register number
                </label>

                <Input
                  id="student-regno"
                  value={form.regNo}
                  onChange={event =>
                    updateField('regNo', event.target.value)
                  }
                  placeholder="Enter your register number"
                  autoComplete="off"
                  required
                  disabled={state.status === 'loading'}
                  className="w-full uppercase"
                />
              </div>

              <div>
                <label
                  htmlFor="student-email"
                  className="mb-2 block text-sm font-medium text-[#E7DCEC]"
                >
                  Registered email address
                </label>

                <Input
                  id="student-email"
                  type="email"
                  value={form.email}
                  onChange={event =>
                    updateField('email', event.target.value)
                  }
                  placeholder="Email used during feedback"
                  autoComplete="email"
                  required
                  disabled={state.status === 'loading'}
                  className="w-full"
                />
              </div>

              {state.status === 'error' && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#F29BA5]/25 bg-[#F29BA5]/10 px-4 py-3 text-sm text-[#FFC2C9]"
                >
                  {state.message}
                </div>
              )}

              <button
                type="submit"
                disabled={state.status === 'loading'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#C3A7E2] px-5 py-3.5 text-sm font-semibold text-[#201628] shadow-[0_7px_22px_rgba(195,167,226,0.15)] transition-all duration-200 hover:bg-[#D7BCEE] hover:shadow-[0_9px_30px_rgba(195,167,226,0.26)] disabled:cursor-wait disabled:opacity-60"
              >
                {state.status === 'loading'
                  ? 'Searching certificates...'
                  : 'Find my certificates'}

                {state.status === 'loading' ? (
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-[#201628]/30 border-t-[#201628]"
                    aria-hidden="true"
                  />
                ) : (
                  <ArrowRight className="size-4" />
                )}
              </button>
            </div>

            <div className="mt-6 flex items-start gap-2 border-t border-white/[0.08] pt-5 text-xs leading-5 text-[#B9B0C5]">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#BBA7DB]" />
              Use the same details provided during feedback
              submission to find your issued certificates.
            </div>
          </form>
        </section>

        {/* Results */}
        <section
          className="mx-auto mt-12 max-w-5xl"
          aria-live="polite"
        >
          {state.status === 'loading' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1].map(index => (
                <div
                  key={index}
                  className="h-72 animate-pulse rounded-[20px] border border-white/10 bg-[#211B2B]/80"
                />
              ))}
            </div>
          )}

          {state.status === 'done' &&
            certificates.length === 0 && (
              <div className="mx-auto max-w-[600px] rounded-[22px] border border-white/10 bg-[#211B2B]/85 px-6 py-10 text-center backdrop-blur-xl">
                <Award className="mx-auto size-10 text-[#C9B2E5]" />
                <h2 className="mt-4 text-xl font-semibold text-white">
                  No certificates found
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#C6BDCE]">
                  Check your register number and email
                  address. Certificates may take some time
                  to become available after an event.
                </p>
              </div>
            )}

          {state.status === 'done' &&
            certificates.length > 0 && (
              <>
                <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C9AFE8]">
                      Certificate collection
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                      {state.name
                        ? `${state.name}'s certificates`
                        : 'Your certificates'}
                    </h2>

                    <p className="mt-2 text-sm text-[#C9BFCE]">
                      {certificates.length} certificate
                      {certificates.length === 1
                        ? ''
                        : 's'}{' '}
                      found
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-full border border-[#BBA7DB]/25 bg-[#211B2B]/80 px-4 py-2 text-xs font-semibold text-[#DBC6F1]">
                    <Award className="size-4" />
                    {certificates.length} issued
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {certificates.map(certificate => (
                    <CertificateCard
                      key={certificate.certificateId}
                      certificate={certificate}
                    />
                  ))}
                </div>
              </>
            )}
        </section>

        {/* Public verification */}
        <div className="mx-auto mt-14 flex max-w-3xl flex-col items-center gap-3 border-t border-white/[0.10] pt-8 text-center">
          <div className="grid size-11 place-items-center rounded-full border border-[#D6AC63]/25 bg-[#D6AC63]/10 text-[#D6AC63]">
            <BadgeCheck className="size-6" />
          </div>

          <p className="text-sm text-[#CCC2D3]">
            Want to check whether a certificate is genuine?
          </p>

          <Link
            to="/verify"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#E3C17C] transition-colors hover:text-[#F4D99E]"
          >
            Verify a certificate
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/[0.07] bg-[#100D17]/50 px-5 py-5 text-center text-xs text-[#AFA4B9] backdrop-blur-lg">
        CertiFlow · R.M.K. College of Engineering and Technology
      </footer>
    </main>
  );
}
