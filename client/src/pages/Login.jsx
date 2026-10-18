import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Button, ErrorNote, Field, Input } from '../components/ui.jsx';
import Logo from '../components/Logo.jsx';
import BlurText from '../components/BlurText';

const STEPS = ['Scan the event QR', 'Share feedback', 'Certificate arrives by email'];

export default function Login() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (admin) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink px-14 py-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-y-0 left-0 flex">
          <div className="w-[3px] bg-gold" />
          <div className="w-[5px]" />
          <div className="w-px bg-gold/50" />
        </div>
        <Logo light />
        <div className="my-auto max-w-xl">
          
<div className="space-y-2">
  <h1 className="sr-only">
    Feedback in. Certificates out.
  </h1>

  <BlurText
    text="Feedback in."
    effect="blur"
    animateBy="words"
    direction="top"
    trigger="load"
    delay={300}
    stepDuration={0.9}
    blur={12}
    distance={30}
    loop={false}
    className="text-[3.4rem] font-bold leading-[1.1] tracking-tight text-white"
  />

  <BlurText
    text="Certificates out."
    effect="blur"
    animateBy="words"
    direction="top"
    trigger="load"
    delay={300}
    stepDuration={0.9}
    blur={12}
    distance={30}
    loop={false}
    className="text-[3.4rem] font-bold leading-[1.1] tracking-tight text-[#D6AC63]"
  />
</div>

          <p className="mt-4 max-w-md text-[15px] text-white/70">
            Participants scan one QR code after the event. A few minutes later this lands in their inbox, with a QR code anyone can scan to check it's genuine.
          </p>
          <figure className="mt-9">
            <img
              src="/sample-certificate.jpg"
              alt="Sample certificate of participation for Query Quest, awarded to Arjun Kumar"
              className="w-full max-w-[540px] -rotate-[1.5deg] rounded-[3px] shadow-[0_24px_60px_-12px_rgb(0_0_0_/_0.6)] ring-1 ring-white/10"
            />
          </figure>
          <ol className="mt-10 flex flex-wrap gap-x-7 gap-y-2 text-sm text-white/80">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2.5">
                <span className="heading text-xl text-gold">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
            <img
              src="/sample-certificate.jpg"
              alt="Sample certificate of participation for Query Quest"
              className="mt-6 w-full rounded-[3px] shadow-[0_12px_30px_-10px_rgb(14_27_54_/_0.45)] ring-1 ring-line"
            />
          </div>
          <h2 className="heading text-[2.4rem]">Coordinator login</h2>
          <p className="mt-1.5 text-[15px] text-muted">Manage events, feedback and certificates.</p>

          <div className="mt-8 space-y-4">
            <Field label="Email">
              <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Field>
            <Field label="Password">
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </Field>
            <ErrorNote>{error}</ErrorNote>
            <Button type="submit" loading={busy} className="w-full">
              Log in
            </Button>
          </div>

                  <p className="mt-8 text-sm text-muted">
            Student? <Link to="/my-certificates" className="link">Find your certificates</Link> or <Link to="/verify" className="link">verify one</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
