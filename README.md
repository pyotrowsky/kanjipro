# WSJJ Kanji.pro

Statyczna aplikacja/PWA do ćwiczenia kanji i słownictwa z podręczników Doki. Repo zawiera frontend, eksporty z Anki oraz generator bazy.

## Struktura

```text
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── icons/
├── manifest.webmanifest
├── sw.js
├── imports/
│   ├── kanji.csv
│   ├── vocabulary_old.csv
│   └── vocabulary_new.csv
├── data/
│   ├── kanji_quiz_database.json
│   └── source/
├── scripts/
│   ├── rebuild_database.py
│   └── validate_data.py
└── .github/workflows/
    └── rebuild-and-deploy.yml
```

## Najprostsza aktualizacja bazy

Nie edytuj `data/kanji_quiz_database.json` ręcznie.

1. W Anki wyeksportuj ponownie:
   - `Japanese (Kanji)`
   - `Japanese (triple cards)`
   - `Japanese (triple cards - new)`
2. Zmień nazwy plików odpowiednio na:
   - `kanji.csv`
   - `vocabulary_old.csv`
   - `vocabulary_new.csv`
3. Na GitHubie otwórz folder `imports/`.
4. **Add file → Upload files** i wgraj trzy nowe pliki, zastępując stare.
5. **Commit changes**.

Po commicie GitHub Actions automatycznie:

1. uruchomi `scripts/rebuild_database.py`,
2. wyczyści i przebuduje bazę,
3. uruchomi walidację,
4. opcjonalnie zapisze wygenerowane pliki `data/` z powrotem do repo,
5. opublikuje nową wersję przez GitHub Pages.

Jeśli walidacja wykryje niespójność w nowych danych, deployment zatrzyma się zamiast opublikować uszkodzoną bazę.

## Jednorazowe ustawienie GitHub Pages

Dla workflow z tego repo ustaw:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

Od tego momentu workflow `Rebuild database and deploy Pages` publikuje aplikację bezpośrednio.

## Lokalna przebudowa

Wymagany jest tylko Python 3; nie ma zewnętrznych pakietów.

```bash
python3 scripts/rebuild_database.py
python3 scripts/validate_data.py
```

Uruchomienie strony lokalnie:

```bash
python3 -m http.server 8000
```

Następnie otwórz `http://localhost:8000`.

Nie otwieraj `index.html` bezpośrednio przez `file://`, ponieważ przeglądarka może wtedy blokować `fetch()` bazy JSON i service workera.

## Reguły generatora

- `KnownKanji` jest całkowicie ignorowane.
- `imports/kanji.csv` jest jedynym źródłem informacji, które kanji należą do kursu i w którym rozdziale są wprowadzane.
- Słówko zostaje tylko wtedy, gdy zawiera przynajmniej jedno kanji z kursu.
- Dopiski pomocnicze takie jak `(な)`, `(に)`, `*`, `～` są usuwane z kanonicznego promptu.
- Furigana jest zapisywana segmentami; jej widoczność jest wyliczana dynamicznie przez frontend.
- Odczyty ON/KUN i słówek są normalizowane do sprawdzania odpowiedzi.

## PWA i aktualizacje

Baza używa strategii **network-first**. Gdy urządzenie ma internet, aplikacja pobiera aktualny `data/kanji_quiz_database.json`; gdy jest offline, korzysta z ostatniej zapisanej kopii. Pozostałe pliki aplikacji są cachowane do działania offline.

## Ważne przy publicznym repo

Jeżeli repozytorium jest publiczne, pliki w `imports/` również są publicznie widoczne na GitHubie. Sam artefakt GitHub Pages zawiera tylko aplikację i gotową bazę runtime, ale źródłowe eksporty nadal pozostają częścią publicznego repo.
