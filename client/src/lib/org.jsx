import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';
import { useAuth } from './auth.jsx';

// College / department name and logo, shown in the sidebar, in the middle of event QR codes
// and on the projector screen (set in Settings)
const EMPTY = { name: '', unit: '', logo: 'none', logoVersion: '' };
const OrgContext = createContext({ org: EMPTY, setOrg: () => {} });

/** URL of the college logo image, or null when there is none */
export const orgLogoUrl = (org) =>
  org?.logo && org.logo !== 'none' ? `/api/public/org/logo?v=${encodeURIComponent(org.logoVersion || '')}` : null;

export function OrgProvider({ children }) {
  const { admin } = useAuth();
  const [org, setOrg] = useState(EMPTY);
  useEffect(() => {
    if (!admin) return;
    api.get('/settings/org').then((r) => setOrg(r.data.org)).catch(() => {});
  }, [admin]);
  const value = useMemo(() => ({ org, setOrg }), [org]);
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export const useOrg = () => useContext(OrgContext);
