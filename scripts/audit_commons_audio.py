#!/usr/bin/env python3
"""One-time read-only audit of Kanji.pro words against Commons Japanese audio categories."""
import csv, io, json, re, time, unicodedata, urllib.parse, urllib.request
from collections import Counter, defaultdict
from pathlib import Path

UA = "KanjiProAudioCoverageAudit/1.0 (github.com/pyotrowsky/kanjipro; educational data audit)"
def fetch(url, params=None):
    if params: url += "?" + urllib.parse.urlencode(params)
    for retry in range(4):
        try:
            req=urllib.request.Request(url, headers={"User-Agent":UA, "Accept":"application/json,text/plain,*/*"})
            with urllib.request.urlopen(req,timeout=35) as response: return response.read()
        except Exception as exc:
            if retry==3: raise RuntimeError(f"Could not fetch {url}: {exc}") from exc
            time.sleep((retry+1)*2)
def norm(s):
    s=unicodedata.normalize("NFKC",str(s or "")).strip()
    return "".join(chr(ord(c)-96) if "ァ"<=c<="ヶ" else c for c in s if c not in " \t\u3000・･")
def canon(s): return norm(s).replace("〜","~")
vocab=list(csv.DictReader(Path("data/source/vocabulary.csv").open(encoding="utf-8-sig",newline="")))
ka=list(csv.DictReader(io.StringIO(fetch("https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/language-data/ka_data.csv").decode("utf-8-sig"))))
known=set()
for row in ka:
    for word,meaning in json.loads(row["examples"]):
        m=re.fullmatch(r"(.*)（([^（）]+)）",word)
        if not m: continue
        for reading in re.split("[／/、，,]",m.group(2)):
            known.add((canon(m.group(1)),canon(reading)))
missing=[]
for row in vocab:
    readings={canon(row["reading"])}|{canon(r) for r in re.split("[／/、，,]",row["accepted_readings"])}
    if not any((canon(row["surface"]),r) in known for r in readings if r): missing.append(row)
print(f"Kanji.pro words: {len(vocab)}; Kanji alive exact: {len(vocab)-len(missing)}; missing: {len(missing)}",flush=True)

API="https://commons.wikimedia.org/w/api.php"
def category_files(name):
    result=[]; params={"action":"query","format":"json","list":"categorymembers","cmtitle":name,"cmtype":"file","cmlimit":"500"}
    while True:
        doc=json.loads(fetch(API,params))
        if "error" in doc: raise RuntimeError(str(doc["error"]))
        result.extend(x["title"] for x in doc["query"]["categorymembers"])
        if "continue" not in doc: break
        params.update(doc["continue"])
    return result
categories=["Category:Lingua Libre pronunciation-jpn","Category:Japanese pronunciation",
"Category:Japanese vocabulary pronunciation from WaniKani and Tofugu",
"Category:Japanese pronunciation of numbers",
"Category:Japanese audio files from Wikibooks",
"Category:Pronunciation of Japanese syllables"]
all_files={}
by_cat={}
for category in categories:
    try:
        files=category_files(category)
        by_cat[category]=len(files)
        for file in files: all_files.setdefault(file,[]).append(category)
        print(f"Loaded {category}: {len(files)} files",flush=True)
    except Exception as err:
        print(f"WARNING {category}: {err}",flush=True)
if not by_cat: raise RuntimeError("No Commons category queried successfully")

kana=defaultdict(list);surface=defaultdict(list);reading_tag=defaultdict(list);romanized=defaultdict(list)
for file,cats in all_files.items():
    name=file.removeprefix("File:")
    name=re.sub(r"\.(?:wav|ogg|oga|opus|mp3|flac)$","",name,flags=re.I)
    if name.startswith("LL-Q") and "(jpn)-" in name:
        word=name.split("(jpn)-",1)[1].rsplit("-",1)[-1]
        m=re.fullmatch(r"(.+?)\s*\(([^)]+)\)",word)
        if m:
            surface[canon(m.group(1))].append(file)
            reading_tag[(canon(m.group(1)),canon(m.group(2)))].append(file)
        elif re.search("[一-龯々]",word): surface[canon(word)].append(file)
        elif re.search("[ぁ-んァ-ヶ]",word):kana[canon(word)].append(file)
    elif re.search("[一-龯々]",name):
        for match in re.finditer(r"[一-龯々ぁ-んァ-ヶー]+",name):
            if len(match.group())>=2:surface[canon(match.group())].append(file)
    elif name.lower().startswith("ja-"):
        romanized[name[3:].lower()].append(file)

found={"matching_reading_only":[],"matching_surface_only":[],"explicit_reading":[],"possible_romanized":[]}
for row in missing:
    surf=canon(row["surface"])
    readings={canon(row["reading"])}|{canon(r) for r in re.split("[／/、，,]",row["accepted_readings"])}
    explicit=[file for r in readings for file in reading_tag.get((surf,r),[])]
    from_reading=[file for r in readings for file in kana.get(r,[])]
    from_surface=surface.get(surf,[])
    roma=(row.get("romaji") or "").lower().replace("ō","ou").replace("ū","uu").replace("ē","ei")
    romfiles=[file for key,files in romanized.items() if key==roma for file in files]
    if explicit: found["explicit_reading"].append((row,explicit))
    elif from_surface: found["matching_surface_only"].append((row,from_surface))
    elif from_reading:found["matching_reading_only"].append((row,from_reading))
    elif romfiles:found["possible_romanized"].append((row,romfiles))
summary={"total":len(vocab),"kanji_alive":len(vocab)-len(missing),"missing_before":len(missing),
"commons_category_file_count":len(all_files),"categories":by_cat,
"additional_by_match_type":{type:len(items) for type,items in found.items()},
"additional_candidates_total":sum(map(len,found.values())),
"remaining_after_candidates":len(missing)-sum(map(len,found.values())),
"sample_matches":{type:[{"surface":row["surface"],"reading":row["reading"],"file":files[0]} for row,files in items[:20]] for type,items in found.items()},
"note":"Reading-only filenames are phonetic candidates, NOT verified lexical/pitch-accent matches. Surface-only and romaji-only files also require review. File licensing must be checked individually."}
print("AUDIT_SUMMARY_JSON="+json.dumps(summary,ensure_ascii=False),flush=True)
Path("audio-coverage-audit.json").write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding="utf-8")
