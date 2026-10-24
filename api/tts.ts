import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getGoogleTtsConfig,
  GOOGLE_LV_VOICE,
  synthesizeGoogleMp3,
} from '../server/googleTts.js';

/**
 * POST { text: string } → audio/mpeg
 * GET → { configured: boolean } (no secrets)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    res.status(200).json({
      configured: getGoogleTtsConfig() != null,
      provider: 'google',
      voice: GOOGLE_LV_VOICE,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Atļauts tikai GET un POST.' });
    return;
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    res.status(400).json({ error: 'Trūkst teksta (text).' });
    return;
  }

  const result = await synthesizeGoogleMp3(text);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.setHeader('Content-Type', result.contentType);
  res.status(200).send(result.audio);
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
