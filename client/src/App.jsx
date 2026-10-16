import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
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

function RequireAuth({ children }) {
  const { admin, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="min-h-screen"><Spinner /></div>;
  if (!admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/verify" element={<Verify />} />
            <Route path="/verify/:certificateId" element={<Verify />} />
            <Route path="/my-certificates" element={<MyCertificates />} />
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
              <Route path="events/:id" element={<EventDetail />} />
              <Route path="certificates" element={<Certificates />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
