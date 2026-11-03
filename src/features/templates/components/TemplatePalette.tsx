import { useDraggable } from '@dnd-kit/core';
import { useState, type CSSProperties } from 'react';
import { closeWorkspace } from '../../../services/workspace/workspaceSession';
import { sortedTemplates, useAppStore } from '../../../stores/appStore';
import type { Template } from '../../../types';
import { TemplateEditor } from './TemplateEditor';

export function TemplateBall({ template, onEdit }: { template: Template; onEdit: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: template.id });
  return (
    <li className="group relative flex flex-col items-center gap-1">
      <div
        ref={setNodeRef}
        data-testid="template-ball"
        data-template-id={template.id}
        aria-label={`Drag ${template.name} onto the calendar`}
        className={`ball size-11 ${isDragging ? 'ball-dragging-source' : ''}`}
        style={{ '--ball-color': template.color } as CSSProperties}
        {...attributes}
        {...listeners}
      />
      <button
        data-testid="template-name"
        title={`Edit ${template.name}`}
        className="max-w-full truncate rounded px-1 text-xs text-muted hover:bg-line hover:text-ink"
        onClick={onEdit}
      >
        {template.name}
      </button>
    </li>
  );
}

export function TemplatePalette() {
  const templates = useAppStore((state) => state.templates);
  const workspaceName = useAppStore((state) => state.workspaceName);
  /** A template id, 'new', or null when the editor is closed. */
  const [editing, setEditing] = useState<string | null>(null);
  const editingTemplate = editing && editing !== 'new' ? templates[editing] : undefined;

  return (
    <aside className="relative z-40 flex w-[104px] shrink-0 flex-col items-center py-3">
      <ul className="flex min-h-0 w-full flex-1 list-none flex-col items-center gap-3.5 overflow-x-hidden overflow-y-auto p-2 pt-1">
        {sortedTemplates(templates).map((template) => (
          <TemplateBall key={template.id} template={template} onEdit={() => setEditing(template.id)} />
        ))}
        <li>
          <button
            aria-label="Add template"
            data-testid="add-template"
            className="flex size-11 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-xl text-muted transition-transform hover:scale-110 hover:text-ink active:scale-95"
            onClick={() => setEditing('new')}
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
          Switch
        </button>
      </div>
      {editing && (
        <TemplateEditor
          key={editing}
          template={editingTemplate}
          onClose={() => setEditing(null)}
        />
      )}
    </aside>
  );
}
