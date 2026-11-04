import type { CSSProperties } from 'react';
import { useT } from '../../../i18n/useT';
import { useRadialPalette } from '../hooks/useRadialPalette';
import type { useTemplateDrag } from '../hooks/useTemplateDrag';

export function RadialPalette({ drag }: { drag: ReturnType<typeof useTemplateDrag>['radial'] }) {
  const t = useT();
  const { menu, templates } = useRadialPalette(drag);
  return <>
    {menu && <div className="radial-palette" role="status" aria-label={t('radial.aria')}>
      {templates.map((template, index) => {
        const point = menu.positions[index]!;
        return <div key={template.id} className={`radial-choice ${menu.hovered === index ? 'radial-hovered' : ''}`} style={{ left: point.x, top: point.y, '--from-x': `${menu.origin.x - point.x}px`, '--from-y': `${menu.origin.y - point.y}px` } as CSSProperties}>
          <div className="ball size-11" style={{ '--ball-color': template.color } as CSSProperties} />
          <span>{template.name}</span>
        </div>;
      })}
    </div>}
  </>;
}
