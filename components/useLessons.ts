"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/client";
import type { Profile } from "@/lib/types";

const POLL_MS = 5000; // keeps the tutor queue and student status fresh without websockets

// Loads /api/lessons for the profile, polls it, and exposes a guarded `act`
// for lesson actions (claim/start/complete/cancel). Views are keyed by profile id,
// so state resets cleanly when the profile changes.
export function useLessons<T>(profile: Profile, pollMs = POLL_MS) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await apiFetch<T>("/api/lessons", { profile }));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    const first = setTimeout(reload, 0); // deferred so setState is not called synchronously in the effect
    const poll = setInterval(reload, pollMs);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
    };
  }, [reload, pollMs]);

  async function act(id: string, action: "claim" | "start" | "complete" | "cancel" | "remove") {
    if (busyId) return; // blocks double clicks
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/lessons/${id}/${action}`, { profile, method: "POST" });
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusyId(null);
      await reload(); // also refreshes the list after a 409, so stale items disappear
    }
  }

  return { data, loading, error, reload, busyId, actionError, act };
}
