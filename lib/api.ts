import "server-only";
import { NextResponse } from "next/server";
import { LessonError } from "./lessons";

// Turns a result or a LessonError into a JSON response ({ error } + proper HTTP status).
export async function respond<T>(fn: () => Promise<T>, okStatus = 200) {
  try {
    return NextResponse.json(await fn(), { status: okStatus });
  } catch (e) {
    if (e instanceof LessonError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: "Wystąpił nieoczekiwany błąd." }, { status: 500 });
  }
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
