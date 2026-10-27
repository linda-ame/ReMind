# ReMind

Lasīšanas un valodas rehabilitācijas web aplikācija (MVP) pieaugušiem pēc insulta.

## Tehnoloģijas

- React + TypeScript + Vite
- Uzdevumu saturs: `src/data/*.json`
- Progress: IndexedDB (bez konta) vai Supabase (pēc ielogošanās)
- Auth: Supabase e-pasts + parole (ģimenes “skatītājs” — vēlāk)

## Lokālā izstrāde

```bash
npm install
npm run dev
```

### Supabase (konts + sync)

1. Izveido projektu [supabase.com](https://supabase.com).
2. SQL Editorā izpildi `supabase/migrations/` failus pēc kārtas (`001`, `002`, `003`).
3. Auth → Providers → Email: MVP laikā vari izslēgt “Confirm email”.
4. Project Settings → API: ielīmē URL un **anon** atslēgu `.env.local`:

```bash
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

5. Restartē `npm run dev`. Bez šīm atslēgām aplikācija strādā kā iepriekš (tikai lokāli).

## Būvēšana

```bash
npm run build
npm run preview
```

## Izvietošana

1. Publicēt repo GitHub.
2. Importēt projektu Vercel (framework: Vite).
3. `vercel.json` nodrošina SPA maršrutēšanu.

## Saturs un progress

- Katram uzdevumam pastāvīgs `id` — jaunu uzdevumu pievienošana JSON failā nedzēš veco progresu.
- Progress → **Eksportēt / Importēt** saglabā mēģinājumus un iestatījumus JSON failā (`schemaVersion: 1`).
