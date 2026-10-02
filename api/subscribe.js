export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const BUTTONDOWN_API_KEY = process.env.BUTTONDOWN_API_KEY;

  if (!BUTTONDOWN_API_KEY) {
    console.error('Missing BUTTONDOWN_API_KEY environment variable');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    const response = await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${BUTTONDOWN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email_address: email,
        tags: ['blog-subscriber'],
      }),
    });

    const data = await response.json();

    if (response.ok) {
      return res.status(200).json({ success: true });
    }

    // Handle Buttondown specific errors
    if (data && data.length > 0 && typeof data[0] === 'string' && data[0].includes('already subscribed')) {
      return res.status(400).json({ error: 'You are already subscribed!' });
    }

    console.error('Buttondown API Error:', data);
    return res.status(400).json({ error: 'There was an error subscribing. Please try again.' });
  } catch (error) {
    console.error('Failed to subscribe:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
