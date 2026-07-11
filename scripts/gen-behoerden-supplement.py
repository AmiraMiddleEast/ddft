#!/usr/bin/env python3
"""Generate data/behoerden-supplement.json from the 2026-07 research (Block 4).

Maps each per-Bundesland Beglaubigungsstelle to the app's document-type slugs and
emits additive behoerden_authority rows (consumed by scripts/seed-behoerden.ts).
Also emits one "allgemeine-beglaubigung" row per Bundesland (the state's central
Beglaubigungsstelle) — the resolver falls back to it for non-judicial documents
that have no specific authority. Re-runnable: overwrites the supplement file.
"""
import json, re, unicodedata, os

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
# Core professional/medical doc types the app must ALWAYS offer, even when no
# research entry names them. Without these, a reseed drops any admin-added type
# (e.g. Fachzahnarzt) that is not authority-backed. They need no specific
# authority — the resolver's general Beglaubigungsstelle fallback routes them
# per Bundesland.
CORE_DOC_TYPES = {
    "facharztanerkennung": "Facharztanerkennung / Weiterbildungsurkunde",
    "fachzahnarztanerkennung": "Fachzahnarztanerkennung / Weiterbildungsurkunde",
}
GENERAL_SLUG = "allgemeine-beglaubigung"
GENERAL_DISPLAY = "Allgemeine Beglaubigungsstelle des Bundeslands"
# Signals that a research entry is the state's catch-all Beglaubigungsstelle.
GENERAL_SIGNALS = [
    "alle nicht-justiz","alle öffentlichen","alle urkunden","alle im land",
    "urkunden von landesbehörden","urkunden sächsischer","urkunden hamburgischer",
    "öffentliche urkunden des bezirks","verwaltungsurkunden des bezirks",
    "sonstige verwaltungsurkunden",
]

def map_types(txt):
    t=txt.lower(); out=[]
    for kw,pair in RULES:
        if kw in t and pair not in out: out.append(pair)
    return out

def entry_row(e, slug, state_slug, state_name):
    return {
        "state_slug": state_slug,
        "state_name": state_name,
        "document_type_slug": slug,
        "name": e.get("stelle",""),
        "address": e.get("adresse_haus") or e.get("adresse_post") or "",
        "phone": e.get("telefon"),
        "email": e.get("email"),
        "website": e.get("webseite"),
        "office_hours": e.get("oeffnungszeiten"),
        "notes": (e.get("ablauf") or None),
        "needs_review": bool(e.get("telefonisch_klaeren")),
        "source": "research-2026-07-block4",
    }

R = json.load(open(SRC))
doc_types = {}
auth = []
seen = set()
from collections import OrderedDict
by_state = OrderedDict()  # (state_slug, state_name) -> [entries]

for e in R:
    bl = e.get("bundesland", "")
    if bl in ("Bund", ""):
        continue
    # strip the "(Nordrhein)" / "(Westfalen-Lippe)" suffix for the slug/name
    state_name = re.sub(r"\s*\(.*\)$", "", bl)
    state_slug = slugify(state_name)
    by_state.setdefault((state_slug, state_name), []).append(e)
    for da in e.get("dokumentarten", []):
        for slug, disp in map_types(da):
            doc_types.setdefault(slug, disp)
            key = (state_slug, slug, e.get("stelle", ""))
            if key in seen:
                continue
            seen.add(key)
            auth.append(entry_row(e, slug, state_slug, state_name))

# Force the core professional doc types so a reseed never drops them.
for slug, disp in CORE_DOC_TYPES.items():
    doc_types.setdefault(slug, disp)

# One general Beglaubigungsstelle per Bundesland: prefer an "alle …" entry,
# else the first (= the central Apostille/Beglaubigungsstelle listed).
doc_types[GENERAL_SLUG] = GENERAL_DISPLAY
general_count = 0
for (state_slug, state_name), entries in by_state.items():
    chosen = None
    for e in entries:
        docs = " | ".join(e.get("dokumentarten", [])).lower()
        if any(s in docs for s in GENERAL_SIGNALS):
            chosen = e
            break
    if chosen is None:
        chosen = entries[0]
    row = entry_row(chosen, GENERAL_SLUG, state_slug, state_name)
    row["needs_review"] = True  # fallback stelle — operator confirms per doc type
    auth.append(row)
    general_count += 1

out = {
    "_generated_from": "block4_vorbeglaubigung.json (research 2026-07)",
    "doc_types": [{"slug": k, "display": v} for k, v in sorted(doc_types.items())],
    "authorities": auth,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"doc_types: {len(doc_types)}")
print(f"authorities: {len(auth)} (davon {general_count} allgemeine-beglaubigung)")
print(f"written: {os.path.relpath(OUT)}")
