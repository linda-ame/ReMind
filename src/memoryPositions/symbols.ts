import type { ShapeId } from '../memoryPairs/types';
import type { MemoryPositionsCategory, MemoryPositionsSymbol } from './types';

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

const COLORS: readonly ShapeColor[] = [
  { hex: '#D32F2F', masculine: 'sarkans', feminine: 'sarkana' },
  { hex: '#1565C0', masculine: 'zils', feminine: 'zila' },
  { hex: '#2E7D32', masculine: 'zaļš', feminine: 'zaļa' },
  { hex: '#F9A825', masculine: 'dzeltens', feminine: 'dzeltena' },
  { hex: '#6A1B9A', masculine: 'violets', feminine: 'violeta' },
  { hex: '#EF6C00', masculine: 'oranžs', feminine: 'oranža' },
  { hex: '#00838F', masculine: 'tirkīza', feminine: 'tirkīza' },
  { hex: '#4E342E', masculine: 'brūns', feminine: 'brūna' },
];

const BLACK = '#161616';

/** Outlines that stay easy to tell apart. No near-twin polygons. */
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

/** Capitals that are not a near lookalike of the next letter. */
const DISTINCT_LETTERS = ['A', 'E', 'H', 'K', 'L', 'O', 'S', 'T', 'X', 'Z', 'U', 'Y'] as const;

/** 6 and 9 are left out so one figure is never the other turned over. */
const DISTINCT_DIGITS = ['1', '2', '3', '4', '5', '7', '8', '0'] as const;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shapeLabel(color: ShapeColor, shape: ShapeId): string {
  const meta = SHAPES[shape];
  const adjective = meta.feminine ? color.feminine : color.masculine;
  return `${capitalize(adjective)} ${meta.name}`;
}

function windows<T>(ordered: readonly T[], count: number): T[][] {
  if (count <= 0 || ordered.length < count) return [];
  const sets: T[][] = [];
  for (let start = 0; start < ordered.length; start += 1) {
    const window: T[] = [];
    for (let index = 0; index < count; index += 1) {
      window.push(ordered[(start + index) % ordered.length]!);
    }
    sets.push(window);
  }
  return sets;
}

function coloredSymbol(shape: ShapeId, color: ShapeColor): MemoryPositionsSymbol {
  return {
    id: `colored:${shape}:${color.hex}`,
    category: 'colored',
    label: shapeLabel(color, shape),
    kind: 'shape',
    shape,
    color: color.hex,
  };
}

function blackSymbol(shape: ShapeId): MemoryPositionsSymbol {
  return {
    id: `black:${shape}`,
    category: 'black',
    label: shapeLabel(
      { hex: BLACK, masculine: 'melns', feminine: 'melna' },
      shape,
    ),
    kind: 'shape',
    shape,
    color: BLACK,
  };
}

function letterSymbol(letter: string): MemoryPositionsSymbol {
  return {
    id: `letter:${letter}`,
    category: 'letters',
    label: `Burts ${letter}`,
    kind: 'letter',
    text: letter,
  };
}

function digitSymbol(digit: string): MemoryPositionsSymbol {
  return {
    id: `digit:${digit}`,
    category: 'digits',
    label: `Cipars ${digit}`,
    kind: 'digit',
    text: digit,
  };
}

function uniqueSymbols(symbols: readonly MemoryPositionsSymbol[]): boolean {
  if (symbols.length === 0) return false;
  const ids = new Set(symbols.map((symbol) => symbol.id));
  if (ids.size !== symbols.length) return false;
  const shapes = symbols.flatMap((symbol) => (symbol.shape ? [symbol.shape] : []));
  if (new Set(shapes).size !== shapes.length) return false;
  if (symbols[0]?.category === 'colored') {
    const colors = symbols.flatMap((symbol) => (symbol.color ? [symbol.color] : []));
    if (colors.length !== symbols.length || new Set(colors).size !== colors.length) return false;
  }
  const texts = symbols.flatMap((symbol) => (symbol.text ? [symbol.text] : []));
  if (new Set(texts).size !== texts.length) return false;
  return symbols.every((symbol) => symbol.label.length > 0);
}

/** Clearly distinct sets. One game never mixes two categories. */
export function symbolSets(
  category: MemoryPositionsCategory,
  count: number,
): MemoryPositionsSymbol[][] {
  if (category === 'colored') {
    return windows(DISTINCT_SHAPES, count).flatMap((shapes) =>
      COLORS.map((_, shift) =>
        shapes.map((shape, index) => coloredSymbol(shape, COLORS[(index + shift) % COLORS.length]!)),
      ),
    ).filter(uniqueSymbols);
  }
  if (category === 'black') {
    return windows(DISTINCT_SHAPES, count)
      .map((shapes) => shapes.map(blackSymbol))
      .filter(uniqueSymbols);
  }
  if (category === 'letters') {
    return windows(DISTINCT_LETTERS, count)
      .map((letters) => letters.map(letterSymbol))
      .filter(uniqueSymbols);
  }
  return windows(DISTINCT_DIGITS, count)
    .map((digits) => digits.map(digitSymbol))
    .filter(uniqueSymbols);
}

export function symbolSetKey(symbols: readonly MemoryPositionsSymbol[]): string {
  return symbols
    .map((symbol) => symbol.id)
    .sort()
    .join('|');
}
