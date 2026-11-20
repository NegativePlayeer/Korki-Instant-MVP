-- Korki Instant — schemat bazy. Wklej w Supabase -> SQL Editor -> Run.
-- Skrypt można uruchomić ponownie (czyści i tworzy od nowa).

drop table if exists lessons;
drop table if exists profiles;

-- Profile testowe (brak logowania — przełącznik roli wybiera jeden z nich)
create table profiles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  role       text not null check (role in ('student', 'tutor'))
);

create table lessons (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references profiles(id),
  tutor_id      uuid references profiles(id),
  subject       text not null check (char_length(subject) between 1 and 60),
  description   text not null check (char_length(description) between 10 and 1000),
  preferred_at  timestamptz,                       -- null = "jak najszybciej"
  status        text not null default 'pending'
                check (status in ('pending', 'accepted', 'in_progress', 'completed', 'cancelled')),
  meeting_url   text,                              -- tylko link, nigdy zawartość tablicy
  whiteboard_url text,
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  started_at    timestamptz,
  completed_at  timestamptz,
  cancelled_at  timestamptz,
  -- "Delete" hides a finished lesson from one side's list; the other side keeps its history
  hidden_by_student boolean not null default false,
  hidden_by_tutor   boolean not null default false,

  -- Lekcja przyjęta/trwająca/zakończona musi mieć korepetytora
  constraint tutor_required check (
    status in ('pending', 'cancelled') or tutor_id is not null
  ),
  -- Linki istnieją dopiero po starcie lekcji
  constraint links_after_start check (
    status in ('pending', 'accepted', 'cancelled') or meeting_url is not null
  )
);

-- Twarda gwarancja w bazie: korepetytor ma maks. jedną aktywną lekcję naraz.
-- Nawet gdyby kod aplikacji miał błąd, baza odrzuci drugą.
create unique index one_active_lesson_per_tutor
  on lessons (tutor_id)
  where status in ('accepted', 'in_progress');

create index lessons_status_idx  on lessons (status, created_at);
create index lessons_student_idx on lessons (student_id);

-- RLS włączone bez polityk: dostęp tylko przez klucz secret z serwera Next.js.
-- Klucze publiczne (anon) nie mają żadnego dostępu do tych tabel.
alter table profiles enable row level security;
alter table lessons  enable row level security;

-- Newer Supabase projects do not grant table access automatically.
-- The server (secret key = service_role) needs it; anon/authenticated get nothing.
grant select, insert, update, delete on profiles, lessons to service_role;

-- Dane testowe
insert into profiles (name, role) values
  ('Ola Nowak',        'student'),
  ('Kuba Wiśniewski',  'student'),
  ('Marta Zielińska',  'student'),
  ('dr Anna Kowalska', 'tutor'),
  ('mgr Piotr Lis',    'tutor'),
  ('Ewa Mazur',        'tutor');
