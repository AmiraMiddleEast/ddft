// Hardcoded city -> Regierungsbezirk map for the four German states that
// still have Regierungsbezirke (BY, BW, HE, NRW).
//
// Keys use slugified state IDs (see db/schema.ts: behoerden_state.id).
// Inner keys are .toLowerCase() + trim() but NOT slugified — we match the
// raw user-provided Ausstellungsort string after lowercasing, so we need
// BOTH the umlaut form ("muenchen" vs "münchen") AND the ASCII fallback.
//
// Sources (HIGH confidence — Wikipedia Regierungsbezirk lists + official
// state administrative maps):
//   Bayern:              https://de.wikipedia.org/wiki/Regierungsbezirk#Bayern  (7 RBz)
//   Baden-Württemberg:   4 RBz — Freiburg, Karlsruhe, Stuttgart, Tübingen
//   Hessen:              3 RBz — Darmstadt, Gießen, Kassel
//   Nordrhein-Westfalen: 5 RBz — Arnsberg, Detmold, Düsseldorf, Köln, Münster
//
// Unknown cities: cityToRegierungsbezirk() returns null. The resolver treats
// that as "ambiguous" when the state requires RBz routing (see Pitfall 4 in
// 03-RESEARCH.md).

type Map = Record<string, Record<string, string>>;

