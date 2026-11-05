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

export type RadialRing = { center: Point; radius: number };

export function radialRing(origin: Point, count: number, width: number, height: number): RadialRing {
  const radius = Math.max(76, count * 50 / (2 * Math.PI));
  const center = { x: Math.max(radius + 28, Math.min(origin.x, width - radius - 28)), y: Math.max(radius + 28, Math.min(origin.y, height - radius - 28)) };
  return { center, radius };
}

/** A bounded radial palette, including hit targets independent of its entrance animation. */
export function radialBalls(origin: Point, count: number, width: number, height: number) {
  const { center, radius } = radialRing(origin, count, width, height);
  return Array.from({ length: count }, (_, i) => ({ x: center.x + Math.cos(i * Math.PI * 2 / count - Math.PI / 2) * radius, y: center.y + Math.sin(i * Math.PI * 2 / count - Math.PI / 2) * radius }));
}

export const RADIAL_HIT_RADIUS = 28;
/** Pointer inside this circle around the ring centre cancels the hover. Balls win where the two overlap. */
export const RADIAL_CENTER_RADIUS = 80;

export function radialHit(point: Point, balls: Point[]): number {
  return balls.findIndex(ball => Math.hypot(point.x - ball.x, point.y - ball.y) <= RADIAL_HIT_RADIUS);
}

export type RadialStep = { hovered: number; picked: number | null };

/** Hovering only highlights a ball; leaving its fixed hit circle picks it, unless the pointer goes back to the ring centre (a ball's hit circle still wins). */
export function radialStep(previousHovered: number, point: Point, balls: Point[], ring: RadialRing): RadialStep {
  let hit = -1;
  let nearest = Infinity;
  balls.forEach((ball, index) => {
    const distance = Math.hypot(point.x - ball.x, point.y - ball.y);
    if (distance <= RADIAL_HIT_RADIUS && distance < nearest) { hit = index; nearest = distance; }
  });
  if (hit >= 0) return { hovered: hit, picked: null };
  // Back inside the ring's inner circle: cancel the hover; the menu stays and nothing is picked.
  if (Math.hypot(point.x - ring.center.x, point.y - ring.center.y) <= RADIAL_CENTER_RADIUS) return { hovered: -1, picked: null };
  return { hovered: -1, picked: previousHovered >= 0 ? previousHovered : null };
}

export function splitParticles() {
  return Array.from({ length: 18 }, (_, i) => ({ dx: Math.cos(i * 2.4) * (35 + i * 3), dy: Math.sin(i * 2.4) * (35 + i * 3), size: 5 + i % 5 }));
}

/** Keep a rejected drop's feedback visible when the pointer leaves the window. */
export function visibleFeedbackPoint(point: Point, width: number, height: number): Point {
  return { x: Math.max(24, Math.min(width - 24, point.x)), y: Math.max(24, Math.min(height - 24, point.y)) };
}
