import { readJson, respond } from "@/lib/api";
import { createLesson, getTutorBoard, LessonError, listForStudent, requireProfile } from "@/lib/lessons";

// Identity comes from the headers set by the role switcher (no real auth in this MVP).
export const GET = (req: Request) =>
  respond(async () => {
    const role = req.headers.get("x-role");
    if (role !== "student" && role !== "tutor") throw new LessonError(400, "Brak lub niepoprawna rola.");
    const profile = await requireProfile(req.headers.get("x-profile-id"), role);
    return role === "student" ? { mine: await listForStudent(profile.id) } : getTutorBoard(profile.id);
  });

export const POST = (req: Request) =>
  respond(async () => {
    const profile = await requireProfile(req.headers.get("x-profile-id"), "student");
    return createLesson(profile.id, await readJson(req));
  }, 201);
