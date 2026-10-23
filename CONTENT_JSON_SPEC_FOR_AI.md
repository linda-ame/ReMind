# ReMind — content JSON spec (for AI content generation)

Generate aphasia / language rehabilitation exercise content as a single JSON object matching this schema exactly. Output valid JSON only (or JSON inside a fenced code block). Do not invent extra fields.

## Root object: `TaskPack`

```json
{
  "schemaVersion": 3,
  "title": "string — pack title",
  "tasks": []
}
```

- `schemaVersion` — use `3` for packs that include the new task types below. Older packs with `1` or `2` remain valid.
- `title` — human-readable pack name (Latvian unless asked otherwise).
- `tasks` — array of task objects (see types below).

## Common fields (every task)

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `id` | string | yes | Stable unique ID. Never reuse. Prefer kebab-case, e.g. `wr-001`, `so-maja-01`. |
| `type` | string | yes | One of the types listed below |
| `contentVersion` | number | yes | Start at `1`. Bump only if wording/options change later. |
| `instruction` | string | yes | Short instruction shown to the user. |
| `hint` | string | no | Optional gentle hint (not used for `antonym` or `definition_guess`). |

Language: Latvian by default (instructions, words, sentences, options, hints).

Blank marker: use exactly three underscores `___` where a word is missing.

Supported `type` values:
`word_reading`, `sentence_completion`, `image_word`, `word_choice`, `reading_comprehension`, `sentence_order`, `odd_one_out`, `antonym`, `definition_guess`

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

## Task type 5: `reading_comprehension`

Short passage + comprehension questions (schemaVersion 2+).

```json
{
  "id": "rc-001",
  "type": "reading_comprehension",
  "contentVersion": 1,
  "instruction": "Izlasiet tekstu un atbildiet uz jautājumiem.",
  "passage": "Rītos Anna dzer tēju. Pēc tam viņa iet uz darbu.",
  "questions": [
    {
      "id": "rc-001-q1",
      "question": "Ko Anna dzer rītos?",
      "answers": ["tēju", "tēja"]
    }
  ]
}
```

Extra fields:
- `passage` (string, required)
- `questions` (array, required) — each item has `id`, `question`, `answers`

---

## Task type 6: `sentence_order`

User taps scrambled words in order to build a sentence (no drag-and-drop).

```json
{
  "id": "so-001",
  "type": "sentence_order",
  "contentVersion": 1,
  "instruction": "Sakārtojiet vārdus teikumā.",
  "words": ["grāmatu", "vakarā", "Māsa", "lasa"],
  "acceptedOrders": [
    [2, 3, 0, 1],
    [1, 2, 3, 0]
  ],
  "modelSentence": "Māsa lasa grāmatu vakarā."
}
```

Extra fields:
- `words` (string[], required) — usually 3–4 early, 5–6 later; **scrambled display order** (not the correct sentence order). Indices into this array are stable and used by `acceptedOrders`.
- `acceptedOrders` (number[][], required) — every acceptable sequence of indices into `words`
- `modelSentence` (string, required) — example sentence shown on “Parādīt teikumu”
- `hint` (string, optional)

Important: put words in a **shuffled** `words` array so the on-screen buttons are not already nearly correct. Encode the correct order(s) only via `acceptedOrders` (e.g. `words: ["laikā", "vilciens", "pienāca"]`, `acceptedOrders: [[1, 2, 0]]` → «Vilciens pienāca laikā.»).

Latvian often allows more than one correct word order. Always list every grammatically acceptable alternative in `acceptedOrders`. Do not mark a valid alternative wrong only because it differs from `modelSentence`.

---

## Task type 7: `odd_one_out`

Four words; one clearly does not belong.
UI does not show `instruction` on screen — the section title already says «Atrodi lieko vārdu». Keep `instruction` in JSON for schema completeness.

```json
{
  "id": "ooo-001",
  "type": "odd_one_out",
  "contentVersion": 1,
  "instruction": "Atrodi lieko vārdu.",
  "options": ["ābols", "bumbieris", "galds", "plūme"],
  "correctIndex": 2,
  "explanation": "Galds ir mēbele; pārējie ir augļi."
}
```

