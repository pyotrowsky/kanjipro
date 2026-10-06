# Kanji Trainer

Statyczna aplikacja do ćwiczenia kanji i słownictwa z podręczników Doki Doki.

## Struktura

```text
kanji-trainer/
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
cd kanji-trainer
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
