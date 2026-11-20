# CLAUDE.md — Korki Instant (MVP)

Recruitment task: MVP of "Korki Instant" for zadaniazmatur.pl. Time budget: **90 minutes**. Full brief: `Zadanie_Rekrutacyjne_Junior_Dev_Korki_Instant.md`.

## Product idea
A student (maturzysta) is stuck on a task and orders or books a 45-minute lesson. A tutor sees the request, claims it, and starts the meeting (generates a link to a shared room / whiteboard).

## Stack (decided)
- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Backend/DB: **Supabase** (Postgres) via `@supabase/supabase-js`
- Supabase is called from server code only (Route Handlers / Server Actions). Secrets stay in `.env.local`; `.env.example` documents the variables.
- No real auth: a role switcher (`Uczeń` / `Korepetytor`) plus a test profile picker, persisted in a cookie/localStorage
- Schema lives in `supabase/schema.sql` (table, status enum/check constraint, seed test profiles) so the recruiter can recreate it in the SQL editor

## Business features (pick 3–4, all must be solid)
1. **Order an instant lesson** — student submits subject, topic/task description, optional preferred time. Validated (no empty fields, length limits).
2. **Tutor queue + claim** — tutor sees open requests and claims one. Claiming is atomic: `update lessons set tutor_id=..., status='accepted' where id=... and status='pending'` and check that a row came back. If none did, return 409 "already taken". Never read-then-write.
3. **Lesson lifecycle** — statuses: `pending → accepted → in_progress → completed`, plus `cancelled`. Only valid transitions are allowed (enforced server-side and with a DB check constraint). Both sides see the status as a badge.
4. **Start meeting** — tutor generates a video room link (`https://meet.jit.si/korki-<id>`) and a shared whiteboard link (Excalidraw room). Only the URLs are stored in `lessons` (never whiteboard content); the student sees them once the lesson is started. Whiteboard snapshots to Supabase Storage are out of scope (mention in README as a future step).

Edge cases to cover: double claim, student cancels after claim, tutor cannot claim while already in an active lesson, a student cannot have more than N open requests, unknown id → 404, double-click submit.

## Visual style
- Backgrounds `#FFFFFF` and `#F8FAFC` (slate-50); text `#171717` / slate-900
- Brand Blue `#132383` (hover `#0b154f`); Brand Gold `#E9BF1E` (hover `#d2a713`, CTAs and highlights)
- Cards: `border border-slate-200 rounded-xl/2xl shadow-sm`; sans-serif font (Geist Sans / Inter)
- Clear status badges; loading, empty and error states on every view
- UI copy is in **Polish**

## Conventions
- Business rules live in one server-side module (`lib/lessons.ts`), not in components or route handlers. Handlers stay thin.
- Return explicit error codes and messages from the API (400 validation, 404 not found, 409 conflict); the UI must show them.
- Keep it small: no extra abstractions, no features beyond the 3–4 above.
- Short comments only where a business rule is non-obvious.

## Deliverables
- Working app: `npm install && npm run dev`
- `.env.example` with `SUPABASE_URL` and the key variable names (no real secrets committed)
- `supabase/schema.sql`
- `README.md` in Polish with exactly these sections:
  1. 🚀 Szybki Start (including Supabase setup)
  2. 🏗️ Architektura i Wybrany Backend
  3. 🧠 Logika Biznesowa i Przepływ (User Flow)
  4. 🧪 Jak przetestowano projekt (including a click-through guide for the recruiter)

## Grading criteria (prioritise effort in this order)
1. Functionality — the full student ↔ tutor flow works end to end
2. Testing — errors, loading states, empty fields, repeatable without breaking state
3. Business logic — makes sense in a real product
4. Style — consistent with the brand parameters above

## Commands
- `npm run dev` — start dev server
- `npm run build` / `npm run lint` — run before handing in
