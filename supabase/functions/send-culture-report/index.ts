// Sends the culture quiz report email through Resend.
//
// Triggered by a Supabase Database Webhook on INSERT into public.culture_leads, so the Resend
// key never reaches the browser and the public cannot call it to email arbitrary addresses
// (the webhook must send the shared secret header, see docs/culture-quiz.md).
//
// Secrets (supabase secrets set ...):
//   RESEND_API_KEY   your Resend API key
//   FROM_EMAIL       e.g. "CareerAIHub <hello@careeraihub.com>" (domain verified in Resend)
//   WEBHOOK_SECRET   random string, also set as the webhook's "x-webhook-secret" header
//   SITE_URL         e.g. https://careeraihub.com

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }

  const { type, record } = await req.json();
  if (type !== 'INSERT' || !record?.email || !record.marketing_consent) {
    return new Response('ignored', { status: 200 });
  }

  const site = Deno.env.get('SITE_URL') ?? 'https://careeraihub.com';
  const first = record.name ? esc(record.name) : 'there';
  const rows = [
    ['Innovation', record.score_innovation],
    ['Autonomy', record.score_autonomy],
    ['Collaboration', record.score_collaboration],
    ['Structure', record.score_structure],
    ['Pace', record.score_pace],
  ]
    .map(([label, score]) => `<tr><td style="padding:4px 16px 4px 0">${label}</td><td><b>${score}</b> / 100</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">Hi ${first}, you are a ${esc(record.persona)}</h2>
      <p style="color:#555">Here is a copy of your Work Culture Quiz result.</p>
      <table style="margin:16px 0;font-size:15px">${rows}</table>
      <p>Culture is one part of the fit. Next, see how your CV scores against a real job description.</p>
      <p><a href="${site}/?utm_source=email&utm_medium=culture_report"
            style="background:#00a8cc;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">
         Scan my CV free</a></p>
      <p style="color:#888;font-size:12px;margin-top:32px">
        You are receiving this because you asked for your quiz report at careeraihub.com.
        To unsubscribe or have your data deleted, reply to this email or write to hello@careeraihub.com.
      </p>
    </div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: Deno.env.get('FROM_EMAIL'),
      to: [record.email],
      subject: `Your work culture persona: ${record.persona}`,
      html,
    }),
  });

  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return new Response('email failed', { status: 502 });
  }
  return new Response('sent', { status: 200 });
});
