import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { z } from 'zod';

// Server-side copy of the contact form's rules; the client schema alone is not a guarantee.
const inquirySchema = z.object({
    name: z.string().trim().min(1).max(120),
    email: z.email().max(254),
    company: z.string().trim().max(200).optional(),
    projectType: z.string().trim().min(1).max(60),
    budget: z.string().trim().min(1).max(60),
    // The form sets no maximum, so keep this well above any real brief
    description: z.string().trim().min(1).max(20000),
    timeline: z.string().trim().max(200).optional(),
});

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const INVALID_INPUT = 'Please check the form fields and try again.';

export async function POST(request: Request) {
    // Read the key per request, so a missing key fails this route instead of the whole build
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
        console.error('RESEND_API_KEY is not set');
        return NextResponse.json({ error: 'Email is not configured.' }, { status: 503 });
    }
    const resend = new Resend(apiKey);

    try {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: INVALID_INPUT }, { status: 400 });
        }

        const parsed = inquirySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: INVALID_INPUT }, { status: 400 });
        }

        const { name, email, company, projectType, budget, description, timeline } = parsed.data;

        const { data, error } = await resend.emails.send({
            from: 'Bonsai Web Design <admin@bonsaiwebdesign.com>',
            to: ['admin@bonsaiwebdesign.com'],
            // Replying to the notification goes straight to the person who wrote in
            replyTo: email,
            subject: `New Project Inquiry from ${name.replace(/[\r\n]+/g, ' ')}`,
            html: `
        <h1>New Project Inquiry</h1>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(company || 'N/A')}</p>
        <p><strong>Project Type:</strong> ${escapeHtml(projectType)}</p>
        <p><strong>Budget:</strong> ${escapeHtml(budget)}</p>
        <p><strong>Timeline:</strong> ${escapeHtml(timeline || 'N/A')}</p>
        <br/>
        <h3>Description:</h3>
        <p>${escapeHtml(description)}</p>
      `,
        });

        if (error) {
            console.error('Resend API Error:', error);
            return NextResponse.json({ error: 'Your message could not be sent.' }, { status: 502 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('Internal Server Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
