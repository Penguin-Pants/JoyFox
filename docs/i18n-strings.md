# JoyFox UI strings: English and German

Generated from `src/i18n/catalog/en.ts` and `src/i18n/catalog/de.ts` for
the owner's review (docs/i18n-spec.md, Section 1). Do not edit by hand:
change the catalogs, then run
`UPDATE_I18N_TABLE=1 npx vitest run tests/unit/i18n-table.test.ts`.
`npm test` fails while this file does not match the catalogs.

`{name}` is a value filled in when the text is shown. `a / b` shows the
singular and the plural form. Brand names and JoyClub's own German labels
stay as they are.

## placement

| Key | English | Deutsch |
| --- | --- | --- |
| `placement.qualified` | Qualified | Qualifiziert |
| `placement.needs-review` | Needs Review | Zu prüfen |
| `placement.quarantined` | Quarantined | Quarantäne |

## condition

| Key | English | Deutsch |
| --- | --- | --- |
| `condition.verified` | Verified by JoyClub | Verifiziert |
| `condition.personallyKnown` | Personally known | Persönlich bekannt |
| `condition.minimumPhotos` | Minimum photos | Mindestanzahl Fotos |
| `condition.minimumProfileWords` | Minimum profile words | Mindestanzahl Wörter im Profil |
| `condition.minimumAccountAgeDays` | Minimum account age in days | Mindestalter des Kontos in Tagen |
| `condition.notTemplateSpam` | Not flagged as template spam | Nicht als Vorlagen-Spam markiert |
| `condition.minimumTrustScore` | Minimum local trust score | Mindest-Vertrauenswert (lokal) |

## field

| Key | English | Deutsch |
| --- | --- | --- |
| `field.accountAgeDays` | Account age in days | Kontoalter in Tagen |
| `field.photoCount` | Photo count | Anzahl der Fotos |
| `field.profileWordCount` | Profile word count | Wörter im Profil |

## outcome

| Key | English | Deutsch |
| --- | --- | --- |
| `outcome.qualified` | Qualified | Qualifiziert |
| `outcome.partial-information` | Partial information | Unvollständige Angaben |
| `outcome.does-not-meet-rule` | Does not meet rule | Erfüllt die Regel nicht |

## common

| Key | English | Deutsch |
| --- | --- | --- |
| `common.close` | Close | Schließen |
| `common.openOptions` | Open JoyFox options | JoyFox-Einstellungen öffnen |
| `common.saveFailed` | JoyFox could not save that change. Nothing was changed. | JoyFox konnte diese Änderung nicht speichern. Es wurde nichts geändert. |

## legacy

| Key | English | Deutsch |
| --- | --- | --- |
| `legacy.text` | {text} | {text} |

## triage

| Key | English | Deutsch |
| --- | --- | --- |
| `triage.reason.unknownValue` | {field} is unknown, so it was not counted for or against. | {field}: unbekannt. Der Wert wurde weder dafür noch dagegen gezählt. |
| `triage.reason.atOrAbove` | {field} is {value}, at or above the required {minimum}. | {field}: {value}. Das erreicht den geforderten Mindestwert {minimum}. |
| `triage.reason.belowMinimum` | {field} is {value}, below the required {minimum}. | {field}: {value}. Das liegt unter dem geforderten Mindestwert {minimum}. |
| `triage.reason.accountAgeRangeAbove` | Account age is between {min} and {max} days, at or above the required {minimum}. | Kontoalter: zwischen {min} und {max} Tagen. Das erreicht den geforderten Mindestwert {minimum}. |
| `triage.reason.accountAgeRangeBelow` | Account age is between {min} and {max} days, below the required {minimum}. | Kontoalter: zwischen {min} und {max} Tagen. Das liegt unter dem geforderten Mindestwert {minimum}. |
| `triage.reason.accountAgeRangeCoarse` | Account age is between {min} and {max} days, which is too coarse to compare with the required {minimum}, so it was not counted for or against. | Kontoalter: zwischen {min} und {max} Tagen. Das ist zu ungenau für einen Vergleich mit dem geforderten Mindestwert {minimum}, deshalb wurde es weder dafür noch dagegen gezählt. |
| `triage.reason.verificationUnknown` | Verification status is unknown, so it was not counted for or against. | Der Verifizierungsstatus ist unbekannt. Er wurde weder dafür noch dagegen gezählt. |
| `triage.reason.verified` | The profile is verified, as the rule requires. | Das Profil ist verifiziert, wie deine Regel es verlangt. |
| `triage.reason.notVerified` | The profile is not verified, which the rule requires. | Das Profil ist nicht verifiziert. Deine Regel verlangt das aber. |
| `triage.reason.personallyKnownUnknown` | Whether you know this member personally is unknown, so it was not counted for or against. | Ob du dieses Mitglied persönlich kennst, ist unbekannt. Das wurde weder dafür noch dagegen gezählt. |
| `triage.reason.personallyKnown` | You marked this member as personally known, as the rule requires. | Du hast dieses Mitglied als persönlich bekannt markiert, wie deine Regel es verlangt. |
| `triage.reason.notPersonallyKnown` | You have not marked this member as personally known, which the rule requires. | Du hast dieses Mitglied nicht als persönlich bekannt markiert. Deine Regel verlangt das aber. |
| `triage.reason.noCriteria` | No qualification criteria are configured, so every sender qualifies. | Es sind keine Kriterien eingestellt, deshalb ist jede Person qualifiziert. |
| `triage.reason.spamFlagged` | A message from this sender looks like a copied template. | Eine Nachricht dieser Person sieht wie eine kopierte Vorlage aus. |
| `triage.reason.spamNotFlagged` | No message from this sender looks like a copied template. | Keine Nachricht dieser Person sieht wie eine kopierte Vorlage aus. |
| `triage.reason.spamOverridden` | You marked this sender as not spam. | Du hast diese Person als „kein Spam“ markiert. |
| `triage.reason.spamUnknown` | JoyFox has not checked this sender's messages for templates, so spam status is unknown. | JoyFox hat die Nachrichten dieser Person nicht auf Vorlagen geprüft. Der Spam-Status ist deshalb unbekannt. |
| `triage.reason.trustUnknown` | You have logged nothing about this member, so the local trust score is unknown. | Du hast zu diesem Mitglied nichts erfasst. Der lokale Vertrauenswert ist deshalb unbekannt. |
| `triage.reason.trustAtOrAbove` | Your local trust score is {score}, at or above the required {minimum}. | Dein lokaler Vertrauenswert: {score}. Das erreicht den geforderten Mindestwert {minimum}. |
| `triage.reason.trustBelow` | Your local trust score is {score}, below the required {minimum}. | Dein lokaler Vertrauenswert: {score}. Das liegt unter dem geforderten Mindestwert {minimum}. |
| `triage.reason.negatedMet` | {reason} Your rule says "not {condition}", so this counts as met. | {reason} Deine Regel sagt „nicht {condition}“, deshalb zählt das als erfüllt. |
| `triage.reason.negatedNotMet` | {reason} Your rule says "not {condition}", so this counts as not met. | {reason} Deine Regel sagt „nicht {condition}“, deshalb zählt das als nicht erfüllt. |
| `triage.reason.unknownNeedsReview` | {reason} Your rule sends unknown values to Needs Review. | {reason} Deine Regel ordnet unbekannte Werte in „Zu prüfen“ ein. |
| `triage.reason.unknownMet` | {reason} Your rule counts an unknown value as met. | {reason} Deine Regel zählt einen unbekannten Wert als erfüllt. |
| `triage.reason.unknownNotMet` | {reason} Your rule counts an unknown value as not met. | {reason} Deine Regel zählt einen unbekannten Wert als nicht erfüllt. |
| `triage.reason.numbered` | Rule {number}: {reason} | Regel {number}: {reason} |
| `triage.reason.userMoved` | You moved this sender to {placement}. | Du hast diese Person nach „{placement}“ verschoben. |
| `triage.headline.noConditions` | Your contact rule has no required conditions, so every sender qualifies. | Deine Kontaktregel hat keine Pflichtbedingungen, deshalb ist jede Person qualifiziert. |
| `triage.headline.meets` | This sender meets your contact rule. | Diese Person erfüllt deine Kontaktregel. |
| `triage.headline.undecided` | JoyFox could not decide, because some information is unknown. | JoyFox konnte nicht entscheiden, weil einige Angaben unbekannt sind. |
| `triage.headline.doesNotMeet` | This sender does not meet your contact rule, so it goes to {placement}. | Diese Person erfüllt deine Kontaktregel nicht und kommt deshalb nach „{placement}“. |