export const CITY_TO_REGIERUNGSBEZIRK: Map = {
  bayern: {
    // ==== Oberbayern ====
    "m\u00fcnchen": "Oberbayern",
    muenchen: "Oberbayern",
    ingolstadt: "Oberbayern",
    rosenheim: "Oberbayern",
    freising: "Oberbayern",
    erding: "Oberbayern",
    "garmisch-partenkirchen": "Oberbayern",
    dachau: "Oberbayern",
    starnberg: "Oberbayern",
    "bad t\u00f6lz": "Oberbayern",
    "bad toelz": "Oberbayern",
    traunstein: "Oberbayern",
    // ==== Niederbayern ====
    landshut: "Niederbayern",
    passau: "Niederbayern",
    straubing: "Niederbayern",
    deggendorf: "Niederbayern",
    dingolfing: "Niederbayern",
    // ==== Oberpfalz ====
    regensburg: "Oberpfalz",
    amberg: "Oberpfalz",
    weiden: "Oberpfalz",
    cham: "Oberpfalz",
    schwandorf: "Oberpfalz",
    // ==== Oberfranken ====
    bayreuth: "Oberfranken",
    bamberg: "Oberfranken",
    coburg: "Oberfranken",
    hof: "Oberfranken",
    kulmbach: "Oberfranken",
    forchheim: "Oberfranken",
    // ==== Mittelfranken ====
    "n\u00fcrnberg": "Mittelfranken",
    nuernberg: "Mittelfranken",
    erlangen: "Mittelfranken",
    "f\u00fcrth": "Mittelfranken",
    fuerth: "Mittelfranken",
    ansbach: "Mittelfranken",
    schwabach: "Mittelfranken",
    // ==== Unterfranken ====
    "w\u00fcrzburg": "Unterfranken",
    wuerzburg: "Unterfranken",
    aschaffenburg: "Unterfranken",
    schweinfurt: "Unterfranken",
    "kitzingen": "Unterfranken",
    // ==== Schwaben ====
    augsburg: "Schwaben",
    kempten: "Schwaben",
    memmingen: "Schwaben",
    kaufbeuren: "Schwaben",
    "neu-ulm": "Schwaben",
    "n\u00f6rdlingen": "Schwaben",
    "noerdlingen": "Schwaben",
  },
  "baden-wuerttemberg": {
    // ==== Stuttgart ====
    stuttgart: "Stuttgart",
    heilbronn: "Stuttgart",
    ludwigsburg: "Stuttgart",
    esslingen: "Stuttgart",
    "schw\u00e4bisch gm\u00fcnd": "Stuttgart",
    "schwaebisch gmuend": "Stuttgart",
    "backnang": "Stuttgart",
    "waiblingen": "Stuttgart",
    // ==== Karlsruhe ====
    karlsruhe: "Karlsruhe",
    mannheim: "Karlsruhe",
    heidelberg: "Karlsruhe",
    pforzheim: "Karlsruhe",
    "baden-baden": "Karlsruhe",
    bruchsal: "Karlsruhe",
    rastatt: "Karlsruhe",
    // ==== Freiburg ====
    freiburg: "Freiburg",
    offenburg: "Freiburg",
    konstanz: "Freiburg",
    "l\u00f6rrach": "Freiburg",
    loerrach: "Freiburg",
    "villingen-schwenningen": "Freiburg",
    "waldshut-tiengen": "Freiburg",
    singen: "Freiburg",
    // ==== Tübingen ====
    "t\u00fcbingen": "T\u00fcbingen",
    tuebingen: "T\u00fcbingen",
    reutlingen: "T\u00fcbingen",
    ulm: "T\u00fcbingen",
    friedrichshafen: "T\u00fcbingen",
    ravensburg: "T\u00fcbingen",
    biberach: "T\u00fcbingen",
    "aalen": "Stuttgart",
  },
  hessen: {
    // ==== Darmstadt ====
    frankfurt: "Darmstadt",
    "frankfurt am main": "Darmstadt",
    darmstadt: "Darmstadt",
    offenbach: "Darmstadt",
    wiesbaden: "Darmstadt",
    hanau: "Darmstadt",
    "r\u00fcsselsheim": "Darmstadt",
    "ruesselsheim": "Darmstadt",
    "bad homburg": "Darmstadt",
    "bad homburg vor der h\u00f6he": "Darmstadt",
    "oberursel": "Darmstadt",
    // ==== Gießen ====
    "gie\u00dfen": "Gie\u00dfen",
    giessen: "Gie\u00dfen",
    marburg: "Gie\u00dfen",
    wetzlar: "Gie\u00dfen",
    "limburg": "Gie\u00dfen",
    "limburg an der lahn": "Gie\u00dfen",
    // ==== Kassel ====
    kassel: "Kassel",
    fulda: "Kassel",
    "bad hersfeld": "Kassel",
    "baunatal": "Kassel",
    eschwege: "Kassel",
  },
  "nordrhein-westfalen": {
    // ==== Düsseldorf ====
    "d\u00fcsseldorf": "D\u00fcsseldorf",
    duesseldorf: "D\u00fcsseldorf",
    duisburg: "D\u00fcsseldorf",
    essen: "D\u00fcsseldorf",
    "m\u00f6nchengladbach": "D\u00fcsseldorf",
    moenchengladbach: "D\u00fcsseldorf",
    wuppertal: "D\u00fcsseldorf",
    solingen: "D\u00fcsseldorf",
    krefeld: "D\u00fcsseldorf",
    neuss: "D\u00fcsseldorf",
    remscheid: "D\u00fcsseldorf",
    // ==== Köln ====
    "k\u00f6ln": "K\u00f6ln",
    koeln: "K\u00f6ln",
    bonn: "K\u00f6ln",
    leverkusen: "K\u00f6ln",
    aachen: "K\u00f6ln",
    "bergisch gladbach": "K\u00f6ln",
    troisdorf: "K\u00f6ln",
    // ==== Münster ====
    "m\u00fcnster": "M\u00fcnster",
    muenster: "M\u00fcnster",
    bottrop: "M\u00fcnster",
    gelsenkirchen: "M\u00fcnster",
    recklinghausen: "M\u00fcnster",
    "gladbeck": "M\u00fcnster",
    "castrop-rauxel": "M\u00fcnster",
    // ==== Detmold ====
    detmold: "Detmold",
    bielefeld: "Detmold",
    paderborn: "Detmold",
    gütersloh: "Detmold",
    "g\u00fctersloh": "Detmold",
    guetersloh: "Detmold",
    minden: "Detmold",
    herford: "Detmold",
    // ==== Arnsberg ====
    arnsberg: "Arnsberg",
    dortmund: "Arnsberg",
    hagen: "Arnsberg",
    bochum: "Arnsberg",
    siegen: "Arnsberg",
    hamm: "Arnsberg",
    iserlohn: "Arnsberg",
    lüdenscheid: "Arnsberg",
    "l\u00fcdenscheid": "Arnsberg",
    luedenscheid: "Arnsberg",
  },
};

/**
 * Resolve a city name to its Regierungsbezirk for the four RBz-routed states.
 * Returns null if the state has no entry OR the city is unknown.
 *
 * Case-insensitive via .toLowerCase(); the map keys include both the umlaut
 * spelling and the ASCII transliteration so users typing either form match.
 */
export function cityToRegierungsbezirk(
  city: string,
  stateSlug: string,
): string | null {
  const normalized = city.trim().toLowerCase();
  return CITY_TO_REGIERUNGSBEZIRK[stateSlug]?.[normalized] ?? null;
}
