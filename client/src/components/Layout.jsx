
import { useEffect, useRef, useState } from 'react';
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router';

import {
  Award,
  CalendarDays,
  CalendarPlus,
  LayoutGrid,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';

import { useAuth } from '../lib/auth.jsx';
import { orgLogoUrl, useOrg } from '../lib/org.jsx';

import Logo from './Logo.jsx';
import { Avatar, cx } from './ui.jsx';
import Jarvis from './Jarvis.jsx';
import AeroShards from './AeroShards.jsx';

// SIDEBAR DIMENSIONS
const EXPANDED_WIDTH = 272;
const COLLAPSED_WIDTH = 76;

// Distance from the browser's left edge.
const SIDEBAR_LEFT_GAP = 20;

// Additional space between sidebar and dashboard.
const SIDEBAR_CONTENT_GAP = 16;

const GROUPS = [
  {
    label: 'Run events',
    items: [
      {
        to: '/',
        label: 'Overview',
        icon: LayoutGrid,
        end: true,
      },
      {
        to: '/events',
        label: 'Events',
        icon: CalendarDays,
      },
      {
        to: '/certificates',
        label: 'Certificates',
        icon: Award,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        to: '/settings',
        label: 'Settings',
        icon: Settings,
      },
      {
        href: '/verify',
        label: 'Public verify page',
        icon: ShieldCheck,
      },
    ],
  },
];

// REDUCED MOTION SUPPORT
function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const update = () => {
      setReduced(media.matches);
    };

    update();

    media.addEventListener('change', update);

    return () => {
      media.removeEventListener('change', update);
    };
  }, []);

  return reduced;
}

// ADMIN BACKGROUND
// Keep Aero Shards unchanged for now.
function AdminBackground() {
  const reducedMotion = useReducedMotion();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(
      typeof navigator !== 'undefined' &&
      Boolean(navigator.gpu)
    );
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-[#100D17]"
      aria-hidden="true"
    >
      {!reducedMotion && enabled && (
        <div className="absolute inset-0 opacity-75">
          <AeroShards
            shardColor="#777180"
            accentColor="#AD9BBF"
            backgroundColor="transparent"
            placement="full"
            material="chrome"
            markers="none"
            count={650}
            shardSize={0.8}
            spread={1.2}
            twist={0.65}
            billow={0.35}
            speed={0.13}
            scale={1}
            depthOfField={0.55}
            glow={0.2}
            grain={0.02}
            vignette={0.3}
            intro={false}
            mouseInteraction={false}
            pulseOnClick={false}
            holdToGather={false}
            parallax={0}
            dpr={1}
            onError={(error) => {
              console.warn(
                'Aero Shards unavailable:',
                error
              );

              setEnabled(false);
            }}
          />
        </div>
      )}

      <div className="absolute inset-0 bg-[#100D17]/10" />

      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#100D17]/10 to-[#100D17]/40" />
    </div>
  );
}

// NAVIGATION LINKS
function NavItem({
  item,
  collapsed = false,
  onNavigate,
}) {
  const Icon = item.icon;

  const base = cx(
    'group relative flex min-h-11 items-center rounded-xl',
    'text-[14px] transition-colors duration-200',
    collapsed
      ? 'justify-center px-2'
      : 'gap-3 px-3'
  );

  const content = (
    <>
      <Icon
        className="size-[19px] shrink-0"
        strokeWidth={1.8}
        aria-hidden="true"
      />

      {!collapsed && (
        <span className="min-w-0 truncate">
          {item.label}
        </span>
      )}
    </>
  );

  if (item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer"
        onClick={onNavigate}
        title={collapsed ? item.label : undefined}
        aria-label={item.label}
        className={cx(
          base,
        'text-white/85 hover:bg-white/[0.12] hover:text-white'        )}
      >
        {content}
      </a>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={({ isActive }) =>
        cx(
          base,
          isActive
            ? 'bg-white/[0.12] font-semibold text-white'
            : 'text-white/85 hover:bg-white/[0.12] hover:text-white'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[#D6AC63]"
              aria-hidden="true"
            />
          )}

          {content}
        </>
      )}
    </NavLink>
  );
}

