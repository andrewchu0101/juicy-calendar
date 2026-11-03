export const PALETTE = [
  '#E98B87',
  '#E9B96E',
  '#A9C98D',
  '#83B9D0',
  '#9C91CE',
  '#E5A5BD',
  '#D6C47B',
  '#83B9A7',
] as const;

const INK = '#2E2A26';
const WHITE = '#FFFFFF';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export function readableTextColor(background: string): string {
  return contrast(background, INK) >= contrast(background, WHITE) ? INK : WHITE;
}

/** Retain 40% of the original saturation, preserving HSL lightness. */
export function mutedEventColor(hex: string): string {
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16));
  const midpoint = (Math.max(...channels) + Math.min(...channels)) / 2;
  return '#' + channels.map(channel => Math.round(midpoint + (channel - midpoint) * 0.4).toString(16).padStart(2, '0')).join('');
}
