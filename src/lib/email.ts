import { Resend } from 'resend';
import { escapeHtml } from '@/lib/escapeHtml';
import { theme } from '@/styles/theme';

// The studio's address: the sender of every portal email and the inbox for client decisions
export const STUDIO_EMAIL = 'admin@bonsaiwebdesign.com';
const FROM = `Bonsai Web Design <${STUDIO_EMAIL}>`;

export interface EmailContent {
    heading: string;
    paragraphs: string[];
    // A quoted block, such as a client's note
    quote?: string;
    action?: { label: string; url: string };
    footnotes?: string[];
}

// Plain strings in, escaped HTML and a text version out, in the portal's dark layout
export function renderEmail({ heading, paragraphs, quote, action, footnotes = [] }: EmailContent) {
    const { colors } = theme;
    const p = (text: string, style: string) => `<p style="${style}">${escapeHtml(text)}</p>`;
    const body = `margin:0 0 16px;font-size:16px;line-height:1.7;color:${colors.textSecondary};`;
    const small = `margin:16px 0 0;font-size:13px;line-height:1.6;color:${colors.textSecondary};`;

    const html = `
<div style="background:${colors.background};padding:48px 24px;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="margin:0 0 32px;font-family:'Playfair Display',Georgia,serif;font-size:20px;letter-spacing:0.05em;text-transform:uppercase;color:${colors.text};">Bonsai</p>
    <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;line-height:1.3;color:${colors.text};">${escapeHtml(heading)}</h1>
    ${paragraphs.map((text) => p(text, body)).join('\n    ')}
    ${quote ? `<blockquote style="margin:0 0 24px;padding:12px 16px;border-left:2px solid ${colors.primary};font-size:15px;line-height:1.7;color:${colors.text};white-space:pre-wrap;">${escapeHtml(quote)}</blockquote>` : ''}
    ${
        action
            ? `<a href="${escapeHtml(action.url)}" style="display:inline-block;margin-top:8px;padding:14px 28px;background:${colors.primary};color:${colors.background};font-size:13px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;text-decoration:none;">${escapeHtml(action.label)}</a>
    <p style="${small}margin-top:32px;">If the button does not work, paste this address into your browser:<br><a href="${escapeHtml(action.url)}" style="color:${colors.primary};word-break:break-all;">${escapeHtml(action.url)}</a></p>`
            : ''
    }
    ${footnotes.map((text) => p(text, small)).join('\n    ')}
  </div>
</div>`;

    const text = [
        heading,
        '',
        ...paragraphs,
        ...(quote ? ['', ...quote.split('\n').map((line) => `> ${line}`)] : []),
        ...(action ? ['', `${action.label}: ${action.url}`] : []),
        ...(footnotes.length ? ['', ...footnotes] : []),
    ].join('\n');

    return { html, text };
}

interface SendEmailOptions {
    to: string;
    subject: string;
    content: EmailContent;
    replyTo?: string;
}

// Throws when the email cannot be sent. Callers decide whether that should fail their request.
export async function sendEmail({ to, subject, content, replyTo }: SendEmailOptions) {
    // A subject is a header: a line break in it would start a new one
    const safeSubject = subject.replace(/[\r\n]+/g, ' ').trim();
    const { html, text } = renderEmail(content);

    // Read the key per request, as the contact form does
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        if (process.env.NODE_ENV !== 'production') {
            console.info(`[portal email] RESEND_API_KEY is not set, so this was not sent.\nTo: ${to}\nSubject: ${safeSubject}\n${text}\n[end email]`);
            return;
        }
        throw new Error('RESEND_API_KEY is not set');
    }

    const { error } = await new Resend(apiKey).emails.send({
        from: FROM,
        to: [to],
        subject: safeSubject,
        html,
        text,
        ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
        throw new Error(`Resend could not send "${safeSubject}": ${error.message}`);
    }
}
