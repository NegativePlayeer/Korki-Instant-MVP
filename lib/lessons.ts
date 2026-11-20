import "server-only";
import { randomBytes } from "node:crypto";
import { supabase } from "./supabase";
import type { Lesson, LessonStatus, Profile, Role } from "./types";

// All business rules live here. Route handlers only call these functions.
// Error messages are Polish on purpose: they are shown to users in the UI.

export const MAX_OPEN_REQUESTS = 3; // max `pending` requests per student
export const MAX_SUBJECT = 60;
export const MIN_DESC = 10;
export const MAX_DESC = 1000;

export class LessonError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 500,
    message: string,
  ) {
    super(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

/* eslint-disable @typescript-eslint/no-explicit-any */
function toLesson(r: any): Lesson {
  return {
    id: r.id,
    studentId: r.student_id,
    tutorId: r.tutor_id,
    subject: r.subject,
    description: r.description,
    preferredTime: r.preferred_at,
    status: r.status,
    meetingUrl: r.meeting_url,
    whiteboardUrl: r.whiteboard_url,
    createdAt: r.created_at,
  };
}

// Log the real DB error server-side, expose only a generic message to the client.
function dbError(error: { code?: string; message: string; details?: string; hint?: string }): never {
  console.error("[supabase]", error.code, error.message, error.details, error.hint);
  throw new LessonError(500, "Błąd bazy danych. Spróbuj ponownie.");
}

/* ---------- Profiles ---------- */

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.from("profiles").select("id,name,role").order("name");
  if (error) dbError(error);
  return data as Profile[];
}

// Identity = the selected test profile (there is no real auth in this MVP).
export async function requireProfile(id: unknown, role: Role): Promise<Profile> {
  if (!isUuid(id)) throw new LessonError(400, "Brak lub niepoprawny profil użytkownika.");
  const { data, error } = await supabase.from("profiles").select("id,name,role").eq("id", id).maybeSingle();
  if (error) dbError(error);
  if (!data) throw new LessonError(404, "Nie znaleziono profilu.");
  if (data.role !== role) throw new LessonError(403, "Ta akcja nie jest dostępna dla Twojej roli.");
  return data as Profile;
}

/* ---------- Reads ---------- */

export async function listForStudent(studentId: string): Promise<Lesson[]> {
  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("student_id", studentId)
    .eq("hidden_by_student", false)
    .order("created_at", { ascending: false });
  if (error) dbError(error);
  return data.map(toLesson);
}

export async function getTutorBoard(tutorId: string) {
  const [queue, mine] = await Promise.all([
    supabase.from("lessons").select("*").eq("status", "pending").order("created_at", { ascending: true }),
    supabase
      .from("lessons")
      .select("*")
      .eq("tutor_id", tutorId)
      .eq("hidden_by_tutor", false)
      .order("created_at", { ascending: false }),
  ]);
  if (queue.error) dbError(queue.error);
  if (mine.error) dbError(mine.error);
  return { queue: queue.data.map(toLesson), mine: mine.data.map(toLesson) };
}

/* ---------- 1. Book a lesson ---------- */

export async function createLesson(studentId: string, input: any): Promise<Lesson> {
  const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const rawTime = input?.preferredTime;

  if (!subject) throw new LessonError(400, "Wybierz przedmiot.");
  if (subject.length > MAX_SUBJECT) throw new LessonError(400, `Przedmiot może mieć max ${MAX_SUBJECT} znaków.`);
  if (description.length < MIN_DESC) throw new LessonError(400, `Opisz zadanie (min. ${MIN_DESC} znaków).`);
  if (description.length > MAX_DESC) throw new LessonError(400, `Opis może mieć max ${MAX_DESC} znaków.`);

  let preferredAt: string | null = null;
  if (rawTime) {
    const d = new Date(rawTime);
    if (Number.isNaN(d.getTime())) throw new LessonError(400, "Niepoprawny termin.");
    // 5 min tolerance so "now" picked in the form is not rejected by clock drift
    if (d.getTime() < Date.now() - 5 * 60_000) throw new LessonError(400, "Termin nie może być w przeszłości.");
    preferredAt = d.toISOString();
  }

  // Cap on open requests keeps one student from flooding the tutor queue.
  const { count, error: cErr } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("status", "pending");
  if (cErr) dbError(cErr);
  if ((count ?? 0) >= MAX_OPEN_REQUESTS)
    throw new LessonError(409, `Masz już ${MAX_OPEN_REQUESTS} otwarte zgłoszenia. Poczekaj na korepetytora lub anuluj jedno.`);

  const { data, error } = await supabase
    .from("lessons")
    .insert({ student_id: studentId, subject, description, preferred_at: preferredAt })
    .select()
    .single();
  if (error) dbError(error);
  return toLesson(data);
}

/* ---------- 2. Claim a request (atomic) ---------- */

export async function claimLesson(lessonId: string, tutorId: string): Promise<Lesson> {
  if (!isUuid(lessonId)) throw new LessonError(404, "Nie znaleziono zgłoszenia.");

  // Single UPDATE guarded by status='pending': only one tutor can win the race.
  // Never read-then-write here.
  const { data, error } = await supabase
    .from("lessons")
    .update({ tutor_id: tutorId, status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", lessonId)
    .eq("status", "pending")
    .select()
    .maybeSingle();

  // 23505 = unique index "one active lesson per tutor" (DB-level guarantee)
  if (error?.code === "23505")
    throw new LessonError(409, "Masz już aktywną lekcję – zakończ ją, zanim przyjmiesz kolejną.");
  if (error) dbError(error);
  if (data) return toLesson(data);

  // No row updated: distinguish "does not exist" (404) from "already taken" (409).
  const { data: cur, error: gErr } = await supabase.from("lessons").select("id").eq("id", lessonId).maybeSingle();
  if (gErr) dbError(gErr);
  if (!cur) throw new LessonError(404, "Nie znaleziono zgłoszenia.");
  throw new LessonError(409, "To zgłoszenie zostało już przyjęte lub anulowane.");
}

/* ---------- 3. Lifecycle: allowed transitions ---------- */

const STATUS_LABEL_PL: Record<LessonStatus, string> = {
  pending: "oczekująca",
  accepted: "przyjęta",
  in_progress: "w trakcie",
  completed: "zakończona",
  cancelled: "anulowana",
};

async function transition(
  lessonId: string,
  actor: { column: "student_id" | "tutor_id"; id: string },
  from: LessonStatus[],
  patch: Record<string, unknown>,
): Promise<Lesson> {
  if (!isUuid(lessonId)) throw new LessonError(404, "Nie znaleziono lekcji.");

  // Atomic: applies only if the lesson belongs to the actor AND is in an allowed status.
  const { data, error } = await supabase
    .from("lessons")
    .update(patch)
    .eq("id", lessonId)
    .eq(actor.column, actor.id)
    .in("status", from)
    .select()
    .maybeSingle();
  if (error) dbError(error);
  if (data) return toLesson(data);

  // Nothing updated: read the row only to explain why (404 / 403 / 409).
  const { data: cur, error: gErr } = await supabase
    .from("lessons")
    .select("student_id,tutor_id,status")
    .eq("id", lessonId)
    .maybeSingle();
  if (gErr) dbError(gErr);
  if (!cur) throw new LessonError(404, "Nie znaleziono lekcji.");
  if (cur[actor.column] !== actor.id) throw new LessonError(403, "To nie jest Twoja lekcja.");
  throw new LessonError(409, `Nie można wykonać tej akcji – lekcja jest ${STATUS_LABEL_PL[cur.status as LessonStatus]}.`);
}

// A student may cancel before the lesson starts, including after a tutor claimed it.
export const cancelLesson = (lessonId: string, studentId: string) =>
  transition(lessonId, { column: "student_id", id: studentId }, ["pending", "accepted"], {
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  });

export const completeLesson = (lessonId: string, tutorId: string) =>
  transition(lessonId, { column: "tutor_id", id: tutorId }, ["in_progress"], {
    status: "completed",
    completed_at: new Date().toISOString(),
  });

// "Delete" only hides a finished lesson (completed or cancelled) from the caller's own list.
// The row stays, so the other side keeps its history. Active lessons cannot be removed.
export const removeLessonForStudent = (lessonId: string, studentId: string) =>
  transition(lessonId, { column: "student_id", id: studentId }, ["completed", "cancelled"], {
    hidden_by_student: true,
  });

export const removeLessonForTutor = (lessonId: string, tutorId: string) =>
  transition(lessonId, { column: "tutor_id", id: tutorId }, ["completed", "cancelled"], {
    hidden_by_tutor: true,
  });

/* ---------- 4. Start the meeting ---------- */

// Excalidraw room format: #room=<20 hex chars>,<22 chars base64url key>.
// Only the URL is stored, never whiteboard content.
function newWhiteboardUrl() {
  const roomId = randomBytes(10).toString("hex");
  const key = randomBytes(16).toString("base64url");
  return `https://excalidraw.com/#room=${roomId},${key}`;
}

export const startLesson = (lessonId: string, tutorId: string) =>
  transition(lessonId, { column: "tutor_id", id: tutorId }, ["accepted"], {
    status: "in_progress",
    started_at: new Date().toISOString(),
    meeting_url: `https://meet.jit.si/korki-${lessonId}`,
    whiteboard_url: newWhiteboardUrl(),
  });
