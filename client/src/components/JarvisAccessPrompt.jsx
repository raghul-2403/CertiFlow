
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  KeyRound,
  LockKeyhole,
  X,
} from 'lucide-react';

import { api } from '../lib/api.js';

export default function JarvisAccessPrompt({
  actionId,
  onClose,
  onResult,
}) {
  const [key, setKey] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [remaining, setRemaining] = useState(null);
  const [complete, setComplete] = useState(false);
  const [locked, setLocked] = useState(false);

  const inputRef = useRef(null);
  const enterRef = useRef(null);
  const yesRef = useRef(null);
  const noRef = useRef(null);

  function play(ref) {
    const audio = ref.current;

    if (!audio) return;

    audio.currentTime = 0;

    audio.play().catch(() => {
      // Browser audio permission may block playback.
      // The visual security message remains available.
    });
  }

  // Play voice prompt when a new authorization
  // request is displayed.
  useEffect(() => {
    inputRef.current?.focus();
    play(enterRef);
  }, [actionId]);

  async function verify(event) {
    event.preventDefault();

    if (
      !key ||
      working ||
      complete ||
      locked
    ) {
      return;
    }

    setWorking(true);
    setMessage('');

    try {
      const { data } = await api.post(
        '/jarvis/approval',
        {
          actionId,
          accessKey: key,
        }
      );

      setKey('');
      setComplete(true);
      setMessage('Access Approved');

      play(yesRef);
      onResult?.(data);
    } catch (error) {
      const data = error.response?.data;

      setKey('');

      if (data?.executionFailed) {
        setComplete(true);
        setMessage(
          data.result ||
          'Authorized, but the requested operation failed.'
        );

        onResult?.(data);
      } else if (
        data?.configurationError
      ) {
        setMessage(
          'Access-key verification is not configured.'
        );
      } else {
        setMessage('Access denied');
        play(noRef);

        setRemaining(
          data?.attemptsRemaining ?? null
        );

        if (data?.attemptsRemaining === 0) {
          setLocked(true);
        }
      }

      inputRef.current?.focus();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="J.A.R.V.I.S. access verification"
      className="absolute inset-0 z-50 flex items-center justify-center bg-[#071016]/95 p-4"
    >
      {/* Prerecorded J.A.R.V.I.S. voice clips */}
      <audio
        ref={enterRef}
        src="/enter.mp3"
        preload="auto"
      />

      <audio
        ref={yesRef}
        src="/access-approved.mp3"
        preload="auto"
      />

      <audio
        ref={noRef}
        src="/access-denied.mp3"
        preload="auto"
      />

      <div className="w-full rounded-2xl border border-cyan-400/35 bg-[#14232C] p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-cyan-300">
            <LockKeyhole className="size-5" />

            <strong className="text-sm">
              J.A.R.V.I.S. Security
            </strong>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close approval"
            className="rounded-lg p-1 text-slate-300 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-5 text-center text-sm font-semibold text-white">
          {complete && message === 'Access Approved'
            ? 'Access Approved'
            : 'Please enter the access key to continue'}
        </p>

        <p className="mt-2 text-center text-xs text-[#A4BCC7]">
          Only the requested event rename will be authorized.
        </p>

        {!complete && !locked && (
          <form
            onSubmit={verify}
            className="mt-5 space-y-3"
          >
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cyan-400" />

              <input
                ref={inputRef}
                type="password"
                value={key}
                onChange={event =>
                  setKey(event.target.value)
                }
                placeholder="Access key"
                autoComplete="off"
                maxLength={256}
                required
                disabled={working}
                className="w-full rounded-lg border border-[#365765] bg-[#0D1921] py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-cyan-400"
              />
            </div>

            <button
              type="submit"
              disabled={working || !key}
              className="w-full rounded-lg bg-[#49CADB] px-4 py-3 text-sm font-bold text-[#07161A] disabled:opacity-50"
            >
              {working
                ? 'Verifying...'
                : 'Verify Access Key'}
            </button>
          </form>
        )}

        {message && (
          <p
            role="status"
            className={`mt-4 text-center text-sm font-semibold ${
              message === 'Access Approved'
                ? 'text-emerald-300'
                : 'text-rose-300'
            }`}
          >
            {message}
          </p>
        )}

        {remaining !== null && !complete && (
          <p className="mt-2 text-center text-xs text-[#A4BCC7]">
            {remaining} attempts remaining
          </p>
        )}

        {(complete || locked) && (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg border border-[#365765] px-4 py-2 text-sm text-white"
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
}
