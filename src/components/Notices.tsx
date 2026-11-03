import { useAppStore } from '../stores/appStore';

export function Notices() {
  const saveError = useAppStore((state) => state.saveError);
  const issues = useAppStore((state) => state.issues);
  const dismissIssues = useAppStore((state) => state.dismissIssues);
  if (!saveError && issues.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex max-w-lg -translate-x-1/2 flex-col gap-2">
      {saveError && (
        <div role="alert" className="rounded-xl bg-danger px-4 py-2.5 text-sm text-white shadow-lg">
          Changes could not be saved and will be retried. {saveError}
        </div>
      )}
      {issues.length > 0 && (
        <div role="status" className="rounded-xl border border-line-strong bg-surface px-4 py-3 text-sm shadow-lg">
          <ul className="max-h-32 list-none space-y-1 overflow-auto p-0">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          <button className="mt-2 text-xs font-medium text-muted underline" onClick={dismissIssues}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
