import { useDraggable } from '@dnd-kit/core';
import { useState, type CSSProperties } from 'react';
import { useT } from '../../../i18n/useT';
import { closeWorkspace } from '../../../services/workspace/workspaceSession';
import { sortedTemplates, useAppStore } from '../../../stores/appStore';
import type { Template } from '../../../types';
import { TemplateEditor } from './TemplateEditor';

type EditorState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; id: string };

export function TemplateBall({ template, onEdit }: { template: Template; onEdit: () => void }) {
  const t = useT();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: template.id });
  return (
    <li className="group relative flex w-full min-w-0 flex-col items-center gap-1">
      <div
        ref={setNodeRef}
        data-testid="template-ball"
        data-template-id={template.id}
        aria-label={t('palette.dragAria', { name: template.name })}
        className={`ball size-11 ${isDragging ? 'ball-dragging-source' : ''}`}
        style={{ '--ball-color': template.color } as CSSProperties}
        {...attributes}
        {...listeners}
      />
      <button
        data-testid="template-name"
        title={t('palette.editTitle', { name: template.name })}
        className="max-w-full truncate rounded px-1 text-xs text-muted hover:bg-line hover:text-ink"
        onClick={onEdit}
      >
        {template.name}
      </button>
    </li>
  );
}

export function TemplatePalette() {
  const t = useT();
  const templates = useAppStore((state) => state.templates);
  const workspaceName = useAppStore((state) => state.workspaceName);
  const [editing, setEditing] = useState<EditorState>({ mode: 'closed' });
  const editingTemplate = editing.mode === 'edit' ? templates[editing.id] : undefined;

  return (
    <aside className="relative z-40 flex w-[104px] shrink-0 flex-col items-center py-3">
      <ul className="flex min-h-0 w-full flex-1 list-none flex-col items-center gap-3.5 overflow-x-hidden overflow-y-auto p-2 pt-1">
        {sortedTemplates(templates).map((template) => (
          <TemplateBall key={template.id} template={template} onEdit={() => setEditing({ mode: 'edit', id: template.id })} />
        ))}
        <li>
          <button
            aria-label={t('palette.add')}
            data-testid="add-template"
            className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-xl text-muted transition-transform hover:scale-110 hover:text-ink active:scale-95"
            onClick={() => setEditing({ mode: 'create' })}
          >
            +
          </button>
        </li>
      </ul>
      <div className="flex w-full flex-col items-center gap-0.5 px-2 pt-2 text-[11px] text-muted">
        <span className="max-w-full truncate" title={workspaceName}>
          {workspaceName}
        </span>
        <button className="underline hover:text-ink" onClick={() => void closeWorkspace()}>
          {t('palette.switch')}
        </button>
      </div>
      {editing.mode !== 'closed' && (
        <TemplateEditor
          key={editing.mode === 'edit' ? `edit:${editing.id}` : 'create'}
          template={editingTemplate}
          onClose={() => setEditing({ mode: 'closed' })}
        />
      )}
    </aside>
  );
}