## trust

| Key | English | Deutsch |
| --- | --- | --- |
| `trust.reason.positive` | You logged 1 positive outcome / {count} positive outcomes. | Du hast 1 positive Erfahrung / {count} positive Erfahrungen erfasst. |
| `trust.reason.negative` | You logged 1 negative outcome / {count} negative outcomes. | Du hast 1 negative Erfahrung / {count} negative Erfahrungen erfasst. |
| `trust.reason.neutral` | You logged 1 neutral outcome / {count} neutral outcomes, which count 0. | Du hast 1 neutrale Erfahrung / {count} neutrale Erfahrungen erfasst. Neutrale Erfahrungen zählen 0. |
| `trust.reason.personallyKnown` | You marked this member as personally known. | Du hast dieses Mitglied als persönlich bekannt markiert. |
| `trust.reason.spamFlagged` | A message from this member looks like a copied template. | Eine Nachricht dieses Mitglieds sieht wie eine kopierte Vorlage aus. |
| `trust.scopeNote` | Based only on what you logged and saw in this browser. It is not a JoyClub or community rating. | Beruht nur auf dem, was du in diesem Browser erfasst und gesehen hast. Es ist keine Bewertung von JoyClub oder der Community. |

## spam

| Key | English | Deutsch |
| --- | --- | --- |
| `spam.detail.override` | You marked this sender as not spam, so their messages are never flagged. | Du hast diese Person als „kein Spam“ markiert. Ihre Nachrichten werden deshalb nie markiert. |
| `spam.detail.belowMinimum` | The message has 1 word / {words} words, below the {minimum} needed before template matching runs. | Die Nachricht hat 1 Wort / {words} Wörter. Für den Vorlagenvergleich sind mindestens {minimum} nötig. |
| `spam.detail.duplicate` | This message closely matches an earlier message you received ({percent}% similar). | Diese Nachricht gleicht stark einer früheren Nachricht an dich ({percent} % ähnlich). |
| `spam.detail.knownPhrase` | The message contains a phrase from your known-template list. | Die Nachricht enthält eine Formulierung aus deiner Liste bekannter Vorlagen. |
| `spam.detail.phraseSimilar` | The message closely matches a phrase from your known-template list ({percent}% similar). | Die Nachricht gleicht stark einer Formulierung aus deiner Liste bekannter Vorlagen ({percent} % ähnlich). |
| `spam.detail.noMatch` | The message matched no earlier message and no known template phrase. | Die Nachricht gleicht keiner früheren Nachricht und keiner bekannten Vorlagen-Formulierung. |

## action

| Key | English | Deutsch |
| --- | --- | --- |
| `action.step.ignore` | Ignore | Profil ignorieren |
| `action.step.delete` | Delete | In den Papierkorb schieben |
| `action.where.before` | before {step} | vor „{step}“ |
| `action.where.during` | during {step} | während „{step}“ |
| `action.failure.control-missing` | JoyFox could not find JoyClub's {step} control. | JoyFox hat JoyClubs Menüpunkt „{step}“ nicht gefunden. |
| `action.failure.confirmation-missing` | JoyClub's confirmation for {step} did not appear. | JoyClubs Bestätigung für „{step}“ ist nicht erschienen. |
| `action.failure.not-verified` | JoyClub did not show that {step} succeeded. | JoyClub hat nicht angezeigt, dass „{step}“ geklappt hat. |
| `action.failure.unverifiable` | JoyFox cannot see JoyClub's result for {step} on this page, so it stopped {where}. | JoyFox kann JoyClubs Ergebnis für „{step}“ auf dieser Seite nicht sehen und hat deshalb {where} angehalten. |
| `action.failure.member-mismatch` | The page showed another member, so JoyFox stopped {where}. | Die Seite hat ein anderes Mitglied gezeigt. JoyFox hat deshalb {where} angehalten. |
| `action.failure.conversation-mismatch` | The page showed another conversation, so JoyFox stopped {where}. | Die Seite hat eine andere Unterhaltung gezeigt. JoyFox hat deshalb {where} angehalten. |
| `action.failure.identity-unavailable` | JoyFox could not confirm which member or conversation the page shows, so it stopped {where}. | JoyFox konnte nicht bestätigen, welches Mitglied oder welche Unterhaltung die Seite zeigt, und hat deshalb {where} angehalten. |
| `action.failure.account-changed` | The active JoyFox account changed, so JoyFox stopped {where}. | Das aktive JoyFox-Konto hat sich geändert. JoyFox hat deshalb {where} angehalten. |
| `action.failure.turned-off` | Ignore and Delete was turned off, so JoyFox stopped {where}. | „Ignorieren und löschen“ wurde ausgeschaltet. JoyFox hat deshalb {where} angehalten. |
| `action.failure.superseded` | A newer Ignore and Delete for this member started, so JoyFox stopped {where}. | Ein neueres „Ignorieren und löschen“ für dieses Mitglied hat begonnen. JoyFox hat deshalb {where} angehalten. |
| `action.failure.log-unavailable` | JoyFox could not write to its action log, so it stopped {where}. | JoyFox konnte nicht in sein Aktionsprotokoll schreiben und hat deshalb {where} angehalten. |
| `action.failure.handoff-failed` | JoyFox could not move on to the member's profile, so it stopped {where}. | JoyFox konnte nicht zum Profil des Mitglieds wechseln und hat deshalb {where} angehalten. |
| `action.failure.timeout` | JoyClub did not respond in time during {step}. | JoyClub hat während „{step}“ nicht rechtzeitig reagiert. |
| `action.failure.step-error` | An unexpected error stopped JoyFox {where}. | Ein unerwarteter Fehler hat JoyFox {where} angehalten. |
| `action.stepText.ignore.done` | Ignore: done. JoyClub ignores this member. | Profil ignorieren: erledigt. JoyClub ignoriert dieses Mitglied. |
| `action.stepText.ignore.not-done` | Ignore: not done. | Profil ignorieren: nicht erledigt. |
| `action.stepText.ignore.unknown` | Ignore: not confirmed. JoyFox started it but did not see JoyClub confirm it. | Profil ignorieren: nicht bestätigt. JoyFox hat den Schritt begonnen, aber keine Bestätigung von JoyClub gesehen. |
| `action.stepText.delete.done` | Delete: done. JoyClub moved the conversation to the trash. | In den Papierkorb schieben: erledigt. JoyClub hat die Unterhaltung in den Papierkorb verschoben. |
| `action.stepText.delete.not-done` | Delete: not done. | In den Papierkorb schieben: nicht erledigt. |
| `action.stepText.delete.unknown` | Delete: not confirmed. JoyFox started it but did not see JoyClub confirm it. | In den Papierkorb schieben: nicht bestätigt. JoyFox hat den Schritt begonnen, aber keine Bestätigung von JoyClub gesehen. |
| `action.next.ignore` | Next: open the member's profile and check whether they are ignored. If not, ignore them there yourself. | Nächster Schritt: Öffne das Profil des Mitglieds und prüfe, ob es ignoriert wird. Wenn nicht, ignoriere es dort selbst. |
| `action.next.delete` | Next: open the conversation and check whether it is in the trash. If not, move it there yourself with JoyClub's trash button. | Nächster Schritt: Öffne die Unterhaltung und prüfe, ob sie im Papierkorb ist. Wenn nicht, verschiebe sie selbst mit „In den Papierkorb schieben“. |
| `action.report.finished` | Ignore and Delete finished. | „Ignorieren und löschen“ ist fertig. |
| `action.report.running` | Ignore and Delete is running. | „Ignorieren und löschen“ läuft. |
| `action.report.stopped` | Ignore and Delete stopped. | „Ignorieren und löschen“ wurde angehalten. |
| `action.report.interrupted` | Ignore and Delete was interrupted, for example because the tab closed. | „Ignorieren und löschen“ wurde unterbrochen, zum Beispiel weil der Tab geschlossen wurde. |
| `action.report.nothingChanged` | Nothing was changed on JoyClub. | Auf JoyClub wurde nichts geändert. |
| `action.report.notUndone` | JoyFox did not undo anything. | JoyFox hat nichts rückgängig gemacht. |

