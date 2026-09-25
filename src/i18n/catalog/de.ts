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
  "placement.quarantined": "Quarantäne",
  "condition.verified": "Von JoyClub geprüft",
  "condition.personallyKnown": "Persönlich bekannt",
  "condition.minimumPhotos": "Mindestanzahl Fotos",
  "condition.minimumProfileWords": "Mindestanzahl Wörter im Profil",
  "condition.minimumAccountAgeDays": "Mindestalter des Kontos in Tagen",
  "condition.notTemplateSpam": "Nicht als Vorlagen-Spam markiert",
  "condition.minimumTrustScore": "Mindest-Vertrauenswert (lokal)",
  "field.accountAgeDays": "Kontoalter in Tagen",
  "field.photoCount": "Anzahl der Fotos",
  "field.profileWordCount": "Wörter im Profil",
  "outcome.qualified": "Qualifiziert",
  "outcome.partial-information": "Unvollständige Angaben",
  "outcome.does-not-meet-rule": "Erfüllt die Regel nicht",
  "common.close": "Schließen",
  "common.openOptions": "JoyFox-Einstellungen öffnen",
  "common.saveFailed":
    "JoyFox konnte diese Änderung nicht speichern. Es wurde nichts geändert.",
  "legacy.text": (p) => p.text,

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
    "Der Prüfstatus ist unbekannt. Er wurde weder dafür noch dagegen gezählt.",
  "triage.reason.verified":
    "Das Profil ist geprüft, wie deine Regel es verlangt.",
  "triage.reason.notVerified":
    "Das Profil ist nicht geprüft. Deine Regel verlangt das aber.",
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
    `Regel ${f.number(p.number)}: ${p.reason}`,
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
    `JoyFox hat JoyClubs Menüpunkt „${p.step}“ nicht gefunden.`,
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
    `Ein neueres „Ignorieren und löschen“ für dieses Mitglied hat begonnen. JoyFox hat deshalb ${p.where} angehalten.`,
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
  "action.report.finished": "„Ignorieren und löschen“ ist fertig.",
  "action.report.running": "„Ignorieren und löschen“ läuft.",
  "action.report.stopped": "„Ignorieren und löschen“ wurde angehalten.",
  "action.report.interrupted":
    "„Ignorieren und löschen“ wurde unterbrochen, zum Beispiel weil der Tab geschlossen wurde.",
  "action.report.nothingChanged": "Auf JoyClub wurde nichts geändert.",
  "action.report.notUndone": "JoyFox hat nichts rückgängig gemacht.",

  // Content script: the Ignore and Delete button and notice
  "quick.progress.Started":
    "„Ignorieren und löschen“ läuft. JoyFox prüft die Seite.",
  "quick.progress.DeleteRequested":
    "Die Unterhaltung wird in den Papierkorb verschoben.",
  "quick.progress.DeleteConfirmed":
    "Papierkorb erledigt. JoyFox öffnet das Profil des Mitglieds, um es dort zu ignorieren.",
  "quick.progress.IgnoreRequested": "Das Mitglied wird auf JoyClub ignoriert.",
  "quick.button": "Ignorieren und löschen",
  "quick.region": "JoyFox: Ignorieren und löschen",
  "quick.scope":
    "Experimentell. Ein Klick verschiebt diese Unterhaltung in JoyClubs Papierkorb, öffnet dann das Profil des Mitglieds und ignoriert es dort. JoyFox hält beim ersten Problem an und sagt dir, was erledigt wurde. JoyFox sendet nie eine Nachricht.",
  "quick.noProfile":
    "JoyFox findet die Profiladresse dieses Mitglieds nicht. Dort ist „Profil ignorieren“. JoyFox hat deshalb nichts getan.",
  "quick.resumed":
    "„Ignorieren und löschen“, fortgesetzt aus der Unterhaltung:",
  "quick.previous":
    "Dein letztes „Ignorieren und löschen“ für dieses Mitglied:",
  "quick.previousOther":
    "Dein letztes „Ignorieren und löschen“ für dieses Mitglied, in einer anderen Unterhaltung:",
  "quick.otherResult":
    "Dein letztes „Ignorieren und löschen“, für eine andere Unterhaltung:",
  "quick.otherRunning":
    "„Ignorieren und löschen“ läuft noch für eine andere Unterhaltung. Warte, bis es fertig ist.",
  "quick.busy":
    "Ein anderes „Ignorieren und löschen“ für dieses Mitglied läuft noch, zum Beispiel in einem anderen Tab. Hier wurde nichts getan.",
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
  "triage.movedOn": (p) =>
    `Du hast diese Person am ${p.date} verschoben. Deine Regel allein würde sie in „${p.placement}“ einordnen.`,
  "triage.move.group": "Diese Person verschieben",
  "triage.move.to": (p) => `Nach „${p.placement}“ verschieben`,
  "triage.move.useRule": "Wieder meine Regel verwenden",
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
  "bar.openProfile": "Profil öffnen",
  "bar.log": "Erfassen:",
  "bar.positive": "Positiv",
  "bar.neutral": "Neutral",
  "bar.negative": "Negativ",
  "bar.undo": "Zurücknehmen",
  "bar.whyAndMove": "Warum und verschieben",
  "bar.scoreDetails": "Details zum Wert",
  "panel.ruleOff.no-rule":
    "Es ist keine Kontaktregel gespeichert, deshalb ordnet JoyFox diese Person nicht ein.",
  "panel.ruleOff.rule-disabled":
    "Deine Kontaktregel ist ausgeschaltet, deshalb ordnet JoyFox diese Person nicht ein.",
  "panel.ruleOff.other": "JoyFox ordnet diese Person nicht ein.",

  // Content script: inbox triage
  "inbox.region": "JoyFox-Sortierung",
  "inbox.views": "Nachrichten zeigen",
  "inbox.view.default": "Posteingang",
  "inbox.view.all": "Alle zeigen",
  "inbox.viewCount": (p, f) => `${p.view} (${f.number(p.count)})`,
  "inbox.about": "Über diese Ansichten",
  "inbox.aboutText":
    "„Posteingang“ blendet Zeilen aus „Quarantäne“ nur in dieser Ansicht aus. Nichts wird gelöscht, und JoyFox ändert nichts auf JoyClub.",
  "inbox.checking": "Wird geprüft",
  "inbox.badge": (p) => `JoyFox: ${p.text}. Grund zeigen.`,
  "inbox.why": "Warum diese Einordnung",
  "inbox.whyNamed": (p) => `Warum: ${p.name}`,
  "inbox.rowGone": "Diese Zeile wird nicht mehr angezeigt.",
  "inbox.unidentified":
    "JoyFox konnte die Profilnummer dieser Person nicht lesen und deine Regel deshalb nicht prüfen. Die Zeile bleibt sichtbar.",
  "inbox.stillChecking": "JoyFox prüft diese Person noch.",

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
  "notes.tagRemoved": "Tag entfernt.",
  "notes.privateNote": "Private Notiz",
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
  "picker.toggle": "JoyFox-Vorlagen",
  "picker.loading": "Vorlagen werden geladen …",
  "picker.readFailed":
    "JoyFox konnte deine Vorlagen nicht lesen. Es wurde nichts eingefügt.",
  "picker.empty":
    "Noch keine Vorlagen. Lege sie in den JoyFox-Einstellungen an.",
  "picker.noAccount":
    "Kein JoyFox-Konto ist aktiv. Wähle eines in den JoyFox-Einstellungen.",
  "picker.result.inserted":
    "Vorlage eingefügt. Prüfe den Text und klicke dann selbst auf JoyClubs „Senden“.",
  "picker.result.not-editable":
    "Das Nachrichtenfeld kann gerade nicht bearbeitet werden. Es wurde nichts eingefügt.",
  "picker.result.too-long":
    "Die Vorlage passt nicht in das Nachrichtenfeld. Es wurde nichts eingefügt, und die Vorlage wurde nicht gekürzt.",
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
  "options.tabs.data": "Deine Daten",
  "options.importRegion": "JoyFox-Daten importieren",

  // Options page: Get started
  "start.state.done": "Erledigt",
  "start.state.off": "Gespeichert, aber ausgeschaltet",
  "start.state.todo": "Noch nicht erledigt",
  "start.ready":
    "JoyFox ist eingerichtet. Öffne deinen JoyClub-Posteingang, um ihn sortiert zu sehen.",
  "start.intro":
    "Drei Schritte, ein paar Minuten. Alles bleibt in diesem Browser.",
  "start.step.account":
    "Füge dein JoyClub-Konto unter [Konten](#accounts) hinzu. JoyFox macht das erste Konto aktiv.",
  "start.step.rule":
    "Speichere eine Kontaktregel unter [Kontaktregel](#rule). Die Sortierung des Posteingangs bleibt aus, bis eine Regel gespeichert und eingeschaltet ist.",
  "start.step.inbox":
    "Öffne deinen JoyClub-Posteingang (www.joyclub.de, ClubMail). JoyFox zeigt seine Tabs über der Liste.",

  // Options page: accounts
  "accounts.readFailed":
    "JoyFox konnte die gespeicherten Konten nicht lesen. Es wurde kein Konto geändert.",
  "accounts.hint":
    "JoyFox kann nicht lesen, mit welchem JoyClub-Login ein Tab arbeitet. Aktiv ist das Konto, das du hier auswählst. Alle Notizen, Tags und Regeln werden darunter gespeichert.",
  "accounts.activeLabel": "Aktives Konto:",
  "accounts.noneSelected": "Keines ausgewählt",
  "accounts.empty":
    "Noch keine Konten. Füge unten ein Konto hinzu, um Notizen und Tags zu speichern.",
  "accounts.list": "Gespeicherte Konten",
  "accounts.active": "Aktiv",
  "accounts.inactive": "Nicht aktiv",
  "accounts.use": "Dieses Konto verwenden",
  "accounts.useLabel": (p) => `Konto ${p.name} verwenden`,
  "accounts.nowActive": (p) => `Aktives Konto ist jetzt ${p.name}.`,
  "accounts.remove": "Entfernen",
  "accounts.confirmRemove": "Entfernen bestätigen",
  "accounts.removeLabel": (p) => `Konto ${p.name} entfernen`,
  "accounts.confirmRemoveLabel": (p) =>
    `Entfernen von Konto ${p.name} und allen seinen Daten bestätigen`,
  "accounts.removePrompt": (p) =>
    `Wenn du ${p.name} entfernst, löscht JoyFox auch die Notizen, Tags und Regeln dieses Kontos. Klicke zum Bestätigen noch einmal.`,
  "accounts.removed": (p) =>
    `${p.name} und die gespeicherten Daten wurden entfernt.`,
  "accounts.addForm": "Konto hinzufügen",
  "accounts.identifier": "JoyClub-Kontokennung",
  "accounts.label": "Anzeigename (optional)",
  "accounts.add": "Konto hinzufügen",
  "accounts.added": (p) => `${p.name} wurde hinzugefügt.`,
  "accounts.saveFailed":
    "Diese Änderung konnte nicht gespeichert werden. Es wurde nichts geändert.",

  // Options page: contact rule
  "rule.readFailed":
    "JoyFox konnte die Kontaktregel nicht lesen. Es wurde keine Regel geändert.",
  "rule.hint":
    "Die Regel ändert nur, wie JoyFox deinen eigenen Posteingang in „Qualifiziert“, „Zu prüfen“ und „Quarantäne“ gruppiert. Sie hält keine Nachricht auf, löscht nichts, und die sendende Person sieht nichts davon.",
  "rule.noAccount":
    "Wähle zuerst ein Konto aus oder füge eines hinzu. Jedes Konto hat seine eigene Regel.",
  "rule.newer":
    "Diese Regel wurde mit einer neueren JoyFox-Version erstellt und kann hier nicht bearbeitet werden. Lösche sie, um eine neue anzulegen.",
  "rule.note.saved": "Für das aktive Konto ist eine Regel gespeichert.",
  "rule.note.none":
    "Für das aktive Konto ist keine Regel gespeichert, deshalb sortiert JoyFox den Posteingang nicht.",
  "rule.enabled": "Meinen JoyClub-Posteingang mit dieser Regel sortieren",
  "rule.placementLabel": "Wer die Regel nicht erfüllt, kommt nach",
  "rule.spamHint":
    "Der Spam-Status ist vorerst unbekannt: JoyFox liest noch keine Nachrichtentexte. Nur deine eigenen Korrekturen „kein Spam“ zählen. Der Posteingang zeigt nur das Prüfsiegel. Fotos, Wörter im Profil und Kontoalter stammen aus Profilen, die du vorher geöffnet hast.",
  "rule.autosaveHint":
    "Änderungen werden automatisch gespeichert: ein Kästchen oder eine Auswahl sofort, eine Zahl, sobald du das Feld verlässt.",
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
  "rule.combine.label": "Wie die Regeln verknüpft werden",
  "rule.combine.prefix": "Eine Person ist qualifiziert bei ",
  "rule.combine.suffix": " dieser Regeln.",
  "rule.advancedHint":
    "Jede Regel ist erfüllt bei ALLEN oder MINDESTENS EINER ihrer Bedingungen, wie du es wählst. Setze ein Häkchen bei „nicht“, um eine Bedingung umzukehren: „nicht Mindestanzahl Fotos 3“ bedeutet weniger als 3 Fotos. Eine Regel ohne Bedingungen wird nicht gespeichert.",
  "rule.addRule": "+ Regel hinzufügen",
  "rule.removeRule": "Regel entfernen",
  "rule.ruleSuffix": " dieser Bedingungen",
  "rule.noConditions": "Noch keine Bedingungen. Füge unten eine hinzu.",
  "rule.removeCondition": "Bedingung entfernen",
  "rule.removeConditionLabel": (p) => `${p.condition} entfernen`,
  "rule.not": "nicht",
  "rule.notTitle": "Diese Bedingung umkehren",
  "rule.notLabel": (p) => `nicht: „${p.condition}“ umkehren`,
  "rule.joiner.all": "UND",
  "rule.joiner.any": "ODER",
  "rule.ruleTitle": (p, f) => `Regel ${f.number(p.number)}: erfüllt bei `,
  "rule.ruleMatchLabel": (p, f) =>
    `Wie Regel ${f.number(p.number)} ihre Bedingungen verknüpft`,
  "rule.removeRuleLabel": (p, f) => `Regel ${f.number(p.number)} entfernen`,
  "rule.addConditionLabel": (p, f) =>
    `Bedingung zu Regel ${f.number(p.number)} hinzufügen`,
  "rule.addCondition": "+ Bedingung hinzufügen …",
  "rule.ruleCount": (p, f) =>
    `${f.number(p.count)} von ${f.number(p.maximum)} Regeln`,
  "rule.simpleUnavailable.all":
    "Die einfache Ansicht ist nicht verfügbar: Die Regeln sind mit ALLEN verknüpft.",
  "rule.simpleUnavailable.not":
    "Die einfache Ansicht ist nicht verfügbar: Die Regel verwendet „nicht“.",
  "rule.simpleUnavailable.severalAll":
    "Die einfache Ansicht ist nicht verfügbar: Mehr als eine Regel verlangt ALLE von mehreren Bedingungen.",
  "rule.simpleUnavailable.duplicate":
    "Die einfache Ansicht ist nicht verfügbar: Eine Bedingung steht in mehr als einer Regel.",
  "rule.savedNoConditions":
    "Regel gespeichert. Sie hat noch keine Bedingungen, deshalb ist jede Person qualifiziert.",
  "rule.savedVacuous":
    "Regel gespeichert. Ohne Einträge im ALLE-Kasten ist jede Person qualifiziert, deshalb wirkt der MINDESTENS-EINE-Kasten nicht.",
  "rule.saved":
    "Regel gespeichert. Offene JoyClub-Tabs werden sofort aktualisiert.",
  "rule.notSaved": (p) => `${p.problem} Die Regel wurde nicht gespeichert.`,
  "rule.saveFailed":
    "JoyFox konnte die Regel nicht speichern. Es wurde nichts geändert.",
  "rule.deleteAll": "Ganze Kontaktregel löschen",
  "rule.removed":
    "Regel entfernt. JoyFox sortiert den Posteingang für dieses Konto nicht mehr.",
  "rule.removeFailed":
    "JoyFox konnte die Regel nicht entfernen. Es wurde nichts geändert.",
  "rule.stale.account.saved":
    "Das aktive Konto hat sich geändert. Die Regel wurde nicht gespeichert. Prüfe das Formular und versuche es noch einmal.",
  "rule.stale.account.removed":
    "Das aktive Konto hat sich geändert. Die Regel wurde nicht entfernt. Prüfe das Formular und versuche es noch einmal.",
  "rule.stale.rule.saved":
    "Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht gespeichert. Das Formular zeigt jetzt die gespeicherte Regel.",
  "rule.stale.rule.removed":
    "Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht entfernt. Das Formular zeigt jetzt die gespeicherte Regel.",
  "rule.changedElsewhere":
    "Die Regel wurde in einem anderen Tab geändert. Das Formular zeigt jetzt die gespeicherte Regel.",

  // Options page: templates
  "templates.readFailed":
    "JoyFox konnte deine Vorlagen nicht lesen. Es wurde keine Vorlage geändert.",
  "templates.heading": "Nachrichtenvorlagen",
  "templates.hint":
    "In einer JoyClub-Unterhaltung fügt die Schaltfläche „JoyFox-Vorlagen“ unter dem Nachrichtenfeld eine Vorlage an der Cursorposition ein. Du kannst den Text danach noch ändern, und du klickst JoyClubs „Senden“ immer selbst. JoyFox sendet nie eine Nachricht.",
  "templates.noAccount":
    "Wähle unter „Konten“ ein aktives Konto, um Vorlagen zu speichern.",
  "templates.empty": "Noch keine Vorlagen. Füge unten eine hinzu.",
  "templates.inFolder": (p) => `Vorlagen in ${p.folder}`,
  "templates.edit": "Bearbeiten",
  "templates.editLabel": (p) => `Vorlage ${p.name} bearbeiten`,
  "templates.editing": (p) => `Du bearbeitest ${p.name}.`,
  "templates.delete": "Löschen",
  "templates.confirmDelete": "Löschen bestätigen",
  "templates.deleteLabel": (p) => `Vorlage ${p.name} löschen`,
  "templates.confirmDeleteLabel": (p) =>
    `Löschen der Vorlage ${p.name} bestätigen`,
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
    "Das aktive Konto hat sich geändert. Es wurde nichts geändert.",

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
  "data.readFailed":
    "JoyFox konnte die gespeicherten Daten nicht lesen. Es wurde nichts geändert.",
  "data.hint":
    "Alles, was JoyFox speichert, bleibt in diesem Browserprofil. Hier kannst du es ansehen, als JSON-Datei speichern und löschen. Löschen hier ändert nie etwas auf JoyClub.",
  "data.noAccounts": "Noch keine Konten.",
  "data.accountPicker": "Angezeigtes Konto",
  "data.caption": "Gespeicherte Datensätze dieses Kontos",
  "data.col.type": "Datentyp",
  "data.col.records": "Datensätze",
  "data.col.actions": "Aktionen",
  "data.show": "Zeigen",
  "data.hide": "Ausblenden",
  "data.showLabel": (p) => `${p.label} zeigen`,
  "data.hideLabel": (p) => `${p.label} ausblenden`,
  "data.deleteAll": "Alle löschen",
  "data.deleteAllLabel": (p) => `Alle Datensätze „${p.label}“ löschen`,
  "data.deleteAllPrompt": (p, f) =>
    `Klicke auf „Bestätigen“, um alle ${f.number(p.count)} Datensätze „${p.label}“ dieses Kontos zu löschen.`,
  "data.deletedAll": (p) =>
    `Alle Datensätze „${p.label}“ dieses Kontos wurden gelöscht.`,
  "data.recordsTitle": (p, f) => `${p.label} (${f.number(p.count)})`,
  "data.accountRecordHint":
    "Der Kontodatensatz wird nur mit dem ganzen Konto entfernt, unter „Konten“.",
  "data.recordSummary": (p) => `${p.id} (geändert: ${p.updated})`,
  "data.delete": "Löschen",
  "data.deleteRecordLabel": (p) => `Datensatz ${p.id} löschen`,
  "data.deleteRecordPrompt": (p) =>
    `Klicke auf „Bestätigen“, um den Datensatz ${p.id} zu löschen.`,
  "data.deletedRecord": (p) => `Datensatz ${p.id} wurde gelöscht.`,
  "data.showMore": (p, f) => `${f.number(p.count)} weitere zeigen`,
  "data.exportAccount": "Dieses Konto exportieren (JSON)",
  "data.exportedAccount": "Der Export dieses Kontos wurde erstellt.",
  "data.deleteAccountData": "Daten dieses Kontos löschen",
  "data.deleteAccountDataLabel": "Alle Daten dieses Kontos löschen",
  "data.deleteAccountDataPrompt":
    "Klicke auf „Bestätigen“, um alle Datensätze dieses Kontos zu löschen. Das Konto selbst bleibt unter „Konten“.",
  "data.deletedAccountData":
    "Alle Daten dieses Kontos wurden gelöscht. Das Konto selbst bleibt erhalten.",
  "data.allAccounts": "Alle Konten",
  "data.exportAll": "Alle JoyFox-Daten exportieren (JSON)",
  "data.exportedAll": "Der Export aller JoyFox-Daten wurde erstellt.",
  "data.deleteEverything": "Alle JoyFox-Daten löschen",
  "data.deleteEverythingLabel": "Alle JoyFox-Daten in diesem Browser löschen",
  "data.deleteEverythingPrompt":
    "Klicke auf „Bestätigen“, um alle Konten, alle Datensätze und alle JoyFox-Einstellungen in diesem Browser zu löschen. Das kann nicht rückgängig gemacht werden.",
  "data.deletedEverything":
    "Alle JoyFox-Daten in diesem Browser wurden gelöscht.",
  "data.confirm": "Bestätigen",
  "data.confirmLabel": (p) => `Bestätigen: ${p.label}`,
  "data.actionFailed":
    "Diese Aktion konnte nicht abgeschlossen werden. Die angezeigten Zahlen zeigen, was jetzt gespeichert ist.",
  "data.import.title": "Importieren",
  "data.import.hint":
    "Importiere eine JoyFox-Exportdatei: alles oder ein Konto. Sie wird mit dem zusammengeführt, was hier gespeichert ist. Ein Konto mit derselben JoyClub-Kennung wird mit dem vorhandenen Konto zusammengeführt. Bei derselben Notiz, Regel oder Einordnung gewinnt die neuere Version. Vorhandene Tags und Korrekturen bleiben erhalten. Der Import beginnt, sobald du die Datei wählst, und danach siehst du, was sich geändert hat.",
  "data.import.fileLabel": "JoyFox-Exportdatei (JSON)",
  "data.import.summary.all": (p, f) =>
    `Dieser vollständige Export enthält ${f.plural(p.matched + p.added, {
      one: "1 Konto",
      other: `${f.number(p.matched + p.added)} Konten`,
    })}: ${f.number(p.matched)} mit einem vorhandenen Konto zusammengeführt, ${f.number(p.added)} neu hinzugefügt.`,
  "data.import.summary.account": (p, f) =>
    `Dieser Export eines einzelnen Kontos enthält ${f.plural(
      p.matched + p.added,
      {
        one: "1 Konto",
        other: `${f.number(p.matched + p.added)} Konten`,
      },
    )}: ${f.number(p.matched)} mit einem vorhandenen Konto zusammengeführt, ${f.number(p.added)} neu hinzugefügt.`,
  "data.import.caption": "Was der Import geändert hat",
  "data.import.col.added": "Hinzugefügt",
  "data.import.col.replaced": "Ersetzt (neuer)",
  "data.import.col.kept": "Behalten",
  "data.import.col.duplicates": "Übersprungene Duplikate",
  "data.import.noRecords": "Die Datei enthält keine Datensätze.",
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
    `Import abgeschlossen: ${f.number(p.added)} Datensätze hinzugefügt, ${f.number(p.replaced)} durch eine neuere Version ersetzt. Einige Einstellungen konnten nicht gespeichert werden. Prüfe das aktive Konto.`,
  "data.import.incomplete":
    "Der Import konnte nicht abgeschlossen werden. Die angezeigten Zahlen zeigen, was jetzt gespeichert ist.",
  "data.import.unreadable":
    "JoyFox konnte diese Datei nicht lesen. Es wurde nichts importiert.",

  // Errors the UI shows
  "error.withSuffix.nothingChanged": (p) =>
    `${p.error}. Es wurde nichts geändert.`,
  "error.withSuffix.nothingImported": (p) =>
    `${p.error}. Es wurde nichts importiert.`,
  "error.withSuffix.nothingDeleted": (p) =>
    `${p.error}. Es wurde nichts gelöscht.`,
  "error.code.SelectorUnavailable":
    "JoyFox findet das erwartete Element auf der Seite nicht",
  "error.code.ExtractionInvalid": "Die Daten sind ungültig",
  "error.code.IdentityMismatch": "Konto oder Mitglied passen nicht zusammen",
  "error.code.StorageError":
    "JoyFox konnte seine gespeicherten Daten nicht lesen oder schreiben",
  "error.code.RuleEvaluationError":
    "Die Kontaktregel konnte nicht geprüft werden",
  "error.code.ActionStepFailed":
    "Ein Schritt auf JoyClub wurde nicht abgeschlossen",
  "error.code.NavigationTimeout": "Die Seite hat nicht rechtzeitig geladen",
  "error.code.UnsupportedPage": "JoyFox unterstützt diese Seite nicht",
  "error.account.emptyIdentifier": "Ein Konto braucht eine Kennung",
  "error.account.duplicate": "Diese Kontokennung ist schon gespeichert",
  "error.account.notRegistered":
    "Ein Konto, das nicht gespeichert ist, kann nicht aktiv werden",
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
  "error.import.tooLarge": "Die Datei ist zu groß für einen JoyFox-Export",
  "error.import.notJson":
    "Die Datei ist kein JoyFox-Export (kein gültiges JSON)",
  "error.import.notExport": "Die Datei ist kein JoyFox-Export",
  "error.import.noVersion": "Die Datei hat keine gültige Schemaversion",
  "error.import.newerVersion":
    "Die Datei stammt aus einer neueren JoyFox-Version. Aktualisiere zuerst JoyFox",
  "error.import.noScope": "Die Datei hat keinen gültigen Exportumfang",
  "error.import.noAccountNamed": "Der Kontoexport nennt kein Konto",
  "error.import.unknownType": (p) =>
    `Die Datei enthält einen unbekannten Datentyp (${p.name})`,
  "error.import.notList": (p) => `„${p.entity}“ ist in der Datei keine Liste`,
  "error.import.notRecord": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ ist kein Datensatz`,
  "error.import.forbiddenKey": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ enthält einen verbotenen Schlüssel`,
  "error.import.unknownField": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ enthält ein unbekanntes Feld (${p.field})`,
  "error.import.tooLong": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ ist ungültig: ${p.field} hat mehr als ${f.number(p.maximum)} Zeichen`,
  "error.import.invalid": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ ist ungültig`,
  "error.import.future": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ hat ein Datum in der Zukunft`,
  "error.import.otherAccount": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ gehört zu einem anderen Konto`,
  "error.import.notOwnScope": (p, f) =>
    `Kontodatensatz ${f.number(p.index)} gehört nicht zu sich selbst`,
  "error.import.twice": (p, f) =>
    `Eintrag ${f.number(p.index)} in „${p.entity}“ kommt zweimal vor`,
  "error.import.sameIdentifier":
    "Zwei Konten in der Datei haben dieselbe Kennung",
  "error.import.noAccountRecord":
    "Der Kontoexport enthält keinen Kontodatensatz",
  "error.import.settingsInvalid":
    "Die Einstellungen in der Datei sind ungültig",
  "error.import.settingsForbidden":
    "Die Einstellungen in der Datei enthalten einen verbotenen Schlüssel",
  "error.import.unknownSetting": (p) =>
    `Die Datei enthält eine Einstellung, die JoyFox nicht verwendet (${p.key})`,
  "error.import.orphans":
    "Einige Datensätze in der Datei gehören zu einem Konto, das die Datei nicht enthält",
  "error.import.sameRecordTwice":
    "Die Datei enthält nach dem Zusammenführen der Konten denselben Datensatz zweimal",
};
