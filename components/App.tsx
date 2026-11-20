"use client";

import { useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/client";
import type { Profile, Role } from "@/lib/types";
import { Room } from "./Room";
import { StudentView } from "./StudentView";
import { TutorView } from "./TutorView";
import { ErrorBox, Loading } from "./Ui";

const STORAGE_KEY = "korki-profile-id";

export function App() {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [roomId, setRoomId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Profile[]>("/api/profiles")
      .then((list) => {
        setProfiles(list);
        setError(null);
        // Restore the last selected profile if it still exists, else the first student.
        const saved = localStorage.getItem(STORAGE_KEY);
        setProfileId(list.find((p) => p.id === saved)?.id ?? list.find((p) => p.role === "student")?.id ?? null);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [attempt]);

  function select(id: string) {
    setRoomId(null); // leaving the room when the test profile changes
    setProfileId(id);
    localStorage.setItem(STORAGE_KEY, id);
  }

  const profile = profiles?.find((p) => p.id === profileId);

  function switchRole(role: Role) {
    const next = profiles?.find((p) => p.role === role);
    if (next) select(next.id);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="text-lg font-bold text-brand">
            Korki <span className="rounded bg-gold px-1.5 text-brand">Instant</span>
          </div>
          {profile && profiles && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 p-0.5 text-sm">
                {(["student", "tutor"] as Role[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => switchRole(r)}
                    className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                      profile.role === r ? "bg-brand text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {r === "student" ? "Uczeń" : "Korepetytor"}
                  </button>
                ))}
              </div>
              <select
                value={profile.id}
                onChange={(e) => select(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm"
                aria-label="Profil testowy"
              >
                {profiles
                  .filter((p) => p.role === profile.role)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main className={`mx-auto px-4 py-8 ${roomId ? "max-w-[1800px]" : "max-w-4xl"}`}>
        {error ? (
          <ErrorBox message={error} onRetry={() => setAttempt((n) => n + 1)} />
        ) : !profile ? (
          <Loading text="Ładowanie profili…" />
        ) : roomId ? (
          <Room key={profile.id} profile={profile} lessonId={roomId} onLeave={() => setRoomId(null)} />
        ) : profile.role === "student" ? (
          <StudentView key={profile.id} profile={profile} onEnterRoom={setRoomId} />
        ) : (
          <TutorView key={profile.id} profile={profile} onEnterRoom={setRoomId} />
        )}
      </main>
    </div>
  );
}