## quick

| Key | English | Deutsch |
| --- | --- | --- |
| `quick.progress.Started` | Ignore and Delete is running. Checking the page. | „Ignorieren und löschen“ läuft. JoyFox prüft die Seite. |
| `quick.progress.DeleteRequested` | Moving the conversation to the trash. | Die Unterhaltung wird in den Papierkorb verschoben. |
| `quick.progress.DeleteConfirmed` | Delete done. Opening the member's profile to ignore them there. | Papierkorb erledigt. JoyFox öffnet das Profil des Mitglieds, um es dort zu ignorieren. |
| `quick.progress.IgnoreRequested` | Ignoring the member on JoyClub. | Das Mitglied wird auf JoyClub ignoriert. |
| `quick.button` | Ignore and Delete | Ignorieren und löschen |
| `quick.region` | JoyFox Ignore and Delete | JoyFox: Ignorieren und löschen |
| `quick.scope` | Experimental. One click moves this conversation to JoyClub's trash, then opens the member's profile and ignores them there. JoyFox stops at the first problem and tells you what was done. It never sends a message. | Experimentell. Ein Klick verschiebt diese Unterhaltung in JoyClubs Papierkorb, öffnet dann das Profil des Mitglieds und ignoriert es dort. JoyFox hält beim ersten Problem an und sagt dir, was erledigt wurde. JoyFox sendet nie eine Nachricht. |
| `quick.noProfile` | JoyFox cannot find this member's profile address, where Ignore is, so it did nothing. | JoyFox findet die Profiladresse dieses Mitglieds nicht. Dort ist „Profil ignorieren“. JoyFox hat deshalb nichts getan. |
| `quick.resumed` | Ignore and Delete, continued from the conversation: | „Ignorieren und löschen“, fortgesetzt aus der Unterhaltung: |
| `quick.previous` | Your last Ignore and Delete for this member: | Dein letztes „Ignorieren und löschen“ für dieses Mitglied: |
| `quick.previousOther` | Your last Ignore and Delete for this member, in another conversation: | Dein letztes „Ignorieren und löschen“ für dieses Mitglied, in einer anderen Unterhaltung: |
| `quick.otherResult` | Your last Ignore and Delete, for another conversation: | Dein letztes „Ignorieren und löschen“, für eine andere Unterhaltung: |
| `quick.otherRunning` | Ignore and Delete is still running for another conversation. Wait until it ends. | „Ignorieren und löschen“ läuft noch für eine andere Unterhaltung. Warte, bis es fertig ist. |
| `quick.busy` | Another Ignore and Delete for this member is still running, for example in another tab. Nothing was done here. | Ein anderes „Ignorieren und löschen“ für dieses Mitglied läuft noch, zum Beispiel in einem anderen Tab. Hier wurde nichts getan. |
| `quick.unexpected` | Ignore and Delete stopped because of an unexpected error. JoyFox may have completed a step: check the member's profile and the conversation yourself. | „Ignorieren und löschen“ wurde durch einen unerwarteten Fehler angehalten. Vielleicht hat JoyFox einen Schritt erledigt: Prüfe selbst das Profil des Mitglieds und die Unterhaltung. |

## triage

| Key | English | Deutsch |
| --- | --- | --- |
| `triage.outcome.met` | Met | Erfüllt |
| `triage.outcome.not-met` | Not met | Nicht erfüllt |
| `triage.outcome.needs-review` | Needs review | Zu prüfen |
| `triage.conditions.summary` | All conditions checked ({count}) | Alle geprüften Bedingungen ({count}) |
| `triage.condition.line` | {outcome}: {condition}. | {outcome}: {condition}. |
| `triage.condition.lineNegated` | {outcome}: not {condition}. | {outcome}: nicht {condition}. |
| `triage.placementLine` | Placement: {placement} ({source}). | Einordnung: {placement} ({source}). |
| `triage.source.override` | your manual choice | deine eigene Wahl |
| `triage.source.rule` | your contact rule | deine Kontaktregel |
| `triage.movedOn` | You moved this sender on {date}. Your rule alone would place it in {placement}. | Du hast diese Person am {date} verschoben. Deine Regel allein würde sie in „{placement}“ einordnen. |
| `triage.move.group` | Move this sender | Diese Person verschieben |
| `triage.move.to` | Move to {placement} | Nach „{placement}“ verschieben |
| `triage.move.useRule` | Use my rule again | Wieder meine Regel verwenden |
| `triage.profileFact.minimumPhotos` | photo count | Anzahl der Fotos |
| `triage.profileFact.minimumProfileWords` | profile word count | Wörter im Profil |
| `triage.profileFact.minimumAccountAgeDays` | account age | Kontoalter |
| `triage.unknownFacts.one` | The {fact} is unknown. Open the profile and JoyFox reads it. | {fact}: unbekannt. Öffne das Profil, dann liest JoyFox den Wert. |
| `triage.unknownFacts.two` | The {first} and {second} are unknown. Open the profile and JoyFox reads them. | {first} und {second}: unbekannt. Öffne das Profil, dann liest JoyFox die Werte. |
| `triage.unknownFacts.three` | The {first}, {second} and {third} are unknown. Open the profile and JoyFox reads them. | {first}, {second} und {third}: unbekannt. Öffne das Profil, dann liest JoyFox die Werte. |

## trust

| Key | English | Deutsch |
| --- | --- | --- |
| `trust.score.none` | Local trust score: no history yet. | Lokaler Vertrauenswert: noch keine Einträge. |
| `trust.score.value` | Local trust score: {score}. | Lokaler Vertrauenswert: {score}. |
| `trust.details.summary` | How the score adds up | So setzt sich der Wert zusammen |
| `trust.contribution` | {points}: {reason} | {points}: {reason} |
| `trust.log.group` | Log an outcome with this member | Erfahrung mit diesem Mitglied erfassen |
| `trust.log.positive` | Log positive | Positive Erfahrung erfassen |
| `trust.log.neutral` | Log neutral | Neutrale Erfahrung erfassen |
| `trust.log.negative` | Log negative | Negative Erfahrung erfassen |
| `trust.log.undo` | Undo last outcome | Letzte Erfahrung zurücknehmen |

## bar

| Key | English | Deutsch |
| --- | --- | --- |
| `bar.placementPrefix` | Placement: | Einordnung: |
| `bar.yourChoice` | (your choice) | (deine Wahl) |
| `bar.openProfile` | Open profile | Profil öffnen |
| `bar.log` | Log: | Erfassen: |
| `bar.positive` | Positive | Positiv |
| `bar.neutral` | Neutral | Neutral |
| `bar.negative` | Negative | Negativ |
| `bar.undo` | Undo | Zurücknehmen |
| `bar.whyAndMove` | Why and move | Warum und verschieben |
| `bar.scoreDetails` | Score details | Details zum Wert |

## panel

| Key | English | Deutsch |
| --- | --- | --- |
| `panel.ruleOff.no-rule` | No contact rule is set, so JoyFox does not place this sender. | Es ist keine Kontaktregel gespeichert, deshalb ordnet JoyFox diese Person nicht ein. |
| `panel.ruleOff.rule-disabled` | Your contact rule is turned off, so JoyFox does not place this sender. | Deine Kontaktregel ist ausgeschaltet, deshalb ordnet JoyFox diese Person nicht ein. |
| `panel.ruleOff.other` | JoyFox does not place this sender. | JoyFox ordnet diese Person nicht ein. |

