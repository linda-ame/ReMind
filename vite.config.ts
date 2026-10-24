import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv } from 'vite';

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Expose Google TTS key to the Vite *server* middleware (never to client bundle).
  const env = loadEnv(mode, process.cwd(), '');
  if (env.GOOGLE_TTS_API_KEY) {
    process.env.GOOGLE_TTS_API_KEY = env.GOOGLE_TTS_API_KEY;
  }
  if (env.GOOGLE_CLOUD_API_KEY) {
    process.env.GOOGLE_CLOUD_API_KEY = env.GOOGLE_CLOUD_API_KEY;
  }

  return {
    plugins: [
      react(),
      {
        name: 'remind-tts-api',
        configureServer(server) {
          server.middlewares.use(
            async (
              req: IncomingMessage,
              res: ServerResponse,
              next: (err?: unknown) => void,
            ) => {
              const path = req.url?.split('?')[0];
              if (path !== '/api/tts') {
                next();
                return;
              }

              try {
                const {
                  getGoogleTtsConfig,
                  GOOGLE_LV_VOICE,
                  synthesizeGoogleMp3,
                } = await import('./server/googleTts.js');

                if (req.method === 'GET') {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      configured: getGoogleTtsConfig() != null,
                      provider: 'google',
                      voice: GOOGLE_LV_VOICE,
                    }),
                  );
                  return;
                }

                if (req.method !== 'POST') {
                  res.statusCode = 405;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({ error: 'Atļauts tikai GET un POST.' }),
                  );
                  return;
                }

                const raw = await readRequestBody(req);
                let text = '';
                try {
                  const body = JSON.parse(raw) as { text?: unknown };
                  text = typeof body.text === 'string' ? body.text : '';
                } catch {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Nederīgs JSON.' }));
                  return;
                }

                const result = await synthesizeGoogleMp3(text);
                if (result.ok) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', result.contentType);
                  res.setHeader('Cache-Control', 'no-store');
                  res.end(result.audio);
                  return;
                }

                res.statusCode = result.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: result.error }));
              } catch (err) {
                console.error('[tts]', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({ error: 'Iekšēja noklausīšanās kļūda.' }),
                );
              }
            },
          );
        },
      },
    ],
  };
});
