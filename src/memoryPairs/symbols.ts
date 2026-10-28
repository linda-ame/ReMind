import type { MemoryPairsCategory, MemoryPairsSymbol, ShapeId } from './types';

interface ShapeColor {
  hex: string;
  masculine: string;
  feminine: string;
}

interface ShapeMeta {
  name: string;
  feminine: boolean;
}

const SHAPES: Record<ShapeId, ShapeMeta> = {
  circle: { name: 'aplis', feminine: false },
  square: { name: 'kvadrāts', feminine: false },
  triangle: { name: 'trijstūris', feminine: false },
  diamond: { name: 'rombs', feminine: false },
  star: { name: 'zvaigzne', feminine: true },
  pentagon: { name: 'piecstūris', feminine: false },
  hexagon: { name: 'sešstūris', feminine: false },
  cross: { name: 'krusts', feminine: false },
  heart: { name: 'sirds', feminine: true },
  arrow: { name: 'bulta', feminine: true },
  moon: { name: 'mēness', feminine: false },
};

const RED: ShapeColor = { hex: '#D32F2F', masculine: 'sarkans', feminine: 'sarkana' };
const BLUE: ShapeColor = { hex: '#1565C0', masculine: 'zils', feminine: 'zila' };
const GREEN: ShapeColor = { hex: '#2E7D32', masculine: 'zaļš', feminine: 'zaļa' };
const GOLD: ShapeColor = { hex: '#F9A825', masculine: 'dzeltens', feminine: 'dzeltena' };
const PURPLE: ShapeColor = { hex: '#6A1B9A', masculine: 'violets', feminine: 'violeta' };
const ORANGE: ShapeColor = { hex: '#EF6C00', masculine: 'oranžs', feminine: 'oranža' };
const TEAL: ShapeColor = { hex: '#00838F', masculine: 'tirkīza', feminine: 'tirkīza' };
const BROWN: ShapeColor = { hex: '#4E342E', masculine: 'brūns', feminine: 'brūna' };

const BLACK_INK = '#161616';
const BLACK_WORD: ShapeColor = { hex: BLACK_INK, masculine: 'melns', feminine: 'melna' };

/**
 * Outlines that stay easy to tell apart.
 * Diamond, pentagon and hexagon are kept in the catalog for older saved boards,
 * but new deals do not use them.
 */
const DISTINCT_SHAPES: readonly ShapeId[] = [
  'circle',
  'square',
  'triangle',
  'star',
  'heart',
  'cross',
  'arrow',
  'moon',
];

/** Far-apart colors. A game never uses two close shades of the same hue. */
const DISTINCT_COLORS: readonly ShapeColor[] = [
  RED,
  BLUE,
  GREEN,
  GOLD,
  PURPLE,
  ORANGE,
  TEAL,
  BROWN,
];

/** Capitals that do not sit next to a near lookalike (no O/Q, C/G, B/D, P/R). */
const DISTINCT_LETTERS = ['A', 'E', 'H', 'K', 'L', 'O', 'S', 'T', 'X', 'Z', 'U', 'Y'] as const;

/** 6 and 9 are left out so a card is never the other one turned over. */
const DISTINCT_DIGITS = ['1', '2', '3', '4', '5', '7', '8', '0'] as const;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shapeLabel(color: ShapeColor, shape: ShapeId): string {
  const meta = SHAPES[shape];
  const adjective = meta.feminine ? color.feminine : color.masculine;
  return `${capitalize(adjective)} ${meta.name}`;
}

function makeColored(shape: ShapeId, color: ShapeColor): MemoryPairsSymbol {
  return {
    id: `colored:${shape}:${color.hex}`,
    category: 'colored',
    label: shapeLabel(color, shape),
    kind: 'shape',
    shape,
    color: color.hex,
  };
}

function makeBlack(shape: ShapeId): MemoryPairsSymbol {
  return {
    id: `black:${shape}`,
    category: 'black',
    label: shapeLabel(BLACK_WORD, shape),
    kind: 'shape',
    shape,
    color: BLACK_INK,
  };
}

function makeLetter(letter: string): MemoryPairsSymbol {
  return {
    id: `letter:${letter}`,
    category: 'letters',
    label: `Burts ${letter}`,
    kind: 'letter',
    text: letter,
  };
}

function makeDigit(digit: string): MemoryPairsSymbol {
  return {
    id: `digit:${digit}`,
    category: 'digits',
    label: `Cipars ${digit}`,
    kind: 'digit',
    text: digit,
  };
}

/** A few neighboring windows, so the next game can use a different group. */
function nearWindows<T>(ordered: readonly T[], count: number): T[][] {
  if (ordered.length <= count) return [ordered.slice()];
  const sets: T[][] = [ordered.slice(0, count)];
  const extra = Math.min(2, ordered.length - count);
  for (let offset = 1; offset <= extra; offset += 1) {
    sets.push(ordered.slice(offset, offset + count));
  }
  return sets;
}

function colorRotations(
  shapes: readonly ShapeId[],
  colors: readonly ShapeColor[],
): MemoryPairsSymbol[][] {
  const shifts = Math.min(colors.length, 8);
  const sets: MemoryPairsSymbol[][] = [];
  for (let shift = 0; shift < shifts; shift += 1) {
    sets.push(
      shapes.map((shape, index) => {
        const color = colors[(index + shift) % colors.length]!;
        return makeColored(shape, color);
      }),
    );
  }
  return sets;
}

/** Clearly distinct symbol sets for one category and pair count. */
export function symbolVariants(
  category: MemoryPairsCategory,
  count: number,
): MemoryPairsSymbol[][] {
  if (category === 'colored') {
    return nearWindows(DISTINCT_SHAPES, count).flatMap((shapes) =>
      colorRotations(shapes, DISTINCT_COLORS),
    );
  }
  if (category === 'black') {
    return nearWindows(DISTINCT_SHAPES, count).map((shapes) => shapes.map(makeBlack));
  }
  if (category === 'letters') {
    return nearWindows(DISTINCT_LETTERS, count).map((letters) => letters.map(makeLetter));
  }
  return nearWindows(DISTINCT_DIGITS, count).map((digits) => digits.map(makeDigit));
}
