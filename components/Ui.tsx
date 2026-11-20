// Small shared building blocks for loading / empty / error states.

export function Loading({ text = "Ładowanie…" }: { text?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
      {text}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
      {onRetry && (
        <button onClick={onRetry} className="ml-2 font-medium underline">
          Spróbuj ponownie
        </button>
      )}
    </div>
  );
}
