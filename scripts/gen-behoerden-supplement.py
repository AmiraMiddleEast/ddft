#!/usr/bin/env python3
"""Generate data/behoerden-supplement.json from the 2026-07 research (Block 4).

Maps each per-Bundesland Beglaubigungsstelle to the app's document-type slugs and
emits additive behoerden_authority rows (consumed by scripts/seed-behoerden.ts).
Re-runnable: overwrites the supplement file. Source is the operator's research
export (path below); the generated JSON is committed so CI/prod seed without it.
"""
import json, re, unicodedata, os, sys

SRC = os.environ.get("BLOCK4",
  "/Users/andreaswilmers/Documents/2026/Amira AI/Clients/Angela/Recherche Ergebnisse/JSON/block4_vorbeglaubigung.json")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "behoerden-supplement.json")

def slugify(s):
    s=(s or "").lower().replace("ä","ae").replace("ö","oe").replace("ü","ue").replace("ß","ss")
    s=unicodedata.normalize("NFKD",s); s="".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+","-",s).strip("-")

# free-text Dokumentart -> (slug, display). Order matters (specific first).
RULES = [
    ("approbation",("approbationsurkunde","Approbationsurkunde / Berufserlaubnis Arzt")),
    ("fachzahnarzt",("fachzahnarztanerkennung","Fachzahnarztanerkennung / Weiterbildungsurkunde")),
    ("facharzt",("facharztanerkennung","Facharztanerkennung / Weiterbildungsurkunde")),
    ("promotion",("promotionsurkunde","Promotionsurkunde")),
    ("universit",("universitaetsdiplom","Universitätsdiplom / Hochschulzeugnis")),
    ("hochschul",("universitaetsdiplom","Universitätsdiplom / Hochschulzeugnis")),
    ("diplom",("universitaetsdiplom","Universitätsdiplom / Hochschulzeugnis")),
    ("staatsexamen",("staatsexamen","Staatsexamenszeugnis")),
    ("geburts",("geburtsurkunde","Geburtsurkunde")),
    ("heirats",("heiratsurkunde","Heiratsurkunde")),
    ("melde",("meldebescheinigung","Meldebescheinigung")),
    ("fuehrungszeugnis",("fuehrungszeugnis","Führungszeugnis")),
    ("führungszeugnis",("fuehrungszeugnis","Führungszeugnis")),
    ("schulzeugnis",("schulzeugnis","Schulzeugnis")),
    ("abitur",("schulzeugnis","Schulzeugnis")),
    ("notariell",("notarielle-urkunden","Notarielle Urkunden")),
]
def map_types(txt):
    t=txt.lower(); out=[]
    for kw,pair in RULES:
        if kw in t and pair not in out: out.append(pair)
    return out

R=json.load(open(SRC))
doc_types={}; auth=[]; seen=set()
for e in R:
    bl=e.get("bundesland","")
    if bl in ("Bund",""):       # BfAA/BfJ = Endbeglaubigung, im Code separat
        continue
    state_slug=slugify(bl)
    addr=e.get("adresse_haus") or e.get("adresse_post") or ""
    review_flag = bool(e.get("telefonisch_klaeren"))
    for da in e.get("dokumentarten",[]):
        for slug,disp in map_types(da):
            doc_types.setdefault(slug,disp)
            key=(state_slug,slug,e.get("stelle",""))
            if key in seen: continue
            seen.add(key)
            auth.append({
                "state_slug": state_slug,
                "state_name": bl,
                "document_type_slug": slug,
                "name": e.get("stelle",""),
                "address": addr,
                "phone": e.get("telefon"),
                "email": e.get("email"),
                "website": e.get("webseite"),
                "office_hours": e.get("oeffnungszeiten"),
                "notes": (e.get("ablauf") or None),
                "needs_review": review_flag or ("klären" in da.lower()),
                "source": "research-2026-07-block4",
            })
out={"_generated_from":"block4_vorbeglaubigung.json (research 2026-07)",
     "doc_types":[{"slug":k,"display":v} for k,v in sorted(doc_types.items())],
     "authorities":auth}
with open(OUT,"w",encoding="utf-8") as f: json.dump(out,f,ensure_ascii=False,indent=2)
print(f"doc_types: {len(doc_types)} -> {sorted(doc_types)}")
print(f"authorities: {len(auth)}")
print(f"written: {os.path.relpath(OUT)}")
