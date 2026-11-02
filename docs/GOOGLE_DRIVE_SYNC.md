# Kanji.pro 3.14 — Google Drive sync (PWA)

## Zakres

- Lokalny IndexedDB + localStorage pozostaje domyślnym źródłem danych podczas pracy offline.
- Opcjonalne połączenie własnego konta Google na każdym urządzeniu, za zgodą użytkownika.
- Dla każdego urządzenia osobny plik `kanjipro-sync-v1-<deviceId>.json` w **ukrytym** katalogu Google Drive `appDataFolder`.
- Po połączeniu aplikacja scala historie i identyfikowane zdarzenia. Przy aktywnym tokenie wykonuje synchronizację po sesji. Pliki każdego urządzenia są zapisywane niezależnie, więc dwa urządzenia nie nadpisują wzajemnie jednego pliku.
- Nie jest wymagany własny serwer, ale **wymagany jest Google Cloud OAuth Client ID właściciela aplikacji**. Każdy użytkownik autoryzuje WŁASNE konto Google; nie zakłada własnego projektu Google Cloud.

## Pierwsza konfiguracja właściciela strony

1. Wejdź do [Google Cloud Console](https://console.cloud.google.com/), utwórz projekt i włącz **Google Drive API**.
2. Skonfiguruj *Google Auth Platform* (OAuth consent screen). Dla aplikacji zewnętrznej ustaw uprawnienie `https://www.googleapis.com/auth/drive.appdata`. Jeżeli projekt jest w trybie Testing, dodaj swoje konto i konta testerów. Produkcyjna publikacja i weryfikacja wymaga osobnej oceny zasad Google.
3. Utwórz **OAuth Client ID → Web application** i dodaj dokładny adres hostingu Kanji.pro do *Authorized JavaScript origins* (np. `https://pyotrowsky.github.io` dla GitHub Pages; NIE dodawaj ścieżki repozytorium).
4. Wprowadź publiczny identyfikator klienta `...apps.googleusercontent.com` do pliku `data/cloud-config.json` jako `google_client_id`. **Nie umieszczaj tam client secret**.
5. Opublikuj zmieniony plik. W Kanji.pro otwórz Ustawienia → Google Drive → Połącz konto. Po połączeniu użytkownik zobaczy stan synchronizacji.

## Co jest synchronizowane

Dla połączonych urządzeń: historia zaliczeń słówek, dane RSS, aktywne błędy (w tym ON/KUN), nowe poprawne/błędne odpowiedzi. Ustawienia pisania, czcionki i wybór rozdziałów pozostają lokalne.

W pierwszym połączeniu bieżąca historia urządzenia jest zachowywana jako niezmienny stan początkowy (*seed*). Aby nie policzyć dwukrotnie historii importowanej wcześniej między urządzeniami, stany początkowe scalane są zachowawczo (największa liczba powtórzeń per słówko; złączenie unikatowych zapisów czasu). Nowe odpowiedzi po pierwszym połączeniu mają identyfikatory zdarzeń i nie są podwajane.

## Ograniczenia i bezpieczeństwo

- OAuth w samej przeglądarce wymaga obecności użytkownika. Access token przechowujemy **tylko w pamięci**, a po przeładowaniu strony / wygaśnięciu tokenu użytkownik może wymagać ponownego kliknięcia „Połącz”. Nie obiecujemy bezobsługowego odnawiania sesji Google w tle.
- Po utracie internetu zapisy lokalne działają dalej. Nowe zdarzenia czekają w dzienniku na ręczną lub automatyczną synchronizację przy kolejnym aktywnym połączeniu.
- Dane w ukrytym `appDataFolder` nie są widoczne na zwykłej liście plików Dysku i są przypisane do konkretnej aplikacji OAuth.
- Synchronizacja nie jest szyfrowaniem end-to-end. Podlega ochronie konta Google i HTTPS.
- Nie otwieraj wielu zakładek Kanji.pro jednocześnie na tym samym urządzeniu podczas synchronizacji, ponieważ wersja MVP nie zawiera blokady wielokartowej.
- Ręczny import kopii JSON podczas korzystania z Google Sync wymaga ostrożności: kolejna synchronizacja może ponownie scalić stare rekordy. Zachowaj kopię przed importem.
- Dzienniki urządzeń obecnie przechowują historię zdarzeń i wymagają okresowej kompaktacji przy bardzo dużych zbiorach; aplikacja sygnalizuje przekroczenie limitu 4 MB.

## Dokumentacja Google

- https://developers.google.com/workspace/drive/api/guides/appdata
- https://developers.google.com/identity/oauth2/web/guides/use-token-model
- https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model
