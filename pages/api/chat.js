export default async function handler(req, res) {
  console.log('Route hit:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('Key present:', !!apiKey);
  console.log('Key prefix:', apiKey ? apiKey.substring(0, 16) : 'MISSING');

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const requestBody = {
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 1000,
      system: req.body.system,
      messages: req.body.messages
    };

    console.log('Calling Anthropic...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody)
    });

    console.log('Anthropic status:', response.status);
    const data = await response.json();
    console.log('Anthropic response:', JSON.stringify(data).substring(0, 300));

    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Caught error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
