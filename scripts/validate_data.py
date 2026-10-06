#!/usr/bin/env python3
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = root / "data" / "kanji_quiz_database.json"
d = json.loads(p.read_text(encoding="utf-8"))

required = {"meta", "kanji", "vocabulary", "quiz_lessons"}
missing = required - d.keys()
assert not missing, f"Brak kluczy: {sorted(missing)}"
assert not d.get("validation_issues"), f"Baza ma błędy walidacji: {len(d.get('validation_issues', []))}"

kanji = d["kanji"]
vocab = d["vocabulary"]
lessons = d["quiz_lessons"]
chars = [k["character"] for k in kanji]
assert len(chars) == len(set(chars)), "Duplikaty kanji"
assert len(kanji) == d["meta"]["kanji_count"], "meta.kanji_count nie zgadza się"
assert len(vocab) == d["meta"]["vocabulary_entries"], "meta.vocabulary_entries nie zgadza się"
assert len(lessons) == d["meta"]["quiz_lessons"], "meta.quiz_lessons nie zgadza się"

kmap = {k["character"]: k for k in kanji}
for l in lessons:
    assert l["target_kanji"], f"Pusty rozdział quizowy: {l['lesson']}"
    for ch in l["target_kanji"]:
        assert ch in kmap, f"Nieznane kanji {ch} w {l['lesson']}"
        assert kmap[ch]["lesson"] == l["lesson"], f"Zły rozdział dla {ch}"

for v in vocab:
    assert v.get("tracked_kanji"), f"Słówko bez śledzonego kanji: {v['note_id']} {v['surface']}"
    assert v.get("accepted_readings"), f"Słówko bez odczytu: {v['note_id']} {v['surface']}"
    assert "".join(x["text"] for x in v.get("furigana_segments", [])) == v["surface"], f"Segmenty != surface: {v['note_id']}"

print(f"OK: {len(kanji)} kanji · {len(vocab)} słówek · {len(lessons)} rozdziałów quizowych")
