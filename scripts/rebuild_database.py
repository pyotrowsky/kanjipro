#!/usr/bin/env python3
"""Rebuild WSJJ Kanji.pro runtime database from three Anki TSV exports.

The files keep the .csv extension because that is what Anki exports, but they are
TSV (tab-separated) files.

Inputs:
  imports/kanji.csv
  imports/vocabulary_old.csv
  imports/vocabulary_new.csv

Outputs:
  data/kanji_quiz_database.json
  data/source/kanji.csv
  data/source/vocabulary.csv
  data/source/lesson_summary.csv
  data/source/validation_issues.csv
  data/source/ambiguous_prompts.csv
  data/source/kanji_quiz.sqlite
  data/source/build_report.json

Important project rules:
- KnownKanji is ignored completely.
- Japanese (Kanji) notes define which kanji belong to the course and their lesson.
- Vocabulary without any tracked course kanji is excluded.
- Parenthetical Anki usage annotations such as (な), (に), (の) are removed.
- Furigana is retained as ruby segments so the frontend can decide dynamically
  which kanji should show furigana in each session.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import shutil
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPORTS = ROOT / "imports"
DATA_DIR = ROOT / "data"
SOURCE_DIR = DATA_DIR / "source"

KANJI_FILE = IMPORTS / "kanji.csv"
VOCAB_OLD = IMPORTS / "vocabulary_old.csv"
VOCAB_NEW = IMPORTS / "vocabulary_new.csv"
RUNTIME_JSON = DATA_DIR / "kanji_quiz_database.json"

LESSON_RE = re.compile(r"\bDoki(\d+)-(\d+)\b")
CJK_RE = re.compile(r"[\u3400-\u9fff\uf900-\ufaff]")
HTML_RE = re.compile(r"<[^>]*>")
BRACKET_RE = re.compile(r"\[[^\]]*\]")
FURI_TOKEN_RE = re.compile(r"([^\s\[\]]+)\[([^\]]+)\]|([^\s]+)")
PLACEHOLDER_EDGE_RE = re.compile(r"^[~～〜]+|[~～〜]+$")

# Known historical source irregularities. Note IDs are stable across Anki exports.
SURFACE_PATCH = {
    "1783671317860": "話しかた",
}
MANUAL_SEGMENTS = {
    "1781519740994": [("持", "も"), ("っていく", None)],
    "1781607717796": [("気", "き"), ("持", "も"), ("ちがいい", None)],
    "1781607717797": [("気", "き"), ("持", "も"), ("ちが", None), ("悪", "わる"), ("い", None)],
    "1781696679989": [("建", "た"), ("てる", None)],
    "1783671317860": [("話", "はな"), ("しかた", None)],
}


def die(msg: str, code: int = 2) -> None:
    print(f"ERROR: {msg}", file=sys.stderr)
    raise SystemExit(code)


def read_tsv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        die(f"Brak pliku: {path.relative_to(ROOT)}")
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter="\t"))
    if not rows:
        die(f"Plik jest pusty: {path.relative_to(ROOT)}")
    return rows


def parse_lesson(tags: str | None):
    m = LESSON_RE.search(tags or "")
    if not m:
        return None
    return int(m.group(1)), int(m.group(2))


def clean_html(s: str | None) -> str:
    return HTML_RE.sub("", html.unescape(s or ""))


def strip_furigana(s: str | None) -> str:
    return "".join(BRACKET_RE.sub("", clean_html(s)).split())


def clean_text(s: str | None) -> str:
    return html.unescape(s or "").replace("\u00a0", " ")


def pattern_markers(*values: str | None) -> tuple[str, str]:
    """Return normalized visible pattern markers from source edges.

    The marker is metadata/display only: it is not part of the canonical
    vocabulary surface used for kanji matching and validation.
    """
    prefix = suffix = ""
    for value in values:
        s = clean_text(value).strip()
        if re.match(r"^[~～〜]+", s):
            prefix = "～"
        if re.search(r"[~～〜]+$", s):
            suffix = "～"
    return prefix, suffix


def clean_surface(s: str | None) -> str:
    s = clean_text(s).strip()
    s = PLACEHOLDER_EDGE_RE.sub("", s)
    s = s.replace("*", "")
    s = re.sub(r"\([^)]*\)|（[^）]*）", "", s)
    return "".join(s.split())


def clean_reading(s: str | None) -> str:
    s = clean_text(s).strip()
    s = PLACEHOLDER_EDGE_RE.sub("", s)
    s = s.replace("*", "")
    return "".join(s.split())


def unique_kanji(s: str) -> list[str]:
    out, seen = [], set()
    for ch in s:
        if CJK_RE.fullmatch(ch) and ch not in seen:
            seen.add(ch)
            out.append(ch)
    return out


def is_kanji_like(ch: str) -> bool:
    return bool(CJK_RE.fullmatch(ch)) or ch == "々"


def split_readings(s: str | None) -> list[str]:
    s = (s or "").strip()
    if not s:
        return []
    return [x.strip() for x in re.split(r"[,，]", s) if x.strip()]


def kata_to_hira(s: str) -> str:
    out = []
    for c in s:
        o = ord(c)
        if 0x30A1 <= o <= 0x30F6:
            out.append(chr(o - 0x60))
        else:
            out.append(c)
    return "".join(out)


def normalize_answer(s: str | None) -> str:
    s = clean_reading(s)
    s = kata_to_hira(s)
    return re.sub(r"[\s・･.．]", "", s)


def parse_raw_furigana_segments(markup: str | None) -> list[dict]:
    s = clean_html(markup or "").strip()
    segments = []
    pos = 0
    for m in FURI_TOKEN_RE.finditer(s):
        if m.start() > pos:
            gap = "".join(s[pos:m.start()].split())
            if gap:
                segments.append({"text": gap, "reading": None})
        if m.group(1) is not None:
            segments.append({"text": m.group(1), "reading": m.group(2)})
        else:
            segments.append({"text": m.group(3), "reading": None})
        pos = m.end()
    if pos < len(s):
        tail = "".join(s[pos:].split())
        if tail:
            segments.append({"text": tail, "reading": None})
    return segments


def split_mixed_ruby(text: str, reading: str | None):
    """Split ruby spanning kana + kanji when literal kana anchors make it safe.

    食べ物[たべもの] -> 食[た] + べ + 物[もの]
    今日[きょう] stays grouped because it is an all-kanji irregular reading.
    """
    if not reading or not any(is_kanji_like(c) for c in text) or all(is_kanji_like(c) for c in text):
        return [(text, reading)]

    runs = []
    for ch in text:
        typ = "K" if is_kanji_like(ch) else "L"
        if runs and runs[-1][0] == typ:
            runs[-1] = (typ, runs[-1][1] + ch)
        else:
            runs.append((typ, ch))

    if not any(t == "L" for t, _ in runs) or not any(t == "K" for t, _ in runs):
        return [(text, reading)]

    out = []
    pos = 0
    for i, (typ, txt) in enumerate(runs):
        if typ == "L":
            idx = reading.find(txt, pos)
            if idx < 0:
                return [(text, reading)]
            out.append((txt, None))
            pos = idx + len(txt)
        else:
            next_lit = next((runs[j][1] for j in range(i + 1, len(runs)) if runs[j][0] == "L"), None)
            if next_lit is None:
                part = reading[pos:]
                if not part:
                    return [(text, reading)]
                out.append((txt, part))
                pos = len(reading)
            else:
                idx = reading.find(next_lit, pos)
                if idx < 0 or idx == pos:
                    return [(text, reading)]
                out.append((txt, reading[pos:idx]))
                pos = idx

    if pos != len(reading) or "".join(x for x, _ in out) != text:
        return [(text, reading)]
    return out


def cleaned_base_segments(note_id: str, raw_markup: str) -> list[dict]:
    if note_id in MANUAL_SEGMENTS:
        return [{"text": t, "reading": r} for t, r in MANUAL_SEGMENTS[note_id]]

    out = []
    for seg in parse_raw_furigana_segments(raw_markup):
        text = clean_text(seg.get("text", "")).strip()
        text = re.sub(r"\([^)]*\)|（[^）]*）", "", text)  # usage annotations e.g. (な), (に)
        text = text.replace("*", "")
        text = PLACEHOLDER_EDGE_RE.sub("", text)
        text = "".join(text.split())
        if not text:
            continue
        reading = seg.get("reading")
        reading = clean_reading(reading) if reading is not None else None
        for t, r in split_mixed_ruby(text, reading):
            if t:
                out.append({"text": t, "reading": r})
    return out


def enrich_segments(base: list[dict], kanji_intro: dict[str, dict]) -> list[dict]:
    enriched = []
    previous_real_kanji = []
    for seg in base:
        text, reading = seg["text"], seg.get("reading")
        kchars = unique_kanji(text)
        tracking_chars = kchars[:]
        if reading is not None and not tracking_chars and "々" in text and previous_real_kanji:
            tracking_chars = [previous_real_kanji[-1]]
        if kchars:
            previous_real_kanji = kchars

        e = {"text": text, "reading": reading, "kanji": tracking_chars}
        if reading is not None and tracking_chars:
            missing = [k for k in tracking_chars if k not in kanji_intro]
            if missing:
                e.update(always_show_furigana=True, hide_from_lesson_order=None, hide_from_lesson=None)
            else:
                maxk = max(tracking_chars, key=lambda k: kanji_intro[k]["lesson_order"])
                e.update(
                    always_show_furigana=False,
                    hide_from_lesson_order=kanji_intro[maxk]["lesson_order"],
                    hide_from_lesson=kanji_intro[maxk]["lesson"],
                )
        else:
            e.update(always_show_furigana=False, hide_from_lesson_order=None, hide_from_lesson=None)
        enriched.append(e)
    return enriched


def markup_from_segments(segs: list[dict]) -> str:
    return "".join(s["text"] + (f"[{s['reading']}]" if s.get("reading") else "") for s in segs)


def split_markup_variants(markup: str) -> list[str]:
    # Slash separators are outside [] in the known Anki source variants.
    parts, buf, depth = [], [], 0
    for ch in markup:
        if ch == "[":
            depth += 1
        elif ch == "]" and depth:
            depth -= 1
        if ch in "/／" and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return parts


def make_variant_records(v: dict, kanji_intro: dict[str, dict]) -> list[dict]:
    surface_parts = re.split(r"[/／]", v["surface"])
    markup_parts = split_markup_variants(v["furigana_markup"])
    if len(surface_parts) <= 1 or len(markup_parts) != len(surface_parts):
        v["accepted_readings"] = sorted(set(split_reading_answers(v.get("reading", ""))))
        return [v]

    raw_readings = re.split(r"[/／]", v.get("reading", ""))
    if len(raw_readings) != len(surface_parts):
        raw_readings = [v.get("reading", "")] * len(surface_parts)

    out = []
    for idx, (surface, markup, reading) in enumerate(zip(surface_parts, markup_parts, raw_readings), start=1):
        nv = dict(v)
        nv["note_id"] = f"{v['note_id']}:{idx}"
        nv["source_note_id"] = v.get("source_note_id", v["note_id"])
        nv["surface"] = surface
        nv["furigana_markup"] = markup
        nv["reading"] = reading
        base = cleaned_base_segments(v.get("source_note_id", v["note_id"]), markup)
        nv["furigana_segments"] = enrich_segments(base, kanji_intro)
        nv["all_kanji"] = unique_kanji(surface)
        nv["tracked_kanji"] = [k for k in nv["all_kanji"] if k in kanji_intro]
        nv["untracked_kanji"] = [k for k in nv["all_kanji"] if k not in kanji_intro]
        nv["accepted_readings"] = sorted(set(split_reading_answers(reading)))
        out.append(nv)
    return out


def split_reading_answers(reading: str | None) -> list[str]:
    r = clean_reading(reading)
    if not r:
        return []
    parts = [x for x in re.split(r"[/／,，]", r) if x]
    return [normalize_answer(x) for x in parts if normalize_answer(x)]


def safe_int(s: str | None):
    return int(s) if (s or "").isdigit() else None


def write_csv(path: Path, fields: list[str], rows: list[dict]):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in fields})


def build():
    kanji_rows = read_tsv(KANJI_FILE)
    old_rows = read_tsv(VOCAB_OLD)
    new_rows = read_tsv(VOCAB_NEW)

    issues: list[dict] = []

    lesson_pairs = set()
    for r in kanji_rows + old_rows + new_rows:
        p = parse_lesson(r.get("tags"))
        if p:
            lesson_pairs.add(p)
    lesson_pairs = sorted(lesson_pairs)
    lesson_order = {pair: i + 1 for i, pair in enumerate(lesson_pairs)}

    def lesson_obj(pair):
        b, c = pair
        return {"book": b, "chapter": c, "lesson": f"{b}-{c}", "lesson_order": lesson_order[pair]}

    # 1) Kanji
    kanji = []
    kanji_intro: dict[str, dict] = {}
    for r in kanji_rows:
        pair = parse_lesson(r.get("tags"))
        char = (r.get("Expression") or "").strip()
        if not pair:
            issues.append({"type": "kanji_missing_lesson", "note_id": r.get("note_id", ""), "value": char, "details": r.get("tags", "")})
            continue
        if not char:
            issues.append({"type": "kanji_missing_character", "note_id": r.get("note_id", ""), "value": "", "details": r.get("tags", "")})
            continue
        if char in kanji_intro:
            issues.append({"type": "duplicate_kanji", "note_id": r.get("note_id", ""), "value": char, "details": "duplicate character"})
            continue
        lo = lesson_obj(pair)
        onyomi = split_readings(r.get("Onyomi"))
        kunyomi = split_readings(r.get("Kunyomi"))
        rec = {
            "note_id": r.get("note_id", ""),
            "character": char,
            **lo,
            "kunyomi": kunyomi,
            "kunyomi_raw": (r.get("Kunyomi") or "").strip(),
            "onyomi": onyomi,
            "onyomi_raw": (r.get("Onyomi") or "").strip(),
            "kunyomi_display": kunyomi,
            "kunyomi_accepted": sorted(set(normalize_answer(x) for x in kunyomi if normalize_answer(x))),
            "onyomi_display": onyomi,
            "onyomi_accepted": sorted(set(normalize_answer(x) for x in onyomi if normalize_answer(x))),
            "polish": (r.get("Polish") or "").strip(),
            "notes": (r.get("Notes") or "").strip(),
            "example_html": (r.get("Example") or "").strip(),
            "example_jp": (r.get("ExampleJP") or "").strip(),
            "diagram": (r.get("Diagram") or "").strip(),
            "stroke_order_gif": (r.get("StrokeOrderGif") or "").strip(),
            "audio": (r.get("Audio") or "").strip(),
            "audio_onyomi": (r.get("AudioOnyomi") or "").strip(),
            "audio_kunyomi": (r.get("AudioKunyomi") or "").strip(),
            "source_tags": (r.get("tags") or "").strip(),
            "last_modified": safe_int(r.get("last modification time")),
        }
        kanji.append(rec)
        kanji_intro[char] = rec

    # 2) Vocabulary -> canonical, cleaned records
    vocab_base = []
    excluded_no_tracked = 0
    cleaned_records = 0
    source_total = len(old_rows) + len(new_rows)

    for source_type, rows in (("triple_cards", old_rows), ("triple_cards_new", new_rows)):
        for r in rows:
            pair = parse_lesson(r.get("tags"))
            if not pair:
                issues.append({"type": "vocab_missing_lesson", "note_id": r.get("note_id", ""), "value": r.get("Kanji", ""), "details": r.get("tags", "")})
                continue

            note_id = str(r.get("note_id", ""))
            furi_field = "ExpressionNew" if source_type == "triple_cards" else "Expression"
            ex_furi_field = "ExampleJPNew" if source_type == "triple_cards" else "ExampleJPFurigana"
            ex_plain_field = "ExampleJPnoFurigana" if source_type == "triple_cards" else "ExampleJP"

            old_surface = strip_furigana(r.get("Kanji", ""))
            raw_markup = (r.get(furi_field) or "").strip()
            raw_markup_plain = strip_furigana(raw_markup)
            pattern_prefix, pattern_suffix = pattern_markers(old_surface, raw_markup_plain)
            surface = SURFACE_PATCH.get(note_id, clean_surface(old_surface))
            display_surface = f"{pattern_prefix}{surface}{pattern_suffix}"
            base_segments = cleaned_base_segments(note_id, raw_markup)
            segments = enrich_segments(base_segments, kanji_intro)
            markup = markup_from_segments(segments)
            plain = strip_furigana(markup)

            if surface != old_surface or markup != "".join(clean_text(raw_markup).split()):
                cleaned_records += 1

            all_chars = unique_kanji(surface)
            tracked = [k for k in all_chars if k in kanji_intro]
            untracked = [k for k in all_chars if k not in kanji_intro]
            if not tracked:
                excluded_no_tracked += 1
                continue

            if plain != surface:
                issues.append({
                    "type": "surface_furigana_mismatch",
                    "note_id": note_id,
                    "value": surface,
                    "details": f"furigana_plain={plain}; markup={markup}; source_markup={raw_markup}",
                })

            lo = lesson_obj(pair)
            rec = {
                "note_id": note_id,
                "source_note_id": note_id,
                "surface": surface,
                "display_surface": display_surface,
                "pattern_prefix": pattern_prefix,
                "pattern_suffix": pattern_suffix,
                "furigana_markup": markup,
                "furigana_segments": segments,
                "reading": clean_reading(r.get("Reading", "")),
                "accepted_readings": split_reading_answers(r.get("Reading", "")),
                "romaji": (r.get("Romaji") or "").strip(),
                "polish": (r.get("Polish") or "").strip(),
                **lo,
                "all_kanji": all_chars,
                "tracked_kanji": tracked,
                "untracked_kanji": untracked,
                "example_furigana": (r.get(ex_furi_field) or "").strip(),
                "example_plain": (r.get(ex_plain_field) or "").strip(),
                "example_pl": (r.get("ExamplePL") or "").strip(),
                "verb_form_affirmative": (r.get("VerbFormAffirmative") or "").strip(),
                "verb_form_negative": (r.get("VerbFormNegative") or "").strip(),
                "notes": (r.get("Notes") or "").strip(),
                "audio": (r.get("Audio") or "").strip(),
                "example_audio": (r.get("ExampleAudio") or "").strip(),
                "audio_dictionary": (r.get("AudioDictionary") or "").strip(),
                "pitch_accent_html": (r.get("PitchAccent") or "").strip(),
                "source_note_type": source_type,
                "source_tags": (r.get("tags") or "").strip(),
                "last_modified": safe_int(r.get("last modification time")),
                "needs_surface_review": plain != surface,
            }
            vocab_base.append(rec)

    # Split source entries that intentionally contain slash-separated written variants.
    vocabulary = []
    split_source_notes = 0
    for v in vocab_base:
        variants = make_variant_records(v, kanji_intro)
        if len(variants) > 1:
            split_source_notes += 1
        for variant in variants:
            if not variant.get("tracked_kanji"):
                excluded_no_tracked += 1
                continue
            vocabulary.append(variant)

    # Recompute/validate after variant splitting.
    for v in vocabulary:
        concat = "".join(s["text"] for s in v.get("furigana_segments", []))
        if concat != v["surface"]:
            issues.append({"type": "segment_surface_mismatch", "note_id": v["note_id"], "value": v["surface"], "details": concat})
        if not v.get("accepted_readings"):
            issues.append({"type": "missing_reading", "note_id": v["note_id"], "value": v["surface"], "details": v.get("reading", "")})

    # Ambiguous visible prompts are legitimate (e.g. 時 -> じ / とき) and are warnings only.
    by_surface = defaultdict(list)
    for v in vocabulary:
        by_surface[v["surface"]].append(v)
    ambiguous = []
    for surf, rows in sorted(by_surface.items()):
        readings = sorted({a for v in rows for a in v.get("accepted_readings", [])})
        if len(readings) > 1:
            ambiguous.append({
                "surface": surf,
                "accepted_readings": " / ".join(readings),
                "note_ids": " ".join(v["note_id"] for v in rows),
            })

    # Quiz lessons: only lessons that actually introduce kanji.
    kanji_by_lesson = defaultdict(list)
    for k in kanji:
        kanji_by_lesson[k["lesson"]].append(k["character"])

    quiz_lessons = []
    known = []
    for pair in lesson_pairs:
        lo = lesson_obj(pair)
        targets = kanji_by_lesson.get(lo["lesson"], [])
        if not targets:
            continue
        known.extend(targets)
        quiz_lessons.append({
            **lo,
            "target_kanji": targets,
            "known_kanji": known[:],
        })

    if not quiz_lessons:
        issues.append({"type": "no_quiz_lessons", "note_id": "", "value": "", "details": "No lesson contains tracked kanji"})

    # Lesson summary for human review.
    kanji_counts = Counter(k["lesson"] for k in kanji)
    vocab_source_counts = Counter(v["lesson"] for v in vocabulary)
    lesson_summary = []
    for pair in lesson_pairs:
        lo = lesson_obj(pair)
        lesson_summary.append({
            **lo,
            "kanji_count": kanji_counts[lo["lesson"]],
            "vocabulary_source_count": vocab_source_counts[lo["lesson"]],
        })

    max_modified = max(
        [x for x in [*(k.get("last_modified") for k in kanji), *(v.get("last_modified") for v in vocabulary)] if x is not None],
        default=None,
    )

    meta = {
        "version": 9,
        "name": "WSJJ Kanji.pro database",
        "source": "Anki exports in imports/",
        "kanji_count": len(kanji),
        "vocabulary_entries": len(vocabulary),
        "source_vocabulary_notes": len(vocab_base),
        "vocabulary_source_total": source_total,
        "vocabulary_excluded_no_tracked_kanji": excluded_no_tracked,
        "slash_combined_notes_split": split_source_notes,
        "quiz_lessons": len(quiz_lessons),
        "cleaned_vocabulary_records": cleaned_records,
        "ambiguous_surface_multiple_readings": len(ambiguous),
        "source_max_modified": max_modified,
        "rules": {
            "knownKanji_field": "ignored",
            "course_kanji_source": "imports/kanji.csv only",
            "vocabulary_filter": "keep only entries containing at least one course kanji",
            "furigana": "source ruby is tokenized; frontend dynamically decides visibility based on selected kanji or lesson",
            "answer_normalization": "katakana -> hiragana; spaces and okurigana markers are ignored",
            "parenthetical_annotations": "removed from canonical vocabulary surface",
            "pattern_markers": "edge ～/~ markers are preserved for display but excluded from canonical surface and validation",
        },
    }

    runtime = {
        "meta": meta,
        "lesson_summary": lesson_summary,
        "kanji": kanji,
        "vocabulary": vocabulary,
        "quiz_lessons": quiz_lessons,
        "validation_issues": issues,
    }

    return runtime, issues, ambiguous


def write_outputs(runtime: dict, issues: list[dict], ambiguous: list[dict]):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    if SOURCE_DIR.exists():
        shutil.rmtree(SOURCE_DIR)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)

    with RUNTIME_JSON.open("w", encoding="utf-8") as f:
        json.dump(runtime, f, ensure_ascii=False, indent=2)
        f.write("\n")

    kanji = runtime["kanji"]
    vocab = runtime["vocabulary"]
    summary = runtime["lesson_summary"]

    # Flat review CSVs.
    kanji_rows = []
    for k in kanji:
        kanji_rows.append({
            "note_id": k["note_id"], "character": k["character"], "book": k["book"], "chapter": k["chapter"],
            "lesson": k["lesson"], "lesson_order": k["lesson_order"], "kunyomi_raw": k["kunyomi_raw"],
            "onyomi_raw": k["onyomi_raw"], "polish": k["polish"], "notes": k["notes"], "source_tags": k["source_tags"],
        })
    write_csv(SOURCE_DIR / "kanji.csv", ["note_id","character","book","chapter","lesson","lesson_order","kunyomi_raw","onyomi_raw","polish","notes","source_tags"], kanji_rows)

    vocab_rows = []
    for v in vocab:
        vocab_rows.append({
            "note_id": v["note_id"], "source_note_id": v.get("source_note_id", v["note_id"]), "surface": v["surface"],
            "display_surface": v.get("display_surface", v["surface"]), "pattern_prefix": v.get("pattern_prefix", ""), "pattern_suffix": v.get("pattern_suffix", ""),
            "furigana_markup": v["furigana_markup"], "reading": v["reading"], "accepted_readings": " / ".join(v.get("accepted_readings", [])),
            "romaji": v["romaji"], "polish": v["polish"], "book": v["book"], "chapter": v["chapter"], "lesson": v["lesson"],
            "lesson_order": v["lesson_order"], "tracked_kanji": " ".join(v["tracked_kanji"]), "untracked_kanji": " ".join(v["untracked_kanji"]),
            "source_note_type": v["source_note_type"], "source_tags": v["source_tags"],
        })
    write_csv(SOURCE_DIR / "vocabulary.csv", ["note_id","source_note_id","surface","display_surface","pattern_prefix","pattern_suffix","furigana_markup","reading","accepted_readings","romaji","polish","book","chapter","lesson","lesson_order","tracked_kanji","untracked_kanji","source_note_type","source_tags"], vocab_rows)

    write_csv(SOURCE_DIR / "lesson_summary.csv", ["book","chapter","lesson","lesson_order","kanji_count","vocabulary_source_count"], summary)
    write_csv(SOURCE_DIR / "validation_issues.csv", ["type","note_id","value","details"], issues)
    write_csv(SOURCE_DIR / "ambiguous_prompts.csv", ["surface","accepted_readings","note_ids"], ambiguous)

    report = {
        "meta": runtime["meta"],
        "validation_issue_count": len(issues),
        "ambiguous_prompt_count": len(ambiguous),
        "runtime_file": str(RUNTIME_JSON.relative_to(ROOT)),
    }
    with (SOURCE_DIR / "build_report.json").open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # SQLite for inspection/querying. Frontend does not load it.
    db_path = SOURCE_DIR / "kanji_quiz.sqlite"
    if db_path.exists():
        db_path.unlink()
    con = sqlite3.connect(db_path)
    con.executescript("""
    PRAGMA foreign_keys=ON;
    CREATE TABLE lessons (lesson TEXT PRIMARY KEY, book INTEGER, chapter INTEGER, lesson_order INTEGER, kanji_count INTEGER, vocabulary_source_count INTEGER);
    CREATE TABLE kanji (character TEXT PRIMARY KEY, note_id TEXT, lesson TEXT, lesson_order INTEGER, kunyomi_raw TEXT, onyomi_raw TEXT, polish TEXT, source_tags TEXT);
    CREATE TABLE vocabulary (note_id TEXT PRIMARY KEY, source_note_id TEXT, surface TEXT, furigana_markup TEXT, reading TEXT, accepted_readings_json TEXT, polish TEXT, lesson TEXT, lesson_order INTEGER, tracked_kanji_json TEXT, untracked_kanji_json TEXT, source_tags TEXT);
    CREATE INDEX idx_vocab_surface ON vocabulary(surface);
    CREATE INDEX idx_vocab_lesson ON vocabulary(lesson_order);
    """)
    for l in summary:
        con.execute("INSERT INTO lessons VALUES (?,?,?,?,?,?)", (l["lesson"], l["book"], l["chapter"], l["lesson_order"], l["kanji_count"], l["vocabulary_source_count"]))
    for k in kanji:
        con.execute("INSERT INTO kanji VALUES (?,?,?,?,?,?,?,?)", (k["character"], k["note_id"], k["lesson"], k["lesson_order"], k["kunyomi_raw"], k["onyomi_raw"], k["polish"], k["source_tags"]))
    for v in vocab:
        con.execute("INSERT INTO vocabulary VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", (
            v["note_id"], v.get("source_note_id", v["note_id"]), v["surface"], v["furigana_markup"], v["reading"], json.dumps(v.get("accepted_readings", []), ensure_ascii=False),
            v["polish"], v["lesson"], v["lesson_order"], json.dumps(v["tracked_kanji"], ensure_ascii=False), json.dumps(v["untracked_kanji"], ensure_ascii=False), v["source_tags"],
        ))
    con.commit()
    con.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--allow-issues", action="store_true", help="Write output even when validation issues are present.")
    args = parser.parse_args()

    runtime, issues, ambiguous = build()
    print(f"Kanji: {len(runtime['kanji'])}")
    print(f"Vocabulary: {len(runtime['vocabulary'])}")
    print(f"Quiz lessons: {len(runtime['quiz_lessons'])}")
    print(f"Excluded vocab without tracked kanji: {runtime['meta']['vocabulary_excluded_no_tracked_kanji']}")
    print(f"Ambiguous visible prompts: {len(ambiguous)}")
    print(f"Validation issues: {len(issues)}")

    if issues and not args.allow_issues:
        for x in issues[:20]:
            print(f" - {x['type']}: {x['note_id']} {x['value']} :: {x['details']}", file=sys.stderr)
        die("Walidacja nie przeszła. Popraw eksporty albo uruchom z --allow-issues do diagnostyki.", 1)

    write_outputs(runtime, issues, ambiguous)
    print(f"OK -> {RUNTIME_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
