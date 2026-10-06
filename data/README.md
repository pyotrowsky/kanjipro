# Dane aplikacji

`kanji_quiz_database_v3.json` jest jedynym plikiem danych ładowanym przez frontend.

Folder `source/` zawiera materiały pomocnicze z etapu budowania bazy: CSV-y, SQLite, raport pytań odroczonych i walidację. Nie są potrzebne do działania strony, ale warto je trzymać w repo jako źródło audytowe.

Uwaga: pole `meta.rules` wewnątrz JSON opisuje zasady z chwili wygenerowania bazy v3. Aktualne zasady wyboru głównych kanji, furigany i limitu sesji są implementowane w `js/app.js`.
