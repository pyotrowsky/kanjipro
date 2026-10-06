# Kanji Quiz Database v3

Baza przygotowana bezpośrednio pod silnik quizu.

## Zawartość
- 166 kanji
- 1191 źródłowych notatek słownikowych (1193 rekordów po rozdzieleniu 2 notatek typu A/B)
- 11 rozdziałów z kanji
- 1475 aktywnych pytań łącznie we wszystkich pulach rozdziałowych
- 56 odroczonych pytań VOCAB, w których bezpieczna częściowa furigana nie jest możliwa bez zdradzenia odczytu ćwiczonego kanji
- 0 błędów walidacji powierzchnia↔furigana

## Reguły
1. `KnownKanji` jest ignorowane.
2. W rozdziale N ćwiczone są kanji wprowadzone dokładnie w N.
3. Za znane uznawane są kanji z N i wszystkich wcześniejszych rozdziałów.
4. Słowo może trafić do puli VOCAB, jeśli zostało wprowadzone nie później niż N i zawiera co najmniej jedno kanji z N.
5. Furigana jest pokazywana tylko nad niepoznanym kanji / blokiem zawierającym niepoznane kanji.
6. Jeśli blok ruby obejmuje jednocześnie ćwiczone i niepoznane kanji, pytanie jest odraczane dla tego rozdziału, aby furigana nie zdradziła odpowiedzi.
7. Dla ON/KUN akceptowana jest dowolna z odczytanych wartości zapisanych w bazie.
8. Normalizacja odpowiedzi: katakana→hiragana, usunięcie spacji i znaczników okurigany `.`/`・`.

## Pliki
- `kanji_quiz_database_v3.json` — kompletna baza do aplikacji
- `kanji_quiz_v3.sqlite` — wersja SQLite
- `quiz_questions.csv` — wszystkie aktywne pytania w formie płaskiej
- `lesson_summary.csv` — liczebności pytań na rozdział
- `deferred_vocab_questions.csv` — pytania odroczone z powodu ryzyka podpowiedzi
- `kanji_quiz_readings.csv` — ON/KUN i odpowiedzi znormalizowane
- `validation_issues.csv` — walidacja techniczna
