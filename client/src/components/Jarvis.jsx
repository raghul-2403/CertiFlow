
import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router';
import ElectricBorder from './ElectricBorder.jsx';

import {
  Activity,
  Bot,
  LoaderCircle,
  MessageCircle,
  Send,
  ShieldAlert,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

import { api } from '../lib/api.js';

import JarvisHorizon from './JarvisHorizon.jsx';
import JarvisAccessPrompt from './JarvisAccessPrompt.jsx';

export default function Jarvis() {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('checking');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [logoAvailable, setLogoAvailable] = useState(true);
  const [voiceMessage, setVoiceMessage] = useState('');

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const [eventDraft, setEventDraft] = useState(null);

  // Sensitive-operation approval.
  const [approvalId, setApprovalId] = useState(null);

  const audioRef = useRef(null);
  const scrollRef = useRef(null);
  const busyRef = useRef(false);

  // Scroll messages, not the whole website.
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [open, messages, sending]);

  // Load backend status and saved messages.
  useEffect(() => {
    if (!open) return;

    let active = true;

    async function initialize() {
      setStatus('checking');
      setLoadingHistory(true);
      setChatError('');

      try {
        await api.get('/jarvis/status');

        if (active) {
          setStatus('online');
        }
      } catch {
        if (active) {
          setStatus('unavailable');
        }
      }

      try {
        const { data } =
          await api.get('/jarvis/history');

        if (
          active &&
          !busyRef.current
        ) {
          setMessages(data.messages || []);
        }
      } catch {
        if (active) {
          setChatError(
            'Could not load saved conversation history.'
          );
        }
      } finally {
        if (active) {
          setLoadingHistory(false);
        }
      }
    }

    initialize();

    return () => {
      active = false;
    };
  }, [open]);

  // Existing recorded warning voice.
  async function testVoice() {
    if (
      !voiceEnabled ||
      !audioRef.current
    ) {
      return;
    }

    const audio = audioRef.current;

    audio.pause();
    audio.currentTime = 0;

    try {
      await audio.play();

      setVoiceMessage(
        'Voice alert played.'
      );
    } catch {
      setVoiceMessage(
        'Your browser blocked sound playback.'
      );
    }
  }

  function toggleVoice() {
    if (voiceEnabled) {
      audioRef.current?.pause();
    }

    setVoiceEnabled(value => !value);

    setVoiceMessage(
      voiceEnabled
        ? 'Voice disabled.'
        : 'Voice enabled.'
    );
  }

  // Send a normal chat message.
  // Never send the secret key using this function.
  async function sendMessage(event) {
    event.preventDefault();

    const text = input.trim();

    if (
      !text ||
      busyRef.current ||
      loadingHistory ||
      approvalId
    ) {
      return;
    }

    if (text.length > 2000) {
      setChatError(
        'Maximum 2000 characters.'
      );
      return;
    }

    busyRef.current = true;
    setSending(true);
    setInput('');
    setChatError('');
    setEventDraft(null);

    setMessages(previous => [
      ...previous,
      {
        role: 'user',
        content: text,
        pending: true,
      },
    ]);

    try {
      const { data } = await api.post(
        '/jarvis/chat',
        {
          message: text,
        }
      );

      setEventDraft(data.draft || null);

      setMessages(previous => [
        ...previous.slice(0, -1),
        {
          role: 'user',
          content: text,
        },
        {
          role: 'assistant',
          content: data.reply,
          provider: data.provider,
        },
      ]);

      if (
        data.approvalRequired &&
        data.approvalId
      ) {
        setApprovalId(data.approvalId);
      }
    } catch (error) {
      setMessages(previous =>
        previous.slice(0, -1)
      );

      setInput(text);

      setChatError(
        error.response?.data?.error ||
        'J.A.R.V.I.S. could not respond.'
      );
    } finally {
      busyRef.current = false;
      setSending(false);
    }
  }

  // Review an AI-prepared event draft.
  function reviewDraft() {
    if (!eventDraft) return;

    navigate('/events?new=1', {
      state: {
        jarvisDraft: eventDraft,
      },
    });

    setEventDraft(null);
    setOpen(false);
  }

  function handleApprovalResult(data) {
    const content = data.approved
      ? `Access Approved\n\n${data.result}`
      : data.result ||
        'The requested operation could not be completed.';

    setMessages(previous => [
      ...previous,
      {
        role: 'assistant',
        content,
        provider: 'certiflow',
      },
    ]);
  }

  return (
    <div className="no-print fixed bottom-5 right-5 z-[90]">
      <audio
        ref={audioRef}
        src="/jarvis-voice.mp3"
        preload="auto"
      />

      
{open && (
    <section
      role="dialog"
      aria-label="J.A.R.V.I.S. assistant"
      className="relative flex h-[min(620px,78vh)] w-[min(410px,calc(100vw-40px))] flex-col overflow-hidden rounded-[18px] border border-[#647480]/40 bg-[#11171D] text-[#E8F2F5] shadow-[0_20px_65px_rgba(0,0,0,0.65)]"
    >
      {/* Keep ALL your existing J.A.R.V.I.S. content here */}

          {/* Header */}
          <header className="flex shrink-0 items-center gap-3 border-b border-[#2B3942] bg-[#151E25] p-4">
            <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-cyan-400/40 bg-black">
              {logoAvailable ? (
                <img
                  src="/jarvis-logo.jpg"
                  alt=""
                  className="size-full object-cover"
                  onError={() =>
                    setLogoAvailable(false)
                  }
                />
              ) : (
                <Bot className="size-6 text-cyan-300" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="font-bold tracking-[0.12em]">
                J.A.R.V.I.S.
              </h2>

              <p className="text-xs text-[#9DAEB8]">
                CertiFlow Intelligent Assistant
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setOpen(false)
              }
              aria-label="Close J.A.R.V.I.S."
              className="rounded-lg p-2 text-[#B4C4CD] hover:bg-white/10"
            >
              <X className="size-5" />
            </button>
          </header>

          {/* Backend connection status */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#263740] bg-[#121D24] px-4 py-2 text-xs">
            <span className="flex items-center gap-2 text-[#AABDC7]">
              <span
                className={`size-2 rounded-full ${
                  status === 'online'
                    ? 'bg-emerald-400'
                    : status === 'checking'
                      ? 'bg-amber-400'
                      : 'bg-red-400'
                }`}
              />

              {status === 'online'
                ? 'Backend connected'
                : status === 'checking'
                  ? 'Connecting...'
                  : 'Backend unavailable'}
            </span>

            <span className="flex items-center gap-1 text-[#8CABB6]">
              <Activity className="size-3.5" />
              Gemini / Groq
            </span>
          </div>

          {/* Animated Horizon and messages */}
          <div
            className="relative min-h-0 flex-1 overflow-hidden bg-[#0D0C15]"
            style={{
              isolation: 'isolate',
            }}
          >
            <JarvisHorizon />

            <div
              ref={scrollRef}
              className="relative z-10 h-full space-y-4 overflow-y-auto px-4 py-5"
              aria-label="Conversation"
              aria-live="polite"
            >
              {loadingHistory && (
                <div className="flex items-center gap-2 text-sm text-[#9DAEB8]">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading saved conversation...
                </div>
              )}

              {!loadingHistory &&
                messages.length === 0 && (
                  <div className="rounded-xl border border-[#28505A] bg-[#182A32]/95 p-3 text-sm text-cyan-100">
                    J.A.R.V.I.S. online. Ask about events,
                    certificates or event management.
                  </div>
                )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user'
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-2xl border px-3.5 py-3 ${
                      message.role === 'user'
                        ? 'border-[#3D515A] bg-[#293640]/95 text-white'
                        : 'border-[#28505A] bg-[#182A32]/95 text-[#E4F2F5]'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
                        J.A.R.V.I.S.
                        {message.provider
                          ? ` · ${message.provider}`
                          : ''}
                      </p>
                    )}

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex items-center gap-2 text-sm text-cyan-200">
                  <LoaderCircle className="size-4 animate-spin" />
                  J.A.R.V.I.S. is thinking...
                </div>
              )}
            </div>
          </div>

          {/* Event draft button */}
          {eventDraft && (
            <div className="shrink-0 border-t border-cyan-400/20 bg-[#15262D] px-4 py-3">
              <p className="mb-2 text-xs text-cyan-200">
                Event draft ready — not saved yet.
              </p>

              <button
                type="button"
                onClick={reviewDraft}
                className="w-full rounded-xl bg-[#49CADB] px-4 py-3 text-sm font-bold text-[#07161A]"
              >
                Review Event Draft →
              </button>
            </div>
          )}

          {/* Chat errors */}
          {chatError && (
            <p
              role="alert"
              className="mx-4 mb-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200"
            >
              {chatError}
            </p>
          )}

          {/* Chat input */}
          

{/* Chat input — aligned silver electric border */}

{/* Chat input — perfectly aligned silver electric border */}
<form
  onSubmit={sendMessage}
  className="relative z-20 flex shrink-0 items-center gap-3 border-t border-[#2B3942] bg-[#111A21] px-4 py-4"
>
  <div className="jarvis-silver-border min-w-0 flex-1">
    <input
      type="text"
      value={input}
      onChange={(event) => setInput(event.target.value)}
      placeholder="Ask J.A.R.V.I.S..."
      aria-label="Message J.A.R.V.I.S."
      maxLength={2000}
      disabled={
        sending ||
        loadingHistory ||
        Boolean(approvalId)
      }
      className="relative z-10 block h-11 w-full min-w-0 rounded-[11px] border-0 bg-[#202D35] px-3 text-sm text-white outline-none placeholder:text-[#8499A4] disabled:opacity-50"
    />
  </div>

  <button
    type="submit"
    disabled={
      !input.trim() ||
      sending ||
      loadingHistory ||
      Boolean(approvalId)
    }
    aria-label="Send message"
    className="relative z-10 grid size-11 shrink-0 place-items-center rounded-xl bg-[#49CADB] text-[#07161A] disabled:opacity-40"
  >
    <Send className="size-5" />
  </button>
</form>



          {/* Existing voice warning system */}
          <div className="shrink-0 border-t border-[#2B3942] bg-[#151E25] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs text-[#9DAEB8]">
              <ShieldAlert className="size-4 text-cyan-300" />
              Voice warning system · Manual test
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={toggleVoice}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[#36535D] bg-[#22343E] px-3 py-2 text-xs font-semibold text-cyan-100"
              >
                {voiceEnabled ? (
                  <Volume2 className="size-4" />
                ) : (
                  <VolumeX className="size-4" />
                )}

                {voiceEnabled
                  ? 'Mute voice'
                  : 'Enable voice'}
              </button>

              <button
                type="button"
                onClick={testVoice}
                disabled={!voiceEnabled}
                className="flex-1 rounded-lg bg-[#49CADB] px-3 py-2 text-xs font-bold text-[#07161A] disabled:opacity-40"
              >
                Test Voice Alert
              </button>
            </div>

            {voiceMessage && (
              <p
                role="status"
                className="mt-2 text-xs text-[#9DAEB8]"
              >
                {voiceMessage}
              </p>
            )}
          </div>

          {/* Access-key popup */}
          {approvalId && (
            <JarvisAccessPrompt
              actionId={approvalId}
              onClose={() =>
                setApprovalId(null)
              }
              onResult={handleApprovalResult}
            />
          )}
                </section>
    )}

      {/* Floating J.A.R.V.I.S. logo */}
      <button
        type="button"
        aria-label={
          open
            ? 'Close J.A.R.V.I.S.'
            : 'Open J.A.R.V.I.S.'
        }
        aria-expanded={open}
        onClick={() =>
          setOpen(previous => !previous)
        }
        className="ml-auto grid size-16 place-items-center overflow-hidden rounded-full border-2 border-cyan-400/70 bg-[#071A20] shadow-[0_0_25px_rgba(48,213,232,0.28)] transition-transform hover:scale-105"
      >
        {logoAvailable ? (
          <img
            src="/jarvis-logo.jpg"
            alt=""
            className="size-full object-cover"
            onError={() =>
              setLogoAvailable(false)
            }
          />
        ) : (
          <MessageCircle className="size-8 text-cyan-300" />
        )}
      </button>
    </div>
  );
}
