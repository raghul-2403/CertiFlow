
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router';

import { AuthProvider, useAuth } from './lib/auth.jsx';
import { OrgProvider } from './lib/org.jsx';
import { Spinner, ToastProvider } from './components/ui.jsx';

import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Events from './pages/Events.jsx';
import EventDetail from './pages/EventDetail.jsx';
import Certificates from './pages/Certificates.jsx';
import Settings from './pages/Settings.jsx';
import Verify from './pages/Verify.jsx';
import Present from './pages/Present.jsx';
import MyCertificates from './pages/MyCertificates.jsx';

// Protected pages
function RequireAuth({ children }) {
  const { admin, ready } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!admin) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return children;
}

// Lightweight white snowflakes.
// Pure CSS animation: no WebGL or full-screen canvas.
const SNOWFLAKES = Array.from({ length: 28 }, (_, i) => ({
  id: i,
  left: `${(i * 37.7 + 13) % 100}%`,
  delay: `${-((i * 3.7) % 19)}s`,
  duration: `${16 + (i % 8) * 2}s`,
  size: `${8 + (i % 4) * 3}px`,
  opacity: 0.12 + (i % 4) * 0.035,
}));

function CertiFlowSnow() {
  const location = useLocation();

  // Keep the projector QR code easy to scan.
  if (/^\/events\/[^/]+\/present\/?$/.test(location.pathname)) {
    return null;
  }

  return (
    <div
      className="certiflow-snow no-print"
      aria-hidden="true"
    >
      {SNOWFLAKES.map((flake) => (
        <span
          key={flake.id}
          className="certiflow-snowflake"
          style={{
            left: flake.left,
            animationDelay: flake.delay,
            animationDuration: flake.duration,
            fontSize: flake.size,
            opacity: flake.opacity,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <ToastProvider>
            <CertiFlowSnow />

            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/verify" element={<Verify />} />
              <Route
                path="/verify/:certificateId"
                element={<Verify />}
              />
              <Route
                path="/my-certificates"
                element={<MyCertificates />}
              />

              <Route
                path="/events/:id/present"
                element={
                  <RequireAuth>
                    <Present />
                  </RequireAuth>
                }
              />

              <Route
                element={
                  <RequireAuth>
                    <Layout />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="events" element={<Events />} />
                <Route
                  path="events/:id"
                  element={<EventDetail />}
                />
                <Route
                  path="certificates"
                  element={<Certificates />}
                />
                <Route path="settings" element={<Settings />} />
              </Route>

              <Route
                path="*"
                element={<Navigate to="/" replace />}
              />
            </Routes>
          </ToastProvider>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
