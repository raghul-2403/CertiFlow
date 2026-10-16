// Sends the certificate email. Uses SMTP if SMTP_USER is set in .env,
// otherwise sends through the coordinator's Gmail via the Google script.
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { getSetting } from '../models/index.js';
import { sendEmailViaGoogle } from './googleBridge.js';

let transporter = null;
const smtpEnabled = () => Boolean(env.smtp.user && env.smtp.pass);

export const mailMode = () => (smtpEnabled() ? 'smtp' : 'google');

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// "Add to profile" link: LinkedIn opens its Add licence or certification form already filled in
export function linkedInAddUrl({ certName, organization, issuedAt = new Date(), verifyUrl, certificateId }) {
  const d = new Date(issuedAt);
  const url = new URL('https://www.linkedin.com/profile/add');
  url.searchParams.set('startTask', 'CERTIFICATION_NAME');
  url.searchParams.set('name', certName);
  url.searchParams.set('organizationName', organization);
  url.searchParams.set('issueYear', String(d.getFullYear()));
  url.searchParams.set('issueMonth', String(d.getMonth() + 1));
  url.searchParams.set('certUrl', verifyUrl);
  url.searchParams.set('certId', certificateId);
  return url.toString();
}

export function buildCertificateEmail({ participant, event, certificateId, verifyUrl, award = null, issuedAt = new Date() }) {
  const certName = award ? `${award.title}, ${event.name}` : `Certificate of Participation, ${event.name}`;
  const subject = award ? `Congratulations! Your ${award.title} certificate for ${event.name}` : `Your certificate for ${event.name}`;
  const opening = award
    ? `Congratulations on <b>${escapeHtml(award.title)}</b> at <b>${escapeHtml(event.name)}</b>! Your certificate is attached to this email as a PDF.`
    : `Thank you for attending <b>${escapeHtml(event.name)}</b> and sharing your feedback. Your certificate is attached to this email as a PDF.`;
  const linkedIn = linkedInAddUrl({ certName, organization: event.organizer, issuedAt, verifyUrl, certificateId });
  const text =
    `Hi ${participant.name},\n\n` +
    (award ? `Congratulations on ${award.title} at ${event.name}!\n` : `Thank you for attending ${event.name} and sharing your feedback.\n`) +
    `Your certificate is attached.\n\nCertificate ID: ${certificateId}\nVerify it at: ${verifyUrl}\n` +
    `Add it to your LinkedIn profile: ${linkedIn}\n\n— ${event.organizer}`;
  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0E1B36">
    <div style="border-top:4px solid #14284B;padding:24px 4px">
      <p style="font-size:15px">Hi ${escapeHtml(participant.name)},</p>
      <p style="font-size:15px;line-height:1.6">${opening}</p>
      <table style="font-size:14px;margin:18px 0;border-collapse:collapse">
        <tr><td style="color:#5B6275;padding:4px 16px 4px 0">Certificate ID</td><td><b>${escapeHtml(certificateId)}</b></td></tr>
        <tr><td style="color:#5B6275;padding:4px 16px 4px 0">Event</td><td>${escapeHtml(event.name)}</td></tr>
        ${award ? `<tr><td style="color:#5B6275;padding:4px 16px 4px 0">Award</td><td>${escapeHtml(award.title)}</td></tr>` : ''}
      </table>
      <p style="margin:22px 0">
        <a href="${linkedIn}" style="background:#0A66C2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:10px 18px;border-radius:6px;display:inline-block">Add to LinkedIn profile</a>
      </p>
      <p style="font-size:14px">Anyone can check that it's genuine here:<br>
      <a href="${verifyUrl}" style="color:#14284B">${escapeHtml(verifyUrl)}</a></p>
      <p style="font-size:14px;color:#5B6275;margin-top:28px">— ${escapeHtml(event.organizer)}</p>
    </div>
  </div>`;
  return { subject, text, html };
}

export async function sendMail({ to, subject, html, text, attachments = [], senderName }) {
  if (smtpEnabled()) {
    transporter ??= nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.pass },
    });
    await transporter.sendMail({
      from: env.smtp.from || `"${senderName || 'CertiFlow'}" <${env.smtp.user}>`,
      to,
      subject,
      html,
      text,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
    });
    return { via: 'smtp' };
  }

  const scriptUrl = await getSetting('google.scriptUrl');
  const result = await sendEmailViaGoogle(scriptUrl, {
    to,
    subject,
    html,
    text,
    senderName,
    attachments: attachments.map((a) => ({
      filename: a.filename,
      contentType: a.contentType,
      base64: a.content.toString('base64'),
    })),
  });
  return { via: 'google', emailQuota: result.emailQuota };
}
