# ReMind — content JSON spec (for AI content generation)

Generate aphasia / language rehabilitation exercise content as a single JSON object matching this schema exactly. Output valid JSON only (or JSON inside a fenced code block). Do not invent extra fields.

## Root object: `TaskPack`

```json
{
  "schemaVersion": 1,
  "title": "string — pack title",
  "tasks": []
}
```

- `schemaVersion` must be `1`.
- `title` — human-readable pack name (Latvian unless asked otherwise).
- `tasks` — array of task objects (see types below).

## Common fields (every task)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `id` | string | yes | Stable unique ID. Never reuse. Prefer kebab-case, e.g. `wr-001`, `sc-maza-01`. |
| `type` | string | yes | One of: `word_reading`, `sentence_completion`, `image_word`, `word_choice` |
| `contentVersion` | number | yes | Start at `1`. Bump only if wording/options change later. |
| `instruction` | string | yes | Short instruction shown to the user. |
| `hint` | string | no | Optional gentle hint. |

Language: Latvian by default (instructions, words, sentences, options, hints).

Blank marker: use exactly three underscores `___` where a word is missing.

---

## Task type 1: `word_reading`

User reads a single word aloud / focuses on one word.

```json
{
  "id": "wr-001",
  "type": "word_reading",
  "contentVersion": 1,
  "instruction": "Izlasiet vārdu.",
  "word": "māja",
  "hint": "Mājvieta"
}
```

Extra fields:
- `word` (string, required)
- `hint` (string, optional)

---

## Task type 2: `sentence_completion`

Sentence with a blank; accepted answers listed.

```json
{
  "id": "sc-001",
  "type": "sentence_completion",
  "contentVersion": 1,
  "instruction": "Ievietojiet trūkstošo vārdu.",
  "sentence": "Es dzeru ___.",
  "answers": ["tēju", "ūdeni"],
  "hint": "Dzēriens"
}
```

Extra fields:
- `sentence` (string, required) — must contain `___` exactly once
- `answers` (string[], required) — all acceptable answers (synonyms, case variants if needed)
- `hint` (string, optional)

---

## Task type 3: `image_word`

Image + sentence with blank.

```json
{
  "id": "iw-001",
  "type": "image_word",
  "contentVersion": 1,
  "instruction": "Apskatiet attēlu un aizpildiet teikumu.",
  "imageSrc": "/images/saule.png",
  "imageAlt": "Saule",
  "sentence": "Debesīs spīd ___.",
  "answers": ["saule"],
  "hint": "Debesis"
}
```

Extra fields:
- `imageSrc` (string, required) — path under `/public` or asset URL, e.g. `/images/foo.png`
- `imageAlt` (string, required) — accessible alt text
- `sentence` (string, required) — must contain `___` exactly once
- `answers` (string[], required)
- `hint` (string, optional)

If no real image file exists yet, still set a sensible `imageSrc` path and clear `imageAlt`; note the intended image briefly in a separate comment only if the user asks for notes (not inside JSON).

---

## Task type 4: `word_choice`

Multiple choice; one or more options can be correct.

```json
{
  "id": "wc-001",
  "type": "word_choice",
  "contentVersion": 1,
  "instruction": "Izvēlieties pareizos vārdus.",
  "prompt": "Kuri ir dzīvnieki?",
  "options": ["kaķis", "galds", "suns", "grāmata"],
  "correctIndices": [0, 2],
  "hint": "Dzīvnieki, ne priekšmeti"
}
```

Extra fields:
- `prompt` (string, required) — question or stem
- `options` (string[], required) — usually 3–6 options
- `correctIndices` (number[], required) — 0-based indices into `options`; must be valid and non-empty
- `hint` (string, optional)

---

## Full example pack

```json
{
  "schemaVersion": 1,
  "title": "Ikdienas vārdi — 1. komplekts",
  "tasks": [
    {
      "id": "wr-maja-01",
      "type": "word_reading",
      "contentVersion": 1,
      "instruction": "Izlasiet vārdu.",
      "word": "māja",
      "hint": "Vieta, kur dzīvojam"
    },
    {
      "id": "sc-udens-01",
      "type": "sentence_completion",
      "contentVersion": 1,
      "instruction": "Ievietojiet trūkstošo vārdu.",
      "sentence": "Es dzeru ___.",
      "answers": ["ūdeni", "tēju"],
      "hint": "Dzēriens"
    },
    {
      "id": "iw-saule-01",
      "type": "image_word",
      "contentVersion": 1,
      "instruction": "Apskatiet attēlu un aizpildiet teikumu.",
      "imageSrc": "/images/saule.png",
      "imageAlt": "Saule debesīs",
      "sentence": "Debesīs spīd ___.",
      "answers": ["saule"],
      "hint": "Debesis"
    },
    {
      "id": "wc-dzivnieki-01",
      "type": "word_choice",
      "contentVersion": 1,
      "instruction": "Izvēlieties pareizos vārdus.",
      "prompt": "Kuri ir dzīvnieki?",
      "options": ["kaķis", "galds", "suns", "grāmata"],
      "correctIndices": [0, 2],
      "hint": "Dzīvnieki, ne priekšmeti"
    }
  ]
}
```

---

## Content quality rules

1. Keep language simple, clear, and suitable for aphasia rehab (short sentences, concrete vocabulary).
2. Prefer everyday topics: home, food, family, body, nature, daily routines.
3. `id` values unique within the pack and across packs if possible.
4. Do not add fields not listed above.
5. Do not omit required fields.
6. For blanks, use `___` only — not `...`, `[ ]`, or `_`.
7. `answers` should include natural acceptable variants when relevant (e.g. case forms), but keep the list small.
8. For `word_choice`, distractors should be plausible but clearly wrong for the prompt.
9. Difficulty: mix easy concrete items; avoid rare jargon unless requested.
10. Output one complete `TaskPack` JSON object unless asked for multiple packs.

## What to produce

When the user asks for content, return a complete `TaskPack` JSON as above. Default language: Latvian.
