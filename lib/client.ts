import type { Profile } from "./types";

// Browser-side fetch wrapper. Sends the selected profile as identity headers
// and turns { error } responses into thrown Errors with the server's message.
export async function apiFetch<T>(
  path: string,
  opts: { profile?: Profile; method?: string; body?: unknown } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? "GET",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        ...(opts.profile && { "x-profile-id": opts.profile.id, "x-role": opts.profile.role }),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new Error("Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `Błąd serwera (${res.status}).`);
  return data as T;
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Wystąpił nieoczekiwany błąd.");
