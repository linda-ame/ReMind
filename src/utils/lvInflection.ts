import { normalizeAnswerText } from './answers';

/**
 * Case endings, compared after diacritics are folded (ā → a), so locative
 * "skolā" already equals "skola" and is not listed separately.
 * Longer endings are tried as well as shorter ones; a word keeps every stem
 * that leaves at least a few letters.
 */
const NOUN_ENDINGS = [
  'iem',
  'am',
  'em',
  'im',
  'um',
  'as',
  'es',
  'is',
  'us',
  'os',
  'ai',
  'ei',
  'a',
  'e',
  'i',
  'u',
  's',
];

/**
 * Infinitive, present, and past endings for keywords such as "lasīt" or "plānot".
 * Compared after diacritics are folded, so "plānojam" ends in "ojam".
 */
const VERB_ENDINGS = [
  'ajam',
  'ajat',
  'ejam',
  'ejat',
  'ijam',
  'ijat',
  'ojam',
  'ojat',
  'osim',
  'aja',
  'eja',
  'ija',
  'oja',
  'aju',
  'eju',
  'iju',
  'oju',
  'at',
  'et',
  'it',
  'ot',
  'o',
];

function stems(word: string, endings: readonly string[]): Set<string> {
  const stems = new Set<string>();
  if (!word) return stems;
  stems.add(word);
  for (const ending of endings) {
    if (!word.endsWith(ending)) continue;
    const stem = word.slice(0, -ending.length);
    const min = word.length <= 4 ? 2 : 3;
    if (stem.length >= min) stems.add(stem);
  }
  return stems;
}

function tokens(text: string): string[] {
  return normalizeAnswerText(text)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * True when `text` contains `keyword` as its own word, allowing Latvian
 * case or verb endings. "ārsts" matches "ārstam"; "lasīt" matches "lasa".
 */
export function keywordUsedInText(keyword: string, text: string): boolean {
  const key = normalizeAnswerText(keyword).replace(/ /g, '');
  if (!key) return false;
  const verb = key.endsWith('t');
  const endings = verb ? [...NOUN_ENDINGS, ...VERB_ENDINGS] : NOUN_ENDINGS;
  const keyStems = stems(key, endings);
  return tokens(text).some((token) => {
    const wordStems = stems(token, endings);
    for (const stem of keyStems) {
      if (wordStems.has(stem)) return true;
    }
    return false;
  });
}
