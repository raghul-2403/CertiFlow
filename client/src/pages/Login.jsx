
import { useState } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router';

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';

import { errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

import {
  Button,
  ErrorNote,
  Field,
  Input,
} from '../components/ui.jsx';

import Logo from '../components/Logo.jsx';
import BlurText from '../components/BlurText.jsx';
import GhostFibers from '../components/GhostFibers.jsx';

export default function Login() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (admin) {
    return <Navigate to="/" replace />;
  }

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    setError('');
    setBusy(true);

    try {
      await login(email, password);

      navigate(
        location.state?.from || '/',
        { replace: true }
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#0D0C14] text-white">

      {/* FULL SCREEN REACT BITS GHOST FIBERS */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        aria-hidden="true"
      >
        <GhostFibers
          className="h-full w-full"
          glowColor="#d4d4d8"
          layers={1}
          twist={1.5}
          threads={54}
          fiberStyle="dashes"
          depthOfField={0.6}
          hoverEffect="focus"
          intro={true}
          mouseInteraction={true}
          lineColor="#ffffff"
          secondaryColor="#a1a1aa"
          volume={0.4}
          foldGlow={1.5}
          particles={0.15}
          sparkle={0.35}
          glow={0.6}
        />
      </div>

      {/* Subtle dark overlay for readability */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-[#0D0C14]/20"
        aria-hidden="true"
      />

      {/* HEADER */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-9">
        <Link
          to="/"
          className="inline-flex items-center gap-3"
        >
          <Logo light />
        </Link>

        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#211D27]/70 px-4 py-2.5 text-sm font-medium text-white/80 backdrop-blur-md transition-colors hover:border-[#D6AC63]/40 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </header>

      {/* LOGIN CONTENT */}
      <section className="relative z-10 flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8">

        <div className="w-full max-w-[440px]">

          {/* Intro */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-[#D6AC63]/35 bg-[#D6AC63]/10 text-[#E7C684] shadow-[0_0_35px_rgba(214,172,99,0.12)]">
              <ShieldCheck className="size-7" />
            </div>

            <BlurText
              text="Welcome back."
              effect="blur"
              animateBy="words"
              direction="top"
              trigger="load"
              delay={200}
              stepDuration={0.7}
              blur={10}
              distance={25}
              loop={false}
              className="justify-center text-4xl font-bold tracking-tight text-[#F7F4FA] sm:text-[2.8rem]"
            />

            <p className="mt-3 text-sm text-[#BCB5C3]">
              Sign in to your CertiFlow administration workspace.
            </p>
          </div>

          {/* GLASS LOGIN CARD */}
          <form
            onSubmit={submit}
            className="relative overflow-hidden rounded-[24px] border border-white/[0.13] bg-[#19171F]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-2xl sm:p-8"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D6AC63]/60 to-transparent"
              aria-hidden="true"
            />

            <div className="mb-7 flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl border border-[#D6AC63]/20 bg-[#D6AC63]/10 text-[#D6AC63]">
                <LockKeyhole className="size-5" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-white">
                  Administrator Login
                </h2>

                <p className="mt-0.5 text-xs text-[#AFA8B8]">
                  Authorized administrators and coordinators
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <Field label="Email address">
                <Input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={event =>
                    setEmail(event.target.value)
                  }
                  placeholder="Enter your email"
                  required
                  disabled={busy}
                />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={event =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  required
                  disabled={busy}
                />
              </Field>

              {error && (
                <ErrorNote>{error}</ErrorNote>
              )}

              <Button
                type="submit"
                loading={busy}
                disabled={busy}
                className="mt-2 w-full justify-center bg-[#D6AC63] font-semibold text-[#17131D] hover:bg-[#E7C684]"
              >
                Log in
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </div>
          </form>

          {/* STUDENT AND VERIFICATION LINKS */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm text-[#BAB2C1]">
            <Link
              to="/my-certificates"
              className="inline-flex items-center gap-2 transition-colors hover:text-[#E7C684]"
            >
              <GraduationCap className="size-4" />
              Student portal
            </Link>

            <span className="hidden size-1 rounded-full bg-white/30 sm:block" />

            <Link
              to="/verify"
              className="inline-flex items-center gap-2 transition-colors hover:text-[#E7C684]"
            >
              <BadgeCheck className="size-4" />
              Verify certificate
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.07] bg-[#0D0C14]/40 px-5 py-5 text-center text-xs text-[#A8A1B0] backdrop-blur-sm">
        CertiFlow · R.M.K. College of Engineering and Technology
      </footer>
    </main>
  );
}