// ORGANISATION INFORMATION
function OrgBlock({ collapsed = false }) {
  const { org } = useOrg();
  const { admin } = useAuth();

  const logo = orgLogoUrl(org);

  if (collapsed) {
    return (
      <div className="flex justify-center">
        {logo ? (
          <img
            src={logo}
            alt={org.name || 'College'}
            title={org.name || 'College'}
            className="size-10 rounded-full border-2 border-[#D6AC63]/60 bg-white object-contain p-1"
          />
        ) : (
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/15 bg-black/20 text-white/90 backdrop-blur-sm transition-colors hover:bg-white/15"
            title={org.name || 'Organisation'}
          >
            <Award className="size-5" />
          </span>
        )}
      </div>
    );
  }

  if (!org.name && !org.unit) {
    return admin?.role === 'admin' ? (
      <Link
        to="/settings#organisation"
        className="block rounded-lg border border-dashed border-white/20 px-3 py-2.5 text-sm text-white/70 hover:border-gold/60 hover:text-white"
      >
        Add your college name
      </Link>
    ) : null;
  }

  return (
    <div className="flex items-center gap-3">
      {logo && (
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white p-1.5 ring-2 ring-[#D6AC63]/60">
          <img
            src={logo}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </span>
      )}

      <div
        className={
          logo
            ? 'min-w-0'
            : 'min-w-0 border-l-2 border-[#D6AC63]/70 pl-3'
        }
      >
        {org.name && (
          <p className="text-[12px] leading-snug text-white/85">
            {org.name}
          </p>
        )}

        {org.unit && (
          <p className="mt-1 text-[12px] font-semibold leading-snug text-[#D6AC63]">
            {org.unit}
          </p>
        )}
      </div>
    </div>
  );
}

// SIDEBAR CONTENT
function SidebarContent({
  collapsed = false,
  onNavigate,
  onToggle,
  mobile = false,
}) {
  const { admin, logout } = useAuth();

  return (
    <div
      className={cx(
        'flex flex-col py-4',
        collapsed ? 'px-3' : 'px-5'
      )}
    >
      {/* Branding and toggle */}
      <div
        className={cx(
          'flex min-h-12 items-center',
          collapsed
            ? 'flex-col gap-3'
            : 'justify-between gap-2'
        )}
      >
        {!collapsed && (
  <div className="min-w-0">
    <Logo light />
  </div>
)}

        {!mobile && (
          <button
            type="button"
            onClick={onToggle}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title={
              collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            aria-label={
              collapsed
                ? 'Expand sidebar'
                : 'Collapse sidebar'
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </button>
        )}
      </div>

      {/* College crest */}
      <div className={collapsed ? 'mt-3' : 'mt-4'}>
        <OrgBlock collapsed={collapsed} />
      </div>

      {/* Navigation */}
      <nav
        className={cx(
          'min-h-0 flex-none overflow-y-auto no-scrollbar',
          collapsed
            ? 'mt-4 space-y-3'
            : 'mt-5 space-y-4'
        )}
        aria-label="Main navigation"
      >
        {GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                {group.label}
              </p>
            ) : (
              <div
                className="mx-auto mb-3 h-px w-8 bg-white/15"
                aria-hidden="true"
              />
            )}

            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Profile and logout */}
      <div className="mt-4 border-t border-white/10 pt-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-3">
            <div title={admin?.name || 'Coordinator'}>
              <Avatar
                name={admin?.name}
                className="bg-white/10 text-white"
              />
            </div>

            <button
              type="button"
              onClick={logout}
              className="grid size-10 place-items-center rounded-lg text-white/65 hover:bg-white/10 hover:text-white"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="size-5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar
              name={admin?.name}
              className="bg-white/10 text-white"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {admin?.name}
              </p>

              <p className="truncate text-xs text-white/55">
                {admin?.role === 'admin'
                  ? 'Administrator'
                  : 'Coordinator'}
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-2 text-white/65 hover:bg-white/10 hover:text-white"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="size-[18px]" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// GLOBAL CERTIFICATE SEARCH
function GlobalSearch({ className }) {
  const navigate = useNavigate();
  const ref = useRef(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (event) => {
      if (
        event.key !== '/' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(
          document.activeElement?.tagName
        )
      ) {
        return;
      }

      event.preventDefault();
      ref.current?.focus();
    };

    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <form
      role="search"
      className={cx('relative', className)}
      onSubmit={(event) => {
        event.preventDefault();

        if (q.trim()) {
          navigate(
            `/certificates?search=${encodeURIComponent(q.trim())}`
          );
        }
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />

      <input
        ref={ref}
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Find a participant by name, register no. or certificate ID"
        aria-label="Find a participant"
        className="h-11 w-full rounded-full border border-white/10 bg-[#201D27]/90 pl-10 pr-12 text-[15px] text-white placeholder:text-[#AAA2B5] focus:border-[#BBA7DB] focus:outline-none focus:ring-2 focus:ring-[#BBA7DB]/20"
      />

      <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/15 px-1.5 text-xs text-[#AFA6BC] sm:block">
        /
      </kbd>
    </form>
  );
}

// MAIN ADMIN LAYOUT
export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);


const [collapsed, setCollapsed] = useState(() => {
  try {
    const saved = localStorage.getItem(
      'certiflow-sidebar-collapsed'
    );

    return saved === 'true';
  } catch {
    return false;
  }
});


  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);


useEffect(() => {
  try {
    window.localStorage.setItem(
      'certiflow-sidebar-collapsed',
      String(collapsed)
    );
  } catch {
    // Ignore unavailable storage.
  }
}, [collapsed]);

function toggleSidebar() {
  setCollapsed(previous => !previous);
}


  const desktopWidth = collapsed
    ? COLLAPSED_WIDTH
    : EXPANDED_WIDTH;

  // Allow space for the floating sidebar and its gap.
  const workspaceOffset =
    SIDEBAR_LEFT_GAP +
    desktopWidth +
    SIDEBAR_CONTENT_GAP;

  return (
    <div className="relative isolate min-h-screen bg-[#100D17] text-ink">

      {/* Existing animated background */}
      <AdminBackground />

      {/* FLOATING DESKTOP SIDEBAR */}


<aside
  className="
    no-print
    fixed left-5 top-1/2 z-30
    hidden -translate-y-1/2
    overflow-hidden
    rounded-[24px]
    border border-white/[0.12]
    bg-[#191620]/25
    shadow-[0_12px_40px_rgba(0,0,0,0.16)]
    backdrop-blur-md
    transition-[width] duration-200 ease-out
    lg:block
  "
  style={{
    width: `${desktopWidth}px`,
    height: 'fit-content',
    maxHeight: 'calc(100vh - 32px)',
  }}
>


        {/* No outer gold strip: sidebar now floats freely */}
        <SidebarContent
          collapsed={collapsed}
          onToggle={toggleSidebar}
        />
      </aside>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-50 bg-black/65 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="
              absolute
              bottom-4 left-4 top-4
              w-[290px] max-w-[calc(100vw-2rem)]
              overflow-hidden rounded-[22px]
              border border-white/15
              bg-[#191620]/95
              shadow-2xl backdrop-blur-2xl
            "
            onClick={(event) => event.stopPropagation()}
            aria-label="Mobile navigation"
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-6 z-10 rounded-lg border border-white/10 bg-[#2A2532] p-2 text-white/80 hover:text-white"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>

            <SidebarContent
              mobile
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* WORKSPACE */}
      <div
        className="
          certiflow-workspace
          relative z-10
          flex min-h-screen min-w-0 flex-col
          transition-[padding-left] duration-200 ease-out
        "
        style={{
          '--sidebar-width': `${workspaceOffset}px`,
        }}
      >
        <style>
          {`
            @media (min-width: 1024px) {
              .certiflow-workspace {
                padding-left: var(--sidebar-width);
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .certiflow-workspace {
                transition: none;
              }
            }
          `}
        </style>

        {/* TOP BAR */}
        <header className="no-print sticky top-0 z-40 border-b border-white/10 bg-[#15121B]/80 backdrop-blur-xl">
          <div className="mx-auto flex h-[68px] max-w-6xl items-center gap-3 px-4 sm:px-8">

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="-ml-1 rounded-lg p-2 text-white lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>

            <div className="lg:hidden">
              <Logo />
            </div>

            <GlobalSearch className="hidden max-w-xl flex-1 md:block" />

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/events?new=1')}
                className="
                  group flex h-10 items-center gap-2
                  rounded-xl
                  border border-[#B8892B]/50
                  bg-[#211D24] px-4
                  text-sm font-semibold text-[#F0E6D1]
                  transition-all duration-300
                  hover:border-[#E4BD71]
                  hover:bg-[#2C2530]
                  hover:shadow-[0_0_18px_rgba(184,137,43,0.18)]
                  active:scale-[0.98]
                "
              >
                <CalendarPlus className="size-[18px] text-[#E4BD71]" />

                <span className="hidden sm:inline">
                  New event
                </span>

                <span className="sm:hidden">
                  New
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* DASHBOARD AND ADMIN ROUTES */}
        <main className="relative mx-auto w-full max-w-6xl flex-1 px-4 pb-16 pt-8 sm:px-8 lg:pt-10">
          <Outlet />
        </main>
      </div>

      {/* J.A.R.V.I.S. */}
      <Jarvis />
    </div>
  );
}
