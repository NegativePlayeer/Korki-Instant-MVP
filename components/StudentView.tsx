"use client";

import { useState } from "react";
import { apiFetch, errorMessage } from "@/lib/client";
import { Lesson, Profile, SUBJECTS } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { Empty, ErrorBox, Loading } from "./Ui";
import { useLessons } from "./useLessons";

const MAX_DESC = 1000; // display limit only; the server enforces the real rules

export function StudentView({ profile, onEnterRoom }: { profile: Profile; onEnterRoom: (id: string) => void }) {
  const { data, loading, error, reload, busyId, actionError, act } = useLessons<{ mine: Lesson[] }>(profile);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return; // double-click guard
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch("/api/lessons", {
        profile,
        method: "POST",
        body: {
          subject,
          description,
          // datetime-local has no timezone: convert to an absolute instant in the browser
          preferredTime: preferredTime ? new Date(preferredTime).toISOString() : null,
        },
      });
      setSubject("");
      setDescription("");
      setPreferredTime("");
      await reload();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const mine = data?.mine ?? [];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section>
        <h2 className="mb-3 text-xl font-semibold">Zamów korepetycje 45 min</h2>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium">
            Przedmiot
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">— wybierz —</option>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Opis zadania / z czym masz problem
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              placeholder="np. Zadanie 7 z arkusza maj 2023 – nie wiem jak zacząć…"
            />
            <span className="block text-right text-xs text-slate-500">
              {description.length}/{MAX_DESC}
            </span>
          </label>
          <label className="block text-sm font-medium">
            Preferowany termin <span className="font-normal text-slate-500">(opcjonalnie)</span>
            <input
              type="datetime-local"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            />
          </label>
          {formError && <ErrorBox message={formError} />}
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-gold px-4 py-2.5 font-semibold text-brand transition-colors hover:bg-gold-hover disabled:opacity-60"
          >
            {submitting ? "Wysyłanie…" : "Zamów korepetycje"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold">Moje zgłoszenia</h2>
        {actionError && (
          <div className="mb-3">
            <ErrorBox message={actionError} />
          </div>
        )}
        {loading ? (
          <Loading />
        ) : error && !data ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : mine.length === 0 ? (
          <Empty>Nie masz jeszcze zgłoszeń. Zamów pierwsze korepetycje!</Empty>
        ) : (
          <ul className="space-y-3">
            {mine.map((l) => (
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
                {l.status === "accepted" && (
                  <p className="mt-2 text-sm text-blue-800">
                    Korepetytor przyjął zgłoszenie – czekaj na link do spotkania.
                  </p>
                )}
                {l.status === "in_progress" && (
                  <button
                    onClick={() => onEnterRoom(l.id)}
                    className="mt-3 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
                  >
                    Wejdź do lekcji
                  </button>
                )}
                {(l.status === "completed" || l.status === "cancelled") && (
                  <button
                    onClick={() => confirm("Usunąć tę lekcję z Twojej listy?") && act(l.id, "remove")}
                    disabled={busyId !== null}
                    className="mt-3 text-sm font-medium text-slate-600 hover:underline disabled:opacity-50"
                  >
                    {busyId === l.id ? "Usuwanie…" : "Usuń z listy"}
                  </button>
                )}
                {(l.status === "pending" || l.status === "accepted") && (
                  <button
                    onClick={() => act(l.id, "cancel")}
                    disabled={busyId !== null}
                    className="mt-3 text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                  >
                    {busyId === l.id ? "Anulowanie…" : "Anuluj"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
