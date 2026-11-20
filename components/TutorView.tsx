"use client";

import { Lesson, Profile } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { Empty, ErrorBox, Loading } from "./Ui";
import { useLessons } from "./useLessons";

export function TutorView({ profile, onEnterRoom }: { profile: Profile; onEnterRoom: (id: string) => void }) {
  const { data, loading, error, reload, busyId, actionError, act } = useLessons<{
    queue: Lesson[];
    mine: Lesson[];
  }>(profile);

  const queue = data?.queue ?? [];
  const mine = data?.mine ?? [];
  const busy = busyId !== null;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Kolejka zgłoszeń</h2>
        {actionError && (
          <div className="mb-3">
            <ErrorBox message={actionError} />
          </div>
        )}
        {loading ? (
          <Loading />
        ) : error && !data ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : queue.length === 0 ? (
          <Empty>Brak oczekujących zgłoszeń. Odpocznij chwilę ☕</Empty>
        ) : (
          <ul className="space-y-3">
            {queue.map((l) => (
              <li key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{l.subject}</span>
                  <StatusBadge status={l.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{l.description}</p>
                {l.preferredTime && (
                  <p className="mt-1 text-xs text-slate-500">
                    Termin: {new Date(l.preferredTime).toLocaleString("pl-PL")}
                  </p>
                )}
                <button
                  onClick={() => act(l.id, "claim")}
                  disabled={busy}
                  className="mt-3 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-gold-hover disabled:opacity-60"
                >
                  {busyId === l.id ? "Przyjmowanie…" : "Przyjmij zgłoszenie"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Moje lekcje</h2>
        {loading ? (
          <Loading />
        ) : mine.length === 0 ? (
          <Empty>Nie przyjąłeś jeszcze żadnej lekcji.</Empty>
        ) : (
          <ul className="space-y-3">
            {mine.map((l) => (
              <li key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{l.subject}</span>
                  <StatusBadge status={l.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">{l.description}</p>
                {/* Only the student can cancel, so a cancelled lesson in this list always means that. */}
                {l.status === "cancelled" && (
                  <p role="status" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    Uczeń anulował tę lekcję. Możesz przyjąć kolejne zgłoszenie z kolejki.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {l.status === "accepted" && (
                    <button
                      onClick={() => act(l.id, "start")}
                      disabled={busy}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
                    >
                      {busyId === l.id ? "Uruchamianie…" : "Rozpocznij spotkanie"}
                    </button>
                  )}
                  {l.status === "in_progress" && (
                    <button
                      onClick={() => onEnterRoom(l.id)}
                      className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
                    >
                      Wejdź do lekcji
                    </button>
                  )}
                  {(l.status === "completed" || l.status === "cancelled") && (
                    <button
                      onClick={() => confirm("Usunąć tę lekcję z Twojej listy?") && act(l.id, "remove")}
                      disabled={busy}
                      className="text-sm font-medium text-slate-600 hover:underline disabled:opacity-50"
                    >
                      {busyId === l.id ? "Usuwanie…" : "Usuń z listy"}
                    </button>
                  )}
                  {l.status === "in_progress" && (
                    <button
                      onClick={() => act(l.id, "complete")}
                      disabled={busy}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                    >
                      {busyId === l.id ? "Kończenie…" : "Zakończ"}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
