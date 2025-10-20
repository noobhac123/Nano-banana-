import { kv } from '@vercel/kv';

// Daily limit and expiry for KV keys
const DAILY_LIMIT = 5;
const EXPIRY_SECONDS = 86400; // 24 hours

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // --- 1. Get API Key from Environment Variables ---
    const STABILITY_API_KEY = process.env.STABILITY_API_KEY;
    if (!STABILITY_API_KEY) {
        console.error('STABILITY_API_KEY is not set.');
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    try {
        // --- 2. Rate Limiting Logic ---
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (!ip) {
            return res.status(400).json({ error: 'Could not identify user IP.' });
        }

        const usage = await kv.get(ip) || 0;
        if (usage >= DAILY_LIMIT) {
            return res.status(429).json({ error: `Rate limit exceeded. Try again in 24 hours.` });
        }

        // --- 3. Get Prompt from Request Body ---
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({ error: 'Prompt is required.' });
        }
        if (prompt.length > 2000) {
            return res.status(400).json({ error: 'Prompt is too long (max 2000 characters).' });
        }

        // --- 4. Call Stability AI API using native fetch ---
        // CRITICAL: This section avoids using any npm package for Stability AI
        const engineId = 'stable-diffusion-v1-6';
        const apiHost = 'https://api.stability.ai';
        const apiUrl = `${apiHost}/v1/generation/${engineId}/text-to-image`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${STABILITY_API_KEY}`,
            },
            body: JSON.stringify({
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: 512,
                width: 512,
                steps: 30,
                samples: 1,
            }),
        });

        // --- 5. Handle Stability AI Response ---
        if (!response.ok) {
            // Read the error body for more details
            const errorBody = await response.text();
            console.error('Stability AI Error:', errorBody);
            throw new Error(`Stability AI API request failed with status ${response.status}`);
        }

        const responseJSON = await response.json();
        const imageBase64 = responseJSON.artifacts[0].base64;

        // --- 6. Update Rate Limit in Vercel KV ---
        // This is done *after* a successful generation to not penalize for failed API calls
        const newUsage = await kv.incr(ip);
        if (newUsage === 1) {
            // If this is the first time, set the 24-hour expiry
            await kv.expire(ip, EXPIRY_SECONDS);
        }

        // --- 7. Send Response to Frontend ---
        res.status(200).json({ image: imageBase64 });

    } catch (error) {
        console.error('Error in generate function:', error.message);
        // Provide a generic error to the client
        return res.status(500).json({ error: 'Failed to generate image. Please try again later.' });
    }
}