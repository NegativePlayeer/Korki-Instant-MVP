# Korki Instant

MVP funkcji „Korki Instant” dla zadaniazmatur.pl: maturzysta utknął na zadaniu, zamawia 45-minutową lekcję, korepetytor widzi zgłoszenie, przyjmuje je i rozpoczyna lekcję na wspólnej tablicy osadzonej bezpośrednio w aplikacji.

**Stos:** Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase (Postgres)

## 🚀 Szybki Start

### 1. Instalacja

```bash
npm install
```

### 2. Supabase

1. Załóż projekt na [supabase.com](https://supabase.com).
2. Otwórz **SQL Editor**, wklej całą zawartość [`supabase/schema.sql`](supabase/schema.sql) i kliknij **Run**.
   Skrypt tworzy tabele `profiles` i `lessons`, ograniczenia, indeksy, nadaje uprawnienia roli `service_role` oraz wstawia 6 profili testowych (3 uczniów, 3 korepetytorów). Można go uruchomić ponownie: czyści dane i tworzy je od nowa. To najprostszy sposób na reset przed testami.
3. W **Project Settings → API Keys** skopiuj adres projektu (**Project URL**) oraz klucz **secret** (zaczyna się od `sb_secret_`; w starszym panelu to `service_role`). Nie używaj kluczy `publishable` / `anon`.

### 3. Zmienne środowiskowe

Skopiuj `.env.example` do `.env.local` i uzupełnij:

```
SUPABASE_URL=https://twoj-projekt.supabase.co
SECRET_KEY=sb_secret_...
```

> Wartości wpisuj **bez cudzysłowów** i bez spacji wokół `=`. Po zmianie `.env.local` zrestartuj `npm run dev`.
> Klucz secret trafia wyłącznie do kodu serwerowego (`import "server-only"`) i nigdy do przeglądarki.

### 4. Uruchomienie

```bash
npm run dev      # http://localhost:3000
npm run build    # build produkcyjny
npm run lint
```

## 🏗️ Architektura i Wybrany Backend

**Backend: Supabase (Postgres)**, wywoływany **wyłącznie z kodu serwerowego** Next.js przez `@supabase/supabase-js`. Przeglądarka rozmawia tylko z naszym API (`/api/*`), a nie z bazą.

Dlaczego Supabase: to zwykły Postgres, więc stan lekcji, ograniczenia i unikalne indeksy da się egzekwować **w bazie**, a nie tylko w kodzie. Dzięki temu jest to prawdziwa gwarancja przy równoległych żądaniach. Do tego darmowy plan i jeden SQL do odtworzenia środowiska.

```
Przeglądarka (React)
   │  fetch /api/...   (nagłówki x-profile-id, x-role)
   ▼
Route Handlers  app/api/**        ← cienkie: parsowanie żądania + kody HTTP
   ▼
lib/lessons.ts                    ← CAŁA logika biznesowa i walidacja
   ▼
lib/supabase.ts  (klucz secret, server-only)
   ▼
Postgres: profiles, lessons  (CHECK, indeks unikalny, RLS włączone bez polityk)
```

| Plik | Rola |
|---|---|
| `lib/lessons.ts` | Reguły biznesowe: walidacja, limity, przyjęcie zgłoszenia, przejścia statusów, link do tablicy |
| `lib/api.ts` | Zamiana wyniku / `LessonError` na JSON `{ error }` z właściwym kodem HTTP |
| `app/api/profiles`, `app/api/lessons`, `app/api/lessons/[id]/[action]` | Cienkie endpointy |
| `components/*` | UI po polsku: widok ucznia, korepetytora, pokój lekcji, stany ładowania / pustki / błędu |
| `supabase/schema.sql` | Schemat, constrainty, seed |

**Bezpieczeństwo i uproszczenia MVP**

- **Brak prawdziwego logowania** (zgodnie z zadaniem). Rola i profil testowy wybierane są w nagłówku strony i zapamiętywane w `localStorage`. Frontend wysyła je w nagłówkach `x-profile-id` / `x-role`, a serwer **weryfikuje w bazie**, że profil istnieje i ma deklarowaną rolę. Nie jest to autoryzacja: ktoś znający ID profilu może się pod niego podszyć. W produkcji zastąpiłoby to Supabase Auth.
- RLS jest włączone **bez polityk**, więc klucze publiczne nie mają dostępu do tabel. Dostęp ma tylko serwer z kluczem secret.
- Klucz secret nie trafia do bundla klienta.

### Ograniczenia i dalsze kroki

- **Brak prawdziwej autoryzacji.** Docelowo Supabase Auth i polityki RLS.
- **Odświeżanie przez polling** (5 s lista, 2 s pokój). Docelowo Supabase Realtime.
- **Zawartość tablicy nie jest zapisywana.** W bazie są tylko adresy URL pokoi. Kolejny krok to zapis zrzutów tablicy do Supabase Storage po zakończeniu lekcji (poza zakresem MVP).
- **Tablica pamięta ostatni rysunek w przeglądarce.** Excalidraw (hostowany na excalidraw.com) zapisuje ostatni rysunek we własnym `localStorage` i może wgrać go do nowego, pustego pokoju. Aplikacja nie ma dostępu do tego storage (inna domena). Próba izolacji ramki przez `sandbox` zepsuła tablicę, więc z niej zrezygnowano. Objawia się to tylko w jednej przeglądarce używanej do wielu lekcji (np. podczas testów na jednym komputerze). Obejście: wyczyścić tablicę przyciskiem kosza w Excalidrawie na początku lekcji. Docelowo własna instancja Excalidraw z własną synchronizacją.
- **Brak wideo.** Aplikacja zapewnia tylko wspólną tablicę. Rozmowa wymaga osobnego narzędzia (telefon, komunikator).
- **Zakończenie pokoju dotyczy osadzonej ramki.** Aplikacja nie zamknie sesji, którą ktoś otworzył ręcznie w osobnej karcie pod tym samym adresem.
- Brak płatności, powiadomień e-mail i ocen korepetytorów (poza zakresem zadania).

## 🧠 Logika Biznesowa i Przepływ (User Flow)

### Statusy lekcji

```
pending ──claim──▶ accepted ──start──▶ in_progress ──complete──▶ completed
   │                  │
   └──────cancel──────┴──▶ cancelled     (anuluje uczeń; tylko przed startem)
```

Dozwolone są wyłącznie te przejścia. Każde jest jednym warunkowym `UPDATE` (`where id = … and status in (…) and <właściciel>`), więc nie ma wyścigu „odczytaj, potem zapisz”. Dodatkowo kolumna `status` ma `CHECK` w bazie.

### Funkcje

1. **Zamówienie lekcji (uczeń).** Przedmiot, opis zadania (10–1000 znaków) i opcjonalny termin (nie z przeszłości). Walidacja po stronie serwera, a błędy wracają do formularza. Przycisk blokuje się na czas wysyłania (ochrona przed double-click). Uczeń może mieć najwyżej **3 otwarte zgłoszenia** (`pending`), co chroni kolejkę przed spamem.
2. **Kolejka i przyjęcie (korepetytor).** Korepetytor widzi otwarte zgłoszenia i przyjmuje jedno. Przyjęcie jest **atomowe**: `update lessons set tutor_id=…, status='accepted' where id=… and status='pending'`. Jeśli żaden wiersz się nie zmienił, odpowiedź to **409 „zgłoszenie już przyjęte”** (lub 404, gdy ID nie istnieje). Dwóch korepetytorów klikających jednocześnie: wygrywa jeden.
3. **Cykl życia.** Statusy widoczne jako kolorowe znaczniki po obu stronach. Uczeń może anulować `pending` i `accepted` (także po przyjęciu przez korepetytora). Korepetytor widzi wtedy na karcie komunikat o anulowaniu i może przyjąć kolejne zgłoszenie.
4. **Start lekcji.** Korepetytor klika „Rozpocznij spotkanie”. Generowany jest pokój wspólnej tablicy Excalidraw (oraz adres pokoju wideo `https://meet.jit.si/korki-<id>`, zapisywany w bazie, ale nieużywany w UI). **W bazie zapisywane są tylko adresy URL**, nigdy zawartość tablicy. Obie strony wchodzą do „pokoju lekcji” z osadzoną tablicą. Po kliknięciu „Zakończ lekcję” przez korepetytora lekcja przechodzi w `completed`, a pokój zamyka się u obu stron (po kolejnym odświeżeniu, do ok. 2 s).
5. **Usuwanie z listy (soft delete).** Zakończoną lub anulowaną lekcję każda ze stron może usunąć **tylko z własnej listy** (flagi `hidden_by_student` / `hidden_by_tutor`). Wiersz zostaje w bazie, a druga strona zachowuje historię.

### Przypadki brzegowe

| Sytuacja | Zachowanie |
|---|---|
| Podwójne przyjęcie zgłoszenia | 409, wygrywa pierwszy |
| Korepetytor ma już aktywną lekcję (`accepted` / `in_progress`) | 409. Gwarantuje to **unikalny indeks w bazie**, nie tylko kod |
| Uczeń anuluje po przyjęciu | dozwolone, korepetytor widzi komunikat |
| Anulowanie lub inna akcja w złym statusie | 409 z opisem statusu |
| Cudza lekcja | 403 |
| Nieznane ID, błędny format ID, nieznana akcja | 404 |
| Pusty lub za krótki opis, brak przedmiotu, termin z przeszłości | 400 |
| Więcej niż 3 otwarte zgłoszenia ucznia | 409 |
| Double-click na „Zamów” / akcjach | zablokowane w UI (jedna akcja naraz) |
| Usunięcie aktywnej lekcji | 409 |

### Przepływ użytkownika

1. **Uczeń** wybiera przedmiot, opisuje zadanie i wysyła zgłoszenie. Widzi je jako „Oczekuje”.
2. **Korepetytor** widzi zgłoszenie w kolejce i klika „Przyjmij zgłoszenie”. Uczeń widzi „Przyjęta”.
3. Korepetytor klika „Rozpocznij spotkanie”, a status zmienia się na „W trakcie”.
4. Obie strony klikają „Wejdź do lekcji” i pracują na wspólnej tablicy.
5. Korepetytor klika „Zakończ lekcję”. Pokój się zamyka, a status to „Zakończona”.

## 🧪 Jak przetestowano projekt

Projekt testowano **ręcznie** (UI) oraz **skryptami `curl`** na żywej bazie Supabase. Nie ma automatycznych testów jednostkowych ani e2e. Przy 90-minutowym limicie priorytetem była poprawność reguł w bazie i na serwerze.

**Co sprawdzono przez API (`curl`):** walidacja pól (400), role (403), limit 3 zgłoszeń (409), wyścig dwóch korepetytorów o to samo zgłoszenie, reguła jednej aktywnej lekcji (409 z indeksu bazy), pełna ścieżka `pending → accepted → in_progress → completed`, pominięcie kroku i powtórzenie akcji (409), cudze lekcje (403), błędne ID i akcje (404), generowanie linków po starcie, listy dla obu ról.

**Stany UI:** ładowanie, pusty widok, błąd (z przyciskiem „Spróbuj ponownie”) w obu widokach, komunikaty błędów z serwera pokazywane użytkownikowi.

**Powtarzalność:** testy tworzą dane w bazie. Aby zacząć od czystego stanu, uruchom ponownie [`supabase/schema.sql`](supabase/schema.sql).

### Ścieżka klikana dla recruitera

Przygotuj **dwie karty przeglądarki** na `http://localhost:3000` (jedna jako uczeń, druga jako korepetytor). Wybór roli i profilu jest w nagłówku.

1. **Karta A: Uczeń → Ola Nowak.** Spróbuj wysłać pusty formularz (błąd), potem wypełnij go i kliknij „Zamów korepetycje”. Zgłoszenie pojawia się jako „Oczekuje”.
2. **Limit:** wyślij kolejne zgłoszenia. Czwarte otwarte dostanie komunikat o limicie 3.
3. **Karta B: Korepetytor → dr Anna Kowalska.** Zgłoszenia ucznia są w kolejce (odświeżanie co 5 s).
4. **Wyścig:** w karcie B wybierz Annę, w trzeciej karcie wybierz „Ewa Mazur”. Obie klikają „Przyjmij” na tym samym zgłoszeniu. Jedna dostaje komunikat „zostało już przyjęte”.
5. **Aktywna lekcja:** Anna z przyjętą lekcją próbuje przyjąć drugą. Dostaje komunikat o aktywnej lekcji.
6. **Anulowanie:** uczeń anuluje przyjętą lekcję. Korepetytor widzi czerwony komunikat „Uczeń anulował tę lekcję”.
7. **Start:** przyjmij kolejne zgłoszenie i kliknij „Rozpocznij spotkanie”. Status zmienia się na „W trakcie”.
8. **Pokój:** obie strony klikają „Wejdź do lekcji”. Pojawia się wspólna tablica (Excalidraw). Rysunek jednej strony powinien być widoczny u drugiej.
9. **Zakończenie:** korepetytor klika „Zakończ lekcję”. U obu stron pokój się zamyka z komunikatem „Lekcja została zakończona”.
10. **Usuwanie:** kliknij „Usuń z listy” przy zakończonej lub anulowanej lekcji. Znika tylko z Twojej listy, a druga strona dalej ją widzi.
