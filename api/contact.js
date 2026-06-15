const TO = 'admin@forgeduk.store';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'name, email and message are required' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from:    'Forged Support <noreply@forgeduk.store>',
      to:      [TO],
      reply_to: email,
      subject: `Forged Support: ${subject || 'General enquiry'}`,
      text:    `Name: ${name}\nEmail: ${email}\nSubject: ${subject || 'General enquiry'}\n\n${message}`,
      html:    `<p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p><p><strong>Subject:</strong> ${subject || 'General enquiry'}</p><hr><p>${message.replace(/\n/g, '<br>')}</p>`,
    }),
  });

  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }

  return res.json({ ok: true });
};
