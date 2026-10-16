import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Award, CalendarDays, CalendarPlus, LayoutGrid, LogOut, Menu, Search, Settings, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../lib/auth.jsx';
import { orgLogoUrl, useOrg } from '../lib/org.jsx';
import Logo from './Logo.jsx';
import { Avatar, Button, cx } from './ui.jsx';

const GROUPS = [
  {
    label: 'Run events',
    items: [
      { to: '/', label: 'Overview', icon: LayoutGrid, end: true },
      { to: '/events', label: 'Events', icon: CalendarDays },
      { to: '/certificates', label: 'Certificates', icon: Award },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/settings', label: 'Settings', icon: Settings },
      { href: '/verify', label: 'Public verify page', icon: ShieldCheck },
    ],
  },
];

function NavItem({ item, onNavigate }) {
  const Icon = item.icon;
  const base = 'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] transition-colors';
  const content = (
    <>
      <Icon className="size-[18px] shrink-0" strokeWidth={1.9} />
      {item.label}
    </>
  );
  if (item.href) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className={cx(base, 'text-white/65 hover:bg-white/[0.06] hover:text-white')}>
        {content}
      </a>
    );
  }
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(base, isActive ? 'bg-white/[0.09] font-semibold text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white')
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? <span className="absolute inset-y-2 -left-5 w-[3px] rounded-r bg-gold" aria-hidden="true" /> : null}
          {content}
        </>
      )}
    </NavLink>
  );
}

function OrgBlock() {
  const { org } = useOrg();
  const { admin } = useAuth();
  if (!org.name && !org.unit) {
    return admin?.role === 'admin' ? (
      <Link to="/settings#organisation" className="block rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-sm text-white/60 hover:border-gold/60 hover:text-white">
        Add your college name
      </Link>
    ) : null;
  }
  const logo = orgLogoUrl(org);
  return (
    <div className="flex items-center gap-3">
      {logo ? (
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white p-1.5 ring-2 ring-gold/70">
          <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
        </span>
      ) : null}
      <div className={logo ? 'min-w-0' : 'border-l-2 border-gold/70 pl-3'}>
        {org.name ? <p className="text-[13px] leading-snug text-white/80">{org.name}</p> : null}
        {org.unit ? <p className="mt-0.5 text-[13px] font-semibold leading-snug text-gold">{org.unit}</p> : null}
      </div>
    </div>
  );
}

function SidebarContent({ onNavigate }) {
  const { admin, logout } = useAuth();
  return (
    <div className="flex h-full flex-col px-5 py-6">
      <Logo light />
      <div className="mt-6">
        <OrgBlock />
      </div>
      <nav className="mt-8 flex-1 space-y-7" aria-label="Main">
        {GROUPS.map((g) => (
          <div key={g.label}>
            <p className="mb-2 px-3 text-xs font-medium text-white/40">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((item) => <NavItem key={item.label} item={item} onNavigate={onNavigate} />)}
            </div>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-3 border-t border-white/10 pt-4">
        <Avatar name={admin?.name} className="bg-white/10 text-white" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-white">{admin?.name}</p>
          <p className="truncate text-xs text-white/50">{admin?.role === 'admin' ? 'Administrator' : 'Coordinator'}</p>
        </div>
        <button type="button" onClick={logout} className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Log out" title="Log out">
          <LogOut className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}

// Search any participant, register number, email or certificate ID from every page. Press "/" to focus.
function GlobalSearch({ className }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) navigate(`/certificates?search=${encodeURIComponent(q.trim())}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Find a participant by name, register no. or certificate ID"
        aria-label="Find a participant"
        className="h-11 w-full rounded-full border border-line bg-paper pl-10 pr-12 text-[15px] text-ink placeholder:text-faint focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15"
      />
      <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 text-xs text-faint sm:block">/</kbd>
    </form>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
      <div className="min-h-screen lg:pl-[272px]">
        {/* Desktop sidebar */}
        <aside className="no-print fixed inset-y-0 left-0 hidden w-[272px] bg-ink lg:block">
          <div className="absolute inset-y-0 left-0 flex" aria-hidden="true">
            <div className="w-[3px] bg-gold" />
            <div className="w-[4px]" />
            <div className="w-px bg-gold/40" />
          </div>
          <SidebarContent />
        </aside>

        {/* Mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-50 bg-ink/50 lg:hidden" onClick={() => setOpen(false)}>
            <div className="relative h-full w-[290px] bg-ink" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-6 rounded-md p-1 text-white/70" aria-label="Close menu">
                <X className="size-5" />
              </button>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </div>
        ) : null}

        {/* Top bar */}
        <header className="no-print sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
          <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-3 px-4 sm:px-8">
            <button type="button" onClick={() => setOpen(true)} className="-ml-1 rounded-md p-2 text-ink lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <Logo className="lg:hidden" />
            <GlobalSearch className="hidden max-w-xl flex-1 md:block" />
            <div className="ml-auto flex items-center gap-2">
              <Button icon={CalendarPlus} onClick={() => navigate('/events?new=1')} className="max-sm:px-3">
                <span className="max-sm:hidden">New event</span>
              </Button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-8 lg:pt-10">
          <Outlet />
        </main>
      </div>
  );
}