## inbox

| Key | English | Deutsch |
| --- | --- | --- |
| `inbox.region` | JoyFox triage | JoyFox-Sortierung |
| `inbox.views` | Show messages | Nachrichten zeigen |
| `inbox.view.default` | Inbox | Posteingang |
| `inbox.view.all` | Show all | Alle zeigen |
| `inbox.viewCount` | {view} ({count}) | {view} ({count}) |
| `inbox.about` | About these views | Über diese Ansichten |
| `inbox.aboutText` | Inbox hides Quarantined rows from this view only. Nothing is deleted, and JoyFox changes nothing on JoyClub. | „Posteingang“ blendet Zeilen aus „Quarantäne“ nur in dieser Ansicht aus. Nichts wird gelöscht, und JoyFox ändert nichts auf JoyClub. |
| `inbox.checking` | Checking | Wird geprüft |
| `inbox.badge` | JoyFox: {text}. Show why. | JoyFox: {text}. Grund zeigen. |
| `inbox.why` | Why this placement | Warum diese Einordnung |
| `inbox.whyNamed` | Why: {name} | Warum: {name} |
| `inbox.rowGone` | This row is no longer shown. | Diese Zeile wird nicht mehr angezeigt. |
| `inbox.unidentified` | JoyFox could not read this sender's profile number, so it could not check your rule. The row stays visible. | JoyFox konnte die Profilnummer dieser Person nicht lesen und deine Regel deshalb nicht prüfen. Die Zeile bleibt sichtbar. |
| `inbox.stillChecking` | JoyFox is still checking this sender. | JoyFox prüft diese Person noch. |

## notes

| Key | English | Deutsch |
| --- | --- | --- |
| `notes.region` | JoyFox notes and tags | JoyFox-Notizen und -Tags |
| `notes.scope` | Private to JoyFox: stored only in this browser, under the active JoyFox account. JoyFox never sends it anywhere. | Nur für dich in JoyFox: gespeichert nur in diesem Browser, unter dem aktiven JoyFox-Konto. JoyFox sendet sie nie irgendwohin. |
| `notes.saved` | Note saved. | Notiz gespeichert. |
| `notes.removed` | Note removed. | Notiz entfernt. |
| `notes.conflict` | This note changed in another tab or in the JoyFox data inspector, so JoyFox did not save your text. It is still in the box. Save again to replace the stored note, or discard your changes to see it. | Diese Notiz wurde in einem anderen Tab oder in der JoyFox-Datenansicht geändert. JoyFox hat deinen Text deshalb nicht gespeichert. Er steht noch im Feld. Speichere noch einmal, um die gespeicherte Notiz zu ersetzen, oder verwirf deine Änderungen, um sie zu sehen. |
| `notes.refused` | The active JoyFox account changed, so nothing was stored. Text typed for the previous account was dropped. | Das aktive JoyFox-Konto hat sich geändert, deshalb wurde nichts gespeichert. Text, den du für das vorherige Konto eingegeben hast, wurde verworfen. |
| `notes.emptyTag` | Type a tag first. Nothing was added. | Gib zuerst einen Tag ein. Es wurde nichts hinzugefügt. |
| `notes.emptyNote` | Type a note first. Nothing was saved. | Gib zuerst eine Notiz ein. Es wurde nichts gespeichert. |
| `notes.tagAdded` | Tag added. | Tag hinzugefügt. |
| `notes.tagRemoved` | Tag removed. | Tag entfernt. |
| `notes.privateNote` | Private note | Private Notiz |
| `notes.discard` | Discard my changes | Meine Änderungen verwerfen |
| `notes.save` | Save note | Notiz speichern |
| `notes.tags` | Tags | Tags |
| `notes.noTags` | No tags yet. | Noch keine Tags. |
| `notes.remove` | Remove | Entfernen |
| `notes.removeTag` | Remove tag {label} | Tag {label} entfernen |
| `notes.addTagLabel` | Add a tag | Tag hinzufügen |
| `notes.addTag` | Add tag | Hinzufügen |
| `notes.summary.none` | Your notes and tags (none yet) | Deine Notizen und Tags (noch keine) |
| `notes.summary.note` | Your notes and tags (a note) | Deine Notizen und Tags (eine Notiz) |
| `notes.summary.tags` | Your notes and tags (1 tag / {count} tags) | Deine Notizen und Tags (1 Tag / {count} Tags) |
| `notes.summary.noteAndTags` | Your notes and tags (a note and 1 tag / {count} tags) | Deine Notizen und Tags (eine Notiz und 1 Tag / {count} Tags) |

## picker

| Key | English | Deutsch |
| --- | --- | --- |
| `picker.toggle` | JoyFox templates | JoyFox-Vorlagen |
| `picker.loading` | Loading templates… | Vorlagen werden geladen … |
| `picker.readFailed` | JoyFox could not read your templates. Nothing was inserted. | JoyFox konnte deine Vorlagen nicht lesen. Es wurde nichts eingefügt. |
| `picker.empty` | No templates yet. Add them on the JoyFox options page. | Noch keine Vorlagen. Lege sie in den JoyFox-Einstellungen an. |
| `picker.noAccount` | No JoyFox account is active. Choose one on the JoyFox options page. | Kein JoyFox-Konto ist aktiv. Wähle eines in den JoyFox-Einstellungen. |
| `picker.result.inserted` | Template inserted. Check the text, then click JoyClub's Send button yourself. | Vorlage eingefügt. Prüfe den Text und klicke dann selbst auf JoyClubs „Senden“. |
| `picker.result.not-editable` | The message field cannot be edited right now. Nothing was inserted. | Das Nachrichtenfeld kann gerade nicht bearbeitet werden. Es wurde nichts eingefügt. |
| `picker.result.too-long` | The template does not fit in the message field. Nothing was inserted; the template was not shortened. | Die Vorlage passt nicht in das Nachrichtenfeld. Es wurde nichts eingefügt, und die Vorlage wurde nicht gekürzt. |
| `picker.result.altered` | JoyClub changed the text after insertion. Check the message field before you send. | JoyClub hat den Text nach dem Einfügen geändert. Prüfe das Nachrichtenfeld, bevor du sendest. |

## templates

| Key | English | Deutsch |
| --- | --- | --- |
| `templates.folder.general` | General | Allgemein |
| `templates.folder.eventConfirmation` | Event confirmation | Event-Zusage |
| `templates.folder.eventCancellation` | Event cancellation | Event-Absage |

## options

| Key | English | Deutsch |
| --- | --- | --- |
| `options.title` | JoyFox options | JoyFox-Einstellungen |
| `options.intro` | JoyFox stores everything locally in this browser profile. Inbox triage stays off until you save a contact rule. | JoyFox speichert alles lokal in diesem Browserprofil. Die Sortierung des Posteingangs bleibt aus, bis du eine Kontaktregel speicherst. |
| `options.tabs.start` | Get started | Erste Schritte |
| `options.tabs.accounts` | Accounts | Konten |
| `options.tabs.rule` | Contact rule | Kontaktregel |
| `options.tabs.templates` | Templates | Vorlagen |
| `options.tabs.data` | Your data | Deine Daten |
| `options.importRegion` | Import JoyFox data | JoyFox-Daten importieren |

## start

