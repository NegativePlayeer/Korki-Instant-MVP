# TODO / znane problemy

Notatki z testów ręcznych. Stan na koniec etapu MVP.

## Do zrobienia

- [ ] **Tablica pamięta stare rysunki.** Excalidraw (excalidraw.com) zapisuje ostatni rysunek we własnym `localStorage` i wgrywa go do nowego, pustego pokoju. Widoczne, gdy jedna przeglądarka obsługuje wiele lekcji (np. korepetytor), a w skrajnym przypadku rysunek jednego ucznia może trafić do następnego.
  - Próby, które nie zadziałały: atrybut `credentialless` na ramce (bez efektu) oraz `sandbox` bez `allow-same-origin` (tablica pusta, uczeń nic nie widział).
  - Obejście: wyczyścić tablicę (kosz) na początku lekcji.
  - Docelowo: własny komponent `@excalidraw/excalidraw` bez zapisu do localStorage albo z kluczem per lekcja (`whiteboard-${lessonId}`). Wymaga synchronizacji między stronami (np. Supabase Realtime Broadcast, bez zapisu w bazie), bo inaczej uczeń i korepetytor nie widzą swoich rysunków. Do przemyślenia architektura; na MVP może to być overkill.
- [ ] **Kolejka i spam dla korepetytora.** Limit 3 otwartych zgłoszeń jest per uczeń, nie globalny. Kolejka pokazuje wszystko (od najstarszych), bez stronicowania i filtru po przedmiocie, a każdy korepetytor odpytuje serwer co 5 s. Do sprawdzenia przy wielu uczniach. Pomysły: filtr po przedmiocie, limit i stronicowanie, wygasanie starych zgłoszeń, powiadomienia zamiast pollingu.
- [ ] **Pole `meeting_url`** jest zapisywane, ale nieużywane w UI (wideo usunięto). Constraint `links_after_start` w `schema.sql` nadal je wymaga. Usunąć razem z constraintem albo zostawić.

## Świadome uproszczenia MVP

- Brak prawdziwej autoryzacji: profil i rola przekazywane nagłówkami `x-profile-id` / `x-role`, serwer sprawdza je tylko względem bazy. Docelowo Supabase Auth i polityki RLS.
- Odświeżanie przez polling (5 s lista, 2 s pokój). Docelowo Supabase Realtime.
- Zawartość tablicy nie jest zapisywana, tylko adres pokoju. Zrzuty do Supabase Storage to kolejny krok.
- Brak wideo. Rozmowa wymaga osobnego narzędzia.

## Zrobione po testach

- [x] Zakończenie lekcji zamyka pokój u obu stron.
- [x] Większa ramka tablicy (pełna szerokość).
- [x] Komunikat dla korepetytora, gdy uczeń anuluje lekcję.
- [x] Usuwanie zakończonych i anulowanych lekcji z listy (soft delete per strona).
- [x] Wideo usunięte z pokoju lekcji.
- [x] Uprawnienia `service_role` do tabel dopisane do `schema.sql`.
