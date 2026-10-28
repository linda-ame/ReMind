import react from '@vitejs/plugin-react';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/** Emit version.json + inject __REMIND_BUILD__ so installed PWAs can detect deploys. */
function remindBuildIdPlugin(): Plugin {
  const buildId =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    `local-${Date.now()}`;

  return {
    name: 'remind-build-id',
    config() {
      return {
        define: {
          __REMIND_BUILD__: JSON.stringify(buildId),
        },
      };
    },
    writeBundle(options) {
      if (!options.dir) return;
      fs.writeFileSync(
        path.join(options.dir, 'version.json'),
        `${JSON.stringify({ version: buildId })}\n`,
        'utf8',
      );
    },
  };
}

async function handleDevStt(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Atļauts tikai POST.' }));
    return;
  }

  try {
    const { recognizeLatvianPcm } = await import('./server/googleStt.js');
    const raw = await readRequestBody(req);
    let audio = '';
    let sampleRate = 16_000;
    try {
      const body = JSON.parse(raw) as { audio?: unknown; sampleRate?: unknown };
      audio = typeof body.audio === 'string' ? body.audio : '';
      if (typeof body.sampleRate === 'number') sampleRate = body.sampleRate;
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Nederīgs JSON.' }));
      return;
    }
    if (!audio) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Trūkst ieraksta (audio).' }));
      return;
    }
    const result = await recognizeLatvianPcm(Buffer.from(audio, 'base64'), sampleRate);
    res.statusCode = result.ok ? 200 : result.status;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(result.ok ? { text: result.text } : { error: result.error }),
    );
  } catch (err) {
    console.error('[stt]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Iekšēja runas atpazīšanas kļūda.' }));
  }
}

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
    // Keep one stable URL; fail loudly if 5173 is taken instead of jumping to 5174.
    server: {
      // Bind both IPv4 and IPv6. Node's default "localhost" is often ::1 only,
      // so http://127.0.0.1:5173 refused the connection.
      host: '::',
      port: 5173,
      strictPort: true,
    },
    plugins: [
      react(),
      remindBuildIdPlugin(),
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
              if (path === '/api/stt') {
                await handleDevStt(req, res);
                return;
              }
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
                let speakingRate: number | undefined;
                try {
                  const body = JSON.parse(raw) as {
                    text?: unknown;
                    speakingRate?: unknown;
                  };
                  text = typeof body.text === 'string' ? body.text : '';
                  if (typeof body.speakingRate === 'number') {
                    speakingRate = body.speakingRate;
                  }
                } catch {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'Nederīgs JSON.' }));
                  return;
                }

                const result = await synthesizeGoogleMp3(
                  text,
                  undefined,
                  speakingRate,
                );
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
