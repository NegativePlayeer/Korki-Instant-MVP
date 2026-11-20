"use client";

import type { Lesson, Profile } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { ErrorBox, Loading } from "./Ui";
import { useLessons } from "./useLessons";

const ROOM_POLL_MS = 2000; // short poll so "end lesson" reaches the other side quickly

// The whiteboard is embedded here, so the app can end the session:
// once the lesson is no longer in_progress, the iframe is unmounted for both sides.
export function Room({ profile, lessonId, onLeave }: { profile: Profile; lessonId: string; onLeave: () => void }) {
  const { data, loading, error, reload, busyId, actionError, act } = useLessons<{ mine: Lesson[] }>(
    profile,
    ROOM_POLL_MS,
  );
  const lesson = data?.mine.find((l) => l.id === lessonId);
  const isTutor = profile.role === "tutor";

  if (loading) return <Loading text="Wchodzenie do lekcji…" />;
  if (!lesson) return error ? <ErrorBox message={error} onRetry={reload} /> : <Ended onLeave={onLeave} text="Nie znaleziono lekcji." />;

  const live = lesson.status === "in_progress" && lesson.whiteboardUrl;
  if (!live) {
    const text =
      lesson.status === "completed"
        ? "Lekcja została zakończona. Tablica została zamknięta."
        : "Ta lekcja nie jest aktualnie prowadzona.";
    return <Ended onLeave={onLeave} text={text} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">{lesson.subject}</h2>
          <StatusBadge status={lesson.status} />
        </div>
        <div className="flex gap-2">
          <button onClick={onLeave} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            Wyjdź (lekcja trwa dalej)
          </button>
          {isTutor && (
            <button
              onClick={() => act(lesson.id, "complete")}
              disabled={busyId !== null}
              className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-brand hover:bg-gold-hover disabled:opacity-60"
            >
              {busyId ? "Kończenie…" : "Zakończ lekcję"}
            </button>
          )}
        </div>
      </div>
      {actionError && <ErrorBox message={actionError} />}
      {/* Known limitation: Excalidraw keeps the last drawing in its own localStorage and can seed a new
          room with it. Sandboxing the frame (no allow-same-origin) breaks the whiteboard, so it is not used. */}
      <iframe
        title="Tablica"
        src={lesson.whiteboardUrl!}
        allow="clipboard-read; clipboard-write; fullscreen"
        className="h-[85vh] min-h-[520px] w-full rounded-2xl border border-slate-200 bg-white shadow-sm"
      />
    </div>
  );
}

function Ended({ text, onLeave }: { text: string; onLeave: () => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="font-medium">{text}</p>
      <button onClick={onLeave} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
        Wróć do listy
      </button>
    </div>
  );
}
