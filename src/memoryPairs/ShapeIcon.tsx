import type { ReactNode } from 'react';
import type { ShapeId } from './types';

interface ShapeIconProps {
  shape: ShapeId;
  color: string;
  outlined: boolean;
}

/** Large solid shapes. Colored ones share the same dark outline. */
export function ShapeIcon({ shape, color, outlined }: ShapeIconProps) {
  const stroke = outlined ? '#1a1a1a' : 'none';
  const strokeWidth = outlined ? 5 : 0;
  const shared = {
    fill: color,
    stroke,
    strokeWidth,
    strokeLinejoin: 'round' as const,
  };

  let body: ReactNode = null;
  switch (shape) {
    case 'circle':
      body = <circle cx="50" cy="50" r="32" {...shared} />;
      break;
    case 'square':
      body = <rect x="18" y="18" width="64" height="64" rx="6" {...shared} />;
      break;
    case 'triangle':
      body = <polygon points="50,14 90,84 10,84" {...shared} />;
      break;
    case 'diamond':
      body = <polygon points="50,10 90,50 50,90 10,50" {...shared} />;
      break;
    case 'star':
      body = (
        <polygon
          points="50,8 61,38 94,38 67,58 78,88 50,70 22,88 33,58 6,38 39,38"
          {...shared}
        />
      );
      break;
    case 'pentagon':
      body = <polygon points="50,12 88,40 74,86 26,86 12,40" {...shared} />;
      break;
    case 'hexagon':
      body = <polygon points="50,12 86,32 86,72 50,92 14,72 14,32" {...shared} />;
      break;
    case 'cross':
      body = (
        <path
          d="M36 12 H64 V36 H88 V64 H64 V88 H36 V64 H12 V36 H36 Z"
          {...shared}
        />
      );
      break;
    case 'heart':
      body = (
        <path
          d="M50 84 C50 84 14 60 14 38 C14 26 24 16 36 16 C44 16 48 22 50 28 C52 22 56 16 64 16 C76 16 86 26 86 38 C86 60 50 84 50 84 Z"
          {...shared}
        />
      );
      break;
    case 'arrow':
      body = <polygon points="12,38 56,38 56,22 90,50 56,78 56,62 12,62" {...shared} />;
      break;
    case 'moon':
      body = (
        <path
          fillRule="evenodd"
          d="M44 14 A36 36 0 1 0 44 86 A36 36 0 1 0 44 14 M66 22 A30 30 0 1 1 66 78 A30 30 0 1 1 66 22"
          {...shared}
        />
      );
      break;
    default:
      body = null;
  }

  if (!body) return null;
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {body}
    </svg>
  );
}
