#!/usr/bin/env python3
"""Generate data/cogs-supplement.json from the 2026-07 CoGS research (Block 2a/2b).

Emits a normalized fill-only overlay (one entry per cogs_kammer id) that the
seed applies AFTER the CSV+research merge: it fills only empty fields and marks
the row as verified (datenVollstaendig=true). Existing non-empty data is kept.
"""
import json, os

SRCDIR = os.environ.get("COGS_SRC",
  "/Users/andreaswilmers/Documents/2026/Amira AI/Clients/Angela/Recherche Ergebnisse/JSON")
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "cogs-supplement.json")

BL_KEY = {
  "Baden-Württemberg":"bw","Bayern":"by","Berlin":"be","Brandenburg":"bb","Bremen":"hb",
  "Hamburg":"hh","Hessen":"he","Mecklenburg-Vorpommern":"mv","Niedersachsen":"ni",
  "Rheinland-Pfalz":"rp","Saarland":"sl","Sachsen":"sn","Sachsen-Anhalt":"st",
  "Schleswig-Holstein":"sh","Thüringen":"th",
}
def bl_key(name):
    if "Nordrhein-Westfalen" in name:
        if "Nordrhein" in name and "Westfalen-Lippe" not in name: return "nw-nr"
        if "Westfalen-Lippe" in name: return "nw-wl"
    return BL_KEY.get(name.strip())

def join(v):
    if isinstance(v, list): return "; ".join(str(x) for x in v if x)
    return v or None

def entry_to_row(e, beruf):
    key = bl_key(e.get("bundesland",""))
    if not key: return None
    return {
        "id": f"{key}-{beruf}",
        "kammerName": e.get("stelle") or None,
        "zustaendigeStelle": e.get("stelle") or None,
        "kammerWebsite": e.get("webseite") or None,
        "directUrlGoodStanding": e.get("antrag_url") or None,
        "antragsverfahren": e.get("ablauf") or None,
        "erforderlicheDokumente": join(e.get("unterlagen")),
        "fuehrungszeugnisOEmpfaenger": e.get("empfaengeradresse_fuehrungszeugnis") or None,
        "kontaktEmail": e.get("email") or None,
        "kontaktTelefon": e.get("telefon") or None,
        "kontaktAdresse": e.get("adresse_haus") or e.get("adresse_post") or None,
        "quellen": join(e.get("quellen")),
    }

rows=[]
for fn, beruf in [("block2a_aerztekammern.json","arzt"),("block2b_zahnaerztekammern.json","zahnarzt")]:
    data=json.load(open(os.path.join(SRCDIR,fn)))
    for e in data:
        r=entry_to_row(e,beruf)
        if r: rows.append(r)

with open(OUT,"w",encoding="utf-8") as f:
    json.dump({"_generated_from":"block2a/2b (research 2026-07)","overlay":rows}, f, ensure_ascii=False, indent=2)
print(f"cogs supplement rows: {len(rows)}")
print("ids:", sorted(r["id"] for r in rows))
