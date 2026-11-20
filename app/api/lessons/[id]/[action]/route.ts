import { respond } from "@/lib/api";
import {
  cancelLesson,
  claimLesson,
  completeLesson,
  LessonError,
  removeLessonForStudent,
  removeLessonForTutor,
  requireProfile,
  startLesson,
} from "@/lib/lessons";
import type { Role } from "@/lib/types";

type Fn = (lessonId: string, profileId: string) => Promise<unknown>;

// action -> which roles may call it, and the business function for each
const ACTIONS: Record<string, Partial<Record<Role, Fn>>> = {
  claim: { tutor: claimLesson },
  start: { tutor: startLesson },
  complete: { tutor: completeLesson },
  cancel: { student: cancelLesson },
  remove: { student: removeLessonForStudent, tutor: removeLessonForTutor },
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await params;
  return respond(async () => {
    if (!Object.hasOwn(ACTIONS, action)) throw new LessonError(404, "Nieznana akcja.");
    const role = req.headers.get("x-role") as Role;
    const run = ACTIONS[action][role];
    if (!run) throw new LessonError(403, "Ta akcja nie jest dostępna dla Twojej roli.");
    // requireProfile checks the profile's real role in the DB, so a spoofed header cannot escalate.
    const profile = await requireProfile(req.headers.get("x-profile-id"), role);
    return run(id, profile.id);
  });
}
