# Dane aplikacji

`kanji_quiz_database.json` jest bazą runtime ładowaną przez WSJJ Kanji.pro.

Nie edytuj jej ręcznie. Jest generowana z trzech eksportów w `imports/` przez:

```bash
python3 scripts/rebuild_database.py
python3 scripts/validate_data.py
```

Folder `source/` zawiera pliki pomocnicze do kontroli: CSV, SQLite, raport buildu i listę potencjalnie wieloznacznych promptów.