| Key | English | Deutsch |
| --- | --- | --- |
| `start.state.done` | Done | Erledigt |
| `start.state.off` | Saved, but turned off | Gespeichert, aber ausgeschaltet |
| `start.state.todo` | Not done yet | Noch nicht erledigt |
| `start.ready` | JoyFox is set up. Open your JoyClub inbox to see it sorted. | JoyFox ist eingerichtet. Öffne deinen JoyClub-Posteingang, um ihn sortiert zu sehen. |
| `start.intro` | Three steps, a few minutes. Everything stays in this browser. | Drei Schritte, ein paar Minuten. Alles bleibt in diesem Browser. |
| `start.step.account` | Add your JoyClub account under [Accounts](#accounts). JoyFox makes the first one active. | Füge dein JoyClub-Konto unter [Konten](#accounts) hinzu. JoyFox macht das erste Konto aktiv. |
| `start.step.rule` | Save a contact rule under [Contact rule](#rule). Inbox triage stays off until a rule is saved and turned on. | Speichere eine Kontaktregel unter [Kontaktregel](#rule). Die Sortierung des Posteingangs bleibt aus, bis eine Regel gespeichert und eingeschaltet ist. |
| `start.step.inbox` | Open your JoyClub inbox (www.joyclub.de, ClubMail). JoyFox adds its tabs above the list. | Öffne deinen JoyClub-Posteingang (www.joyclub.de, ClubMail). JoyFox zeigt seine Tabs über der Liste. |

## accounts

| Key | English | Deutsch |
| --- | --- | --- |
| `accounts.readFailed` | JoyFox could not read its stored accounts. No account was changed. | JoyFox konnte die gespeicherten Konten nicht lesen. Es wurde kein Konto geändert. |
| `accounts.hint` | JoyFox cannot read which JoyClub login a tab uses. The active account is the one selected here, and all notes, tags and rules are stored under it. | JoyFox kann nicht lesen, mit welchem JoyClub-Login ein Tab arbeitet. Aktiv ist das Konto, das du hier auswählst. Alle Notizen, Tags und Regeln werden darunter gespeichert. |
| `accounts.activeLabel` | Active account: | Aktives Konto: |
| `accounts.noneSelected` | None selected | Keines ausgewählt |
| `accounts.empty` | No accounts yet. Add one below to start storing notes and tags. | Noch keine Konten. Füge unten ein Konto hinzu, um Notizen und Tags zu speichern. |
| `accounts.list` | Stored accounts | Gespeicherte Konten |
| `accounts.active` | Active | Aktiv |
| `accounts.inactive` | Not active | Nicht aktiv |
| `accounts.use` | Use this account | Dieses Konto verwenden |
| `accounts.useLabel` | Use account {name} | Konto {name} verwenden |
| `accounts.nowActive` | Active account is now {name}. | Aktives Konto ist jetzt {name}. |
| `accounts.remove` | Remove | Entfernen |
| `accounts.confirmRemove` | Confirm removal | Entfernen bestätigen |
| `accounts.removeLabel` | Remove account {name} | Konto {name} entfernen |
| `accounts.confirmRemoveLabel` | Confirm removal of account {name} and all of its data | Entfernen von Konto {name} und allen seinen Daten bestätigen |
| `accounts.removePrompt` | Removing {name} also deletes its notes, tags and rules. Click again to confirm. | Wenn du {name} entfernst, löscht JoyFox auch die Notizen, Tags und Regeln dieses Kontos. Klicke zum Bestätigen noch einmal. |
| `accounts.removed` | Removed {name} and its stored data. | {name} und die gespeicherten Daten wurden entfernt. |
| `accounts.addForm` | Add an account | Konto hinzufügen |
| `accounts.identifier` | JoyClub account identifier | JoyClub-Kontokennung |
| `accounts.label` | Display label (optional) | Anzeigename (optional) |
| `accounts.add` | Add account | Konto hinzufügen |
| `accounts.added` | Added {name}. | {name} wurde hinzugefügt. |
| `accounts.saveFailed` | That change could not be saved. Nothing was changed. | Diese Änderung konnte nicht gespeichert werden. Es wurde nichts geändert. |

## rule

| Key | English | Deutsch |
| --- | --- | --- |
| `rule.readFailed` | JoyFox could not read the contact rule. No rule was changed. | JoyFox konnte die Kontaktregel nicht lesen. Es wurde keine Regel geändert. |
| `rule.hint` | The rule only changes how JoyFox groups your own inbox into Qualified, Needs Review and Quarantined. It never stops a message, never deletes anything, and the sender sees nothing. | Die Regel ändert nur, wie JoyFox deinen eigenen Posteingang in „Qualifiziert“, „Zu prüfen“ und „Quarantäne“ gruppiert. Sie hält keine Nachricht auf, löscht nichts, und die sendende Person sieht nichts davon. |
| `rule.noAccount` | Select or add an account first. Each account has its own rule. | Wähle zuerst ein Konto aus oder füge eines hinzu. Jedes Konto hat seine eigene Regel. |
| `rule.newer` | This rule was made in a newer version of JoyFox and cannot be edited here. Delete it to start a new one. | Diese Regel wurde mit einer neueren JoyFox-Version erstellt und kann hier nicht bearbeitet werden. Lösche sie, um eine neue anzulegen. |
| `rule.note.saved` | A rule is saved for the active account. | Für das aktive Konto ist eine Regel gespeichert. |
| `rule.note.none` | No rule is saved for the active account, so JoyFox does not sort the inbox. | Für das aktive Konto ist keine Regel gespeichert, deshalb sortiert JoyFox den Posteingang nicht. |
| `rule.enabled` | Sort my JoyClub inbox with this rule | Meinen JoyClub-Posteingang mit dieser Regel sortieren |
| `rule.placementLabel` | A sender who does not meet the rule goes to | Einordnung, wenn die Regel nicht erfüllt ist: |
| `rule.spamHint` | Spam status is unknown for now: JoyFox does not read message text yet. Only your own "not spam" corrections count. The inbox shows only the verification shield; photos, profile words and account age come from profiles you opened before. | Der Spam-Status ist vorerst unbekannt: JoyFox liest noch keine Nachrichtentexte. Nur deine eigenen Korrekturen „kein Spam“ zählen. Der Posteingang zeigt nur das Verifizierungssymbol. Fotos, Wörter im Profil und Kontoalter stammen aus Profilen, die du vorher geöffnet hast. |
| `rule.autosaveHint` | Changes are saved automatically: a box or choice at once, a number when you leave its field. | Änderungen werden automatisch gespeichert: ein Kästchen oder eine Auswahl sofort, eine Zahl, sobald du das Feld verlässt. |
| `rule.editor` | Editor: | Editor: |
| `rule.simple` | Simple | Einfach |
| `rule.advanced` | Advanced | Erweitert |
| `rule.match.all` | ALL | ALLEN |
| `rule.match.any` | ANY | MINDESTENS EINER |
| `rule.box.all` | A sender qualifies when ALL of these are met | Eine Person ist qualifiziert, wenn ALLE diese Bedingungen erfüllt sind |
| `rule.box.any` | Or a sender qualifies when ANY of these is met | Oder eine Person ist qualifiziert, wenn MINDESTENS EINE dieser Bedingungen erfüllt ist |
| `rule.unknown.needs-review` | Send to Needs Review | In „Zu prüfen“ einordnen |
| `rule.unknown.met` | Count as met | Als erfüllt zählen |
| `rule.unknown.not-met` | Count as not met | Als nicht erfüllt zählen |
| `rule.unknownPrompt` | If JoyFox cannot see this: | Wenn JoyFox das nicht sehen kann: |
| `rule.unknownLabel` | {condition}: if JoyFox cannot see this | {condition}: wenn JoyFox das nicht sehen kann |
| `rule.valueLabel` | {condition} value | {condition}: Wert |
| `rule.numberProblem` | Enter a whole number from {minimum} to {maximum} for "{condition}". | Gib für „{condition}“ eine ganze Zahl von {minimum} bis {maximum} ein. |
| `rule.combine.label` | How the rules combine | Wie die Regeln verknüpft werden |
| `rule.combine.prefix` | A sender is qualified if | Eine Person ist qualifiziert bei |
| `rule.combine.suffix` | of these rules match. | dieser Regeln. |
| `rule.advancedHint` | Each rule is met when ALL or ANY of its conditions are met, as you choose. Tick "not" to turn a condition around: "not Minimum photos 3" means fewer than 3 photos. A rule without conditions is not saved. | Jede Regel ist erfüllt bei ALLEN oder MINDESTENS EINER ihrer Bedingungen, wie du es wählst. Setze ein Häkchen bei „nicht“, um eine Bedingung umzukehren: „nicht Mindestanzahl Fotos 3“ bedeutet weniger als 3 Fotos. Eine Regel ohne Bedingungen wird nicht gespeichert. |
| `rule.addRule` | + Add rule | + Regel hinzufügen |
| `rule.removeRule` | Remove rule | Regel entfernen |
| `rule.ruleSuffix` | of these are met | dieser Bedingungen |
| `rule.noConditions` | No conditions yet. Add one below. | Noch keine Bedingungen. Füge unten eine hinzu. |
| `rule.removeCondition` | Remove condition | Bedingung entfernen |
| `rule.removeConditionLabel` | Remove {condition} | {condition} entfernen |
| `rule.not` | not | nicht |
| `rule.notTitle` | Turn this condition around | Diese Bedingung umkehren |
| `rule.notLabel` | not: turn "{condition}" around | nicht: „{condition}“ umkehren |
| `rule.joiner.all` | AND | UND |
| `rule.joiner.any` | OR | ODER |
| `rule.ruleTitle` | Rule {number}: met if | Regel {number}: erfüllt bei |
| `rule.ruleMatchLabel` | How rule {number} combines its conditions | Wie Regel {number} ihre Bedingungen verknüpft |
| `rule.removeRuleLabel` | Remove rule {number} | Regel {number} entfernen |
| `rule.addConditionLabel` | Add a condition to rule {number} | Bedingung zu Regel {number} hinzufügen |
| `rule.addCondition` | + Add condition… | + Bedingung hinzufügen … |
| `rule.ruleCount` | {count} of {maximum} rules | {count} von {maximum} Regeln |
| `rule.simpleUnavailable.all` | Simple view is not available: the rules combine with ALL. | Die einfache Ansicht ist nicht verfügbar: Die Regeln sind mit ALLEN verknüpft. |
| `rule.simpleUnavailable.not` | Simple view is not available: the rule uses "not". | Die einfache Ansicht ist nicht verfügbar: Die Regel verwendet „nicht“. |
| `rule.simpleUnavailable.severalAll` | Simple view is not available: more than one rule needs ALL of several conditions. | Die einfache Ansicht ist nicht verfügbar: Mehr als eine Regel verlangt ALLE von mehreren Bedingungen. |
| `rule.simpleUnavailable.duplicate` | Simple view is not available: a condition appears in more than one rule. | Die einfache Ansicht ist nicht verfügbar: Eine Bedingung steht in mehr als einer Regel. |
| `rule.savedNoConditions` | Rule saved. It has no conditions yet, so every sender qualifies. | Regel gespeichert. Sie hat noch keine Bedingungen, deshalb ist jede Person qualifiziert. |
| `rule.savedVacuous` | Rule saved. With nothing in the ALL box, every sender qualifies, so the ANY box has no effect. | Regel gespeichert. Ohne Einträge im ALLE-Kasten ist jede Person qualifiziert, deshalb wirkt der MINDESTENS-EINE-Kasten nicht. |
| `rule.saved` | Rule saved. Open JoyClub tabs update at once. | Regel gespeichert. Offene JoyClub-Tabs werden sofort aktualisiert. |
| `rule.notSaved` | {problem} The rule was not saved. | {problem} Die Regel wurde nicht gespeichert. |
| `rule.saveFailed` | JoyFox could not save the rule. Nothing was changed. | JoyFox konnte die Regel nicht speichern. Es wurde nichts geändert. |
| `rule.deleteAll` | Delete whole contact rule | Ganze Kontaktregel löschen |
| `rule.removed` | Rule removed. JoyFox no longer sorts the inbox for this account. | Regel entfernt. JoyFox sortiert den Posteingang für dieses Konto nicht mehr. |
| `rule.removeFailed` | JoyFox could not remove the rule. Nothing was changed. | JoyFox konnte die Regel nicht entfernen. Es wurde nichts geändert. |
| `rule.stale.account.saved` | The active account changed. The rule was not saved. Check the form and try again. | Das aktive Konto hat sich geändert. Die Regel wurde nicht gespeichert. Prüfe das Formular und versuche es noch einmal. |
| `rule.stale.account.removed` | The active account changed. The rule was not removed. Check the form and try again. | Das aktive Konto hat sich geändert. Die Regel wurde nicht entfernt. Prüfe das Formular und versuche es noch einmal. |
| `rule.stale.rule.saved` | The rule was changed in another tab. It was not saved. The form now shows the saved rule. | Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht gespeichert. Das Formular zeigt jetzt die gespeicherte Regel. |
| `rule.stale.rule.removed` | The rule was changed in another tab. It was not removed. The form now shows the saved rule. | Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht entfernt. Das Formular zeigt jetzt die gespeicherte Regel. |
| `rule.changedElsewhere` | The rule was changed in another tab. The form now shows the saved rule. | Die Regel wurde in einem anderen Tab geändert. Das Formular zeigt jetzt die gespeicherte Regel. |

## templates

| Key | English | Deutsch |
| --- | --- | --- |
| `templates.readFailed` | JoyFox could not read your templates. No template was changed. | JoyFox konnte deine Vorlagen nicht lesen. Es wurde keine Vorlage geändert. |
| `templates.heading` | Message templates | Nachrichtenvorlagen |
| `templates.hint` | On a JoyClub conversation, the "JoyFox templates" button below the message field inserts a template at the cursor. You can still edit the text, and you always click JoyClub's Send button yourself. JoyFox never sends a message. | In einer JoyClub-Unterhaltung fügt die Schaltfläche „JoyFox-Vorlagen“ unter dem Nachrichtenfeld eine Vorlage an der Cursorposition ein. Du kannst den Text danach noch ändern, und du klickst JoyClubs „Senden“ immer selbst. JoyFox sendet nie eine Nachricht. |
| `templates.noAccount` | Choose an active account above to store templates. | Wähle unter „Konten“ ein aktives Konto, um Vorlagen zu speichern. |
| `templates.empty` | No templates yet. Add one below. | Noch keine Vorlagen. Füge unten eine hinzu. |
| `templates.inFolder` | Templates in {folder} | Vorlagen in {folder} |
| `templates.edit` | Edit | Bearbeiten |
| `templates.editLabel` | Edit template {name} | Vorlage {name} bearbeiten |
| `templates.editing` | Editing {name}. | Du bearbeitest {name}. |
| `templates.delete` | Delete | Löschen |
| `templates.confirmDelete` | Confirm delete | Löschen bestätigen |
| `templates.deleteLabel` | Delete template {name} | Vorlage {name} löschen |
| `templates.confirmDeleteLabel` | Confirm deleting template {name} | Löschen der Vorlage {name} bestätigen |
| `templates.deletePrompt` | Click "Confirm delete" to delete {name}. | Klicke auf „Löschen bestätigen“, um {name} zu löschen. |
| `templates.deleted` | Deleted {name}. | {name} wurde gelöscht. |
| `templates.addForm` | Add a template | Vorlage hinzufügen |
| `templates.name` | Name | Name |
| `templates.folder` | Folder (optional, General if empty) | Ordner (optional, leer bedeutet Allgemein) |
| `templates.text` | Text | Text |
| `templates.saveChanges` | Save changes | Änderungen speichern |
| `templates.add` | Add template | Vorlage hinzufügen |
| `templates.cancel` | Cancel editing | Bearbeiten abbrechen |
| `templates.saved` | Saved {name}. | {name} wurde gespeichert. |
| `templates.added` | Added {name}. | {name} wurde hinzugefügt. |
| `templates.accountChanged` | The active account changed. Nothing was changed. | Das aktive Konto hat sich geändert. Es wurde nichts geändert. |

## entity

| Key | English | Deutsch |
| --- | --- | --- |
| `entity.extensionAccounts` | Account record | Kontodatensatz |
| `entity.joyClubMembers` | Members | Mitglieder |
| `entity.profileSnapshots` | Profile snapshots | Profil-Momentaufnahmen |
| `entity.userNotes` | Notes | Notizen |
| `entity.userTags` | Tags | Tags |
| `entity.trustSignals` | Trust outcomes | Erfasste Erfahrungen |
| `entity.contactRules` | Contact rules | Kontaktregeln |
| `entity.conversationClassifications` | Manual placements | Eigene Einordnungen |
| `entity.savedSearches` | Saved searches | Gespeicherte Suchen |
| `entity.eventMetadata` | Event notes | Event-Notizen |
| `entity.spendLogEntries` | Spending log | Ausgabenprotokoll |
| `entity.syncConfigs` | Sync settings | Sync-Einstellungen |
| `entity.extensionPreferences` | Preferences | Einstellungen |
| `entity.messageTemplates` | Message templates | Nachrichtenvorlagen |
| `entity.spamPhrases` | Spam phrases | Spam-Formulierungen |
| `entity.messageObservations` | Cached message text (normalized) | Zwischengespeicherte Nachrichtentexte (normalisiert) |
| `entity.senderSpamOverrides` | Not-spam corrections | Korrekturen „kein Spam“ |
| `entity.actionLogs` | Action log | Aktionsprotokoll |

## data

| Key | English | Deutsch |
| --- | --- | --- |
| `data.readFailed` | JoyFox could not read its stored data. Nothing was changed. | JoyFox konnte die gespeicherten Daten nicht lesen. Es wurde nichts geändert. |
| `data.hint` | Everything JoyFox stores stays in this browser profile. You can inspect it, save it as a JSON file and delete it here. Deleting here never changes anything on JoyClub. | Alles, was JoyFox speichert, bleibt in diesem Browserprofil. Hier kannst du es ansehen, als JSON-Datei speichern und löschen. Löschen hier ändert nie etwas auf JoyClub. |
| `data.noAccounts` | No accounts yet. | Noch keine Konten. |
| `data.accountPicker` | Account to inspect | Angezeigtes Konto |
| `data.caption` | Stored records for this account | Gespeicherte Datensätze dieses Kontos |
| `data.col.type` | Data type | Datentyp |
| `data.col.records` | Records | Datensätze |
| `data.col.actions` | Actions | Aktionen |
| `data.show` | Show | Zeigen |
| `data.hide` | Hide | Ausblenden |
| `data.showLabel` | Show {label} | {label} zeigen |
| `data.hideLabel` | Hide {label} | {label} ausblenden |
| `data.deleteAll` | Delete all | Alle löschen |
| `data.deleteAllLabel` | Delete all {label} | Alle Datensätze „{label}“ löschen |
| `data.deleteAllPrompt` | Click "Confirm" to delete all {count} {label} records of this account. | Klicke auf „Bestätigen“, um alle {count} Datensätze „{label}“ dieses Kontos zu löschen. |
| `data.deletedAll` | Deleted all {label} of this account. | Alle Datensätze „{label}“ dieses Kontos wurden gelöscht. |
| `data.recordsTitle` | {label} ({count}) | {label} ({count}) |
| `data.accountRecordHint` | The account record is removed only with the whole account, in Accounts above. | Der Kontodatensatz wird nur mit dem ganzen Konto entfernt, unter „Konten“. |
| `data.recordSummary` | {id} (updated {updated}) | {id} (geändert: {updated}) |
| `data.delete` | Delete | Löschen |
| `data.deleteRecordLabel` | Delete record {id} | Datensatz {id} löschen |
| `data.deleteRecordPrompt` | Click "Confirm" to delete record {id}. | Klicke auf „Bestätigen“, um den Datensatz {id} zu löschen. |
| `data.deletedRecord` | Deleted record {id}. | Datensatz {id} wurde gelöscht. |
| `data.showMore` | Show {count} more | {count} weitere zeigen |
| `data.exportAccount` | Export this account (JSON) | Dieses Konto exportieren (JSON) |
| `data.exportedAccount` | Export of this account created. | Der Export dieses Kontos wurde erstellt. |
| `data.deleteAccountData` | Delete this account's data | Daten dieses Kontos löschen |
| `data.deleteAccountDataLabel` | Delete all data of this account | Alle Daten dieses Kontos löschen |
| `data.deleteAccountDataPrompt` | Click "Confirm" to delete every record of this account. The account itself stays in Accounts. | Klicke auf „Bestätigen“, um alle Datensätze dieses Kontos zu löschen. Das Konto selbst bleibt unter „Konten“. |
| `data.deletedAccountData` | Deleted all data of this account. The account itself is kept. | Alle Daten dieses Kontos wurden gelöscht. Das Konto selbst bleibt erhalten. |
| `data.allAccounts` | All accounts | Alle Konten |
| `data.exportAll` | Export all JoyFox data (JSON) | Alle JoyFox-Daten exportieren (JSON) |
| `data.exportedAll` | Export of all JoyFox data created. | Der Export aller JoyFox-Daten wurde erstellt. |
| `data.deleteEverything` | Delete all JoyFox data | Alle JoyFox-Daten löschen |
| `data.deleteEverythingLabel` | Delete all JoyFox data in this browser | Alle JoyFox-Daten in diesem Browser löschen |
| `data.deleteEverythingPrompt` | Click "Confirm" to delete every account, every record and every JoyFox setting in this browser. This cannot be undone. | Klicke auf „Bestätigen“, um alle Konten, alle Datensätze und alle JoyFox-Einstellungen in diesem Browser zu löschen. Das kann nicht rückgängig gemacht werden. |
| `data.deletedEverything` | Deleted all JoyFox data in this browser. | Alle JoyFox-Daten in diesem Browser wurden gelöscht. |
| `data.confirm` | Confirm | Bestätigen |
| `data.confirmLabel` | Confirm: {label} | Bestätigen: {label} |
| `data.actionFailed` | That action could not be completed. The counts shown now are what is stored. | Diese Aktion konnte nicht abgeschlossen werden. Die angezeigten Zahlen zeigen, was jetzt gespeichert ist. |
| `data.import.title` | Import | Importieren |
| `data.import.hint` | Import a JoyFox export file: everything, or one account. It is merged into what is stored here. An account with the same JoyClub identifier is merged into the existing one. For the same note, rule or placement the newer version wins; existing tags and corrections are kept. The import starts when you choose the file, and you then see what changed. | Importiere eine JoyFox-Exportdatei: alles oder ein Konto. Sie wird mit dem zusammengeführt, was hier gespeichert ist. Ein Konto mit derselben JoyClub-Kennung wird mit dem vorhandenen Konto zusammengeführt. Bei derselben Notiz, Regel oder Einordnung gewinnt die neuere Version. Vorhandene Tags und Korrekturen bleiben erhalten. Der Import beginnt, sobald du die Datei wählst, und danach siehst du, was sich geändert hat. |
| `data.import.fileLabel` | JoyFox export file (JSON) | JoyFox-Exportdatei (JSON) |
| `data.import.summary.all` | This full export holds {total} account(s): {matched} merged into an existing account, {added} added as new. | Dieser vollständige Export enthält 1 Konto / {total} Konten: {matched} mit einem vorhandenen Konto zusammengeführt, {added} neu hinzugefügt. |
| `data.import.summary.account` | This single-account export holds {total} account(s): {matched} merged into an existing account, {added} added as new. | Dieser Export eines einzelnen Kontos enthält 1 Konto / {total} Konten: {matched} mit einem vorhandenen Konto zusammengeführt, {added} neu hinzugefügt. |
| `data.import.caption` | What the import changed | Was der Import geändert hat |
| `data.import.col.added` | Added | Hinzugefügt |
| `data.import.col.replaced` | Replaced (newer) | Ersetzt (neuer) |
| `data.import.col.kept` | Kept | Behalten |
| `data.import.col.duplicates` | Skipped duplicates | Übersprungene Duplikate |
| `data.import.noRecords` | The file holds no records. | Die Datei enthält keine Datensätze. |
| `data.import.settingsSkipped` | Settings in the file that are never imported (they switch features on): {keys}. | Einstellungen in der Datei, die nie importiert werden (sie schalten Funktionen ein): {keys}. |
| `data.import.settingsNotSaved` | Settings that could not be saved: {keys}. | Einstellungen, die nicht gespeichert werden konnten: {keys}. |
| `data.import.settingsAdded` | Settings added (only those not set here): {keys}. | Hinzugefügte Einstellungen (nur solche, die hier nicht gesetzt waren): {keys}. |
| `data.import.running` | Importing the file. | Die Datei wird importiert. |
| `data.import.nothing` | Everything in this file is already stored. Nothing was changed. | Alles in dieser Datei ist schon gespeichert. Es wurde nichts geändert. |
| `data.import.complete` | Import complete: {added} record(s) added, {replaced} replaced by a newer version. | Import abgeschlossen: {added} Datensätze hinzugefügt, {replaced} durch eine neuere Version ersetzt. |
| `data.import.completeSettingsFailed` | Import complete: {added} record(s) added, {replaced} replaced by a newer version. Some settings could not be saved; check the active account. | Import abgeschlossen: {added} Datensätze hinzugefügt, {replaced} durch eine neuere Version ersetzt. Einige Einstellungen konnten nicht gespeichert werden. Prüfe das aktive Konto. |
| `data.import.incomplete` | The import could not be completed. The counts shown now are what is stored. | Der Import konnte nicht abgeschlossen werden. Die angezeigten Zahlen zeigen, was jetzt gespeichert ist. |
| `data.import.unreadable` | JoyFox could not read that file. Nothing was imported. | JoyFox konnte diese Datei nicht lesen. Es wurde nichts importiert. |

## error

| Key | English | Deutsch |
| --- | --- | --- |
| `error.withSuffix.nothingChanged` | {error}. Nothing was changed. | {error}. Es wurde nichts geändert. |
| `error.withSuffix.nothingImported` | {error}. Nothing was imported. | {error}. Es wurde nichts importiert. |
| `error.withSuffix.nothingDeleted` | {error}. Nothing was deleted. | {error}. Es wurde nichts gelöscht. |
| `error.code.SelectorUnavailable` | JoyFox cannot find the expected element on the page | JoyFox findet das erwartete Element auf der Seite nicht |
| `error.code.ExtractionInvalid` | The data is not valid | Die Daten sind ungültig |
| `error.code.IdentityMismatch` | The account or member does not match | Konto oder Mitglied passen nicht zusammen |
| `error.code.StorageError` | JoyFox could not read or write its stored data | JoyFox konnte seine gespeicherten Daten nicht lesen oder schreiben |
| `error.code.RuleEvaluationError` | The contact rule could not be checked | Die Kontaktregel konnte nicht geprüft werden |
| `error.code.ActionStepFailed` | A step on JoyClub did not complete | Ein Schritt auf JoyClub wurde nicht abgeschlossen |
| `error.code.NavigationTimeout` | The page did not load in time | Die Seite hat nicht rechtzeitig geladen |
| `error.code.UnsupportedPage` | JoyFox does not support this page | JoyFox unterstützt diese Seite nicht |
| `error.account.emptyIdentifier` | An account needs a non-empty identifier | Ein Konto braucht eine Kennung |
| `error.account.duplicate` | That account identifier is already registered | Diese Kontokennung ist schon gespeichert |
| `error.account.notRegistered` | Cannot activate an account that is not registered | Ein Konto, das nicht gespeichert ist, kann nicht aktiv werden |
| `error.account.gone` | That account no longer exists | Dieses Konto gibt es nicht mehr |
| `error.account.changed` | The active account changed | Das aktive Konto hat sich geändert |
| `error.template.noName` | A template needs a name | Eine Vorlage braucht einen Namen |
| `error.template.nameTooLong` | A template name can have at most {maximum} characters | Der Name einer Vorlage darf höchstens {maximum} Zeichen haben |
| `error.template.folderTooLong` | A folder name can have at most {maximum} characters | Der Name eines Ordners darf höchstens {maximum} Zeichen haben |
| `error.template.noText` | A template needs some text | Eine Vorlage braucht Text |
| `error.template.tooLong` | A template can have at most {maximum} characters | Eine Vorlage darf höchstens {maximum} Zeichen haben |
| `error.template.deleted` | That template was deleted meanwhile | Diese Vorlage wurde inzwischen gelöscht |
| `error.data.changedDuringCheck` | Stored data changed while the file was checked. Choose the file again | Die gespeicherten Daten haben sich geändert, während JoyFox die Datei geprüft hat. Wähle die Datei noch einmal |
| `error.data.unknownType` | Unknown data type | Unbekannter Datentyp |
| `error.data.accountRecord` | The account record is removed only with the whole account | Der Kontodatensatz wird nur mit dem ganzen Konto entfernt |
| `error.import.tooLarge` | The file is too large to be a JoyFox export | Die Datei ist zu groß für einen JoyFox-Export |
| `error.import.notJson` | The file is not a JoyFox export (not valid JSON) | Die Datei ist kein JoyFox-Export (kein gültiges JSON) |
| `error.import.notExport` | The file is not a JoyFox export | Die Datei ist kein JoyFox-Export |
| `error.import.noVersion` | The file has no valid schema version | Die Datei hat keine gültige Schemaversion |
| `error.import.newerVersion` | The file comes from a newer JoyFox version. Update JoyFox first | Die Datei stammt aus einer neueren JoyFox-Version. Aktualisiere zuerst JoyFox |
| `error.import.noScope` | The file has no valid export scope | Die Datei hat keinen gültigen Exportumfang |
| `error.import.noAccountNamed` | The account export names no account | Der Kontoexport nennt kein Konto |
| `error.import.unknownType` | The file holds an unknown data type ({name}) | Die Datei enthält einen unbekannten Datentyp ({name}) |
| `error.import.notList` | The file's {entity} list is not a list | „{entity}“ ist in der Datei keine Liste |
| `error.import.notRecord` | Record {index} of {entity} is not a record | Eintrag {index} in „{entity}“ ist kein Datensatz |
| `error.import.forbiddenKey` | Record {index} of {entity} holds a forbidden key | Eintrag {index} in „{entity}“ enthält einen verbotenen Schlüssel |
| `error.import.unknownField` | Record {index} of {entity} holds an unknown field ({field}) | Eintrag {index} in „{entity}“ enthält ein unbekanntes Feld ({field}) |
| `error.import.tooLong` | Record {index} of {entity} is invalid: {field} is longer than {maximum} characters | Eintrag {index} in „{entity}“ ist ungültig: {field} hat mehr als {maximum} Zeichen |
| `error.import.invalid` | Record {index} of {entity} is invalid | Eintrag {index} in „{entity}“ ist ungültig |
| `error.import.future` | Record {index} of {entity} is dated in the future | Eintrag {index} in „{entity}“ hat ein Datum in der Zukunft |
| `error.import.otherAccount` | Record {index} of {entity} belongs to another account | Eintrag {index} in „{entity}“ gehört zu einem anderen Konto |
| `error.import.notOwnScope` | Account record {index} is not its own scope | Kontodatensatz {index} gehört nicht zu sich selbst |
| `error.import.twice` | Record {index} of {entity} appears twice | Eintrag {index} in „{entity}“ kommt zweimal vor |
| `error.import.sameIdentifier` | Two accounts in the file have the same identifier | Zwei Konten in der Datei haben dieselbe Kennung |
| `error.import.noAccountRecord` | The account export holds no account record | Der Kontoexport enthält keinen Kontodatensatz |
| `error.import.settingsInvalid` | The file's settings are invalid | Die Einstellungen in der Datei sind ungültig |
| `error.import.settingsForbidden` | The file's settings hold a forbidden key | Die Einstellungen in der Datei enthalten einen verbotenen Schlüssel |
| `error.import.unknownSetting` | The file holds a setting JoyFox does not use ({key}) | Die Datei enthält eine Einstellung, die JoyFox nicht verwendet ({key}) |
| `error.import.orphans` | Some records in the file belong to an account the file does not hold | Einige Datensätze in der Datei gehören zu einem Konto, das die Datei nicht enthält |
| `error.import.sameRecordTwice` | The file holds the same record twice after merging accounts | Die Datei enthält nach dem Zusammenführen der Konten denselben Datensatz zweimal |
