
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  ImageOff,
  KeyRound,
  Link2,
  RefreshCw,
  Unplug,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { useLocation } from 'react-router';
import { api, errorMessage } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { timeAgo } from '../lib/format.js';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  PageHeader,
  Skeleton,
  useToast,
} from '../components/ui.jsx';
import { orgLogoUrl, useOrg } from '../lib/org.jsx';

function Step({ n, title, done, children }) {
  return (
    <li className="flex gap-4">
      <span
        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full heading text-lg ${
          done ? 'bg-ok text-white' : 'border border-gold/60 text-gold'
        }`}
      >
        {done ? <Check className="size-4" strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1 pb-8">
        <p className="font-semibold">{title}</p>
        <div className="mt-1.5 space-y-3 text-[15px] text-ink-soft">
          {children}
        </div>
      </div>
    </li>
  );
}

function GoogleSetup({ settings, onChange }) {
  const toast = useToast();
  const { admin } = useAuth();
  const g = settings.google;

  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function copyScript() {
    let script;

    try {
      ({ data: script } = await api.get('/settings/google/script', {
        responseType: 'text',
      }));
    } catch (err) {
      toast(errorMessage(err), 'bad');
      return;
    }

    try {
      await navigator.clipboard.writeText(script);
      toast('Script copied');
    } catch {
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(
        new Blob([script], { type: 'text/plain' })
      );

      a.href = objectUrl;
      a.download = 'CertiFlow-Code.gs';
      a.click();
      URL.revokeObjectURL(objectUrl);

      toast(
        'Clipboard is blocked here, so the script was downloaded. Open the file and copy all of it.'
      );
    }

    setCopied(true);
  }

  async function connect(e) {
    e.preventDefault();
    setBusy('connect');
    setError('');

    try {
      const { data } = await api.put('/settings/google', {
        scriptUrl: url.trim(),
      });

      onChange({ ...settings, google: data.google });
      toast('Google Form connected');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy('');
    }
  }

  async function test() {
    setBusy('test');

    try {
      const { data } = await api.post('/settings/google/test');
      onChange({ ...settings, google: data.google });
      toast('Connection works');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  async function disconnect() {
    if (
      !window.confirm(
        'Disconnect the Google Form? Certificates already issued stay safe.'
      )
    ) {
      return;
    }

    try {
      const { data } = await api.delete('/settings/google');
      onChange({ ...settings, google: data.google });
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  }

  if (g.connected) {
    return (
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Google Form</h2>
              <Badge tone="ok">Connected</Badge>
            </div>

            <p className="mt-1 text-[15px] text-muted">
              {g.formTitle}. Last checked {timeAgo(g.lastSyncAt)}.
              {settings.mailMode === 'google' && g.emailQuota != null
                ? ` About ${g.emailQuota} emails left today on this Gmail account.`
                : ''}
            </p>

            {g.lastSyncError ? (
              <div className="mt-3">
                <ErrorNote>{g.lastSyncError}</ErrorNote>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {g.formUrl ? (
              <a href={g.formUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" icon={ExternalLink}>
                  Open form
                </Button>
              </a>
            ) : null}

            {g.editUrl ? (
              <a href={g.editUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" icon={ExternalLink}>
                  Edit form
                </Button>
              </a>
            ) : null}

            {g.registerUrl ? (
              <a href={g.registerUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="secondary" icon={ExternalLink}>
                  Certificate register
                </Button>
              </a>
            ) : null}

            <Button
              size="sm"
              variant="secondary"
              icon={RefreshCw}
              loading={busy === 'test'}
              onClick={test}
            >
              Test connection
            </Button>

            {admin.role === 'admin' ? (
              <Button
                size="sm"
                variant="danger"
                icon={Unplug}
                onClick={disconnect}
              >
                Disconnect
              </Button>
            ) : null}
          </div>
        </div>

        {g.scriptVersion < g.latestScriptVersion ? (
          <div className="mt-5 rounded-lg border border-gold/40 bg-gold-wash p-4">
            <p className="font-semibold">
              Update your Google script (2 minutes)
            </p>

            <p className="mt-1 text-sm text-ink-soft">
              {g.scriptVersion < 2
                ? 'The new version lets anyone check a certificate by scanning its QR code with their phone (right now the QR only works on this laptop), and adds the event code question.'
                : 'Version 3 adds an optional “Event Code” question to your form, used by the Attendance check of an event. Nothing else changes.'}
            </p>

            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
              <li>
                <button
                  type="button"
                  onClick={copyScript}
                  className="link"
                >
                  Copy the new script
                </button>
                {copied ? ' (copied)' : ''}.
              </li>

              <li>
                In your Apps Script project, select all the old code
                (Ctrl + A), paste (Ctrl + V) and save (Ctrl + S).
              </li>

              <li>
                Select <b>setup</b> next to Run and click <b>Run</b>.
                Allow any new permission Google asks for.
              </li>

              <li>
                <b>Deploy → Manage deployments → ✏️ Edit</b>,
                set <b>Version: New version</b>, click <b>Deploy</b>.
                The link stays the same.
              </li>

              <li>
                Click <b>Test connection</b> above.
                This notice disappears when it worked.
              </li>

              {g.scriptVersion < 2 ? (
                <li>
                  Open each event that already has certificates and
                  click <b>Re-create certificates</b>, so their QR
                  codes use the new verify page.
                </li>
              ) : null}
            </ol>
          </div>
        ) : null}

        <p className="mt-5 rounded-lg bg-canvas px-4 py-3 text-sm text-ink-soft">
          Don't rename the questions in the Google Form. CertiFlow
          reads answers by their titles. You can change the description,
          colours and header image freely.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold">
        Connect your Google Form
      </h2>

      <p className="mt-1 text-[15px] text-muted">
        Do this once, signed in to the Gmail account that should send
        the certificates. It takes about three minutes.
      </p>

      <ol className="mt-6">
        <Step n={1} title="Copy the CertiFlow script" done={copied}>
          <p>It already contains your app's secret key.</p>

          <Button
            icon={copied ? Check : Copy}
            variant={copied ? 'secondary' : 'primary'}
            onClick={copyScript}
          >
            {copied ? 'Copied' : 'Copy script'}
          </Button>
        </Step>

        <Step n={2} title="Paste it into a new Apps Script project">
          <p>
            Open{' '}
            <a
              href="https://script.new"
              target="_blank"
              rel="noreferrer"
              className="link"
            >
              script.new
            </a>
            , delete the sample code, paste, and press{' '}
            <b>Ctrl + S</b> to save.
          </p>
        </Step>

        <Step n={3} title="Run setup to create your form">
          <p>
            Make sure <b>setup</b> is selected next to the Run button,
            then click <b>Run</b>. Google asks for permission:
            choose your account, then <b>Advanced</b>,{' '}
            <b>Go to project</b>, <b>Allow</b>.
          </p>
        </Step>

        <Step n={4} title="Deploy it as a web app">
          <p>
            Click <b>Deploy</b>, <b>New deployment</b>, the gear
            icon, <b>Web app</b>. Set <b>Execute as: Me</b> and{' '}
            <b>Who has access: Anyone</b>, then <b>Deploy</b>
            and copy the <b>Web app URL</b>.
          </p>
        </Step>

        <Step n={5} title="Paste the Web app URL here">
          <form
            onSubmit={connect}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <Input
              placeholder="https://script.google.com/macros/s/…/exec"
              value={url}
              onChange={e => setUrl(e.target.value)}
              aria-label="Web app URL"
              required
            />

            <Button
              type="submit"
              icon={Link2}
              loading={busy === 'connect'}
              className="shrink-0"
            >
              Connect
            </Button>
          </form>

          <ErrorNote>{error}</ErrorNote>
        </Step>
      </ol>
    </Card>
  );
}

function PasswordCard() {
  const toast = useToast();

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      await api.post('/auth/change-password', form);

      setForm({
        currentPassword: '',
        newPassword: '',
      });

      toast('Password changed');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <KeyRound className="size-5 text-muted" />
        Your password
      </h2>

      <form onSubmit={save} className="mt-4 space-y-3">
        <Field label="Current password">
          <Input
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={e =>
              setForm({
                ...form,
                currentPassword: e.target.value,
              })
            }
            required
          />
        </Field>

        <Field label="New password" hint="At least 8 characters">
          <Input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={form.newPassword}
            onChange={e =>
              setForm({
                ...form,
                newPassword: e.target.value,
              })
            }
            required
          />
        </Field>

        <ErrorNote>{error}</ErrorNote>

        <Button type="submit" loading={busy}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

// ------------------------------------------
// TEAM MANAGEMENT — AUTOFILL FIX
// ------------------------------------------

const EMPTY_MEMBER = {
  name: '',
  email: '',
  password: '',
  role: 'coordinator',
};

function TeamCard() {
  const toast = useToast();
  const { admin } = useAuth();

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(() => ({
    ...EMPTY_MEMBER,
  }));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [formVersion, setFormVersion] = useState(0);

  const load = useCallback(
    () =>
      api
        .get('/auth/users')
        .then(r => setUsers(r.data.users))
        .catch(() => {}),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function update(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value,
    }));
  }

  function clearForm() {
    setForm({ ...EMPTY_MEMBER });
    setError('');
    setFormVersion(previous => previous + 1);
  }

  async function add(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      };

      await api.post('/auth/users', payload);

      toast(`${payload.name} can now log in`);

      clearForm();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(u) {
    if (!window.confirm(`Remove ${u.name}'s access?`)) {
      return;
    }

    try {
      await api.delete(`/auth/users/${u.id}`);
      await load();
    } catch (err) {
      toast(errorMessage(err), 'bad');
    }
  }

  return (
    <Card className="p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <UserPlus className="size-5 text-muted" />
        Team
      </h2>

      <p className="mt-1 text-sm text-muted">
        Coordinators can manage events and certificates. Admins can
        also change the Google connection and team.
      </p>

      <ul className="mt-4 divide-y divide-line rounded-lg border border-line">
        {users.map(u => (
          <li
            key={u.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {u.name}{' '}
                {u.id === admin.id ? (
                  <span className="text-muted">(you)</span>
                ) : null}
              </p>

              <p className="truncate text-xs text-muted">
                {u.email}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                tone={u.role === 'admin' ? 'blue' : 'muted'}
              >
                {u.role === 'admin'
                  ? 'Admin'
                  : 'Coordinator'}
              </Badge>

              {u.id !== admin.id ? (
                <button
                  type="button"
                  onClick={() => remove(u)}
                  className="rounded p-1 text-muted hover:text-bad"
                  aria-label={`Remove ${u.name}`}
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      <form
        key={formVersion}
        onSubmit={add}
        autoComplete="off"
        className="mt-4 grid gap-3 sm:grid-cols-2"
      >
        {/* New member name — not the logged-in user's name */}
        <input
          type="text"
          name="team_member_new_name"
          autoComplete="off"
          placeholder="Name"
          aria-label="New team member name"
          value={form.name}
          onChange={e => update('name', e.target.value)}
          maxLength={120}
          required
          className="h-10 min-w-0 rounded-lg border border-line bg-paper px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-blue focus:ring-2 focus:ring-blue/15"
        />

        {/* New member email — distinct from login email */}
        <input
          type="email"
          name="team_member_new_email"
          autoComplete="section-new-team-member email"
          placeholder="Email"
          aria-label="New team member email"
          value={form.email}
          onChange={e => update('email', e.target.value)}
          required
          className="h-10 min-w-0 rounded-lg border border-line bg-paper px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-blue focus:ring-2 focus:ring-blue/15"
        />

        {/* Ask the browser for a NEW password, not saved login */}
        <input
          type="password"
          name="team_member_new_secret"
          autoComplete="new-password"
          placeholder="Temporary password"
          aria-label="New team member temporary password"
          value={form.password}
          onChange={e => update('password', e.target.value)}
          minLength={8}
          maxLength={256}
          required
          className="h-10 min-w-0 rounded-lg border border-line bg-paper px-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-blue focus:ring-2 focus:ring-blue/15"
        />

        <select
          name="team_member_new_role"
          aria-label="New team member role"
          value={form.role}
          onChange={e => update('role', e.target.value)}
          className="h-10 min-w-0 rounded-lg border border-line bg-paper px-3 text-[15px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/15"
        >
          <option value="coordinator">Coordinator</option>
          <option value="admin">Admin</option>
        </select>

        <div className="sm:col-span-2">
          <ErrorNote>{error}</ErrorNote>
        </div>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button
            type="submit"
            variant="secondary"
            icon={UserPlus}
            loading={busy}
          >
            Add team member
          </Button>

          <button
            type="button"
            onClick={clearForm}
            disabled={busy}
            className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-ink disabled:opacity-50"
          >
            Clear fields
          </button>
        </div>
      </form>
    </Card>
  );
}

function LogoPicker() {
  const toast = useToast();
  const { org, setOrg } = useOrg();

  const [busy, setBusy] = useState('');
  const fileRef = useRef(null);
  const src = orgLogoUrl(org);

  async function run(kind, request) {
    setBusy(kind);

    try {
      const { data } = await request();
      setOrg(data.org);

      toast(
        data.org.logo === 'none'
          ? 'QR codes will be plain, without a logo'
          : 'Logo saved. New QR codes show it in the middle.'
      );
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy('');
    }
  }

  function upload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      toast('Choose a PNG or JPG image', 'bad');
      return;
    }

    run('upload', () =>
      api.put('/settings/org/logo', file, {
        headers: {
          'Content-Type': file.type,
        },
      })
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-5 border-t border-line pt-6 sm:flex-row sm:items-center">
      <div className="grid size-24 shrink-0 place-items-center rounded-full border-2 border-gold/60 bg-paper p-3 shadow-sm">
        {src ? (
          <img
            src={src}
            alt="College logo"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <ImageOff className="size-7 text-faint" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          College logo
        </p>

        <p className="mt-0.5 text-sm text-muted">
          Placed in the middle of every event QR code and as a
          faint watermark on the projector screen when you present
          a QR code. A transparent PNG works best. The QR still
          scans with the logo in it.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={upload}
          />

          <Button
            size="sm"
            variant="secondary"
            icon={Upload}
            loading={busy === 'upload'}
            onClick={() => fileRef.current?.click()}
          >
            Upload logo
          </Button>

          {org.logo !== 'crest' ? (
            <Button
              size="sm"
              variant="secondary"
              loading={busy === 'crest'}
              onClick={() =>
                run('crest', () =>
                  api.post('/settings/org/logo', {
                    use: 'crest',
                  })
                )
              }
            >
              Use RMKCET crest
            </Button>
          ) : null}

          {org.logo !== 'none' ? (
            <Button
              size="sm"
              variant="ghost"
              loading={busy === 'none'}
              onClick={() =>
                run('none', () =>
                  api.post('/settings/org/logo', {
                    use: 'none',
                  })
                )
              }
            >
              No logo
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OrgCard() {
  const toast = useToast();
  const { org, setOrg } = useOrg();

  const [form, setForm] = useState(org);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(org);
  }, [org]);

  async function save(e) {
    e.preventDefault();
    setBusy(true);

    try {
      const { data } = await api.put('/settings/org', {
        name: form.name,
        unit: form.unit,
      });

      setOrg(data.org);
      toast('Organisation saved');
    } catch (err) {
      toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      className="scroll-mt-24 p-6"
      id="organisation"
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Building2 className="size-5 text-muted" />
        Organisation
      </h2>

      <p className="mt-1 text-sm text-muted">
        Shown in the sidebar, on event QR codes and on the projector
        screen when you present a QR code.
      </p>

      <form
        onSubmit={save}
        className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end"
      >
        <Field label="College">
          <Input
            value={form.name}
            onChange={e =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
            placeholder="R.M.K. College of Engineering and Technology"
            maxLength={120}
          />
        </Field>

        <Field label="Department or club">
          <Input
            value={form.unit}
            onChange={e =>
              setForm({
                ...form,
                unit: e.target.value,
              })
            }
            placeholder="Department of CSE"
            maxLength={120}
          />
        </Field>

        <Button type="submit" loading={busy}>
          Save
        </Button>
      </form>

      <LogoPicker />
    </Card>
  );
}

export default function Settings() {
  const { admin } = useAuth();

  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');

  const { hash } = useLocation();

  useEffect(() => {
    api
      .get('/settings')
      .then(r => setSettings(r.data))
      .catch(e => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    if (!settings || !hash) return;

    document
      .getElementById(hash.slice(1))
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
  }, [settings, hash]);

  if (error) {
    return <ErrorNote>{error}</ErrorNote>;
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your college details, the Google Form and Gmail connection, and who can log in."
      />

      <div className="space-y-6">
        {admin.role === 'admin' ? (
          <OrgCard />
        ) : null}

        <GoogleSetup
          settings={settings}
          onChange={setSettings}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <PasswordCard />

          {admin.role === 'admin' ? (
            <TeamCard />
          ) : null}
        </div>

        <p className="text-sm text-muted">
          Database:{' '}
          {settings.database === 'local'
            ? 'stored on this computer (server/.data)'
            : 'MongoDB Atlas'}.
          {' '}Emails are sent{' '}
          {settings.mailMode === 'smtp'
            ? 'through your SMTP settings'
            : 'from the connected Gmail account'}.
          {' '}Verification links point to{' '}
          {settings.publicBaseUrl}.
        </p>
      </div>
    </>
  );
}
