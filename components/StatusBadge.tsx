import { LessonStatus, STATUS_LABEL } from "@/lib/types";

const STYLE: Record<LessonStatus, string> = {
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  accepted: "bg-blue-50 text-blue-800 border-blue-200",
  in_progress: "bg-emerald-50 text-emerald-800 border-emerald-200",
  completed: "bg-slate-100 text-slate-700 border-slate-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: LessonStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
