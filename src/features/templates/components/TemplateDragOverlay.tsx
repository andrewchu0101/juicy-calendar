import { DragOverlay, type Modifier } from '@dnd-kit/core';
import type { CSSProperties, RefObject } from 'react';
import type { Template } from '../../../types';
import { splitParticles } from '../../calendar/engine';
import type { Splash } from '../hooks/useTemplateDrag';

/** Keeps the ball centred on the pointer, wherever on the ball it was grabbed. */
const centerOnPointer: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!activatorEvent || !draggingNodeRect) return transform;
  const { clientX, clientY } = activatorEvent as PointerEvent;
  return {
    ...transform,
    x: transform.x + clientX - draggingNodeRect.left - draggingNodeRect.width / 2,
    y: transform.y + clientY - draggingNodeRect.top - draggingNodeRect.height / 2,
  };
};

export function TemplateDragOverlay({
  template,
  ballRef,
  point,
}: {
  point?: { x: number; y: number } | null;
  template: Template | null;
  ballRef: RefObject<HTMLDivElement | null>;
}) {
  if (point && template) return <div ref={ballRef} data-testid="ball-overlay" className="ball ball-overlay size-11" style={{ position: 'fixed', pointerEvents: 'none', zIndex: 100, left: point.x - 22, top: point.y - 22, '--ball-color': template.color } as CSSProperties} />;
  return (
    <DragOverlay dropAnimation={null} modifiers={[centerOnPointer]} style={{ pointerEvents: 'none' }}>
      {template && (
        <div
          ref={ballRef}
          data-testid="ball-overlay"
          className="ball ball-overlay size-11"
          style={{ '--ball-color': template.color } as CSSProperties}
        />
      )}
    </DragOverlay>
  );
}

const DROPLETS = [
  { dx: -30, dy: -16, size: 7 },
  { dx: -14, dy: -30, size: 5 },
  { dx: 15, dy: -28, size: 6 },
  { dx: 30, dy: -12, size: 5 },
];

/** Flat droplets, separate from any ball, that play once on drop. */
export function DropSplash({ splash }: { splash: Splash | null }) {
  if (!splash) return null;
  return (
    <div key={splash.key} aria-hidden>
      {DROPLETS.map((droplet) => (
        <span
          key={`${droplet.dx}:${droplet.dy}`}
          className="droplet"
          style={
            {
              left: splash.x,
              top: splash.y,
              width: droplet.size,
              height: droplet.size,
              backgroundColor: splash.color,
              '--dx': `${droplet.dx}px`,
              '--dy': `${droplet.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function SplitBurst({ burst }: { burst: Splash | null }) {
  if (!burst) return null;
  return <div key={burst.key} aria-hidden data-testid="split-burst">{splitParticles().map((particle, i) => <span key={i} className="split-particle" style={{ left: burst.x, top: burst.y, width: particle.size, height: particle.size, backgroundColor: burst.color, '--dx': `${particle.dx}px`, '--dy': `${particle.dy}px` } as CSSProperties} />)}</div>;
}
