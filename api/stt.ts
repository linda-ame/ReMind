import type { VercelRequest, VercelResponse } from '@vercel/node';
import { recognizeLatvianPcm } from '../server/googleStt.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '2mb',
    },
  },
};

/**
 * POST { audio: base64 LINEAR16 PCM, sampleRate?: number }
 * Returns { text } for the audio recorded so far.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Atļauts tikai POST.' });
    return;
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
  const audio =
    body && typeof body === 'object' && typeof (body as { audio?: unknown }).audio === 'string'
      ? (body as { audio: string }).audio
      : '';
  const sampleRate =
    body &&
    typeof body === 'object' &&
    typeof (body as { sampleRate?: unknown }).sampleRate === 'number'
      ? (body as { sampleRate: number }).sampleRate
      : 16_000;

  if (!audio) {
    res.status(400).json({ error: 'Trūkst ieraksta (audio).' });
    return;
  }

  let pcm: Buffer;
  try {
    pcm = Buffer.from(audio, 'base64');
  } catch {
    res.status(400).json({ error: 'Nederīgs ieraksts.' });
    return;
  }

  const result = await recognizeLatvianPcm(pcm, sampleRate);
  if (result.ok) {
    res.status(200).json({ text: result.text });
    return;
  }
  res.status(result.status).json({ error: result.error });
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
