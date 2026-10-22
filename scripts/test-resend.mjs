import { Resend } from 'resend';
import fs from 'fs';
import path from 'path';

// Manually load .env.local to avoid dependencies
const envPath = path.join(process.cwd(), '.env.local');
let apiKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/RESEND_API_KEY=(.*)/);
    if (match && match[1]) {
        apiKey = match[1].trim();
    }
} catch (e) {
    console.error('Error reading .env.local:', e.message);
    process.exit(1);
}

if (!apiKey) {
    console.error('Could not find RESEND_API_KEY in .env.local');
    process.exit(1);
}

console.log('Found API Key:', apiKey.slice(0, 5) + '...');

const resend = new Resend(apiKey);

(async function () {
    console.log('Attempting to send test email...');
    try {
        const { data, error } = await resend.emails.send({
            from: 'onboarding@resend.dev',
            to: 'contact@bonsaiwebdesign.com',
            subject: 'Test Email from Script',
            html: '<p>This is a test email to verify the API key and domain settings.</p>'
        });

        if (error) {
            console.error('FAILED. Resend returned an error:');
            console.error(JSON.stringify(error, null, 2));
        } else {
            console.log('SUCCESS! Email sent.');
            console.log('ID:', data.id);
        }
    } catch (err) {
        console.error('EXCEPTION occurred:');
        console.error(err);
    }
})();
