# WSJJ Kanji.pro

Statyczna aplikacja do ćwiczenia kanji i słownictwa z podręczników Doki Doki.

## Struktura

```text
wsjj-kanji-pro/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── data/
│   ├── kanji_quiz_database_v3.json   # baza używana przez aplikację
│   └── source/                       # pliki pomocnicze / audyt bazy
│       ├── kanji_quiz_v3.sqlite
│       ├── quiz_questions.csv
│       ├── lesson_summary.csv
│       ├── deferred_vocab_questions.csv
│       ├── kanji_quiz_readings.csv
│       ├── validation_issues.csv
│       └── README.md
├── .gitignore
└── README.md
```

## Uruchomienie lokalne

Aplikacja ładuje bazę JSON przez `fetch()`, więc najlepiej uruchomić prosty lokalny serwer zamiast otwierać `index.html` przez `file://`.

Na macOS / Linux:

```bash
cd wsjj-kanji-pro
python3 -m http.server 8000
```

Następnie otwórz w przeglądarce:

```text
http://localhost:8000
```

## GitHub Pages

Repozytorium jest gotowe do hostowania bez procesu buildowania.

1. Wrzuć cały katalog do repozytorium GitHub.
2. Wejdź w **Settings → Pages**.
3. Wybierz **Deploy from a branch**.
4. Wskaż gałąź `main` i katalog `/ (root)`.

Po wdrożeniu `index.html` będzie ładował bazę z `data/kanji_quiz_database_v3.json`.

## Dane

Plik `data/kanji_quiz_database_v3.json` jest bieżącą bazą runtime aplikacji. Pole `KnownKanji` ze starych eksportów Anki nie jest używane.

Baza zawiera 166 kanji oraz przefiltrowane słownictwo. Furigana jest generowana w interfejsie na podstawie ustawionego trybu (zaznaczone kanji albo poziom rozdziału).

Pliki w `data/source/` są pomocnicze i służą do kontroli/analizy danych; aplikacja ich bezpośrednio nie ładuje.


## Instalacja na urządzeniu mobilnym (PWA)

Po opublikowaniu repo przez GitHub Pages:

**iOS / iPadOS:** otwórz stronę w Safari → **Udostępnij** → **Dodaj do ekranu początkowego** → **Dodaj**.

**Android:** otwórz stronę w Chrome → menu **⋮** → **Zainstaluj aplikację** lub **Dodaj do ekranu głównego** → potwierdź.

Aplikacja ma własny manifest, ikonę, tryb `standalone` i service workera. Po pierwszym poprawnym załadowaniu może uruchamiać się z pamięci podręcznej także bez połączenia z siecią.

### Pliki PWA

- `manifest.webmanifest` — nazwa, kolory, ikony i tryb aplikacji.
- `sw.js` — cache/offline.
- `icons/` — ikony dla iOS i innych platform.
- `index.html` — zawiera metadane Apple Web App i odnośnik do manifestu.
