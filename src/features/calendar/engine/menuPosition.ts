/** Keep a measured context menu inside the viewport, with room for its focus outline. */
export function menuPosition(point: { x: number; y: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const margin = 4;
  return {
    x: Math.max(margin, Math.min(point.x, viewport.width - size.width - margin)),
    y: Math.max(margin, Math.min(point.y, viewport.height - size.height - margin)),
  };
}
