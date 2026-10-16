import { useState } from 'react';
import { Link } from 'react-router';
import { Award, Download, Search, ShieldCheck, Trophy } from 'lucide-react';
import { api, errorMessage } from '../lib/api.js';
import { fmtDate } from '../lib/format.js';
import { Badge, Button, ErrorNote, Field, Input, Skeleton } from '../components/ui.jsx';
import Logo from '../components/Logo.jsx';

// Public page: a student finds every certificate issued to them with register number + email
export default function MyCertificates() {
  const [form, setForm] = useState({ regNo: '', email: '' });
  const [state, setState] = useState({ status: 'idle' });

  async function search(e) {
    e.preventDefault();
    setState({ status: 'loading' });
    try {
      const { data } = await api.post('/public/my-certificates', form);
      setState({ status: 'done', ...data });
    } catch (err) {
      setState({ status: 'error', message: errorMessage(err) });
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="relative bg-ink text-white">
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gold" aria-hidden="true" />
        <div className="mx-auto max-w-2xl px-5 pb-16 pt-8">
          <Logo light />
          <h1 className="heading mt-12 text-[2.8rem] leading-tight">My certificates</h1>
          <p className="mt-2 max-w-md text-[15px] text-white/70">
            Lost the email? Enter your register number and the email you gave in the feedback form to download all your certificates again.
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-8 max-w-2xl px-5 pb-16">
        <form onSubmit={search} className="grid gap-3 rounded-xl bg-paper p-5 shadow-[0_10px_30px_-12px_rgb(14_27_54_/_0.3)] ring-1 ring-line sm:grid-cols-[1fr_1.3fr_auto] sm:items-end">
          <Field label="Register number">
            <Input value={form.regNo} onChange={(e) => setForm({ ...form, regNo: e.target.value })} required autoComplete="off" className="uppercase" />
          </Field>
          <Field label="Email">
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required autoComplete="email" />
          </Field>
          <Button type="submit" icon={Search} loading={state.status === 'loading'}>Find</Button>
        </form>

        <div className="mt-8">
          {state.status === 'loading' ? <Skeleton className="h-48 rounded-xl" /> : null}
          {state.status === 'error' ? <ErrorNote>{state.message}</ErrorNote> : null}
          {state.status === 'done' && !state.certificates.length ? (
            <div className="rounded-xl border border-line bg-paper px-6 py-8 text-center">
              <Award className="mx-auto size-8 text-faint" strokeWidth={1.5} />
              <p className="mt-2 font-medium">No certificates found</p>
              <p className="mt-1 text-sm text-muted">Check the register number, and use the same email you typed in the form. Certificates usually arrive a few minutes after you submit.</p>
            </div>
          ) : null}
          {state.status === 'done' && state.certificates.length ? (
            <section className="overflow-hidden rounded-xl border border-line bg-paper">
              <p className="border-b border-line px-6 py-4 font-semibold">
                {state.name}, you have {state.certificates.length} certificate{state.certificates.length === 1 ? '' : 's'}
              </p>
              <ul className="divide-y divide-line">
                {state.certificates.map((c) => (
                  <li key={c.certificateId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="heading text-xl text-ink">
                        {c.event}
                        {c.award ? <Badge tone="gold" className="ml-2 align-middle font-sans"><Trophy className="size-3" /> {c.award}</Badge> : null}
                      </p>
                      <p className="text-sm text-muted">{c.organizer}, {fmtDate(c.eventDate)} · <span className="whitespace-nowrap">{c.certificateId}</span></p>
                    </div>
                    <a href={c.download}><Button size="sm" variant="secondary" icon={Download}>Download PDF</Button></a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <p className="mt-10 flex items-center justify-center gap-2 text-sm text-muted">
          <ShieldCheck className="size-4" /> Checking someone else&apos;s certificate? <Link to="/verify" className="link">Verify a certificate</Link>
        </p>
      </main>
    </div>
  );
}
