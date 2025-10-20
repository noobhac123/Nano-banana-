import { kv } from '@vercel/kv';

// Daily limit for image generations per IP
const DAILY_LIMIT = 5;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Get IP address from the request headers, the standard for Vercel
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        if (!ip) {
            return res.status(400).json({ error: 'Could not identify user IP.' });
        }

        // Fetch the current usage count from Vercel KV
        const usage = await kv.get(ip) || 0;

        // Calculate remaining credits
        const remaining = DAILY_LIMIT - Number(usage);

        return res.status(200).json({ remaining: Math.max(0, remaining) });

    } catch (error) {
        console.error('Error in get-credits:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}