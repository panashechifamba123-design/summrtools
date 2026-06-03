export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic origin check — only allow your domain
  const origin = req.headers.origin || '';
  const allowed = [
    'https://summrtools.co.zw',
    'https://www.summrtools.co.zw',
    'http://localhost:3000'
  ];
  if (!allowed.includes(origin)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { model, max_tokens, system, messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5',
        max_tokens: max_tokens || 1000,
        system: system || '',
        messages: messages
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'API error' });
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('Claude proxy error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
