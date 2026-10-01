import type { Catalog } from "./en";

/**
 * The German catalog, typed against the English one: a missing key or a
 * wrong param shape fails `npm run typecheck`.
 *
 * Copy rules (docs/i18n-spec.md, Section 5): informal "du" and imperative
 * forms, neutral nouns for people ("Person", "Mitglied"), JoyClub's own
 * German labels for its controls ("Profil ignorieren", "In den Papierkorb
 * schieben", "Senden"), and the owner's glossary.
 */
export const de: Catalog = {
  // Shared labels
  "placement.qualified": "Qualifiziert",
  "placement.needs-review": "Zu prüfen",
  "placement.quarantined": "Junk",
  "condition.verified": "Verifiziert",
  "condition.personallyKnown": "Persönlich bekannt",
  "condition.minimumPhotos": "Mindestanzahl Fotos",
  "condition.minimumProfileWords": "Mindestanzahl Wörter im Profil",
  "condition.minimumAccountAgeDays": "Mindestalter des Kontos in Tagen",
  "condition.notTemplateSpam": "Nicht als Vorlagen-Spam markiert",
  "condition.minimumTrustScore": "Mindest-Vertrauenswert (lokal)",
  "condition.firstMessageContains": "Erste Nachricht enthält",
  "field.accountAgeDays": "Kontoalter in Tagen",
  "field.photoCount": "Anzahl der Fotos",
  "field.profileWordCount": "Wörter im Profil",
  "outcome.qualified": "Qualifiziert",
  "outcome.partial-information": "Unvollständige Angaben",
  "outcome.does-not-meet-rule": "Erfüllt die Regel nicht",
  "common.close": "Schließen",
  "common.openOptions": "JoyFox-Einstellungen öffnen",
  "common.saveFailed":
    "JoyFox konnte diese Änderung nicht speichern. Es wurde nichts geändert. Versuche es noch einmal. Wenn es weiter nicht klappt, lade die Seite neu.",
  "legacy.text": (p) => p.text,
  "common.textUnavailable": "(Dieser Text kann nicht angezeigt werden.)",

  // Triage reasons
  "triage.reason.unknownValue": (p) =>
    `${p.field}: unbekannt. Der Wert wurde weder dafür noch dagegen gezählt.`,
  "triage.reason.atOrAbove": (p, f) =>
    `${p.field}: ${f.number(p.value)}. Das erreicht den geforderten Mindestwert ${f.number(p.minimum)}.`,
  "triage.reason.belowMinimum": (p, f) =>
    `${p.field}: ${f.number(p.value)}. Das liegt unter dem geforderten Mindestwert ${f.number(p.minimum)}.`,
  "triage.reason.accountAgeRangeAbove": (p, f) =>
    `Kontoalter: zwischen ${f.number(p.min)} und ${f.number(p.max)} Tagen. Das erreicht den geforderten Mindestwert ${f.number(p.minimum)}.`,
  "triage.reason.accountAgeRangeBelow": (p, f) =>
    `Kontoalter: zwischen ${f.number(p.min)} und ${f.number(p.max)} Tagen. Das liegt unter dem geforderten Mindestwert ${f.number(p.minimum)}.`,
  "triage.reason.accountAgeRangeCoarse": (p, f) =>
    `Kontoalter: zwischen ${f.number(p.min)} und ${f.number(p.max)} Tagen. Das ist zu ungenau für einen Vergleich mit dem geforderten Mindestwert ${f.number(p.minimum)}, deshalb wurde es weder dafür noch dagegen gezählt.`,
  "triage.reason.verificationUnknown":
    "Der Verifizierungsstatus ist unbekannt. Er wurde weder dafür noch dagegen gezählt.",
  "triage.reason.verified":
    "Das Profil ist verifiziert, wie deine Regel es verlangt.",
  "triage.reason.notVerified":
    "Das Profil ist nicht verifiziert. Deine Regel verlangt das aber.",
  "triage.reason.personallyKnownUnknown":
    "Ob du dieses Mitglied persönlich kennst, ist unbekannt. Das wurde weder dafür noch dagegen gezählt.",
  "triage.reason.personallyKnown":
    "Du hast dieses Mitglied als persönlich bekannt markiert, wie deine Regel es verlangt.",
  "triage.reason.notPersonallyKnown":
    "Du hast dieses Mitglied nicht als persönlich bekannt markiert. Deine Regel verlangt das aber.",
  "triage.reason.noCriteria":
    "Es sind keine Kriterien eingestellt, deshalb ist jede Person qualifiziert.",
  "triage.reason.spamFlagged":
    "Eine Nachricht dieser Person sieht wie eine kopierte Vorlage aus.",
  "triage.reason.spamNotFlagged":
    "Keine Nachricht dieser Person sieht wie eine kopierte Vorlage aus.",
  "triage.reason.spamOverridden":
    "Du hast diese Person als „kein Spam“ markiert.",
  "triage.reason.spamUnknown":
    "JoyFox hat die Nachrichten dieser Person nicht auf Vorlagen geprüft. Der Spam-Status ist deshalb unbekannt.",
  "triage.reason.phraseSeenNow": (p) =>
    `Die neueste Nachricht dieser Person enthält „${p.text}“.`,
  "triage.reason.phraseSeenBefore": (p) =>
    `Eine frühere Nachricht dieser Person aus deinem Posteingang enthält „${p.text}“.`,
  "triage.reason.phraseNotInLatest": (p) =>
    `Die neueste Nachricht dieser Person enthält „${p.text}“ nicht. Der Posteingang zeigt nur die neueste Nachricht, deshalb kann JoyFox nicht sehen, ob die erste Nachricht es enthielt.`,
  "triage.reason.phraseNotSeen": (p) =>
    `JoyFox hat keine Nachricht dieser Person gesehen, die „${p.text}“ enthält. Nur der Posteingang zeigt JoyFox Nachrichten.`,
  "triage.reason.trustUnknown":
    "Du hast zu diesem Mitglied nichts erfasst. Der lokale Vertrauenswert ist deshalb unbekannt.",
  "triage.reason.trustAtOrAbove": (p, f) =>
    `Dein lokaler Vertrauenswert: ${f.number(p.score)}. Das erreicht den geforderten Mindestwert ${f.number(p.minimum)}.`,
  "triage.reason.trustBelow": (p, f) =>
    `Dein lokaler Vertrauenswert: ${f.number(p.score)}. Das liegt unter dem geforderten Mindestwert ${f.number(p.minimum)}.`,
  "triage.reason.negatedMet": (p) =>
    `${p.reason} Deine Regel sagt „nicht ${p.condition}“, deshalb zählt das als erfüllt.`,
  "triage.reason.negatedNotMet": (p) =>
    `${p.reason} Deine Regel sagt „nicht ${p.condition}“, deshalb zählt das als nicht erfüllt.`,
  "triage.reason.unknownNeedsReview": (p) =>
    `${p.reason} Deine Regel ordnet unbekannte Werte in „Zu prüfen“ ein.`,
  "triage.reason.unknownMet": (p) =>
    `${p.reason} Deine Regel zählt einen unbekannten Wert als erfüllt.`,
  "triage.reason.unknownNotMet": (p) =>
    `${p.reason} Deine Regel zählt einen unbekannten Wert als nicht erfüllt.`,
  "triage.reason.numbered": (p, f) =>
    `Gruppe ${f.number(p.number)}: ${p.reason}`,
  "triage.reason.userMoved": (p) =>
    `Du hast diese Person nach „${p.placement}“ verschoben.`,
  "triage.headline.noConditions":
    "Deine Kontaktregel hat keine Pflichtbedingungen, deshalb ist jede Person qualifiziert.",
  "triage.headline.meets": "Diese Person erfüllt deine Kontaktregel.",
  "triage.headline.undecided":
    "JoyFox konnte nicht entscheiden, weil einige Angaben unbekannt sind.",
  "triage.headline.doesNotMeet": (p) =>
    `Diese Person erfüllt deine Kontaktregel nicht und kommt deshalb nach „${p.placement}“.`,

  // Trust score
  "trust.reason.positive": (p, f) =>
    `Du hast ${f.plural(p.count, {
      one: "1 positive Erfahrung",
      other: `${f.number(p.count)} positive Erfahrungen`,
    })} erfasst.`,
  "trust.reason.negative": (p, f) =>
    `Du hast ${f.plural(p.count, {
      one: "1 negative Erfahrung",
      other: `${f.number(p.count)} negative Erfahrungen`,
    })} erfasst.`,
  "trust.reason.neutral": (p, f) =>
    `Du hast ${f.plural(p.count, {
      one: "1 neutrale Erfahrung",
      other: `${f.number(p.count)} neutrale Erfahrungen`,
    })} erfasst. Neutrale Erfahrungen zählen 0.`,
  "trust.reason.personallyKnown":
    "Du hast dieses Mitglied als persönlich bekannt markiert.",
  "trust.reason.spamFlagged":
    "Eine Nachricht dieses Mitglieds sieht wie eine kopierte Vorlage aus.",
  "trust.scopeNote":
    "Beruht nur auf dem, was du in diesem Browser erfasst und gesehen hast. Es ist keine Bewertung von JoyClub oder der Community.",

  // Template spam detector
  "spam.detail.override":
    "Du hast diese Person als „kein Spam“ markiert. Ihre Nachrichten werden deshalb nie markiert.",
  "spam.detail.belowMinimum": (p, f) =>
    `Die Nachricht hat ${f.plural(p.words, {
      one: "1 Wort",
      other: `${f.number(p.words)} Wörter`,
    })}. Für den Vorlagenvergleich sind mindestens ${f.number(p.minimum)} nötig.`,
  "spam.detail.duplicate": (p, f) =>
    `Diese Nachricht gleicht stark einer früheren Nachricht an dich (${f.number(p.percent)} % ähnlich).`,
  "spam.detail.knownPhrase":
    "Die Nachricht enthält eine Formulierung aus deiner Liste bekannter Vorlagen.",
  "spam.detail.phraseSimilar": (p, f) =>
    `Die Nachricht gleicht stark einer Formulierung aus deiner Liste bekannter Vorlagen (${f.number(p.percent)} % ähnlich).`,
  "spam.detail.noMatch":
    "Die Nachricht gleicht keiner früheren Nachricht und keiner bekannten Vorlagen-Formulierung.",

  // Quick Ignore and Delete (M9). JoyClub's own German labels name its
  // controls (live-evidence/10-ignore.md).
  "action.step.ignore": "Profil ignorieren",
  "action.step.delete": "In den Papierkorb schieben",
  "action.where.before": (p) => `vor „${p.step}“`,
  "action.where.during": (p) => `während „${p.step}“`,
  "action.failure.control-missing": (p) =>
    `JoyFox hat auf dieser Seite JoyClubs Option „${p.step}“ nicht gefunden.`,
  "action.failure.confirmation-missing": (p) =>
    `JoyClubs Bestätigung für „${p.step}“ ist nicht erschienen.`,
  "action.failure.not-verified": (p) =>
    `JoyClub hat nicht angezeigt, dass „${p.step}“ geklappt hat.`,
  "action.failure.unverifiable": (p) =>
    `JoyFox kann JoyClubs Ergebnis für „${p.step}“ auf dieser Seite nicht sehen und hat deshalb ${p.where} angehalten.`,
  "action.failure.member-mismatch": (p) =>
    `Die Seite hat ein anderes Mitglied gezeigt. JoyFox hat deshalb ${p.where} angehalten.`,
  "action.failure.conversation-mismatch": (p) =>
    `Die Seite hat eine andere Unterhaltung gezeigt. JoyFox hat deshalb ${p.where} angehalten.`,
  "action.failure.identity-unavailable": (p) =>
    `JoyFox konnte nicht bestätigen, welches Mitglied oder welche Unterhaltung die Seite zeigt, und hat deshalb ${p.where} angehalten.`,
  "action.failure.account-changed": (p) =>
    `Das aktive JoyFox-Konto hat sich geändert. JoyFox hat deshalb ${p.where} angehalten.`,
  "action.failure.turned-off": (p) =>
    `„Ignorieren und löschen“ wurde ausgeschaltet. JoyFox hat deshalb ${p.where} angehalten.`,
  "action.failure.superseded": (p) =>
    `Ein neuerer JoyFox-Vorgang für dieses Mitglied hat begonnen. JoyFox hat deshalb ${p.where} angehalten.`,
  "action.failure.log-unavailable": (p) =>
    `JoyFox konnte nicht in sein Aktionsprotokoll schreiben und hat deshalb ${p.where} angehalten.`,
  "action.failure.handoff-failed": (p) =>
    `JoyFox konnte nicht zum Profil des Mitglieds wechseln und hat deshalb ${p.where} angehalten.`,
  "action.failure.timeout": (p) =>
    `JoyClub hat während „${p.step}“ nicht rechtzeitig reagiert.`,
  "action.failure.step-error": (p) =>
    `Ein unerwarteter Fehler hat JoyFox ${p.where} angehalten.`,
  "action.stepText.ignore.done":
    "Profil ignorieren: erledigt. JoyClub ignoriert dieses Mitglied.",
  "action.stepText.ignore.not-done": "Profil ignorieren: nicht erledigt.",
  "action.stepText.ignore.unknown":
    "Profil ignorieren: nicht bestätigt. JoyFox hat den Schritt begonnen, aber keine Bestätigung von JoyClub gesehen.",
  "action.stepText.delete.done":
    "In den Papierkorb schieben: erledigt. JoyClub hat die Unterhaltung in den Papierkorb verschoben.",
  "action.stepText.delete.not-done":
    "In den Papierkorb schieben: nicht erledigt.",
  "action.stepText.delete.unknown":
    "In den Papierkorb schieben: nicht bestätigt. JoyFox hat den Schritt begonnen, aber keine Bestätigung von JoyClub gesehen.",
  "action.next.ignore":
    "Nächster Schritt: Öffne das Profil des Mitglieds und prüfe, ob es ignoriert wird. Wenn nicht, ignoriere es dort selbst.",
  "action.next.delete":
    "Nächster Schritt: Öffne die Unterhaltung und prüfe, ob sie im Papierkorb ist. Wenn nicht, verschiebe sie selbst mit „In den Papierkorb schieben“.",
  "action.next.showList":
    "„In den Papierkorb schieben“ klappt nur, während diese Unterhaltung in der ClubMail-Liste daneben zu sehen ist. Mach das Fenster breiter oder scrolle die Liste, bis die Unterhaltung erscheint, und versuche es dann noch einmal.",
  "action.self.ignore":
    "Du kannst es selbst tun: Öffne das Profil des Mitglieds und ignoriere es dort mit „Profil ignorieren“.",
  "action.self.delete":
    "Du kannst es selbst tun: Verschiebe die Unterhaltung mit „In den Papierkorb schieben“ in den Papierkorb.",
  "action.report.finished": "„Ignorieren und löschen“ ist fertig.",
  "action.report.undo":
    "Rückgängig machen: Hol die Unterhaltung aus JoyClubs Papierkorb zurück. Öffne dann das Profil des Mitglieds und wähle im Menü „Profil nicht mehr ignorieren“.",
  "action.report.running": "„Ignorieren und löschen“ läuft.",
  "action.report.stopped": "„Ignorieren und löschen“ wurde angehalten.",
  "action.report.interrupted":
    "„Ignorieren und löschen“ wurde unterbrochen, zum Beispiel weil der Tab geschlossen wurde.",
  "action.report.nothingChanged": "Auf JoyClub wurde nichts geändert.",
  "action.report.notUndone": "JoyFox hat nichts rückgängig gemacht.",
  "action.deleteReport.finished": "„Löschen“ ist fertig.",
  "action.deleteReport.undo":
    "Rückgängig machen: Hol die Unterhaltung aus JoyClubs Papierkorb zurück.",
  "action.deleteReport.running": "„Löschen“ läuft.",
  "action.deleteReport.stopped": "„Löschen“ wurde angehalten.",
  "action.deleteReport.interrupted":
    "„Löschen“ wurde unterbrochen, zum Beispiel weil der Tab geschlossen wurde.",

  // Content script: the Delete and Ignore and Delete buttons and notice
  "quick.progress.Started":
    "„Ignorieren und löschen“ läuft. JoyFox prüft die Seite.",
  "quick.delete.progress.Started": "„Löschen“ läuft. JoyFox prüft die Seite.",
  "quick.progress.DeleteRequested":
    "Die Unterhaltung wird in den Papierkorb verschoben.",
  "quick.progress.DeleteConfirmed":
    "Papierkorb erledigt. JoyFox öffnet das Profil des Mitglieds, um es dort zu ignorieren.",
  "quick.progress.IgnoreRequested": "Das Mitglied wird auf JoyClub ignoriert.",
  "quick.button": "Ignorieren und löschen",
  "quick.region": "JoyFox: Aktionen für die Unterhaltung",
  "quick.delete.button": "Löschen",
  "quick.delete.scope":
    "Ein Klick verschiebt diese Unterhaltung in JoyClubs Papierkorb und kehrt dann zur ClubMail-Liste zurück. Das Mitglied wird nicht ignoriert. JoyFox hält beim ersten Problem an und sagt dir, was erledigt wurde. JoyFox sendet nie eine Nachricht.",
  "quick.scope":
    "Experimentell. Ein Klick verschiebt diese Unterhaltung in JoyClubs Papierkorb, öffnet dann das Profil des Mitglieds und ignoriert es dort. JoyFox hält beim ersten Problem an und sagt dir, was erledigt wurde. JoyFox sendet nie eine Nachricht.",
  "quick.needsList":
    "Klappt nur, während diese Unterhaltung in der ClubMail-Liste daneben zu sehen ist. Mach das Fenster breiter oder scrolle die Liste, bis die Unterhaltung erscheint.",
  "quick.noProfile":
    "JoyFox findet den Link zum Profil dieses Mitglieds nicht. Dort ist „Profil ignorieren“. JoyFox hat deshalb nichts getan. Du kannst es selbst tun: Verschiebe die Unterhaltung mit „In den Papierkorb schieben“ in den Papierkorb. Öffne dann das Profil des Mitglieds und ignoriere es dort mit „Profil ignorieren“.",
  "quick.resumed":
    "„Ignorieren und löschen“, fortgesetzt aus der Unterhaltung:",
  "quick.waitingMenu": "JoyFox wartet auf JoyClubs Profilmenü …",
  "quick.previous":
    "Dein letztes „Ignorieren und löschen“ für dieses Mitglied:",
  "quick.previousOther":
    "Dein letztes „Ignorieren und löschen“ für dieses Mitglied, in einer anderen Unterhaltung:",
  "quick.otherResult":
    "Dein letztes „Ignorieren und löschen“, für eine andere Unterhaltung:",
  "quick.delete.previous": "Dein letztes „Löschen“ für dieses Mitglied:",
  "quick.delete.previousOther":
    "Dein letztes „Löschen“ für dieses Mitglied, in einer anderen Unterhaltung:",
  "quick.delete.otherResult":
    "Dein letztes „Löschen“, für eine andere Unterhaltung:",
  "quick.otherRunning":
    "Ein JoyFox-Vorgang läuft noch für eine andere Unterhaltung. Warte, bis er fertig ist.",
  "quick.busy":
    "Ein anderer JoyFox-Vorgang für dieses Mitglied läuft noch, zum Beispiel in einem anderen Tab. Hier wurde nichts getan.",
  "quick.junk.done":
    "Als Junk markiert: Die Person ist in „Junk“, und ein negatives Ergebnis ist festgehalten.",
  "quick.junk.busy":
    "Ein anderer JoyFox-Vorgang für dieses Mitglied läuft noch. JoyFox hat den Papierkorb-Schritt deshalb nicht begonnen.",
  "quick.junk.notTrashed":
    "Die Unterhaltung wurde nicht in den Papierkorb verschoben.",
  "quick.delete.unexpected":
    "„Löschen“ wurde durch einen unerwarteten Fehler angehalten. Vielleicht hat JoyFox die Unterhaltung in den Papierkorb verschoben: Prüfe selbst JoyClubs Papierkorb.",
  "quick.unexpected":
    "„Ignorieren und löschen“ wurde durch einen unerwarteten Fehler angehalten. Vielleicht hat JoyFox einen Schritt erledigt: Prüfe selbst das Profil des Mitglieds und die Unterhaltung.",

  // Content script: triage explanation, member bar and trust controls
  "triage.outcome.met": "Erfüllt",
  "triage.outcome.not-met": "Nicht erfüllt",
  "triage.outcome.needs-review": "Zu prüfen",
  "triage.conditions.summary": (p, f) =>
    `Alle geprüften Bedingungen (${f.number(p.count)})`,
  "triage.condition.line": (p) => `${p.outcome}: ${p.condition}. `,
  "triage.condition.lineNegated": (p) => `${p.outcome}: nicht ${p.condition}. `,
  "triage.placementLine": (p) => `Einordnung: ${p.placement} (${p.source}).`,
  "triage.source.override": "deine eigene Wahl",
  "triage.source.rule": "deine Kontaktregel",
  "triage.source.sharedEvent": "die Ausnahme für gemeinsame Events",
  "triage.sharedEvent.attending": (p) =>
    `Auf der Gästeliste von „${p.event}“${p.when ? ` (${p.when})` : ""}, das du mit „Ich gehe hin“ markiert hast.`,
  "triage.sharedEvent.attended": (p) =>
    `Auf der Gästeliste von „${p.event}“${p.when ? ` (${p.when})` : ""}, das du mit „Ich war dort“ markiert hast.`,
  "triage.sharedEvent.optOut":
    "Das gemeinsame Event für diese Person nicht verwenden",
  "triage.movedOn": (p) =>
    `Du hast diese Person am ${p.date} verschoben. Deine Regel allein würde sie in „${p.placement}“ einordnen.`,
  "triage.place.group": "Diese Person einordnen",
  "triage.useRule": "Wieder meine Regel verwenden",
  "mark.group": "Diese Person markieren",
  "mark.qualified": "Als qualifiziert markieren",
  "mark.junk": "Als Junk markieren",
  "mark.trustFailed": (p) =>
    `JoyFox hat diese Person in „${p.placement}“ eingeordnet, konnte das Vertrauensergebnis aber nicht festhalten und hat deshalb dort angehalten. Du kannst es auf der Unterhaltung oder dem Profil des Mitglieds festhalten.`,
  "mark.junk.noTrash":
    "Die Person ist in „Junk“, und ein negatives Ergebnis ist festgehalten. JoyFox konnte diese Unterhaltung hier nicht in den Papierkorb verschieben. Verschiebe sie selbst mit „In den Papierkorb schieben“.",
  "triage.profileFact.minimumPhotos": "Anzahl der Fotos",
  "triage.profileFact.minimumProfileWords": "Wörter im Profil",
  "triage.profileFact.minimumAccountAgeDays": "Kontoalter",
  "triage.unknownFacts.one": (p) =>
    `${p.fact}: unbekannt. Öffne das Profil, dann liest JoyFox den Wert.`,
  "triage.unknownFacts.two": (p) =>
    `${p.first} und ${p.second}: unbekannt. Öffne das Profil, dann liest JoyFox die Werte.`,
  "triage.unknownFacts.three": (p) =>
    `${p.first}, ${p.second} und ${p.third}: unbekannt. Öffne das Profil, dann liest JoyFox die Werte.`,
  "trust.score.none": "Lokaler Vertrauenswert: noch keine Einträge.",
  "trust.score.value": (p, f) =>
    `Lokaler Vertrauenswert: ${f.number(p.score)}.`,
  "trust.details.summary": "So setzt sich der Wert zusammen",
  "trust.contribution": (p, f) =>
    `${p.points > 0 ? "+" : ""}${f.number(p.points)}: ${p.reason}`,
  "trust.log.group": "Erfahrung mit diesem Mitglied erfassen",
  "trust.log.positive": "Positive Erfahrung erfassen",
  "trust.log.neutral": "Neutrale Erfahrung erfassen",
  "trust.log.negative": "Negative Erfahrung erfassen",
  "trust.log.undo": "Letzte Erfahrung zurücknehmen",
  "bar.placementPrefix": "Einordnung: ",
  "bar.yourChoice": "(deine Wahl)",
  "bar.sharedEvent": "(gemeinsames Event)",
  "bar.openProfile": "Profil öffnen",
  "bar.log": "Erfassen:",
  "bar.positive": "Positiv",
  "bar.neutral": "Neutral",
  "bar.negative": "Negativ",
  "bar.undo": "Zurücknehmen",
  "bar.details": "Details",
  "strip.collapse": "JoyFox einklappen",
  "strip.expand": "JoyFox ausklappen",
  "bar.scoreDetails": "Details zum Wert",
  "panel.ruleOff.no-rule":
    "Es ist keine Kontaktregel gespeichert, deshalb ordnet JoyFox diese Person nicht ein.",
  "panel.ruleOff.rule-disabled":
    "Deine Kontaktregel ist ausgeschaltet, deshalb ordnet JoyFox diese Person nicht ein.",
  "panel.ruleOff.other":
    "JoyFox kann diese Person gerade nicht einordnen. Lade die Seite neu, um es noch einmal zu versuchen.",
  "panel.ruleOff.no-account":
    "Es ist kein JoyFox-Konto aktiv, deshalb zeigt JoyFox zu diesem Mitglied nichts an.",

  // Content script: inbox triage
  "inbox.region": "JoyFox-Sortierung",
  "inbox.views": "Nachrichten zeigen",
  "inbox.view.default": "Posteingang",
  "inbox.view.all": "Alle zeigen",
  "inbox.viewCount": (p, f) => `${p.view} (${f.number(p.count)})`,
  "inbox.about": "Über diese Ansichten",
  "inbox.aboutText":
    "„Posteingang“ blendet Zeilen aus „Junk“ nur in dieser Ansicht aus. Nichts wird gelöscht, und JoyFox ändert nichts auf JoyClub.",
  "inbox.checking": "Wird eingeordnet …",
  "inbox.badge": (p) => `JoyFox: ${p.text}. Details.`,
  "inbox.why": "Details",
  "inbox.whyNamed": (p) => `Details: ${p.name}`,
  "inbox.rowGone": "Diese Zeile wird nicht mehr angezeigt.",
  "inbox.unidentified":
    "JoyFox konnte die Profilnummer dieser Person nicht lesen und deine Regel deshalb nicht prüfen. Die Zeile bleibt sichtbar.",
  "inbox.stillChecking": "JoyFox prüft diese Person noch.",
  "inbox.setup.no-account":
    "Es ist kein JoyFox-Konto aktiv, deshalb sortiert JoyFox diesen Posteingang nicht.",
  "inbox.setup.no-rule":
    "Es ist keine Kontaktregel gespeichert, deshalb sortiert JoyFox diesen Posteingang nicht.",

  // Content script: notes and tags
  "notes.region": "JoyFox-Notizen und -Tags",
  "notes.scope":
    "Nur für dich in JoyFox: gespeichert nur in diesem Browser, unter dem aktiven JoyFox-Konto. JoyFox sendet sie nie irgendwohin.",
  "notes.saved": "Notiz gespeichert.",
  "notes.removed": "Notiz entfernt.",
  "notes.conflict":
    "Diese Notiz wurde in einem anderen Tab oder in der JoyFox-Datenansicht geändert. JoyFox hat deinen Text deshalb nicht gespeichert. Er steht noch im Feld. Speichere noch einmal, um die gespeicherte Notiz zu ersetzen, oder verwirf deine Änderungen, um sie zu sehen.",
  "notes.refused":
    "Das aktive JoyFox-Konto hat sich geändert, deshalb wurde nichts gespeichert. Text, den du für das vorherige Konto eingegeben hast, wurde verworfen.",
  "notes.emptyTag": "Gib zuerst einen Tag ein. Es wurde nichts hinzugefügt.",
  "notes.emptyNote": "Gib zuerst eine Notiz ein. Es wurde nichts gespeichert.",
  "notes.tagAdded": "Tag hinzugefügt.",
  "notes.tagExists": "Diesen Tag hat das Mitglied schon.",
  "notes.tagRemoved": "Tag entfernt.",
  "notes.privateNote": "Private Notiz",
  "notes.length": (p, f) =>
    `${f.number(p.count)} von ${f.number(p.maximum)} Zeichen`,
  "notes.pasteCut":
    "Nur ein Teil des eingefügten Texts hat gepasst. Der Rest wurde nicht eingefügt.",
  "notes.discard": "Meine Änderungen verwerfen",
  "notes.save": "Notiz speichern",
  "notes.tags": "Tags",
  "notes.noTags": "Noch keine Tags.",
  "notes.remove": "Entfernen",
  "notes.removeTag": (p) => `Tag ${p.label} entfernen`,
  "notes.addTagLabel": "Tag hinzufügen",
  "notes.addTag": "Hinzufügen",
  "notes.summary.none": "Deine Notizen und Tags (noch keine)",
  "notes.summary.note": "Deine Notizen und Tags (eine Notiz)",
  "notes.summary.tags": (p, f) =>
    `Deine Notizen und Tags (${f.plural(p.count, {
      one: "1 Tag",
      other: `${f.number(p.count)} Tags`,
    })})`,
  "notes.summary.noteAndTags": (p, f) =>
    `Deine Notizen und Tags (eine Notiz und ${f.plural(p.count, {
      one: "1 Tag",
      other: `${f.number(p.count)} Tags`,
    })})`,

  // Content script: template picker
  "listing.heading.event": "JoyFox: deine Notizen zu diesem Event",
  "listing.heading.venue": "JoyFox: deine Notizen zu diesem Club",
  "listing.summary.event": (p) =>
    `JoyFox: deine Notizen zu diesem Event (${p.state})`,
  "listing.summary.venue": (p) =>
    `JoyFox: deine Notizen zu diesem Club (${p.state})`,
  "listing.summary.none": "noch keine",
  "listing.summary.note": "eine Notiz",
  "listing.loading": "Deine Notizen werden geladen …",
  "listing.readFailed":
    "JoyFox konnte deine Notizen zu dieser Seite nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen.",
  "listing.noAccount":
    "Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Notizen zu Events zu speichern.",
  "listing.attendanceLabel": "Deine Teilnahme",
  "listing.attendance.unknown": "Kein Status",
  "listing.attendance.interested": "Interessiert",
  "listing.attendance.attending": "Ich gehe hin",
  "listing.attendance.not-attending": "Ich gehe nicht hin",
  "listing.attendance.attended": "Ich war dort",
  "listing.noteLabel": "Deine Notiz",
  "listing.saveNote": "Notiz speichern",
  "listing.tagsLabel": "Deine Tags",
  "listing.tagLabel": "Neuer Tag",
  "listing.addTag": "Tag hinzufügen",
  "listing.removeTag": (p) => `Tag ${p.tag} entfernen`,
  "listing.emptyTag": "Gib zuerst einen Tag ein. Es wurde nichts hinzugefügt.",
  "listing.tooManyTags.event": (p, f) =>
    `Du kannst einem Event höchstens ${f.number(p.maximum)} Tags geben. Entferne zuerst einen.`,
  "listing.tooManyTags.venue": (p, f) =>
    `Du kannst einem Club höchstens ${f.number(p.maximum)} Tags geben. Entferne zuerst einen.`,
  "listing.privacy":
    "Privat: nur in diesem Browser gespeichert. JoyClub sieht nichts, und deine Anmeldung bei JoyClub ändert sich nicht.",
  "listing.saved": "Gespeichert.",
  "listing.tracked.event": "Gespeichert. JoyFox verfolgt dieses Event jetzt.",
  "listing.tracked.venue": "Gespeichert. JoyFox verfolgt diesen Club jetzt.",
  "listing.removed.event":
    "Es ist keine Notiz, kein Tag und keine Teilnahme mehr eingetragen, deshalb verfolgt JoyFox dieses Event nicht mehr.",
  "listing.removed.venue":
    "Es ist keine Notiz und kein Tag mehr eingetragen, deshalb verfolgt JoyFox diesen Club nicht mehr.",
  "listing.conflict":
    "Diese Notizen wurden in einem anderen Tab geändert, deshalb hat JoyFox nicht gespeichert. Jetzt werden die gespeicherten Notizen angezeigt; deine eingegebene Notiz steht noch im Feld.",
  "listing.refused":
    "Das aktive JoyFox-Konto hat sich geändert, deshalb wurde nichts gespeichert.",
  "events.heading": "Deine Events",
  "events.hint":
    "Alle Events und Clubs, zu denen du auf JoyClub eine Notiz, einen Tag oder deine Teilnahme eingetragen hast, nach Datum. JoyFox behält sie, auch wenn JoyClub ein Event entfernt. Um einen Eintrag zu ändern, öffne ihn auf JoyClub.",
  "events.readFailed":
    "JoyFox konnte deine Events nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen.",
  "events.noAccount":
    "Wähle zuerst ein Konto aus oder füge eines hinzu. Jedes Konto hat eigene Events.",
  "events.empty":
    "Noch keine verfolgten Events. Öffne ein Event auf JoyClub und trage eine Notiz, einen Tag oder deine Teilnahme ein.",
  "events.count": (p, f) =>
    `${f.number(p.shown)} von ${f.number(p.total)} verfolgten Events angezeigt.`,
  "events.filterLabel": "Zeigen",
  "events.filter.all": "Alle verfolgten Events",
  "events.searchLabel": "In meinen Notizen, Tags und Titeln suchen",
  "events.noDate": "Kein Datum",
  "events.untitled": (p) => `Event ${p.id}`,
  "events.past": (p) => `${p.when} (vorbei)`,
  "events.venue": (p) => `Club: ${p.venue}`,
  "events.venuesHeading": "Deine Clubs",
  "events.guests": (p, f) =>
    f.plural(p.count, {
      one: "1 Gast gespeichert",
      other: `${f.number(p.count)} Gäste gespeichert`,
    }),
  "events.exception.label":
    "Ausnahme für gemeinsame Events: eine Person als „Qualifiziert“ einordnen, wenn sie auf der Gästeliste eines Events steht, das ich mit „Ich gehe hin“ oder „Ich war dort“ markiert habe",
  "events.exception.hint":
    "Standardmäßig aus. JoyFox speichert die Gästeliste eines verfolgten Events, wenn du die Event-Seite öffnest, so weit JoyClub sie geladen hat, und löscht sie, wenn du das Event nicht mehr verfolgst. Eine Person, die du selbst markiert hast, behält deine Wahl, und im Bereich „Details“ kannst du die Ausnahme für eine Person abschalten.",
  "events.exception.saved": "Gespeichert.",
  "events.exception.saveFailed":
    "JoyFox konnte diese Einstellung nicht speichern. Versuche es noch einmal.",
  "quickSetting.heading": "Ignorieren und löschen",
  "quickSetting.label":
    "Die Schaltfläche „Ignorieren und löschen“ in ClubMail-Unterhaltungen zeigen",
  "quickSetting.hint":
    "Experimentell und standardmäßig an. Ein Klick schiebt die Unterhaltung in JoyClubs Papierkorb, öffnet das Profil des Mitglieds im selben Tab und ignoriert das Mitglied dort. Das funktioniert nur, solange die ClubMail-Liste neben der Unterhaltung zu sehen ist. JoyFox handelt nur, wenn du klickst. Das „Aktionsprotokoll“ unter „Deine Daten“ hält jeden Schritt fest. Diese Einstellung steuert nur „Ignorieren und löschen“: Die Schaltfläche „Löschen“ und „Als Junk markieren“ verschieben eine Unterhaltung auch dann in JoyClubs Papierkorb, wenn sie aus ist.",
  "quickSetting.risk":
    "Bemerkt JoyClub ein Werkzeug, das für dich klickt, kann dein Konto eingeschränkt oder geschlossen werden. Von allen JoyFox-Funktionen hat diese das höchste Risiko.",
  "quickSetting.undo":
    "Um es rückgängig zu machen, stelle die Unterhaltung aus JoyClubs Papierkorb wieder her. Öffne dann das Profil des Mitglieds und wähle im Menü „Profil nicht mehr ignorieren“.",
  "quickSetting.saved": "Gespeichert. Offene ClubMail-Tabs folgen sofort.",
  "quickSetting.saveFailed":
    "JoyFox konnte diese Einstellung nicht speichern. Versuche es noch einmal.",
  "sharedEvents.heading": "Gemeinsame Events",
  "sharedEvents.intro":
    "Dieses Mitglied steht auf der gespeicherten Gästeliste dieser Events, die du verfolgst:",
  "eventFilter.label": "JoyFox: zeigen",
  "eventFilter.all": "Alle geladenen Events und Dates",
  "eventFilter.tracked": "Nur Events, die JoyFox verfolgt",
  "eventFilter.note": "Nur Events mit deiner Notiz",
  "eventFilter.attending": "Nur Events, zu denen du gehst",
  "eventFilter.interested": "Nur Events, die dich interessieren",
  "eventFilter.tag": (p) => `Nur Events mit deinem Tag: ${p.tag}`,
  "eventFilter.count": (p, f) =>
    `${f.number(p.shown)} von ${f.number(p.loaded)} geladenen Events angezeigt. Später geladene Events werden auch geprüft.`,
  "eventFilter.readFailed":
    "JoyFox konnte deine Event-Notizen nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen.",
  "eventFilter.noAccount":
    "Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um nach deinen Notizen zu filtern.",
  "eventFilter.badge": "JoyFox",
  "eventFilter.hasNote": "Notiz",
  "typeFilter.legend": "Profiltyp",
  "typeFilter.man": "Mann",
  "typeFilter.woman": "Frau",
  "typeFilter.couple": "Paar",
  "typeFilter.unknown": "Unbekannt",
  "typeFilter.count": (p, f) =>
    `${f.number(p.shown)} von ${f.number(p.loaded)} geladenen angezeigt`,
  "typeFilter.unknownHidden": (p, f) =>
    `${f.number(p.count)} mit unbekanntem Typ ausgeblendet`,
  "typeFilter.scrollHint": "Nach unten scrollen, um mehr zu laden.",
  "typeFilter.unknownMark": "Typ unbekannt",
  "messages.heading": "Nachrichtensuche",
  "messages.hint":
    "JoyFox speichert die ClubMail-Nachrichten, die du öffnest, gesendete und empfangene, damit du sie hier durchsuchen kannst. Es speichert nur, was eine Unterhaltung auf dem Bildschirm zeigt, und lädt nie ältere Nachrichten. Der Text bleibt in diesem Browser, und eine Exportdatei enthält ihn auch. Wenn du JoyFox in privaten Fenstern erlaubst, speichert es die Nachrichten, die du dort öffnest, genauso.",
  "messages.caching": "Die Nachrichten speichern, die ich in ClubMail öffne",
  "messages.cachingOn": "Das Speichern von Nachrichten ist an.",
  "messages.cachingOff":
    "Das Speichern von Nachrichten ist aus. Schon gespeicherte Nachrichten bleiben, bis sie älter als die hier eingestellte Zeit sind oder bis du sie unter „Deine Daten“ löschst.",
  "messages.offHint":
    "Das Speichern ist aus: JoyFox speichert keine neuen Nachrichten. Die Suche umfasst weiter die schon gespeicherten Nachrichten.",
  "messages.retentionLabel": "Nachrichten behalten für (Monate)",
  "messages.retentionSave": "Speichern",
  "messages.retentionHint": (p, f) =>
    `Ältere Nachrichten werden automatisch gelöscht. Eine kleinere Zahl löscht ältere Nachrichten sofort. Standard ist ${f.number(p.default)}. Klicke zum Übernehmen auf „Speichern“.`,
  "messages.retentionConfirm": "Speichern und löschen",
  "messages.retentionConfirmPrompt": (p, f) =>
    `Eine kleinere Zahl löscht die gespeicherten Nachrichten, die älter als ${f.plural(
      p.months,
      { one: "1 Monat", other: `${f.number(p.months)} Monate` },
    )} sind, sofort. Klicke zum Bestätigen auf „Speichern und löschen“.`,
  "messages.retentionSaved": (p, f) =>
    p.deleted === 0
      ? "Gespeichert. Keine ältere Nachricht musste gelöscht werden."
      : `Gespeichert. ${f.plural(p.deleted, {
          one: "1 ältere Nachricht wurde",
          other: `${f.number(p.deleted)} ältere Nachrichten wurden`,
        })} gelöscht.`,
  "messages.retentionInvalid": (p, f) =>
    `Gib eine ganze Zahl von ${f.number(p.minimum)} bis ${f.number(p.maximum)} ein. Es wurde nichts geändert.`,
  "messages.noAccount": "Wähle zuerst ein Konto aus oder füge eines hinzu.",
  "messages.readFailed":
    "JoyFox konnte deine gespeicherten Nachrichten nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen.",
  "messages.searchLabel": "Meine Nachrichten durchsuchen",
  "messages.count": (p, f) =>
    p.count === 0
      ? "Keine gespeicherte Nachricht enthält das."
      : `${f.plural(p.count, {
          one: "1 Nachricht",
          other: `${f.number(p.count)} Nachrichten`,
        })} gefunden.`,
  "messages.countLimited": (p, f) =>
    `${f.number(p.count)} Nachrichten gefunden. Die neuesten ${f.number(p.shown)} werden angezeigt.`,
  "messages.sentTo": (p) => `Du an ${p.member} · ${p.when}`,
  "messages.receivedFrom": (p) => `${p.member} an dich · ${p.when}`,
  "messages.storedAt": (p) => `gespeichert ${p.when}`,
  "signals.state.complete": "Vollständig",
  "signals.state.incomplete": "Unvollständig",
  "signals.state.unknown": "Vollständigkeit unbekannt",
  "signals.state.unknownShort": "Unbekannt",
  "signals.photos": (p, f) =>
    f.plural(p.count, {
      one: "1 Foto",
      other: `${f.number(p.count)} Fotos`,
    }),
  "signals.photosUnknown": "Fotos unbekannt",
  "signals.words": (p, f) =>
    f.plural(p.count, {
      one: "1 Wort",
      other: `${f.number(p.count)} Wörter`,
    }),
  "signals.wordsUnknown": "Wörter unbekannt",
  "signals.verified": "verifiziert",
  "signals.notVerified": "nicht verifiziert",
  "signals.verificationUnknown": "Verifizierung unbekannt",
  "signals.heading": "Vollständigkeit des Profils",
  "signals.trust": (p, f) =>
    `Vertrauen ${p.score > 0 ? "+" : ""}${f.number(p.score)}`,
  "signals.trustNoneShort": "Vertrauen –",
  "signals.noteAdd": "Notiz hinzufügen",
  "signals.noteEdit": "Notiz",
  "signals.tagsLabel": "Deine Tags",
  "signals.tagCount": (p, f) =>
    f.plural(p.count, {
      one: "1 Tag",
      other: `${f.number(p.count)} Tags`,
    }),
  "signals.editor.label": (p) => `JoyFox: Notiz und Tags für ${p.member}`,
  "member.number": (p) => `Mitglied ${p.id}`,
  "signals.editor.loading": "Wird geladen …",
  "signals.editor.close": "Schließen",
  "signals.editor.noAccount":
    "Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Notizen zu führen.",
  "signals.editor.readFailed":
    "JoyFox konnte die Notizen zu diesem Mitglied nicht lesen. Schließe die Notiz und öffne sie erneut.",
  "signals.filter.label": "JoyFox: unvollständige Profile ausblenden",
  "signals.filter.count": (p, f) =>
    `${f.number(p.hidden)} von ${f.number(p.loaded)} geladenen Profilen ausgeblendet. Profile, über die JoyFox nichts weiß, bleiben sichtbar.`,
  "compat.heading": "Gemeinsame Vorlieben",
  "compat.shared": (p, f) =>
    `Du teilst ${f.plural(p.count, {
      one: "1 Vorliebe",
      other: `${f.number(p.count)} Vorlieben`,
    })} mit diesem Mitglied:`,
  "compat.none": "Du teilst keine Vorlieben mit diesem Mitglied.",
  "compat.listToggle": "Gemeinsame Vorlieben anzeigen",
  "compat.own": (p, f) =>
    `Das ist dein Profil. JoyFox vergleicht andere Profile mit ${f.plural(
      p.count,
      {
        one: "deiner 1 positiven Vorliebe",
        other: `deinen ${f.number(p.count)} positiven Vorlieben`,
      },
    )}.`,
  "compat.ownUnknown":
    "Öffne einmal dein eigenes JoyClub-Profil, damit JoyFox deine Vorlieben kennt.",
  "compat.unreadable":
    "JoyFox konnte die Vorlieben dieses Profils noch nicht lesen.",
  "compat.missing": "Dieses Profil zeigt keine Vorlieben zum Vergleichen.",
  "compat.readFailed":
    "JoyFox konnte deine Vorlieben nicht laden. Lade die Seite neu, um es noch einmal zu versuchen.",
  "compat.noAccount":
    "Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Vorlieben zu vergleichen.",
  "compat.badge": (p, f) => `${f.number(p.count)} gemeinsam`,
  "compat.badgeLabel": (p, f) =>
    `JoyFox: ${f.plural(p.count, {
      one: "1 gemeinsame Vorliebe",
      other: `${f.number(p.count)} gemeinsame Vorlieben`,
    })}`,
  "compat.sort.button": "Nach gemeinsamen Vorlieben sortieren",
  "compat.sort.on":
    "Nach gemeinsamen Vorlieben sortiert. Mitglieder, deren Profil du noch nicht geöffnet hast, stehen am Ende.",
  "compat.sort.unavailable":
    "JoyFox kann die Ergebnisse so, wie JoyClub sie gerade zeigt, nicht sortieren. Ihre Reihenfolge ist unverändert.",
  "searches.heading": "Gespeicherte JoyFox-Suchen",
  "searches.loading": "Gespeicherte Suchen werden geladen …",
  "searches.readFailed":
    "JoyFox konnte deine gespeicherten Suchen nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen.",
  "searches.empty": "Noch keine gespeicherten Suchen.",
  "searches.noAccount":
    "Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Suchen zu speichern.",
  "searches.save": "Diese Suche speichern",
  "searches.nameLabel": "Name für diese Suche",
  "searches.confirmSave": "Speichern",
  "searches.cancel": "Abbrechen",
  "searches.noName": "Gib zuerst einen Namen ein. Es wurde nichts gespeichert.",
  "searches.nameTooLong": (p, f) =>
    `Ein Name darf höchstens ${f.number(p.maximum)} Zeichen haben. Es wurde nichts gespeichert.`,
  "searches.notSearchAddress":
    "Die Adresse dieser Seite ist keine Suche, die JoyFox speichern kann. Es wurde nichts gespeichert.",
  "searches.full": (p, f) =>
    `Du hast ${f.number(p.maximum)} gespeicherte Suchen, mehr behält JoyFox nicht. Lösche zuerst eine.`,
  "searches.refused":
    "Das aktive JoyFox-Konto hat sich geändert, deshalb wurde nichts geändert.",
  "searches.saved": (p) => `„${p.name}“ gespeichert.`,
  "searches.noMatch": (p) =>
    `„${p.name}“ passt nicht mehr zur Suchadresse von JoyClub, deshalb hat JoyFox die Suche nicht geöffnet. Führe die Suche noch einmal aus und speichere sie neu.`,
  "searches.running": (p) => `„${p.name}“ wird ausgeführt …`,
  "searches.runningUnnamed": "Die gespeicherte Suche wird ausgeführt …",
  "searches.shown": (p) => `„${p.name}“ wird angezeigt.`,
  "searches.shownUnnamed": "Die gespeicherte Suche wird angezeigt.",
  "searches.runFailed":
    "JoyFox konnte die gespeicherte Suche nicht ausführen. Öffne den Filter von JoyClub und klicke auf „Anwenden“.",
  "searches.deleteLabel": (p) => `Gespeicherte Suche ${p.name} löschen`,
  "searches.confirmDelete": (p) =>
    `Klicke noch einmal auf ✕, um „${p.name}“ zu löschen.`,
  "searches.deleted": (p) => `„${p.name}“ gelöscht.`,
  "picker.toggle": "JoyFox-Vorlagen",
  "picker.loading": "Vorlagen werden geladen …",
  "picker.readFailed":
    "JoyFox konnte deine Vorlagen nicht laden. Es wurde nichts eingefügt. Klicke noch einmal auf „JoyFox-Vorlagen“, um es erneut zu versuchen.",
  "picker.empty":
    "Noch keine Vorlagen. Lege sie in den JoyFox-Einstellungen an.",
  "picker.noAccount":
    "Kein JoyFox-Konto ist aktiv. Wähle eines in den JoyFox-Einstellungen.",
  "picker.result.inserted":
    "Vorlage eingefügt. Prüfe den Text und klicke dann selbst auf JoyClubs „Senden“.",
  "picker.result.not-editable":
    "Das Nachrichtenfeld kann gerade nicht bearbeitet werden. Es wurde nichts eingefügt. Warte, bis du in das Nachrichtenfeld tippen kannst, und versuche es dann noch einmal.",
  "picker.result.too-long": (p, f) =>
    `Mit der Vorlage wäre die Nachricht ${f.plural(p.over, {
      one: "1 Zeichen",
      other: `${f.number(p.over)} Zeichen`,
    })} zu lang. Das Nachrichtenfeld fasst höchstens ${f.number(p.limit)} Zeichen. Es wurde nichts eingefügt. Kürze deinen Text oder die Vorlage.`,
  "picker.result.altered":
    "JoyClub hat den Text nach dem Einfügen geändert. Prüfe das Nachrichtenfeld, bevor du sendest.",
  "templates.folder.general": "Allgemein",
  "templates.folder.eventConfirmation": "Event-Zusage",
  "templates.folder.eventCancellation": "Event-Absage",

  // Options page: shell and tabs
  "options.title": "JoyFox-Einstellungen",
  "options.intro":
    "JoyFox speichert alles lokal in diesem Browserprofil. Die Sortierung des Posteingangs bleibt aus, bis du eine Kontaktregel speicherst.",
  "options.tabs.start": "Erste Schritte",
  "options.tabs.accounts": "Konten",
  "options.tabs.rule": "Kontaktregel",
  "options.tabs.templates": "Vorlagen",
  "options.tabs.events": "Events",
  "options.tabs.messages": "Nachrichten",
  "options.tabs.data": "Deine Daten",
  "options.importRegion": "JoyFox-Daten importieren",
  "options.languageSaveFailed":
    "JoyFox konnte die Sprache nicht speichern. Versuche es noch einmal.",

  // Options page: Get started
  "start.state.done": "Erledigt",
  "start.state.off": "Gespeichert, aber ausgeschaltet",
  "start.state.todo": "Noch nicht erledigt",
  "start.state.doneOpen":
    "Erledigt: keine Bedingungen, deshalb ist jede Person qualifiziert",
  "start.ready":
    "JoyFox ist eingerichtet. Öffne deinen JoyClub-Posteingang, um ihn sortiert zu sehen.",
  "start.intro":
    "Drei Schritte, ein paar Minuten. Alles bleibt in diesem Browser.",
  "start.introAccess":
    "Vier Schritte, ein paar Minuten. Alles bleibt in diesem Browser.",
  "start.readFailed":
    "JoyFox konnte seine Einrichtung nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen.",
  "start.step.access":
    "Erlaube JoyFox den Zugriff auf joyclub.de. Der Zugriff ist gerade aus, deshalb kann JoyFox auf JoyClub nicht arbeiten.",
  "start.step.account":
    "Füge dein JoyClub-Konto unter [Konten](#accounts) hinzu. JoyFox macht das erste Konto aktiv.",
  "start.step.chooseAccount":
    "Wähle das aktive Konto unter [Konten](#accounts) aus.",
  "start.step.rule":
    "Speichere eine Kontaktregel unter [Kontaktregel](#rule). Die Sortierung des Posteingangs bleibt aus, bis eine Regel gespeichert und eingeschaltet ist.",
  "start.step.inbox":
    "Öffne deinen JoyClub-Posteingang (www.joyclub.de, ClubMail). JoyFox zeigt seine Tabs über der Liste.",

  // Options page: site access (Get started)
  "access.allow": "Zugriff auf joyclub.de erlauben",
  "access.granted":
    "Der Zugriff auf joyclub.de ist an. Lade offene JoyClub-Tabs neu, damit JoyFox dort arbeiten kann.",
  "access.refused":
    "Der Zugriff auf joyclub.de ist weiterhin aus. JoyFox kann auf JoyClub erst arbeiten, wenn du den Zugriff hier oder unter about:addons erlaubst.",

  // Options page: accounts
  "accounts.readFailed":
    "JoyFox konnte die gespeicherten Konten nicht lesen. Es wurde kein Konto geändert. Lade die Seite neu, um es noch einmal zu versuchen.",
  "accounts.hint":
    "JoyFox kann nicht lesen, mit welchem JoyClub-Login ein Tab arbeitet. Aktiv ist das Konto, das du hier auswählst. JoyFox speichert deine Notizen, Tags, Regeln, Vorlagen und andere Daten unter diesem Konto.",
  "accounts.activeLabel": "Aktives Konto:",
  "accounts.noneSelected": "Keines ausgewählt",
  "accounts.empty":
    "Noch keine Konten. Füge unten ein Konto hinzu, um JoyFox zu verwenden.",
  "accounts.list": "Gespeicherte Konten",
  "accounts.nameWithIdentifier": (p) => `${p.label} (${p.identifier})`,
  "accounts.active": "Aktiv",
  "accounts.inactive": "Nicht aktiv",
  "accounts.use": "Dieses Konto verwenden",
  "accounts.useLabel": (p) => `Dieses Konto verwenden: ${p.name}`,
  "accounts.nowActive": (p) => `Aktives Konto ist jetzt ${p.name}.`,
  "accounts.rename": "Umbenennen",
  "accounts.renameLabel": (p) => `Umbenennen: Konto ${p.name}`,
  "accounts.renameField": (p) => `Neuer Anzeigename für ${p.identifier}`,
  "accounts.renameSave": "Speichern",
  "accounts.renameCancel": "Abbrechen",
  "accounts.renamed": (p) =>
    `Anzeigename gespeichert. JoyFox zeigt dieses Konto jetzt als ${p.name}.`,
  "accounts.remove": "Entfernen",
  "accounts.confirmRemove": "Entfernen bestätigen",
  "accounts.removeLabel": (p) => `Entfernen: Konto ${p.name}`,
  "accounts.confirmRemoveLabel": (p) =>
    `Entfernen bestätigen: Konto ${p.name} und alle seine Daten`,
  "accounts.removePrompt": (p) =>
    `Wenn du ${p.name} entfernst, löscht JoyFox alles, was es für dieses Konto gespeichert hat, zum Beispiel Notizen, Tags, Regeln, Vorlagen, Nachrichten, Event-Notizen und gespeicherte Suchen. Klicke zum Bestätigen noch einmal.`,
  "accounts.removed": (p) =>
    `${p.name} und die gespeicherten Daten wurden entfernt.`,
  "accounts.removedNoneActive": (p) =>
    `${p.name} und die gespeicherten Daten wurden entfernt. Jetzt ist kein Konto aktiv. Wähle eines mit „Dieses Konto verwenden“.`,
  "accounts.removedNoneLeft": (p) =>
    `${p.name} und die gespeicherten Daten wurden entfernt. Es gibt keine Konten mehr. Füge ein Konto hinzu, um JoyFox zu verwenden.`,
  "accounts.addForm": "Konto hinzufügen",
  "accounts.identifier": "JoyClub-Kontokennung",
  "accounts.identifierHint":
    "Dein JoyClub-Nickname eignet sich gut. JoyFox verwendet ihn nur, um deine Konten zu unterscheiden und Importe zuzuordnen. JoyFox prüft ihn nicht. Du kannst ihn später nicht ändern.",
  "accounts.label": "Anzeigename (optional)",
  "accounts.labelHint":
    "Nur JoyFox zeigt diesen Namen. Wenn du ihn leer lässt, zeigt JoyFox die Kennung.",
  "accounts.add": "Konto hinzufügen",
  "accounts.added": (p) => `${p.name} wurde hinzugefügt.`,

  // Options page: contact rule
  "rule.readFailed":
    "JoyFox konnte die Kontaktregel nicht lesen. Es wurde keine Regel geändert. Lade die Seite neu, um es noch einmal zu versuchen.",
  "rule.hint":
    "Die Regel ändert nur, wie JoyFox deinen eigenen Posteingang in „Qualifiziert“, „Zu prüfen“ und „Junk“ gruppiert. Sie hält keine Nachricht auf, löscht nichts, und die sendende Person sieht nichts davon.",
  "rule.noAccount":
    "Wähle zuerst ein Konto aus oder füge eines hinzu. Jedes Konto hat seine eigene Regel.",
  "rule.newer":
    "Diese Regel wurde mit einer neueren JoyFox-Version erstellt und kann hier nicht bearbeitet werden. Lösche sie, um eine neue anzulegen.",
  "rule.note.saved": "Für das aktive Konto ist eine Regel gespeichert.",
  "rule.note.none":
    "Für das aktive Konto ist keine Regel gespeichert, deshalb sortiert JoyFox den Posteingang nicht.",
  "rule.enabled": "Meinen JoyClub-Posteingang mit dieser Regel sortieren",
  "rule.placementLabel": "Einordnung, wenn die Regel nicht erfüllt ist:",
  "rule.spamHint":
    "Der Spam-Status ist vorerst unbekannt: JoyFox prüft Nachrichten noch nicht auf Vorlagen. Nur deine eigenen Korrekturen „kein Spam“ zählen. Der Posteingang zeigt nur das Verifizierungssymbol. Fotos, Wörter im Profil und Kontoalter stammen aus Profilen, die du vorher geöffnet hast.",
  "rule.autosaveHint":
    "Änderungen werden automatisch gespeichert: ein Kästchen oder eine Auswahl sofort, eine Zahl oder ein Text, sobald du das Feld verlässt.",
  "rule.firstMessageHint":
    "„Erste Nachricht enthält“ liest die Nachrichtenvorschau in deinem Posteingang und beachtet keine Groß- und Kleinschreibung. Der Posteingang zeigt nur die neueste Nachricht. Wenn eine Person mehr als eine Nachricht gesendet hat, ist die Vorschau deshalb vielleicht nicht die erste. Wenn die Vorschau deinen Text nicht enthält, zählt die Bedingung nach deiner Wahl unter „Wenn JoyFox das nicht sehen kann“. Sobald JoyFox deinen Text sieht, bleibt die Bedingung erfüllt.",
  "rule.preset.label": "Mit einer Vorgabe beginnen",
  "rule.preset.choose": "Vorgabe wählen …",
  "rule.preset.apply": "Vorgabe übernehmen",
  "rule.preset.confirm": "Bedingungen ersetzen",
  "rule.preset.confirmPrompt":
    "Die Vorgabe ersetzt alle Bedingungen unten. Klicke zur Bestätigung auf „Bedingungen ersetzen“.",
  "rule.preset.hint":
    "Eine Vorgabe setzt die Bedingungen unten und speichert sie. Danach kannst du sie wie jede andere Regel ändern.",
  "rule.preset.open": "Offen",
  "rule.preset.complete": "Nur vollständige Profile",
  "rule.preset.verified": "Verifizierte Mitglieder",
  "rule.preset.highTrust": "Mitglieder mit hohem Vertrauen",
  "rule.preset.custom": "Eigene",
  "rule.preset.describe.open":
    "Keine Bedingungen: Jede Person ist qualifiziert.",
  "rule.preset.describe.complete": (p, f) =>
    `Eine Person braucht mindestens ${f.number(p.photos)} Fotos und mindestens ${f.number(p.words)} Wörter im Profil.`,
  "rule.preset.describe.verified":
    "Eine Person muss von JoyClub verifiziert sein.",
  "rule.preset.describe.highTrust": (p, f) =>
    `Eine Person muss von JoyClub verifiziert sein und braucht mindestens ${f.number(p.photos)} Fotos, mindestens ${f.number(p.words)} Wörter im Profil und ein Konto, das mindestens ${f.number(p.days)} Tage alt ist.`,
  "rule.preset.describe.custom":
    "Entfernt alle Bedingungen, damit du die gewünschten ankreuzen kannst.",
  "rule.preset.applied": (p) =>
    `Vorgabe „${p.preset}“ übernommen und gespeichert. Du kannst ihre Bedingungen unten ändern.`,
  "rule.preset.appliedOpen":
    "Vorgabe „Offen“ übernommen und gespeichert. Die Regel hat keine Bedingungen, deshalb ist jede Person qualifiziert.",
  "rule.preset.appliedCustom":
    "Alle Bedingungen entfernt und gespeichert. Kreuze die gewünschten Bedingungen an. Bis dahin ist jede Person qualifiziert.",
  "rule.editor": "Editor:",
  "rule.simple": "Einfach",
  "rule.advanced": "Erweitert",
  "rule.match.all": "ALLEN",
  "rule.match.any": "MINDESTENS EINER",
  "rule.box.all":
    "Eine Person ist qualifiziert, wenn ALLE diese Bedingungen erfüllt sind",
  "rule.box.any":
    "Oder eine Person ist qualifiziert, wenn MINDESTENS EINE dieser Bedingungen erfüllt ist",
  "rule.unknown.needs-review": "In „Zu prüfen“ einordnen",
  "rule.unknown.met": "Als erfüllt zählen",
  "rule.unknown.not-met": "Als nicht erfüllt zählen",
  "rule.unknownPrompt": "Wenn JoyFox das nicht sehen kann:",
  "rule.unknownLabel": (p) =>
    `${p.condition}: wenn JoyFox das nicht sehen kann`,
  "rule.valueLabel": (p) => `${p.condition}: Wert`,
  "rule.numberProblem": (p, f) =>
    `Gib für „${p.condition}“ eine ganze Zahl von ${f.number(p.minimum)} bis ${f.number(p.maximum)} ein.`,
  "rule.textPlaceholder": "Wort, Formulierung oder Emoji",
  "rule.textLabel": (p) => `${p.condition}: Wort, Formulierung oder Emoji`,
  "rule.textProblem": (p, f) =>
    `Gib für „${p.condition}“ ein Wort, eine Formulierung oder ein Emoji mit höchstens ${f.number(p.maximum)} Zeichen ein.`,
  "rule.fieldNumberProblem": (p, f) =>
    `Gib eine ganze Zahl von ${f.number(p.minimum)} bis ${f.number(p.maximum)} ein.`,
  "rule.fieldTextProblem": (p, f) =>
    `Gib ein Wort, eine Formulierung oder ein Emoji mit höchstens ${f.number(p.maximum)} Zeichen ein.`,
  "rule.textHint":
    "Gib ein Wort, eine Formulierung oder ein Emoji ein, um diese Bedingung zu verwenden.",
  "rule.spamNote": "(noch nicht geprüft: immer unbekannt)",
  "rule.combine.label": "Wie die Gruppen verknüpft werden",
  "rule.combine.prefix": "Eine Person ist qualifiziert bei ",
  "rule.combine.suffix": " dieser Gruppen.",
  "rule.advancedHint":
    "Jede Gruppe ist erfüllt bei ALLEN oder MINDESTENS EINER ihrer Bedingungen, wie du es wählst. Setze ein Häkchen bei „nicht“, um eine Bedingung umzukehren: „nicht Mindestanzahl Fotos 3“ bedeutet weniger als 3 Fotos. Eine Gruppe ohne Bedingungen wird nicht gespeichert.",
  "rule.addRule": "+ Gruppe hinzufügen",
  "rule.removeRule": "Gruppe entfernen",
  "rule.confirmRemoveGroup": "Entfernen bestätigen",
  "rule.confirmRemoveGroupLabel": (p, f) =>
    `Entfernen bestätigen: Gruppe ${f.number(p.number)}`,
  "rule.removeGroupPrompt": (p, f) =>
    `Klicke noch einmal, um Gruppe ${f.number(p.number)} und ihre Bedingungen zu entfernen.`,
  "rule.ruleSuffix": " dieser Bedingungen",
  "rule.noConditions": "Noch keine Bedingungen. Füge unten eine hinzu.",
  "rule.removeCondition": "Bedingung entfernen",
  "rule.removeConditionLabel": (p) => `${p.condition} entfernen`,
  "rule.not": "nicht",
  "rule.notTitle": "Diese Bedingung umkehren",
  "rule.notLabel": (p) => `nicht: „${p.condition}“ umkehren`,
  "rule.joiner.all": "UND",
  "rule.joiner.any": "ODER",
  "rule.ruleTitle": (p, f) => `Gruppe ${f.number(p.number)}: erfüllt bei `,
  "rule.ruleMatchLabel": (p, f) =>
    `Wie Gruppe ${f.number(p.number)} ihre Bedingungen verknüpft`,
  "rule.removeRuleLabel": (p, f) =>
    `Gruppe entfernen: Nr. ${f.number(p.number)}`,
  "rule.addConditionLabel": (p, f) =>
    `Bedingung zu Gruppe ${f.number(p.number)} hinzufügen`,
  "rule.addCondition": "+ Bedingung hinzufügen …",
  "rule.ruleCount": (p, f) =>
    `${f.number(p.count)} von ${f.number(p.maximum)} Gruppen`,
  "rule.simpleUnavailable.all":
    "Die einfache Ansicht ist nicht verfügbar: Die Gruppen sind mit ALLEN verknüpft.",
  "rule.simpleUnavailable.not":
    "Die einfache Ansicht ist nicht verfügbar: Die Regel verwendet „nicht“.",
  "rule.simpleUnavailable.severalAll":
    "Die einfache Ansicht ist nicht verfügbar: Mehr als eine Gruppe verlangt ALLE von mehreren Bedingungen.",
  "rule.simpleUnavailable.duplicate":
    "Die einfache Ansicht ist nicht verfügbar: Eine Bedingung steht in mehr als einer Gruppe.",
  "rule.savedNoConditions":
    "Regel gespeichert. Sie hat noch keine Bedingungen, deshalb ist jede Person qualifiziert.",
  "rule.savedVacuous":
    "Regel gespeichert. Ohne Einträge im ALLE-Kasten ist jede Person qualifiziert, deshalb wirkt der MINDESTENS-EINE-Kasten nicht.",
  "rule.saved":
    "Regel gespeichert. Offene JoyClub-Tabs werden sofort aktualisiert.",
  "rule.notSaved": (p) => `${p.problem} Die Regel wurde nicht gespeichert.`,
  "rule.saveFailed":
    "JoyFox konnte die Regel nicht speichern. Es wurde nichts geändert. Ändere das Feld noch einmal, oder lade die Seite neu, um die gespeicherte Regel zu sehen.",
  "rule.deleteAll": "Ganze Kontaktregel löschen",
  "rule.confirmDeleteAll": "Löschen bestätigen",
  "rule.deletePrompt":
    "Klicke noch einmal, um die ganze Kontaktregel zu löschen. JoyFox sortiert den Posteingang für dieses Konto dann nicht mehr.",
  "rule.removed":
    "Kontaktregel gelöscht. JoyFox sortiert den Posteingang für dieses Konto nicht mehr.",
  "rule.removeFailed":
    "JoyFox konnte die Regel nicht löschen. Es wurde nichts geändert. Versuche es noch einmal. Wenn es weiter nicht klappt, lade die Seite neu.",
  "rule.stale.account.saved":
    "Das aktive Konto hat sich geändert, deshalb wurde die Regel nicht gespeichert. Prüfe im Tab „Konten“ das aktive Konto, bevor du die Regel noch einmal änderst.",
  "rule.stale.account.removed":
    "Das aktive Konto hat sich geändert, deshalb wurde die Regel nicht gelöscht. Prüfe im Tab „Konten“ das aktive Konto, bevor du noch einmal eine Regel löschst.",
  "rule.stale.rule.saved":
    "Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht gespeichert. Das Formular zeigt jetzt die gespeicherte Regel.",
  "rule.stale.rule.removed":
    "Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht gelöscht. Das Formular zeigt jetzt die gespeicherte Regel.",
  "rule.changedElsewhere":
    "Die Regel wurde in einem anderen Tab geändert. Das Formular zeigt jetzt die gespeicherte Regel.",

  // Options page: templates
  "templates.readFailed":
    "JoyFox konnte deine Vorlagen nicht lesen. Es wurde keine Vorlage geändert. Lade die Seite neu, um es noch einmal zu versuchen.",
  "templates.heading": "Nachrichtenvorlagen",
  "templates.hint":
    "In einer JoyClub-Unterhaltung fügt die Schaltfläche „JoyFox-Vorlagen“ unter dem Nachrichtenfeld eine Vorlage an der Cursorposition ein. Du kannst den Text danach noch ändern, und du klickst JoyClubs „Senden“ immer selbst. JoyFox sendet nie eine Nachricht.",
  "templates.noAccount":
    "Wähle unter [Konten](#accounts) ein aktives Konto, um Vorlagen zu speichern.",
  "templates.empty": "Noch keine Vorlagen. Füge unten eine hinzu.",
  "templates.inFolder": (p) => `Vorlagen in ${p.folder}`,
  "templates.edit": "Bearbeiten",
  "templates.editLabel": (p) => `Bearbeiten: Vorlage ${p.name}`,
  "templates.editing": (p) => `Du bearbeitest ${p.name}.`,
  "templates.delete": "Löschen",
  "templates.confirmDelete": "Löschen bestätigen",
  "templates.deleteLabel": (p) => `Löschen: Vorlage ${p.name}`,
  "templates.confirmDeleteLabel": (p) =>
    `Löschen bestätigen: Vorlage ${p.name}`,
  "templates.deletePrompt": (p) =>
    `Klicke auf „Löschen bestätigen“, um ${p.name} zu löschen.`,
  "templates.deleted": (p) => `${p.name} wurde gelöscht.`,
  "templates.addForm": "Vorlage hinzufügen",
  "templates.name": "Name",
  "templates.folder": "Ordner (optional, leer bedeutet Allgemein)",
  "templates.text": "Text",
  "templates.saveChanges": "Änderungen speichern",
  "templates.add": "Vorlage hinzufügen",
  "templates.cancel": "Bearbeiten abbrechen",
  "templates.saved": (p) => `${p.name} wurde gespeichert.`,
  "templates.added": (p) => `${p.name} wurde hinzugefügt.`,
  "templates.accountChanged":
    "Das aktive Konto hat sich geändert, deshalb wurde nichts geändert. Prüfe im Tab „Konten“ das aktive Konto, bevor du es noch einmal versuchst.",

  // Options page: your data
  "entity.extensionAccounts": "Kontodatensatz",
  "entity.joyClubMembers": "Mitglieder",
  "entity.profileSnapshots": "Profil-Momentaufnahmen",
  "entity.userNotes": "Notizen",
  "entity.userTags": "Tags",
  "entity.trustSignals": "Erfasste Erfahrungen",
  "entity.contactRules": "Kontaktregeln",
  "entity.conversationClassifications": "Eigene Einordnungen",
  "entity.savedSearches": "Gespeicherte Suchen",
  "entity.eventMetadata": "Event-Notizen",
  "entity.spendLogEntries": "Ausgabenprotokoll",
  "entity.syncConfigs": "Sync-Einstellungen",
  "entity.extensionPreferences": "Einstellungen",
  "entity.messageTemplates": "Nachrichtenvorlagen",
  "entity.spamPhrases": "Spam-Formulierungen",
  "entity.messageObservations":
    "Zwischengespeicherte Nachrichtentexte (normalisiert)",
  "entity.senderSpamOverrides": "Korrekturen „kein Spam“",
  "entity.actionLogs": "Aktionsprotokoll",
  "entity.messagePhraseMatches": "Gefundene Formulierungen in Nachrichten",
  "entity.cachedMessages": "Gespeicherte Nachrichten (für die Suche)",
  "data.readFailed":
    "JoyFox konnte die gespeicherten Daten nicht lesen. Es wurde nichts geändert. Lade die Seite neu, um es noch einmal zu versuchen.",
  "data.hint":
    "Alles, was JoyFox speichert, bleibt in diesem Browserprofil. Hier kannst du es ansehen, als JSON-Datei speichern und löschen. Löschen hier ändert nie etwas auf JoyClub.",
  "data.importPointer": "Eine Datei importierst du unter [Konten](#accounts).",
  "data.noAccounts": "Noch keine Konten.",
  "data.accountPicker": "Konto zum Ansehen (ändert das aktive Konto nicht)",
  "data.caption": "Gespeicherte Datensätze dieses Kontos",
  "data.col.type": "Datentyp",
  "data.col.records": "Datensätze",
  "data.col.actions": "Aktionen",
  "data.show": "Zeigen",
  "data.hide": "Ausblenden",
  "data.showLabel": (p) => `Zeigen: ${p.label}`,
  "data.hideLabel": (p) => `Ausblenden: ${p.label}`,
  "data.deleteAll": "Alle löschen",
  "data.deleteAllLabel": (p) => `Alle löschen: ${p.label}`,
  "data.deleteAllPrompt": (p, f) =>
    `Klicke auf „Bestätigen“, um alle ${f.number(p.count)} Datensätze „${p.label}“ dieses Kontos zu löschen.`,
  "data.deletedAll": (p) =>
    `Alle Datensätze „${p.label}“ dieses Kontos wurden gelöscht.`,
  "data.recordsTitle": (p, f) => `${p.label} (${f.number(p.count)})`,
  "data.accountRecordHint":
    "Der Kontodatensatz wird nur mit dem ganzen Konto entfernt, unter [Konten](#accounts).",
  "data.recordSummary": (p) => `${p.id} (geändert: ${p.updated})`,
  "data.recordSummaryNamed": (p) =>
    `${p.name}: ${p.id} (geändert: ${p.updated})`,
  "data.recordNamed": (p) => `${p.name} (${p.id})`,
  "data.valueYes": "ja",
  "data.valueNo": "nein",
  "data.valueEmpty": "(leer)",
  "data.rawJson": "Gespeichertes JSON",
  "data.moreCharacters": (p, f) =>
    `…und ${f.number(p.count)} weitere Zeichen (siehe „Gespeichertes JSON“)`,
  "data.moreValues": (p, f) =>
    `…und ${f.number(p.count)} weitere (siehe „Gespeichertes JSON“)`,
  "data.delete": "Löschen",
  "data.deleteRecordLabel": (p) => `Löschen: Datensatz ${p.record}`,
  "data.deleteRecordPrompt": (p) =>
    `Klicke auf „Bestätigen“, um den Datensatz ${p.record} zu löschen.`,
  "data.deletedRecord": (p) => `Datensatz ${p.record} wurde gelöscht.`,
  "data.showMore": (p, f) => `${f.number(p.count)} weitere zeigen`,
  "data.exportAccount": "Dieses Konto exportieren (JSON)",
  "data.exportedAccount": "Der Export dieses Kontos wurde erstellt.",
  "data.deleteAccountData": "Daten dieses Kontos löschen",
  "data.deleteAccountDataLabel":
    "Daten dieses Kontos löschen (alle Datensätze)",
  "data.deleteAccountDataPrompt":
    "Klicke auf „Bestätigen“, um alle Datensätze dieses Kontos zu löschen. Das Konto selbst bleibt unter „Konten“.",
  "data.deletedAccountData":
    "Alle Daten dieses Kontos wurden gelöscht. Das Konto selbst bleibt erhalten.",
  "data.allAccounts": "Alle Konten",
  "data.retentionLabel": "Gespeicherte Profil-Momentaufnahmen je Mitglied",
  "data.retentionHint": (p, f) =>
    `JoyFox behält die neuesten Momentaufnahmen der Profilangaben jedes Mitglieds, immer mindestens die letzte. Eine kleinere Zahl löscht ältere Momentaufnahmen sofort, in allen Konten. Von ${f.number(p.minimum)} bis ${f.number(p.maximum)}; Standard ist ${f.number(p.default)}. Klicke auf „Speichern“, um die Zahl zu übernehmen.`,
  "data.retentionSave": "Speichern",
  "data.retentionConfirm": "Speichern und löschen",
  "data.retentionConfirmPrompt": (p, f) =>
    `Eine kleinere Zahl löscht ältere Momentaufnahmen sofort, in allen Konten: Für jedes Mitglied bleibt nur ${f.plural(
      p.keep,
      {
        one: "die neueste Momentaufnahme",
        other: `die neuesten ${f.number(p.keep)} Momentaufnahmen`,
      },
    )}. Klicke zum Bestätigen auf „Speichern und löschen“.`,
  "data.retentionSaved": (p, f) =>
    p.deleted === 0
      ? "Gespeichert. Keine Momentaufnahme musste gelöscht werden."
      : `Gespeichert. ${f.plural(p.deleted, {
          one: "1 ältere Momentaufnahme wurde",
          other: `${f.number(p.deleted)} ältere Momentaufnahmen wurden`,
        })} gelöscht.`,
  "data.retentionInvalid": (p, f) =>
    `Gib eine ganze Zahl von ${f.number(p.minimum)} bis ${f.number(p.maximum)} ein. Es wurde nichts geändert.`,
  "data.retentionFailed":
    "JoyFox konnte die Einstellung nicht speichern. Das Feld zeigt die Zahl, die jetzt gilt. Versuche es noch einmal.",
  "data.reminderLabel": "An den Export aller Daten erinnern nach (Tagen)",
  "data.reminderHint": (p, f) =>
    `JoyFox-Daten bleiben in diesem Browserprofil, auch wenn du den Browser schließt. Wenn du JoyFox entfernst oder das Profil verlierst, sind die Daten weg. Ein vollständiger Export ist deine Sicherung. Diese Seite bittet um einen, wenn der letzte vollständige Export älter als diese Zahl von Tagen ist. 0 schaltet die Erinnerung aus. Von ${f.number(p.minimum)} bis ${f.number(p.maximum)}; Standard ist ${f.number(p.default)}. Klicke auf „Speichern“, um die Zahl zu übernehmen.`,
  "data.reminderSave": "Speichern",
  "data.reminderSaved": (p, f) =>
    p.days === 0
      ? "Gespeichert. Die Export-Erinnerung ist aus."
      : `Gespeichert. JoyFox erinnert dich ${f.plural(p.days, {
          one: "1 Tag",
          other: `${f.number(p.days)} Tage`,
        })} nach dem letzten vollständigen Export.`,
  "data.reminderInvalid": (p, f) =>
    `Gib eine ganze Zahl von ${f.number(p.minimum)} bis ${f.number(p.maximum)} ein. Es wurde nichts geändert.`,
  "data.reminderNever":
    "Du hast noch nicht alle JoyFox-Daten exportiert. Wenn du JoyFox entfernst oder dieses Browserprofil verlierst, sind die Daten weg. Klicke auf „Alle JoyFox-Daten exportieren (JSON)“, um eine Sicherung zu speichern.",
  "data.reminderDue": (p, f) =>
    `Dein letzter vollständiger Export war ${f.plural(p.days, {
      one: "vor 1 Tag",
      other: `vor ${f.number(p.days)} Tagen`,
    })}. Wenn du JoyFox entfernst oder dieses Browserprofil verlierst, sind neuere Daten weg. Klicke auf „Alle JoyFox-Daten exportieren (JSON)“, um eine Sicherung zu speichern.`,
  "data.lastExport": (p, f) =>
    p.days === 0
      ? "Letzter vollständiger Export: heute."
      : `Letzter vollständiger Export: ${f.plural(p.days, {
          one: "vor 1 Tag",
          other: `vor ${f.number(p.days)} Tagen`,
        })}.`,
  "data.exportAll": "Alle JoyFox-Daten exportieren (JSON)",
  "data.exportedAll": "Der Export aller JoyFox-Daten wurde erstellt.",
  "data.deleteEverything": "Alle JoyFox-Daten löschen",
  "data.deleteEverythingLabel": "Alle JoyFox-Daten löschen (in diesem Browser)",
  "data.deleteEverythingPrompt":
    "Klicke auf „Bestätigen“, um alle Konten, alle Datensätze und alle JoyFox-Einstellungen in diesem Browser zu löschen. Das kann nicht rückgängig gemacht werden.",
  "data.deletedEverything":
    "Alle JoyFox-Daten in diesem Browser wurden gelöscht.",
  "data.confirm": "Bestätigen",
  "data.confirmLabel": (p) => `Bestätigen: ${p.label}`,
  "data.actionFailed":
    "JoyFox konnte das Löschen nicht abschließen. Einige Datensätze sind vielleicht schon gelöscht: Die angezeigten Zahlen zeigen, was noch gespeichert ist. Versuche es noch einmal.",
  "data.exportFailed":
    "JoyFox konnte den Export nicht erstellen. Es wurde nichts exportiert. Versuche es noch einmal.",
  "data.import.title": "Importieren",
  "data.import.hint":
    "Importiere eine JoyFox-Exportdatei: alles oder ein Konto. Sie wird mit dem zusammengeführt, was hier gespeichert ist. Ein Konto mit derselben JoyClub-Kennung wird mit dem vorhandenen Konto zusammengeführt. Bei derselben Notiz, Regel oder Einordnung gewinnt die neuere Version. Vorhandene Tags und Korrekturen bleiben erhalten. Der Import beginnt, sobald du die Datei wählst, und danach siehst du, was sich geändert hat.",
  "data.import.fileLabel": "JoyFox-Exportdatei (JSON)",
  "data.import.summary.all": (p, f) =>
    `Dieser vollständige Export enthält ${f.plural(p.total, {
      one: "1 Konto",
      other: `${f.number(p.total)} Konten`,
    })}: ${f.number(p.matched)} mit einem vorhandenen Konto zusammengeführt, ${f.number(p.added)} neu hinzugefügt.`,
  "data.import.summary.account": (p, f) =>
    `Dieser Export eines einzelnen Kontos enthält ${f.plural(p.total, {
      one: "1 Konto",
      other: `${f.number(p.total)} Konten`,
    })}: ${f.number(p.matched)} mit einem vorhandenen Konto zusammengeführt, ${f.number(p.added)} neu hinzugefügt.`,
  "data.import.caption": "Was der Import geändert hat",
  "data.import.col.added": "Hinzugefügt",
  "data.import.col.replaced": "Ersetzt (neuer)",
  "data.import.col.kept": "Behalten",
  "data.import.col.duplicates": "Übersprungene Duplikate",
  "data.import.noRecords": "Die Datei enthält keine Datensätze.",
  "data.setting.activeAccount": "aktives Konto",
  "data.setting.language": "Sprache",
  "data.setting.messageCaching": "Nachrichten speichern",
  "data.setting.messageRetention": "Nachrichten behalten für",
  "data.setting.quickIgnoreDelete": "Schaltfläche „Ignorieren und löschen“",
  "data.setting.stripCollapsed": "JoyFox-Leiste eingeklappt",
  "data.setting.templatePicker": "Vorlagenauswahl",
  "data.setting.sharedEventException": "Ausnahme für gemeinsame Events",
  "data.setting.snapshotRetention": "Momentaufnahmen je Mitglied",
  "data.setting.exportReminder": "Export-Erinnerung",
  "data.setting.diagnostics": "Diagnose",
  "data.import.settingsUnknown":
    "Die Datei enthält außerdem Einstellungen, die diese JoyFox-Version nicht kennt. Sie wurden nicht importiert.",
  "data.import.settingsSkipped": (p) =>
    `Einstellungen in der Datei, die nie importiert werden (sie schalten Funktionen ein): ${p.keys}.`,
  "data.import.settingsNotSaved": (p) =>
    `Einstellungen, die nicht gespeichert werden konnten: ${p.keys}.`,
  "data.import.settingsAdded": (p) =>
    `Hinzugefügte Einstellungen (nur solche, die hier nicht gesetzt waren): ${p.keys}.`,
  "data.import.running": "Die Datei wird importiert.",
  "data.import.nothing":
    "Alles in dieser Datei ist schon gespeichert. Es wurde nichts geändert.",
  "data.import.complete": (p, f) =>
    `Import abgeschlossen: ${f.number(p.added)} Datensätze hinzugefügt, ${f.number(p.replaced)} durch eine neuere Version ersetzt.`,
  "data.import.completeSettingsFailed": (p, f) =>
    `Import abgeschlossen: ${f.number(p.added)} Datensätze hinzugefügt, ${f.number(p.replaced)} durch eine neuere Version ersetzt. Einige Einstellungen konnten nicht gespeichert werden (siehe oben). Stelle sie selbst noch einmal ein.`,
  "data.import.incomplete":
    "JoyFox konnte den Import nicht abschließen. Wähle die Datei noch einmal, um es erneut zu versuchen: Bereits gespeicherte Datensätze werden nicht doppelt hinzugefügt.",
  "data.import.unreadable":
    "JoyFox konnte diese Datei nicht prüfen. Es wurde nichts importiert. Wähle die Datei noch einmal. Wenn es weiter nicht klappt, lade die Seite neu oder exportiere die Datei noch einmal aus JoyFox.",

  // Errors the UI shows
  "error.withSuffix.nothingChanged": (p) =>
    `${p.error}. Es wurde nichts geändert.`,
  "error.withSuffix.nothingImported": (p) =>
    `${p.error}. Es wurde nichts importiert.`,
  "error.withSuffix.nothingDeleted": (p) =>
    `${p.error}. Es wurde nichts gelöscht.`,
  "error.withSuffix.nothingExported": (p) =>
    `${p.error}. Es wurde nichts exportiert. Versuche es noch einmal.`,
  "error.withSuffix.settingNotChanged": (p) =>
    `${p.error}. Die Einstellung wurde nicht geändert. Versuche es noch einmal.`,
  "error.account.emptyIdentifier":
    "Gib zuerst die Kennung deines JoyClub-Kontos ein",
  "error.account.duplicate":
    "Ein Konto mit dieser Kennung ist schon in der Liste. Verwende dieses Konto oder gib eine andere Kennung ein",
  "error.account.notRegistered":
    "Dieses Konto ist nicht mehr in der Liste, zum Beispiel weil es in einem anderen Tab entfernt wurde",
  "error.account.gone": "Dieses Konto gibt es nicht mehr",
  "error.account.changed": "Das aktive Konto hat sich geändert",
  "error.template.noName": "Eine Vorlage braucht einen Namen",
  "error.template.nameTooLong": (p, f) =>
    `Der Name einer Vorlage darf höchstens ${f.number(p.maximum)} Zeichen haben`,
  "error.template.folderTooLong": (p, f) =>
    `Der Name eines Ordners darf höchstens ${f.number(p.maximum)} Zeichen haben`,
  "error.template.noText": "Eine Vorlage braucht Text",
  "error.template.tooLong": (p, f) =>
    `Eine Vorlage darf höchstens ${f.number(p.maximum)} Zeichen haben`,
  "error.template.deleted": "Diese Vorlage wurde inzwischen gelöscht",
  "error.data.changedDuringCheck":
    "Die gespeicherten Daten haben sich geändert, während JoyFox die Datei geprüft hat. Wähle die Datei noch einmal",
  "error.data.unknownType": "Unbekannter Datentyp",
  "error.data.accountRecord":
    "Der Kontodatensatz wird nur mit dem ganzen Konto entfernt",
  "error.import.tooLarge":
    "Die Datei ist zu groß für einen JoyFox-Export. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.notJson":
    "Die Datei ist kein JoyFox-Export. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.notExport":
    "Die Datei ist kein JoyFox-Export. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.noVersion":
    "Die Datei sagt nicht, welche JoyFox-Version sie erstellt hat. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.newerVersion":
    "Die Datei stammt aus einer neueren JoyFox-Version. Aktualisiere zuerst JoyFox",
  "error.import.noScope":
    "Die Datei sagt nicht, ob sie ein Konto oder alle Daten enthält. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.noAccountNamed":
    "Die Datei ist der Export eines Kontos, nennt das Konto aber nicht. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.unknownType":
    "Die Datei enthält eine Art von Daten, die JoyFox nicht kennt. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.notList": (p) =>
    `Der Teil „${p.entity}“ der Datei ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.notRecord": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.forbiddenKey": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ enthält einen Feldnamen, den JoyFox nicht erlaubt. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.unknownField": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ enthält ein Feld, das JoyFox nicht kennt. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.tooLong": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ enthält einen Text mit mehr als ${f.number(p.maximum)} Zeichen. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.invalid": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.future": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ hat ein Datum in der Zukunft. Prüfe die Uhr des Computers, der die Datei erstellt hat`,
  "error.import.otherAccount": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ gehört zu einem anderen Konto. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.notOwnScope": (p, f) =>
    `Kontodatensatz ${f.number(p.index)} ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.twice": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ kommt in der Datei zweimal vor. Wähle eine Datei, die JoyFox exportiert hat`,
  "error.import.sameIdentifier":
    "Zwei Konten in der Datei haben dieselbe Kennung. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.noAccountRecord":
    "Die Datei ist der Export eines Kontos, enthält dieses Konto aber nicht. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.settingsInvalid":
    "Die Einstellungen in der Datei sind beschädigt. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.settingsForbidden":
    "Die Einstellungen in der Datei enthalten einen Namen, den JoyFox nicht erlaubt. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.unknownSetting":
    "Die Datei enthält eine Einstellung, die JoyFox nicht verwendet. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.orphans":
    "Einige Datensätze in der Datei gehören zu einem Konto, das die Datei nicht enthält. Wähle eine Datei, die JoyFox exportiert hat",
  "error.import.sameRecordTwice":
    "Zwei Datensätze in der Datei würden hier zum selben Datensatz. Wähle eine Datei, die JoyFox exportiert hat",
};
