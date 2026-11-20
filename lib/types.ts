export type LessonStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Role = "student" | "tutor";

export type Profile = { id: string; name: string; role: Role };

export type Lesson = {
  id: string;
  studentId: string;
  tutorId: string | null;
  subject: string;
  description: string;
  preferredTime: string | null;
  status: LessonStatus;
  meetingUrl: string | null;
  whiteboardUrl: string | null;
  createdAt: string;
};

export const SUBJECTS = ["Matematyka", "Fizyka", "Chemia", "Biologia", "Informatyka"];

export const STATUS_LABEL: Record<LessonStatus, string> = {
  pending: "Oczekuje",
  accepted: "Przyjęta",
  in_progress: "W trakcie",
  completed: "Zakończona",
  cancelled: "Anulowana",
};
