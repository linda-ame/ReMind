# ReMind

Lasīšanas un valodas rehabilitācijas web aplikācija (MVP) pieaugušiem pēc insulta.

## Tehnoloģijas

- React + TypeScript + Vite
- Uzdevumu saturs: `src/data/tasks.json`
- Progress: IndexedDB (`ProgressRepository` interfeiss — vēlāk var pievienot Supabase)
- Bez autentifikācijas

## Lokālā izstrāde

```bash
npm install
npm run dev
```

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
