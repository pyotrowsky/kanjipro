#!/usr/bin/env python3
import json
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "data" / "kanji_quiz_database_v3.json"
db = json.loads(p.read_text(encoding="utf-8"))
assert len(db.get("kanji", [])) == 166, f"Unexpected kanji count: {len(db.get('kanji', []))}"
assert db.get("vocabulary"), "Vocabulary is empty"
assert db.get("lesson_summary"), "Lesson summary is empty"
print(f"OK: {len(db['kanji'])} kanji, {len(db['vocabulary'])} vocabulary entries, {len(db['lesson_summary'])} lessons")
