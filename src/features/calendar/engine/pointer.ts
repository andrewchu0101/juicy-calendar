import { columnMinutesToDate, pixelsToMinutes, timelineSpanMinutes, type TimelineConfig } from './timeline';

/** Where the columns area is on screen right now, in client coordinates. */
export type GridGeometry = {
  left: number;
  top: number;
  columnWidth: number;
  columnCount: number;
};

export type Point = { x: number; y: number };

export function columnIndexAt(x: number, geometry: GridGeometry): number {
  const index = Math.floor((x - geometry.left) / geometry.columnWidth);
  return Math.min(Math.max(index, 0), geometry.columnCount - 1);
}

export function pointerToTime(
  point: Point,
  geometry: GridGeometry,
  days: Date[],
  timeline: TimelineConfig,
  options: { allowOverflow?: boolean; magnetEnabled?: boolean } = {},
): Date {
  const day = days[columnIndexAt(point.x, geometry)];
  if (!day) throw new Error('pointerToTime needs at least one visible day');
  const raw = pixelsToMinutes(point.y - geometry.top, timeline);
  const minutes = magnetMinutes(raw, timeline.pixelsPerMinute, options.magnetEnabled ?? false);
  const resolved = options.allowOverflow
    ? minutes
    : Math.min(Math.max(minutes, 0), timelineSpanMinutes(timeline));
  return columnMinutesToDate(day, resolved, timeline);
}

/** Scroll speed (px per frame) for a pointer near a scroll container's top or bottom edge. */
export function edgeScrollSpeed(y: number, top: number, bottom: number, zone = 48, max = 14): number {
  if (y < top + zone) return -Math.ceil(max * Math.min((top + zone - y) / zone, 1));
  if (y > bottom - zone) return Math.ceil(max * Math.min((y - (bottom - zone)) / zone, 1));
  return 0;
}

/** Gentle attraction only within eight screen pixels of a half-hour line. */
export function magnetMinutes(minutes: number, pixelsPerMinute: number, enabled: boolean): number {
  const nearest = Math.round(minutes / 30) * 30;
  return enabled && Math.abs(nearest - minutes) * pixelsPerMinute <= 8 ? nearest : minutes;
}

/** A bounded radial palette, including hit targets independent of its entrance animation. */
export function radialBalls(origin: Point, count: number, width: number, height: number) {
  const radius = Math.max(76, count * 50 / (2 * Math.PI));
  const center = { x: Math.max(radius + 28, Math.min(origin.x, width - radius - 28)), y: Math.max(radius + 28, Math.min(origin.y, height - radius - 28)) };
  return Array.from({ length: count }, (_, i) => ({ x: center.x + Math.cos(i * Math.PI * 2 / count - Math.PI / 2) * radius, y: center.y + Math.sin(i * Math.PI * 2 / count - Math.PI / 2) * radius }));
}

export function radialHit(point: Point, balls: Point[]): number {
  return balls.findIndex(ball => Math.hypot(point.x - ball.x, point.y - ball.y) <= 28);
}

export function splitParticles() {
  return Array.from({ length: 18 }, (_, i) => ({ dx: Math.cos(i * 2.4) * (35 + i * 3), dy: Math.sin(i * 2.4) * (35 + i * 3), size: 5 + i % 5 }));
}

/** Keep a rejected drop's feedback visible when the pointer leaves the window. */
export function visibleFeedbackPoint(point: Point, width: number, height: number): Point {
  return { x: Math.max(24, Math.min(width - 24, point.x)), y: Math.max(24, Math.min(height - 24, point.y)) };
}
