import axios from 'axios';

const TOKEN_KEY = 'certiflow.token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t) => {
    try { localStorage.setItem(TOKEN_KEY, t); } catch { /* private mode */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* private mode */ }
  },
};

export const api = axios.create({ baseURL: '/api', timeout: 120000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config.url.includes('/auth/login')) onUnauthorized();
    return Promise.reject(err);
  }
);

export function errorMessage(err) {
  if (err?.response?.data instanceof Blob) return 'Download failed';
  return err?.response?.data?.message || err?.message || 'Something went wrong';
}

// Downloads a protected file (PDF/CSV) using the login token
export async function downloadFile(url, fallbackName) {
  const res = await api.get(url, { responseType: 'blob' });
  const dispo = res.headers['content-disposition'] || '';
  const name = /filename="([^"]+)"/.exec(dispo)?.[1] || fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 2000);
}

// Opens a protected PDF in a new tab. The tab is opened straight away (while the click
// still counts as a user action) so Chrome's pop-up blocker doesn't stop it.
export async function openPdf(url, { before } = {}) {
  const win = window.open('', '_blank');
  if (win) win.document.write('<p style="font-family:sans-serif;padding:24px">Preparing the certificate…</p>');
  try {
    if (before) await before();
    const res = await api.get(url, { responseType: 'blob' });
    const href = URL.createObjectURL(res.data);
    if (win) win.location.href = href;
    else {
      // pop-ups blocked: download instead
      const a = document.createElement('a');
      a.href = href;
      a.download = 'certificate.pdf';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(href), 120000);
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}
