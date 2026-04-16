async function run(inputs) {
  // Load the database (this should be done only once in a real workflow, perhaps in an initialization step)
  // For this example, we assume the database is available as a JSON object.
  // In a real Active Pieces workflow, you might store this JSON in a global variable or a data store.
  const behoerdenDB = {
    // The content of behoerden_db.json will be inserted here
  };

  const docInfo = inputs.dokument; // Assuming input is named 'dokument'

  let vorbeglaubigungsStelle = {
    name: "Zuständigkeit muss manuell geprüft werden",
    adresse: "N/A",
    hinweis: "Für dieses Dokument konnte die zuständige Stelle nicht automatisch ermittelt werden."
  };

  const bundesland = docInfo.bundesland; // Assuming the KI provides the state
  const ausstellungsort = docInfo.ausstellungsort.toLowerCase();
  const typ = docInfo.dokumenten_typ.toLowerCase();

  if (behoerdenDB[bundesland]) {
    const stateData = behoerdenDB[bundesland];
    // This is a placeholder for the complex logic that would be needed.
    // A real implementation would need to parse the 'dokumente_raw' markdown
    // and apply rules based on 'ausstellungsort' and 'typ'.
    
    // Example of a more specific (but still simplified) logic for a state with districts:
    if (stateData.hat_regierungsbezirke) {
        // Logic to map 'ausstellungsort' to a 'Regierungsbezirk'
        // Then find the correct authority within that district's section of the markdown.
    }

    // For now, we just return a snippet of the raw markdown for the identified document type.
    const docTypeRegex = new RegExp(`##.*${typ.replace(/\//g, '\\/')}.*?##`, 'is');
    const match = stateData.dokumente_raw.match(docTypeRegex);

    if (match) {
        vorbeglaubigungsStelle = {
            name: `Siehe Details für ${docInfo.dokumenten_typ} in ${bundesland}`,
            adresse: "Siehe Details",
            hinweis: match[0] // Return the matched markdown section
        };
    } else {
        vorbeglaubigungsStelle.hinweis = `Keine spezifischen Informationen für '${docInfo.dokumenten_typ}' in ${bundesland} gefunden. Hier sind die allgemeinen Informationen: ${stateData.besonderheiten}`;
    }

  } else {
      vorbeglaubigungsStelle.hinweis = `Keine Informationen für das Bundesland '${bundesland}' in der Datenbank gefunden.`
  }

  return {
      dokument_details: docInfo,
      vorbeglaubigung: vorbeglaubigungsStelle
  };
}
