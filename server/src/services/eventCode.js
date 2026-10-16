// The rotating event code shown on the projector screen.
// It is a 4-digit number worked out from a secret per event and the current time window,
// so it changes every few minutes and can't be guessed or shared from outside the hall.
// A response is accepted if its code matches the window it was submitted in, or one of the
// two windows before (people need a few minutes to fill the form after reading the code),
// or the one after (allows for the clocks of Google and this computer being slightly apart).
import crypto from 'node:crypto';

const GRACE_WINDOWS = 2;

const windowMs = (event) => (event.access?.codeMinutes || 5) * 60 * 1000;

function codeForWindow(secret, windowIndex) {
  const mac = crypto.createHmac('sha256', secret).update(String(windowIndex)).digest();
  return String(mac.readUInt32BE(0) % 10000).padStart(4, '0');
}

export const newCodeSecret = () => crypto.randomBytes(16).toString('hex');

/** The code to show right now, and when it changes */
export function currentCode(event, now = Date.now()) {
  const ms = windowMs(event);
  const index = Math.floor(now / ms);
  return { code: codeForWindow(event.access.codeSecret, index), changesAt: new Date((index + 1) * ms), minutes: ms / 60000 };
}

/** Did the participant type a valid code for the time they submitted the form? */
export function codeMatches(event, entered, submittedAt) {
  const typed = String(entered ?? '').replace(/\D/g, '');
  if (typed.length !== 4 || !event.access?.codeSecret) return false;
  const index = Math.floor(new Date(submittedAt || Date.now()).getTime() / windowMs(event));
  // the next window too, in case Google's clock is a little ahead of this computer's
  for (let w = index + 1; w >= index - GRACE_WINDOWS; w -= 1) {
    if (codeForWindow(event.access.codeSecret, w) === typed) return true;
  }
  return false;
}
