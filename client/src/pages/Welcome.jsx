
import { Link } from 'react-router';
import CertiFlowDotOverlay from '../components/CertiFlowDotOverlay.jsx';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';

import BlurText from '../components/BlurText.jsx';
import LightRays from '../components/LightRays.jsx';

// Official React Bits Light Rays background
function WelcomeBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[#0D0C14]" />

      <div className="absolute inset-0">
        <LightRays
          raysOrigin="top-center"
          raysColor="#FFFFFF"
          raysSpeed={1}
          lightSpread={0.5}
          rayLength={3}
          rayDensity={1}
          raySharpness={0.35}
          glow={0.6}
          haze={0.25}
          atmosphere={1}
          intensity={0.85}
          saturation={1}
          opacity={1}
          followMouse={true}
          mouseInfluence={0.1}
          cursorShadow={true}
          clickPulse={true}
          intro={true}
        />
      </div>

      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-[#0D0C14]/75 to-transparent" />
    </div>
  );
}

// Animated heading with two differently colored sections
function AnimatedWelcomeTitle() {
  return (
    <div className="w-full max-w-4xl">
      <h1 className="sr-only">
        What brings you here?
      </h1>

      <div
        aria-hidden="true"
        className="flex flex-wrap items-center justify-center gap-x-[0.25em] gap-y-1 text-4xl font-bold leading-[1.15] tracking-[-0.045em] sm:text-5xl md:text-[4rem]"
      >
        <BlurText
          text="What brings you"
          effect="blur"
          animateBy="words"
          direction="top"
          staggerFrom="start"
          trigger="load"
          delay={180}
          stepDuration={0.55}
          blur={12}
          distance={30}
          loop={false}
          className="justify-center text-[#F8F5FA]"
        />

        <BlurText
          text="here?"
          effect="blur"
          animateBy="words"
          direction="top"
          staggerFrom="start"
          trigger="load"
          delay={180}
          stepDuration={0.55}
          blur={12}
          distance={30}
          loop={false}
          className="justify-center bg-gradient-to-r from-[#EACB91] via-[#D4AF6C] to-[#BBA4D5] bg-clip-text text-transparent"
        />
      </div>
    </div>
  );
}

// Administrator and Student entry cards
function EntryCard({
  to,
  icon: Icon,
  title,
  description,
  action,
  color,
}) {
  return (
    <Link
      to={to}
      className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#1D1A23]/85 p-6 text-left shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#D6AC63]/50 hover:bg-[#26212D]/95 hover:shadow-[0_25px_65px_rgba(0,0,0,0.4)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D6AC63] sm:p-7"
    >
      <div
        className="pointer-events-none absolute -right-14 -top-20 size-52 rounded-full opacity-0 blur-[65px] transition-opacity duration-500 group-hover:opacity-30"
        style={{
          background: color,
        }}
      />

      <div className="relative flex items-start justify-between">
        <span
          className="grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]"
          style={{
            color,
          }}
        >
          <Icon
            className="size-7"
            strokeWidth={1.7}
          />
        </span>

        <ArrowRight className="size-5 -rotate-45 text-white/40 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[#E8C17C]" />
      </div>

      <div className="relative mt-7 flex-1">
        <h2 className="text-2xl font-semibold tracking-tight text-[#F6F2F8]">
          {title}
        </h2>

        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#C7C1CE]">
          {description}
        </p>
      </div>

      <div className="relative mt-6 flex items-center gap-2 text-sm font-semibold text-[#E6BF77]">
        {action}

        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

export default function Welcome() {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#0D0C14] font-sans text-white">
      <WelcomeBackground />

      <CertiFlowDotOverlay
        color="#D4D4D8"
        opacity={0.25}
      />

      {/* Header */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-6 sm:px-9">
        <Link
          to="/"
          className="flex items-center gap-3"
          aria-label="CertiFlow home"
        >
          <span className="grid size-11 place-items-center rounded-xl border border-[#D6AC63]/30 bg-[#D6AC63]/10 text-[#D6AC63]">
            <Award className="size-6" />
          </span>

          <div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              CertiFlow
            </span>

            <p className="text-[10px] tracking-wide text-[#AFA6B6]">
              RMKCET · Certificate Management
            </p>
          </div>
        </Link>

        <Link
          to="/verify"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#19171F]/80 px-3 py-2.5 text-xs font-medium text-[#D8CFDD] backdrop-blur-md transition-colors hover:border-[#D6AC63]/40 hover:bg-[#25212B] sm:px-4 sm:text-sm"
        >
          <BadgeCheck className="size-4 text-[#D6AC63]" />
          Verify certificate
        </Link>
      </header>

      {/* Main welcome content */}
      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 pb-16 pt-12 text-center sm:px-8 sm:pt-16">

        {/* React Bits Blur Text heading */}
        <AnimatedWelcomeTitle />

        <p className="mt-5 max-w-xl text-sm leading-7 text-[#D0CAD5] sm:text-base">
          Manage events and certificates, or find the
          achievements you've earned. Choose your path to begin.
        </p>

        {/* Administrator and Student cards */}
        <div className="mt-12 grid w-full max-w-[760px] gap-4 text-left sm:grid-cols-2 sm:gap-5">
          <EntryCard
            to="/login"
            icon={ShieldCheck}
            title="Administrator"
            description="Coordinate events, manage certificates, review feedback and work with J.A.R.V.I.S."
            action="Admin login"
            color="#D6AC63"
          />

          <EntryCard
            to="/my-certificates"
            icon={GraduationCap}
            title="Student"
            description="Find certificates using your register number, view achievements and verify authenticity."
            action="Find my certificates"
            color="#BFA9E4"
          />
        </div>

        <div className="mt-9 flex items-center justify-center gap-2 text-xs text-[#A8A1B0]">
          <BadgeCheck className="size-4 text-[#D6AC63]" />
          Every achievement deserves to be recognized.
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06] bg-[#0D0C14]/60 px-5 py-5 text-center text-xs text-[#A8A1B0] backdrop-blur-sm">
        CertiFlow · R.M.K. College of Engineering and Technology
      </footer>
    </main>
  );
}
