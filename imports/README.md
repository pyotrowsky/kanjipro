# Importy z Anki

Do aktualizacji bazy podmień **dokładnie te trzy pliki**:

- `kanji.csv` — eksport notatek `Japanese (Kanji)`
- `vocabulary_old.csv` — eksport `Japanese (triple cards)`
- `vocabulary_new.csv` — eksport `Japanese (triple cards - new)`

Pliki z Anki mają rozszerzenie `.csv`, ale w praktyce są eksportem tab-separated (TSV). To jest prawidłowe — nie otwieraj i nie zapisuj ich ponownie w Excelu przed wrzuceniem.

## Aktualizacja przez stronę GitHub

1. Wyeksportuj ponownie trzy typy notatek z Anki.
2. Zmień nazwy eksportów na trzy nazwy powyżej.
3. Na GitHubie wejdź do folderu `imports/`.
4. Użyj **Add file → Upload files** i przeciągnij trzy nowe pliki (zastępując stare).
5. Kliknij **Commit changes**.

Workflow `.github/workflows/rebuild-and-deploy.yml` automatycznie przebuduje bazę, sprawdzi ją i opublikuje nową wersję strony.

`KnownKanji` jest ignorowane przez generator.