Extra fields:
- `options` (string[], required) — exactly four words
- `correctIndex` (number, required) — 0-based index of the odd word
- `explanation` (string, required) — short reason why it does not belong
- `hint` (string, optional)

Quality rules:
- One unambiguous correct answer.
- Three words share one clear category; the fourth does not.
- Avoid broad or ambiguous categories where more than one word could be “odd”.
- Keep `explanation` with the task; verify unambiguity before publishing.

---

## Task type 8: `antonym`

Find an opposite of the given word (not synonyms in this phase).
UI shows the word and the fixed prompt «Kāds ir pretstats?» — do not rely on a separate on-screen instruction, and do **not** include `hint`.

```json
{
  "id": "ant-001",
  "type": "antonym",
  "contentVersion": 1,
  "instruction": "Kāds ir pretstats?",
  "word": "karsts",
  "answers": ["auksts", "vēss"]
}
```

Extra fields:
- `word` (string, required)
- `answers` (string[], required) — all acceptable antonyms

Start with clear pairs (karsts–auksts, plats–šaurs, tukšs–pilns). Later items may be more contextual. Do not create synonym tasks here. No hints for this type.

---

## Task type 9: `definition_guess`

Guess the word from a short description. Do **not** include `hint`.

```json
{
  "id": "dg-001",
  "type": "definition_guess",
  "contentVersion": 1,
  "instruction": "Uzminiet vārdu pēc apraksta.",
  "description": "Vieta, kur dzīvojam. Tur ir istabas un mēbeles.",
  "answers": ["māja", "dzīvoklis"]
}
```

Extra fields:
- `description` (string, required) — usually 1–2 short sentences early on
- `answers` (string[], required) — example acceptable words (not an exhaustive list)

---

## Full example pack (mixed types)

```json
{
  "schemaVersion": 3,
  "title": "Ikdienas vārdi — 1. komplekts",
  "tasks": [
    {
      "id": "wr-maja-01",
      "type": "word_reading",
      "contentVersion": 1,
      "instruction": "Izlasiet vārdu.",
      "word": "māja"
    },
    {
      "id": "so-udens-01",
      "type": "sentence_order",
      "contentVersion": 1,
      "instruction": "Sakārtojiet vārdus teikumā.",
      "words": ["ūdeni", "Es", "dzeru"],
      "acceptedOrders": [[1, 2, 0]],
      "modelSentence": "Es dzeru ūdeni."
    },
    {
      "id": "ooo-augli-01",
      "type": "odd_one_out",
      "contentVersion": 1,
      "instruction": "Atrodi lieko vārdu.",
      "options": ["ābols", "bumbieris", "galds", "plūme"],
      "correctIndex": 2,
      "explanation": "Galds ir mēbele; pārējie ir augļi."
    },
    {
      "id": "ant-karsts-01",
      "type": "antonym",
      "contentVersion": 1,
      "instruction": "Kāds ir pretstats?",
      "word": "karsts",
      "answers": ["auksts", "vēss"]
    },
    {
      "id": "dg-maja-01",
      "type": "definition_guess",
      "contentVersion": 1,
      "instruction": "Uzminiet vārdu pēc apraksta.",
      "description": "Vieta, kur dzīvojam. Tur ir istabas un mēbeles.",
      "answers": ["māja", "dzīvoklis"]
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
9. For `sentence_order`, include every acceptable word order in `acceptedOrders`.
10. For `odd_one_out`, ensure exactly one unambiguous odd word and keep `explanation`.
11. For `antonym`, only antonyms — no synonym sets and no `hint` in this phase.
12. For `definition_guess`, do not include `hint`.
13. Difficulty: mix easy concrete items; avoid rare jargon unless requested.
14. Output one complete `TaskPack` JSON object unless asked for multiple packs.

## What to produce

When the user asks for content, return a complete `TaskPack` JSON as above. Default language: Latvian.
