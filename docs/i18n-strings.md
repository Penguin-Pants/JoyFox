# JoyFox UI strings: English and German

Generated from `src/i18n/catalog/en.ts` and `src/i18n/catalog/de.ts` for
the owner's review (docs/i18n-spec.md, Section 1). The owner approved
every string on 2026-09-25 and reviewed the strings added later on
2026-09-26; a changed string needs a new review. Do not
edit by hand:
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
| `condition.firstMessageContains` | First message contains | Erste Nachricht enthält |

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
| `common.saveFailed` | JoyFox could not save that change. Nothing was changed. Try again. If it keeps failing, reload the page. | JoyFox konnte diese Änderung nicht speichern. Es wurde nichts geändert. Versuche es noch einmal. Wenn es weiter nicht klappt, lade die Seite neu. |

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
| `triage.reason.phraseSeenNow` | The latest message from this sender contains "{text}". | Die neueste Nachricht dieser Person enthält „{text}“. |
| `triage.reason.phraseSeenBefore` | An earlier message from this sender, seen in your inbox, contains "{text}". | Eine frühere Nachricht dieser Person aus deinem Posteingang enthält „{text}“. |
| `triage.reason.phraseNotInLatest` | The latest message from this sender does not contain "{text}". The inbox shows only the latest message, so JoyFox cannot see if the first message contained it. | Die neueste Nachricht dieser Person enthält „{text}“ nicht. Der Posteingang zeigt nur die neueste Nachricht, deshalb kann JoyFox nicht sehen, ob die erste Nachricht es enthielt. |
| `triage.reason.phraseNotSeen` | JoyFox has not seen a message from this sender that contains "{text}". Only the inbox shows messages to JoyFox. | JoyFox hat keine Nachricht dieser Person gesehen, die „{text}“ enthält. Nur der Posteingang zeigt JoyFox Nachrichten. |
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
| `triage.headline.doesNotMeet` | This sender does not meet your contact rule, so JoyFox places them in {placement}. | Diese Person erfüllt deine Kontaktregel nicht und kommt deshalb nach „{placement}“. |

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
| `action.next.showList` | Delete works only while the ClubMail list shows beside the conversation. Widen the window and try again. | „In den Papierkorb schieben“ klappt nur, während die ClubMail-Liste neben der Unterhaltung zu sehen ist. Mach das Fenster breiter und versuche es noch einmal. |
| `action.self.ignore` | You can do it yourself: open the member's profile and ignore them there. | Du kannst es selbst tun: Öffne das Profil des Mitglieds und ignoriere es dort mit „Profil ignorieren“. |
| `action.self.delete` | You can do it yourself: move the conversation to the trash with JoyClub's trash button. | Du kannst es selbst tun: Verschiebe die Unterhaltung mit „In den Papierkorb schieben“ in den Papierkorb. |
| `action.report.finished` | Ignore and Delete finished. | „Ignorieren und löschen“ ist fertig. |
| `action.report.undo` | To undo, restore the conversation from JoyClub's trash. Then open the member's profile and choose "Profil nicht mehr ignorieren" in its menu. | Rückgängig machen: Hol die Unterhaltung aus JoyClubs Papierkorb zurück. Öffne dann das Profil des Mitglieds und wähle im Menü „Profil nicht mehr ignorieren“. |
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
| `quick.needsList` | Works only while the ClubMail list shows beside this conversation. Widen the window. | Klappt nur, während die ClubMail-Liste neben dieser Unterhaltung zu sehen ist. Mach das Fenster breiter. |
| `quick.noProfile` | JoyFox cannot find this member's profile address, where Ignore is, so it did nothing. | JoyFox findet die Profiladresse dieses Mitglieds nicht. Dort ist „Profil ignorieren“. JoyFox hat deshalb nichts getan. |
| `quick.resumed` | Ignore and Delete, continued from the conversation: | „Ignorieren und löschen“, fortgesetzt aus der Unterhaltung: |
| `quick.waitingMenu` | Waiting for JoyClub's profile menu… | JoyFox wartet auf JoyClubs Profilmenü … |
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
| `triage.outcome.needs-review` | Needs Review | Zu prüfen |
| `triage.conditions.summary` | All checked conditions ({count}) | Alle geprüften Bedingungen ({count}) |
| `triage.condition.line` | {outcome}: {condition}. | {outcome}: {condition}. |
| `triage.condition.lineNegated` | {outcome}: not {condition}. | {outcome}: nicht {condition}. |
| `triage.placementLine` | Placement: {placement} ({source}). | Einordnung: {placement} ({source}). |
| `triage.source.override` | your manual choice | deine eigene Wahl |
| `triage.source.rule` | your contact rule | deine Kontaktregel |
| `triage.source.sharedEvent` | the shared-event exception | die Ausnahme für gemeinsame Events |
| `triage.sharedEvent.attending` | On the guest list of "{event}" ({when}), which you marked Attending. | Auf der Gästeliste von „{event}“ ({when}), das du mit „Ich gehe hin“ markiert hast. |
| `triage.sharedEvent.attended` | On the guest list of "{event}" ({when}), which you marked Attended. | Auf der Gästeliste von „{event}“ ({when}), das du mit „Ich war dort“ markiert hast. |
| `triage.sharedEvent.optOut` | Don't use the shared event for this sender | Das gemeinsame Event für diese Person nicht verwenden |
| `triage.movedOn` | You moved this sender on {date}. Your rule alone would place them in {placement}. | Du hast diese Person am {date} verschoben. Deine Regel allein würde sie in „{placement}“ einordnen. |
| `triage.move.group` | Move this sender | Diese Person verschieben |
| `triage.move.to` | Move to {placement} | Nach „{placement}“ verschieben |
| `triage.move.keep` | Keep in {placement} | In „{placement}“ lassen |
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
| `trust.log.group` | Log how it went with this member | Erfahrung mit diesem Mitglied erfassen |
| `trust.log.positive` | Log positive | Positive Erfahrung erfassen |
| `trust.log.neutral` | Log neutral | Neutrale Erfahrung erfassen |
| `trust.log.negative` | Log negative | Negative Erfahrung erfassen |
| `trust.log.undo` | Undo last outcome | Letzte Erfahrung zurücknehmen |

## bar

| Key | English | Deutsch |
| --- | --- | --- |
| `bar.placementPrefix` | Placement: | Einordnung: |
| `bar.yourChoice` | (your choice) | (deine Wahl) |
| `bar.sharedEvent` | (shared event) | (gemeinsames Event) |
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
| `panel.ruleOff.no-account` | No JoyFox account is active, so JoyFox shows nothing for this member. | Es ist kein JoyFox-Konto aktiv, deshalb zeigt JoyFox zu diesem Mitglied nichts an. |

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
| `inbox.checking` | Checking | Wird eingeordnet … |
| `inbox.badge` | JoyFox: {text}. Why and move. | JoyFox: {text}. Warum und verschieben. |
| `inbox.why` | Why and move | Warum und verschieben |
| `inbox.whyNamed` | Why and move: {name} | Warum und verschieben: {name} |
| `inbox.rowGone` | This row is no longer shown. | Diese Zeile wird nicht mehr angezeigt. |
| `inbox.unidentified` | JoyFox could not read this sender's profile number, so it could not check your rule. The row stays visible. | JoyFox konnte die Profilnummer dieser Person nicht lesen und deine Regel deshalb nicht prüfen. Die Zeile bleibt sichtbar. |
| `inbox.stillChecking` | JoyFox is still checking this sender. | JoyFox prüft diese Person noch. |
| `inbox.setup.no-account` | JoyFox has no active account, so it does not sort this inbox. | Es ist kein JoyFox-Konto aktiv, deshalb sortiert JoyFox diesen Posteingang nicht. |
| `inbox.setup.no-rule` | No contact rule is saved, so JoyFox does not sort this inbox. | Es ist keine Kontaktregel gespeichert, deshalb sortiert JoyFox diesen Posteingang nicht. |

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
| `notes.tagExists` | Already tagged. | Diesen Tag hat das Mitglied schon. |
| `notes.tagRemoved` | Tag removed. | Tag entfernt. |
| `notes.privateNote` | Private note | Private Notiz |
| `notes.length` | {count} of {maximum} characters | {count} von {maximum} Zeichen |
| `notes.pasteCut` | Only part of the pasted text fit. The rest was not pasted. | Nur ein Teil des eingefügten Texts hat gepasst. Der Rest wurde nicht eingefügt. |
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

## listing

| Key | English | Deutsch |
| --- | --- | --- |
| `listing.heading.event` | JoyFox: your notes on this event | JoyFox: deine Notizen zu diesem Event |
| `listing.heading.venue` | JoyFox: your notes on this venue | JoyFox: deine Notizen zu diesem Club |
| `listing.summary.event` | JoyFox: your notes on this event ({state}) | JoyFox: deine Notizen zu diesem Event ({state}) |
| `listing.summary.venue` | JoyFox: your notes on this venue ({state}) | JoyFox: deine Notizen zu diesem Club ({state}) |
| `listing.summary.none` | none yet | noch keine |
| `listing.summary.note` | a note | eine Notiz |
| `listing.loading` | Loading your notes… | Deine Notizen werden geladen … |
| `listing.readFailed` | JoyFox could not read your notes on this page. Reload the page to try again. | JoyFox konnte deine Notizen zu dieser Seite nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen. |
| `listing.noAccount` | Select or add an account in the JoyFox options to keep notes on events. | Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Notizen zu Events zu speichern. |
| `listing.attendanceLabel` | Your attendance | Deine Teilnahme |
| `listing.attendance.unknown` | No status | Kein Status |
| `listing.attendance.interested` | Interested | Interessiert |
| `listing.attendance.attending` | Attending | Ich gehe hin |
| `listing.attendance.not-attending` | Not attending | Ich gehe nicht hin |
| `listing.attendance.attended` | Attended | Ich war dort |
| `listing.noteLabel` | Your note | Deine Notiz |
| `listing.saveNote` | Save note | Notiz speichern |
| `listing.tagsLabel` | Your tags | Deine Tags |
| `listing.tagLabel` | New tag | Neuer Tag |
| `listing.addTag` | Add tag | Tag hinzufügen |
| `listing.removeTag` | Remove tag {tag} | Tag {tag} entfernen |
| `listing.emptyTag` | Type a tag first. Nothing was added. | Gib zuerst einen Tag ein. Es wurde nichts hinzugefügt. |
| `listing.tooManyTags.event` | You can add at most {maximum} tags to an event. Remove one first. | Du kannst einem Event höchstens {maximum} Tags geben. Entferne zuerst einen. |
| `listing.tooManyTags.venue` | You can add at most {maximum} tags to a venue. Remove one first. | Du kannst einem Club höchstens {maximum} Tags geben. Entferne zuerst einen. |
| `listing.privacy` | Private: stored only in this browser. JoyClub sees nothing, and your sign-up on JoyClub does not change. | Privat: nur in diesem Browser gespeichert. JoyClub sieht nichts, und deine Anmeldung bei JoyClub ändert sich nicht. |
| `listing.saved` | Saved. | Gespeichert. |
| `listing.tracked.event` | Saved. JoyFox now tracks this event. | Gespeichert. JoyFox verfolgt dieses Event jetzt. |
| `listing.tracked.venue` | Saved. JoyFox now tracks this venue. | Gespeichert. JoyFox verfolgt diesen Club jetzt. |
| `listing.removed.event` | No note, tag or attendance is left, so JoyFox no longer tracks this event. | Es ist keine Notiz, kein Tag und keine Teilnahme mehr eingetragen, deshalb verfolgt JoyFox dieses Event nicht mehr. |
| `listing.removed.venue` | No note or tag is left, so JoyFox no longer tracks this venue. | Es ist keine Notiz und kein Tag mehr eingetragen, deshalb verfolgt JoyFox diesen Club nicht mehr. |
| `listing.conflict` | These notes changed in another tab, so JoyFox did not save. The stored notes are shown now; your typed note is still in the box. | Diese Notizen wurden in einem anderen Tab geändert, deshalb hat JoyFox nicht gespeichert. Jetzt werden die gespeicherten Notizen angezeigt; deine eingegebene Notiz steht noch im Feld. |
| `listing.refused` | The active JoyFox account changed, so nothing was saved. | Das aktive JoyFox-Konto hat sich geändert, deshalb wurde nichts gespeichert. |

## events

| Key | English | Deutsch |
| --- | --- | --- |
| `events.heading` | My events | Meine Events |
| `events.hint` | Every event and venue you added a note, tag or attendance to on JoyClub, in date order. JoyFox keeps them after JoyClub removes an event. To change one, open it on JoyClub. | Alle Events und Clubs, zu denen du auf JoyClub eine Notiz, einen Tag oder deine Teilnahme eingetragen hast, nach Datum. JoyFox behält sie, auch wenn JoyClub ein Event entfernt. Um einen Eintrag zu ändern, öffne ihn auf JoyClub. |
| `events.readFailed` | JoyFox could not read your events. Reload the page to try again. | JoyFox konnte deine Events nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen. |
| `events.noAccount` | Select or add an account first. Each account has its own events. | Wähle zuerst ein Konto aus oder füge eines hinzu. Jedes Konto hat eigene Events. |
| `events.empty` | No tracked events yet. Open an event on JoyClub and add a note, a tag or your attendance. | Noch keine verfolgten Events. Öffne ein Event auf JoyClub und trage eine Notiz, einen Tag oder deine Teilnahme ein. |
| `events.count` | {shown} of {total} tracked events shown. | {shown} von {total} verfolgten Events angezeigt. |
| `events.filterLabel` | Show | Zeigen |
| `events.filter.all` | All tracked events | Alle verfolgten Events |
| `events.searchLabel` | Search my notes, tags and titles | In meinen Notizen, Tags und Titeln suchen |
| `events.noDate` | No date | Kein Datum |
| `events.untitled` | Event {id} | Event {id} |
| `events.past` | {when} (past) | {when} (vorbei) |
| `events.venue` | Venue: {venue} | Club: {venue} |
| `events.venuesHeading` | My venues | Meine Clubs |
| `events.guests` | 1 guest stored / {count} guests stored | 1 Gast gespeichert / {count} Gäste gespeichert |
| `events.exception.label` | Shared-event exception: place a sender in Qualified when they are on the guest list of an event I marked Attending or Attended | Ausnahme für gemeinsame Events: eine Person als „Qualifiziert“ einordnen, wenn sie auf der Gästeliste eines Events steht, das ich mit „Ich gehe hin“ oder „Ich war dort“ markiert habe |
| `events.exception.hint` | Off by default. JoyFox stores a tracked event's guest list when you open the event page, as far as JoyClub has loaded it, and deletes it when you stop tracking the event. A sender you moved yourself keeps your choice, and the "Why" panel can turn the exception off for one sender. | Standardmäßig aus. JoyFox speichert die Gästeliste eines verfolgten Events, wenn du die Event-Seite öffnest, so weit JoyClub sie geladen hat, und löscht sie, wenn du das Event nicht mehr verfolgst. Eine Person, die du selbst verschoben hast, behält deine Wahl, und im Bereich „Warum“ kannst du die Ausnahme für eine Person abschalten. |
| `events.exception.saved` | Saved. | Gespeichert. |
| `events.exception.saveFailed` | JoyFox could not save this setting. Try again. | JoyFox konnte diese Einstellung nicht speichern. Versuche es noch einmal. |

## quickSetting

| Key | English | Deutsch |
| --- | --- | --- |
| `quickSetting.heading` | Ignore and Delete | Ignorieren und löschen |
| `quickSetting.label` | Show the "Ignore and Delete" button on ClubMail conversations | Die Schaltfläche „Ignorieren und löschen“ in ClubMail-Unterhaltungen zeigen |
| `quickSetting.hint` | Experimental and off by default. One click moves the conversation to JoyClub's trash, opens the member's profile in the same tab and ignores the member there. It works only while the ClubMail list shows beside the conversation. JoyFox acts only when you click. The "Action log" in "Your data" records every step. | Experimentell und standardmäßig aus. Ein Klick schiebt die Unterhaltung in JoyClubs Papierkorb, öffnet das Profil des Mitglieds im selben Tab und ignoriert das Mitglied dort. Das funktioniert nur, solange die ClubMail-Liste neben der Unterhaltung zu sehen ist. JoyFox handelt nur, wenn du klickst. Das „Aktionsprotokoll“ unter „Deine Daten“ hält jeden Schritt fest. |
| `quickSetting.risk` | If JoyClub finds a tool that clicks for you, it can restrict or close your account. Of all JoyFox features, this one has the highest risk. | Bemerkt JoyClub ein Werkzeug, das für dich klickt, kann dein Konto eingeschränkt oder geschlossen werden. Von allen JoyFox-Funktionen hat diese das höchste Risiko. |
| `quickSetting.undo` | To undo, restore the conversation from JoyClub's trash. Then open the member's profile and choose "Profil nicht mehr ignorieren" in its menu. | Um es rückgängig zu machen, stelle die Unterhaltung aus JoyClubs Papierkorb wieder her. Öffne dann das Profil des Mitglieds und wähle im Menü „Profil nicht mehr ignorieren“. |
| `quickSetting.saved` | Saved. Open ClubMail tabs follow at once. | Gespeichert. Offene ClubMail-Tabs folgen sofort. |
| `quickSetting.saveFailed` | JoyFox could not save this setting. Try again. | JoyFox konnte diese Einstellung nicht speichern. Versuche es noch einmal. |

## sharedEvents

| Key | English | Deutsch |
| --- | --- | --- |
| `sharedEvents.heading` | Shared events | Gemeinsame Events |
| `sharedEvents.intro` | This member is on the stored guest list of these events you track: | Dieses Mitglied steht auf der gespeicherten Gästeliste dieser Events, die du verfolgst: |

## eventFilter

| Key | English | Deutsch |
| --- | --- | --- |
| `eventFilter.label` | JoyFox: show | JoyFox: zeigen |
| `eventFilter.all` | All loaded events and dates | Alle geladenen Events und Dates |
| `eventFilter.tracked` | Only events JoyFox tracks | Nur Events, die JoyFox verfolgt |
| `eventFilter.note` | Only events with your note | Nur Events mit deiner Notiz |
| `eventFilter.attending` | Only events you attend | Nur Events, zu denen du gehst |
| `eventFilter.interested` | Only events you are interested in | Nur Events, die dich interessieren |
| `eventFilter.tag` | Only events with your tag: {tag} | Nur Events mit deinem Tag: {tag} |
| `eventFilter.count` | {shown} of {loaded} loaded events shown. Events loaded later are checked too. | {shown} von {loaded} geladenen Events angezeigt. Später geladene Events werden auch geprüft. |
| `eventFilter.readFailed` | JoyFox could not read your event notes. Reload the page to try again. | JoyFox konnte deine Event-Notizen nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen. |
| `eventFilter.noAccount` | Select or add an account in the JoyFox options to filter by your notes. | Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um nach deinen Notizen zu filtern. |
| `eventFilter.badge` | JoyFox | JoyFox |
| `eventFilter.hasNote` | note | Notiz |

## messages

| Key | English | Deutsch |
| --- | --- | --- |
| `messages.heading` | Message search | Nachrichtensuche |
| `messages.hint` | JoyFox stores the ClubMail messages you open, sent and received, so you can search them here. It stores only what a conversation shows on screen and never loads older messages. The text stays in this browser, and an export file holds it too. If you allow JoyFox in private windows, it stores the messages you open there in the same way. | JoyFox speichert die ClubMail-Nachrichten, die du öffnest, gesendete und empfangene, damit du sie hier durchsuchen kannst. Es speichert nur, was eine Unterhaltung auf dem Bildschirm zeigt, und lädt nie ältere Nachrichten. Der Text bleibt in diesem Browser, und eine Exportdatei enthält ihn auch. Wenn du JoyFox in privaten Fenstern erlaubst, speichert es die Nachrichten, die du dort öffnest, genauso. |
| `messages.caching` | Store the messages I open in ClubMail | Die Nachrichten speichern, die ich in ClubMail öffne |
| `messages.cachingOn` | Message storing is on. | Das Speichern von Nachrichten ist an. |
| `messages.cachingOff` | Message storing is off. Messages stored before stay until they are older than the time set here, or until you delete them under "Your data". | Das Speichern von Nachrichten ist aus. Schon gespeicherte Nachrichten bleiben, bis sie älter als die hier eingestellte Zeit sind oder bis du sie unter „Deine Daten“ löschst. |
| `messages.offHint` | Storing is off: JoyFox stores no new messages. Search still covers the messages stored before. | Das Speichern ist aus: JoyFox speichert keine neuen Nachrichten. Die Suche umfasst weiter die schon gespeicherten Nachrichten. |
| `messages.retentionLabel` | Keep messages for (months) | Nachrichten behalten für (Monate) |
| `messages.retentionSave` | Save | Speichern |
| `messages.retentionHint` | Messages older than this are deleted automatically. Lowering the number deletes older messages at once. The default is {default}. Click "Save" to apply. | Ältere Nachrichten werden automatisch gelöscht. Eine kleinere Zahl löscht ältere Nachrichten sofort. Standard ist {default}. Klicke zum Übernehmen auf „Speichern“. |
| `messages.retentionConfirm` | Save and delete | Speichern und löschen |
| `messages.retentionConfirmPrompt` | Lowering the number deletes the stored messages older than 1 month / {months} months at once. Click "Save and delete" to confirm. | Eine kleinere Zahl löscht die gespeicherten Nachrichten, die älter als 1 Monat / {months} Monate sind, sofort. Klicke zum Bestätigen auf „Speichern und löschen“. |
| `messages.retentionSaved` | Saved. 1 older message was / {deleted} older messages were deleted. | Gespeichert. 1 ältere Nachricht wurde / {deleted} ältere Nachrichten wurden gelöscht. |
| `messages.retentionInvalid` | Enter a whole number from {minimum} to {maximum}. Nothing was changed. | Gib eine ganze Zahl von {minimum} bis {maximum} ein. Es wurde nichts geändert. |
| `messages.noAccount` | Select or add an account first. | Wähle zuerst ein Konto aus oder füge eines hinzu. |
| `messages.readFailed` | JoyFox could not read your stored messages. Reload the page to try again. | JoyFox konnte deine gespeicherten Nachrichten nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen. |
| `messages.searchLabel` | Search my messages | Meine Nachrichten durchsuchen |
| `messages.count` | 1 message / {count} messages found. | 1 Nachricht / {count} Nachrichten gefunden. |
| `messages.countLimited` | {count} messages found. The newest {shown} are shown. | {count} Nachrichten gefunden. Die neuesten {shown} werden angezeigt. |
| `messages.sentTo` | You to {member} · {when} | Du an {member} · {when} |
| `messages.receivedFrom` | {member} to you · {when} | {member} an dich · {when} |
| `messages.storedAt` | stored {when} | gespeichert {when} |

## signals

| Key | English | Deutsch |
| --- | --- | --- |
| `signals.state.complete` | Complete | Vollständig |
| `signals.state.incomplete` | Incomplete | Unvollständig |
| `signals.state.unknown` | Completeness unknown | Vollständigkeit unbekannt |
| `signals.state.unknownShort` | Unknown | Unbekannt |
| `signals.photos` | 1 photo / {count} photos | 1 Foto / {count} Fotos |
| `signals.photosUnknown` | photos unknown | Fotos unbekannt |
| `signals.words` | 1 word / {count} words | 1 Wort / {count} Wörter |
| `signals.wordsUnknown` | words unknown | Wörter unbekannt |
| `signals.verified` | verified | verifiziert |
| `signals.notVerified` | not verified | nicht verifiziert |
| `signals.verificationUnknown` | verification unknown | Verifizierung unbekannt |
| `signals.heading` | Profile completeness | Vollständigkeit des Profils |
| `signals.trust` | Trust {score} | Vertrauen {score} |
| `signals.trustNoneShort` | Trust – | Vertrauen – |
| `signals.noteAdd` | Add note | Notiz hinzufügen |
| `signals.noteEdit` | Note | Notiz |
| `signals.tagsLabel` | Your tags | Deine Tags |
| `signals.tagCount` | 1 tag / {count} tags | 1 Tag / {count} Tags |
| `signals.editor.label` | JoyFox: note and tags for {member} | JoyFox: Notiz und Tags für {member} |

## member

| Key | English | Deutsch |
| --- | --- | --- |
| `member.number` | Member {id} | Mitglied {id} |

## signals

| Key | English | Deutsch |
| --- | --- | --- |
| `signals.editor.loading` | Loading… | Wird geladen … |
| `signals.editor.close` | Close | Schließen |
| `signals.editor.noAccount` | Select or add an account in the JoyFox options to keep notes. | Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Notizen zu führen. |
| `signals.editor.readFailed` | JoyFox could not read this member's notes. Close and try again. | JoyFox konnte die Notizen zu diesem Mitglied nicht lesen. Schließe die Notiz und öffne sie erneut. |
| `signals.filter.label` | JoyFox: hide incomplete profiles | JoyFox: unvollständige Profile ausblenden |
| `signals.filter.count` | {hidden} of {loaded} loaded profiles hidden. Profiles JoyFox knows nothing about stay visible. | {hidden} von {loaded} geladenen Profilen ausgeblendet. Profile, über die JoyFox nichts weiß, bleiben sichtbar. |

## compat

| Key | English | Deutsch |
| --- | --- | --- |
| `compat.heading` | Shared preferences | Gemeinsame Vorlieben |
| `compat.shared` | You share 1 preference / {count} preferences with this member: | Du teilst 1 Vorliebe / {count} Vorlieben mit diesem Mitglied: |
| `compat.none` | You share no preferences with this member. | Du teilst keine Vorlieben mit diesem Mitglied. |
| `compat.listToggle` | Show the shared preferences | Gemeinsame Vorlieben anzeigen |
| `compat.own` | This is your profile. JoyFox compares other profiles with your 1 positive preference / {count} positive preferences. | Das ist dein Profil. JoyFox vergleicht andere Profile mit deiner 1 positiven Vorliebe / deinen {count} positiven Vorlieben. |
| `compat.ownUnknown` | Open your own JoyClub profile once, so JoyFox knows your preferences. | Öffne einmal dein eigenes JoyClub-Profil, damit JoyFox deine Vorlieben kennt. |
| `compat.unreadable` | JoyFox could not read this profile's preferences yet. | JoyFox konnte die Vorlieben dieses Profils noch nicht lesen. |
| `compat.missing` | This profile shows no preferences to compare. | Dieses Profil zeigt keine Vorlieben zum Vergleichen. |
| `compat.readFailed` | JoyFox could not load your preferences. Reload the page to try again. | JoyFox konnte deine Vorlieben nicht laden. Lade die Seite neu, um es noch einmal zu versuchen. |
| `compat.noAccount` | Select or add an account in the JoyFox options to compare preferences. | Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Vorlieben zu vergleichen. |
| `compat.badge` | {count} shared | {count} gemeinsam |
| `compat.badgeLabel` | JoyFox: 1 shared preference / {count} shared preferences | JoyFox: 1 gemeinsame Vorliebe / {count} gemeinsame Vorlieben |
| `compat.sort.button` | Sort by shared preferences | Nach gemeinsamen Vorlieben sortieren |
| `compat.sort.on` | Sorted by shared preferences. Members whose profile you have not opened come last. | Nach gemeinsamen Vorlieben sortiert. Mitglieder, deren Profil du noch nicht geöffnet hast, stehen am Ende. |
| `compat.sort.unavailable` | JoyFox cannot sort this list: its layout does not allow it. | JoyFox kann diese Liste nicht sortieren, weil ihr Aufbau das nicht zulässt. |

## searches

| Key | English | Deutsch |
| --- | --- | --- |
| `searches.heading` | JoyFox saved searches | Gespeicherte JoyFox-Suchen |
| `searches.loading` | Loading saved searches… | Gespeicherte Suchen werden geladen … |
| `searches.readFailed` | JoyFox could not read your saved searches. Reload the page to try again. | JoyFox konnte deine gespeicherten Suchen nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen. |
| `searches.empty` | No saved searches yet. | Noch keine gespeicherten Suchen. |
| `searches.noAccount` | Select or add an account in the JoyFox options to save searches. | Wähle in den JoyFox-Einstellungen ein Konto aus oder füge eines hinzu, um Suchen zu speichern. |
| `searches.save` | Save this search | Diese Suche speichern |
| `searches.nameLabel` | Name for this search | Name für diese Suche |
| `searches.confirmSave` | Save | Speichern |
| `searches.cancel` | Cancel | Abbrechen |
| `searches.noName` | Type a name first. Nothing was saved. | Gib zuerst einen Namen ein. Es wurde nichts gespeichert. |
| `searches.nameTooLong` | A name can have at most {maximum} characters. Nothing was saved. | Ein Name darf höchstens {maximum} Zeichen haben. Es wurde nichts gespeichert. |
| `searches.notSearchAddress` | This page's address is not a search JoyFox can save. Nothing was saved. | Die Adresse dieser Seite ist keine Suche, die JoyFox speichern kann. Es wurde nichts gespeichert. |
| `searches.full` | You have {maximum} saved searches, the most JoyFox keeps. Delete one first. | Du hast {maximum} gespeicherte Suchen, mehr behält JoyFox nicht. Lösche zuerst eine. |
| `searches.refused` | The active JoyFox account changed, so nothing was changed. | Das aktive JoyFox-Konto hat sich geändert, deshalb wurde nichts geändert. |
| `searches.saved` | Saved "{name}". | „{name}“ gespeichert. |
| `searches.noMatch` | "{name}" no longer matches JoyClub's search address, so JoyFox did not open it. Run the search again and save it again. | „{name}“ passt nicht mehr zur Suchadresse von JoyClub, deshalb hat JoyFox die Suche nicht geöffnet. Führe die Suche noch einmal aus und speichere sie neu. |
| `searches.running` | Running "{name}"… | „{name}“ wird ausgeführt … |
| `searches.runningUnnamed` | Running the saved search… | Die gespeicherte Suche wird ausgeführt … |
| `searches.shown` | Showing "{name}". | „{name}“ wird angezeigt. |
| `searches.shownUnnamed` | Showing the saved search. | Die gespeicherte Suche wird angezeigt. |
| `searches.runFailed` | JoyFox could not run the saved search. Open JoyClub's filter and click "Anwenden". | JoyFox konnte die gespeicherte Suche nicht ausführen. Öffne den Filter von JoyClub und klicke auf „Anwenden“. |
| `searches.deleteLabel` | Delete saved search {name} | Gespeicherte Suche {name} löschen |
| `searches.confirmDelete` | Click ✕ again to delete "{name}". | Klicke noch einmal auf ✕, um „{name}“ zu löschen. |
| `searches.deleted` | Deleted "{name}". | „{name}“ gelöscht. |

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
| `picker.result.too-long` | The template is 1 character / {over} characters too long for the message field, which takes at most {limit} characters. Nothing was inserted. Shorten your text or the template. | Die Vorlage ist 1 Zeichen / {over} Zeichen zu lang für das Nachrichtenfeld, das höchstens {limit} Zeichen fasst. Es wurde nichts eingefügt. Kürze deinen Text oder die Vorlage. |
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
| `options.intro` | JoyFox stores everything locally in this browser profile. Inbox sorting stays off until you save a contact rule. | JoyFox speichert alles lokal in diesem Browserprofil. Die Sortierung des Posteingangs bleibt aus, bis du eine Kontaktregel speicherst. |
| `options.tabs.start` | Get started | Erste Schritte |
| `options.tabs.accounts` | Accounts | Konten |
| `options.tabs.rule` | Contact rule | Kontaktregel |
| `options.tabs.templates` | Templates | Vorlagen |
| `options.tabs.events` | Events | Events |
| `options.tabs.messages` | Messages | Nachrichten |
| `options.tabs.data` | Your data | Deine Daten |
| `options.importRegion` | Import JoyFox data | JoyFox-Daten importieren |
| `options.languageSaveFailed` | JoyFox could not save the language. Try again. | JoyFox konnte die Sprache nicht speichern. Versuche es noch einmal. |

## start

| Key | English | Deutsch |
| --- | --- | --- |
| `start.state.done` | Done | Erledigt |
| `start.state.off` | Saved, but turned off | Gespeichert, aber ausgeschaltet |
| `start.state.todo` | Not done yet | Noch nicht erledigt |
| `start.state.doneOpen` | Done: no conditions, so every sender qualifies | Erledigt: keine Bedingungen, deshalb ist jede Person qualifiziert |
| `start.ready` | JoyFox is set up. Open your JoyClub inbox to see it sorted. | JoyFox ist eingerichtet. Öffne deinen JoyClub-Posteingang, um ihn sortiert zu sehen. |
| `start.intro` | Three steps, a few minutes. Everything stays in this browser. | Drei Schritte, ein paar Minuten. Alles bleibt in diesem Browser. |
| `start.introAccess` | Four steps, a few minutes. Everything stays in this browser. | Vier Schritte, ein paar Minuten. Alles bleibt in diesem Browser. |
| `start.readFailed` | JoyFox could not read its setup. Reload the page to try again. | JoyFox konnte seine Einrichtung nicht lesen. Lade die Seite neu, um es noch einmal zu versuchen. |
| `start.step.access` | Allow JoyFox to access joyclub.de. Access is off now, so JoyFox cannot work on JoyClub. | Erlaube JoyFox den Zugriff auf joyclub.de. Der Zugriff ist gerade aus, deshalb kann JoyFox auf JoyClub nicht arbeiten. |
| `start.step.account` | Add your JoyClub account under [Accounts](#accounts). JoyFox makes the first one active. | Füge dein JoyClub-Konto unter [Konten](#accounts) hinzu. JoyFox macht das erste Konto aktiv. |
| `start.step.chooseAccount` | Choose the active account under [Accounts](#accounts). | Wähle das aktive Konto unter [Konten](#accounts) aus. |
| `start.step.rule` | Save a contact rule under [Contact rule](#rule). Inbox sorting stays off until a rule is saved and turned on. | Speichere eine Kontaktregel unter [Kontaktregel](#rule). Die Sortierung des Posteingangs bleibt aus, bis eine Regel gespeichert und eingeschaltet ist. |
| `start.step.inbox` | Open your JoyClub inbox (www.joyclub.de, ClubMail). JoyFox adds its tabs above the list. | Öffne deinen JoyClub-Posteingang (www.joyclub.de, ClubMail). JoyFox zeigt seine Tabs über der Liste. |

## access

| Key | English | Deutsch |
| --- | --- | --- |
| `access.allow` | Allow access to joyclub.de | Zugriff auf joyclub.de erlauben |
| `access.granted` | Access to joyclub.de is on. JoyFox can now work on JoyClub. | Der Zugriff auf joyclub.de ist an. JoyFox kann jetzt auf JoyClub arbeiten. |
| `access.refused` | Access to joyclub.de is still off. JoyFox cannot work on JoyClub until you allow access here or in about:addons. | Der Zugriff auf joyclub.de ist weiterhin aus. JoyFox kann auf JoyClub erst arbeiten, wenn du den Zugriff hier oder unter about:addons erlaubst. |

## accounts

| Key | English | Deutsch |
| --- | --- | --- |
| `accounts.readFailed` | JoyFox could not read its stored accounts. No account was changed. Reload the page to try again. | JoyFox konnte die gespeicherten Konten nicht lesen. Es wurde kein Konto geändert. Lade die Seite neu, um es noch einmal zu versuchen. |
| `accounts.hint` | JoyFox cannot read which JoyClub login a tab uses. The active account is the one selected here. JoyFox stores your notes, tags, rules, templates and other data under it. | JoyFox kann nicht lesen, mit welchem JoyClub-Login ein Tab arbeitet. Aktiv ist das Konto, das du hier auswählst. JoyFox speichert deine Notizen, Tags, Regeln, Vorlagen und andere Daten unter diesem Konto. |
| `accounts.activeLabel` | Active account: | Aktives Konto: |
| `accounts.noneSelected` | None selected | Keines ausgewählt |
| `accounts.empty` | No accounts yet. Add one below to use JoyFox. | Noch keine Konten. Füge unten ein Konto hinzu, um JoyFox zu verwenden. |
| `accounts.list` | Stored accounts | Gespeicherte Konten |
| `accounts.nameWithIdentifier` | {label} ({identifier}) | {label} ({identifier}) |
| `accounts.active` | Active | Aktiv |
| `accounts.inactive` | Not active | Nicht aktiv |
| `accounts.use` | Use this account | Dieses Konto verwenden |
| `accounts.useLabel` | Use this account: {name} | Dieses Konto verwenden: {name} |
| `accounts.nowActive` | Active account is now {name}. | Aktives Konto ist jetzt {name}. |
| `accounts.rename` | Rename | Umbenennen |
| `accounts.renameLabel` | Rename account {name} | Umbenennen: Konto {name} |
| `accounts.renameField` | New display label for {identifier} | Neuer Anzeigename für {identifier} |
| `accounts.renameSave` | Save | Speichern |
| `accounts.renameCancel` | Cancel | Abbrechen |
| `accounts.renamed` | Label saved. JoyFox now shows this account as {name}. | Anzeigename gespeichert. JoyFox zeigt dieses Konto jetzt als {name}. |
| `accounts.remove` | Remove | Entfernen |
| `accounts.confirmRemove` | Confirm removal | Entfernen bestätigen |
| `accounts.removeLabel` | Remove account {name} | Entfernen: Konto {name} |
| `accounts.confirmRemoveLabel` | Confirm removal of account {name} and all of its data | Entfernen bestätigen: Konto {name} und alle seine Daten |
| `accounts.removePrompt` | Removing {name} deletes everything JoyFox stored for this account, for example notes, tags, rules, templates, messages, event notes and saved searches. Click again to confirm. | Wenn du {name} entfernst, löscht JoyFox alles, was es für dieses Konto gespeichert hat, zum Beispiel Notizen, Tags, Regeln, Vorlagen, Nachrichten, Event-Notizen und gespeicherte Suchen. Klicke zum Bestätigen noch einmal. |
| `accounts.removed` | Removed {name} and its stored data. | {name} und die gespeicherten Daten wurden entfernt. |
| `accounts.removedNoneActive` | Removed {name} and its stored data. No account is active now. Choose one with "Use this account". | {name} und die gespeicherten Daten wurden entfernt. Jetzt ist kein Konto aktiv. Wähle eines mit „Dieses Konto verwenden“. |
| `accounts.removedNoneLeft` | Removed {name} and its stored data. No accounts are left. Add one to use JoyFox. | {name} und die gespeicherten Daten wurden entfernt. Es gibt keine Konten mehr. Füge ein Konto hinzu, um JoyFox zu verwenden. |
| `accounts.addForm` | Add an account | Konto hinzufügen |
| `accounts.identifier` | JoyClub account identifier | JoyClub-Kontokennung |
| `accounts.identifierHint` | Your JoyClub nickname works well. JoyFox uses it only to tell your accounts apart and to match imports. JoyFox does not check it. You cannot change it later. | Dein JoyClub-Nickname eignet sich gut. JoyFox verwendet ihn nur, um deine Konten zu unterscheiden und Importe zuzuordnen. JoyFox prüft ihn nicht. Du kannst ihn später nicht ändern. |
| `accounts.label` | Display label (optional) | Anzeigename (optional) |
| `accounts.labelHint` | Only JoyFox shows this label. If you leave it empty, JoyFox shows the identifier. | Nur JoyFox zeigt diesen Namen. Wenn du ihn leer lässt, zeigt JoyFox die Kennung. |
| `accounts.add` | Add account | Konto hinzufügen |
| `accounts.added` | Added {name}. | {name} wurde hinzugefügt. |
| `accounts.saveFailed` | That change could not be saved. Nothing was changed. | Diese Änderung konnte nicht gespeichert werden. Es wurde nichts geändert. |

## rule

| Key | English | Deutsch |
| --- | --- | --- |
| `rule.readFailed` | JoyFox could not read the contact rule. No rule was changed. Reload the page to try again. | JoyFox konnte die Kontaktregel nicht lesen. Es wurde keine Regel geändert. Lade die Seite neu, um es noch einmal zu versuchen. |
| `rule.hint` | The rule only changes how JoyFox groups your own inbox into Qualified, Needs Review and Quarantined. It never stops a message, never deletes anything, and the sender sees nothing. | Die Regel ändert nur, wie JoyFox deinen eigenen Posteingang in „Qualifiziert“, „Zu prüfen“ und „Quarantäne“ gruppiert. Sie hält keine Nachricht auf, löscht nichts, und die sendende Person sieht nichts davon. |
| `rule.noAccount` | Select or add an account first. Each account has its own rule. | Wähle zuerst ein Konto aus oder füge eines hinzu. Jedes Konto hat seine eigene Regel. |
| `rule.newer` | This rule was made in a newer version of JoyFox and cannot be edited here. Delete it to start a new one. | Diese Regel wurde mit einer neueren JoyFox-Version erstellt und kann hier nicht bearbeitet werden. Lösche sie, um eine neue anzulegen. |
| `rule.note.saved` | A rule is saved for the active account. | Für das aktive Konto ist eine Regel gespeichert. |
| `rule.note.none` | No rule is saved for the active account, so JoyFox does not sort the inbox. | Für das aktive Konto ist keine Regel gespeichert, deshalb sortiert JoyFox den Posteingang nicht. |
| `rule.enabled` | Sort my JoyClub inbox with this rule | Meinen JoyClub-Posteingang mit dieser Regel sortieren |
| `rule.placementLabel` | A sender who does not meet the rule goes to | Einordnung, wenn die Regel nicht erfüllt ist: |
| `rule.spamHint` | Spam status is unknown for now: JoyFox does not check messages for templates yet. Only your own "not spam" corrections count. The inbox shows only the verification shield; photos, profile words and account age come from profiles you opened before. | Der Spam-Status ist vorerst unbekannt: JoyFox prüft Nachrichten noch nicht auf Vorlagen. Nur deine eigenen Korrekturen „kein Spam“ zählen. Der Posteingang zeigt nur das Verifizierungssymbol. Fotos, Wörter im Profil und Kontoalter stammen aus Profilen, die du vorher geöffnet hast. |
| `rule.autosaveHint` | Changes are saved automatically: a box or choice at once, a number or text when you leave its field. | Änderungen werden automatisch gespeichert: ein Kästchen oder eine Auswahl sofort, eine Zahl oder ein Text, sobald du das Feld verlässt. |
| `rule.firstMessageHint` | "First message contains" reads the message preview in your inbox, ignoring upper and lower case. The inbox shows only the latest message, so when a sender sent more than one, the preview may not be the first. If the preview does not contain your text, the condition counts as your "If JoyFox cannot see this" choice. Once JoyFox sees your text, it stays met. | „Erste Nachricht enthält“ liest die Nachrichtenvorschau in deinem Posteingang und beachtet keine Groß- und Kleinschreibung. Der Posteingang zeigt nur die neueste Nachricht. Wenn eine Person mehr als eine Nachricht gesendet hat, ist die Vorschau deshalb vielleicht nicht die erste. Wenn die Vorschau deinen Text nicht enthält, zählt die Bedingung nach deiner Wahl unter „Wenn JoyFox das nicht sehen kann“. Sobald JoyFox deinen Text sieht, bleibt die Bedingung erfüllt. |
| `rule.preset.label` | Start from a preset | Mit einer Vorgabe beginnen |
| `rule.preset.choose` | Choose a preset… | Vorgabe wählen … |
| `rule.preset.apply` | Apply preset | Vorgabe übernehmen |
| `rule.preset.confirm` | Replace conditions | Bedingungen ersetzen |
| `rule.preset.confirmPrompt` | The preset replaces every condition below. Click "Replace conditions" to confirm. | Die Vorgabe ersetzt alle Bedingungen unten. Klicke zur Bestätigung auf „Bedingungen ersetzen“. |
| `rule.preset.hint` | A preset fills in the conditions below and saves them. You can then change them like any other rule. | Eine Vorgabe setzt die Bedingungen unten und speichert sie. Danach kannst du sie wie jede andere Regel ändern. |
| `rule.preset.open` | Open | Offen |
| `rule.preset.complete` | Complete profiles only | Nur vollständige Profile |
| `rule.preset.verified` | Verified members | Verifizierte Mitglieder |
| `rule.preset.highTrust` | High-trust members | Mitglieder mit hohem Vertrauen |
| `rule.preset.custom` | Custom | Eigene |
| `rule.preset.describe.open` | No conditions: every sender qualifies. | Keine Bedingungen: Jede Person ist qualifiziert. |
| `rule.preset.describe.complete` | A sender needs at least {photos} photos and at least {words} words of profile text. | Eine Person braucht mindestens {photos} Fotos und mindestens {words} Wörter im Profil. |
| `rule.preset.describe.verified` | A sender needs to be verified by JoyClub. | Eine Person muss von JoyClub verifiziert sein. |
| `rule.preset.describe.highTrust` | A sender needs to be verified by JoyClub, with at least {photos} photos, at least {words} words of profile text and an account at least {days} days old. | Eine Person muss von JoyClub verifiziert sein und braucht mindestens {photos} Fotos, mindestens {words} Wörter im Profil und ein Konto, das mindestens {days} Tage alt ist. |
| `rule.preset.describe.custom` | Clears all conditions, so you can tick the ones you want. | Entfernt alle Bedingungen, damit du die gewünschten ankreuzen kannst. |
| `rule.preset.applied` | Preset "{preset}" applied and saved. You can change its conditions below. | Vorgabe „{preset}“ übernommen und gespeichert. Du kannst ihre Bedingungen unten ändern. |
| `rule.preset.appliedOpen` | Preset "Open" applied and saved. The rule has no conditions, so every sender qualifies. | Vorgabe „Offen“ übernommen und gespeichert. Die Regel hat keine Bedingungen, deshalb ist jede Person qualifiziert. |
| `rule.preset.appliedCustom` | All conditions cleared and saved. Tick the conditions you want. Until you do, every sender qualifies. | Alle Bedingungen entfernt und gespeichert. Kreuze die gewünschten Bedingungen an. Bis dahin ist jede Person qualifiziert. |
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
| `rule.textPlaceholder` | Word, phrase or emoji | Wort, Formulierung oder Emoji |
| `rule.textLabel` | {condition}: word, phrase or emoji | {condition}: Wort, Formulierung oder Emoji |
| `rule.textProblem` | Enter a word, phrase or emoji of up to {maximum} characters for "{condition}". | Gib für „{condition}“ ein Wort, eine Formulierung oder ein Emoji mit höchstens {maximum} Zeichen ein. |
| `rule.fieldNumberProblem` | Enter a whole number from {minimum} to {maximum}. | Gib eine ganze Zahl von {minimum} bis {maximum} ein. |
| `rule.fieldTextProblem` | Enter a word, phrase or emoji of up to {maximum} characters. | Gib ein Wort, eine Formulierung oder ein Emoji mit höchstens {maximum} Zeichen ein. |
| `rule.textHint` | Type a word, phrase or emoji to use this condition. | Gib ein Wort, eine Formulierung oder ein Emoji ein, um diese Bedingung zu verwenden. |
| `rule.spamNote` | (not checked yet: always unknown) | (noch nicht geprüft: immer unbekannt) |
| `rule.combine.label` | How the groups combine | Wie die Gruppen verknüpft werden |
| `rule.combine.prefix` | A sender is qualified if | Eine Person ist qualifiziert bei |
| `rule.combine.suffix` | of these groups match. | dieser Gruppen. |
| `rule.advancedHint` | Each group is met when ALL or ANY of its conditions are met, as you choose. Tick "not" to turn a condition around: "not Minimum photos 3" means fewer than 3 photos. A group without conditions is not saved. | Jede Gruppe ist erfüllt bei ALLEN oder MINDESTENS EINER ihrer Bedingungen, wie du es wählst. Setze ein Häkchen bei „nicht“, um eine Bedingung umzukehren: „nicht Mindestanzahl Fotos 3“ bedeutet weniger als 3 Fotos. Eine Gruppe ohne Bedingungen wird nicht gespeichert. |
| `rule.addRule` | + Add group | + Gruppe hinzufügen |
| `rule.removeRule` | Remove group | Gruppe entfernen |
| `rule.confirmRemoveGroup` | Confirm removal | Entfernen bestätigen |
| `rule.confirmRemoveGroupLabel` | Confirm removal of group {number} | Entfernen von Gruppe {number} bestätigen |
| `rule.removeGroupPrompt` | Click again to remove group {number} and its conditions. | Klicke noch einmal, um Gruppe {number} und ihre Bedingungen zu entfernen. |
| `rule.ruleSuffix` | of these are met | dieser Bedingungen |
| `rule.noConditions` | No conditions yet. Add one below. | Noch keine Bedingungen. Füge unten eine hinzu. |
| `rule.removeCondition` | Remove condition | Bedingung entfernen |
| `rule.removeConditionLabel` | Remove {condition} | {condition} entfernen |
| `rule.not` | not | nicht |
| `rule.notTitle` | Turn this condition around | Diese Bedingung umkehren |
| `rule.notLabel` | not: turn "{condition}" around | nicht: „{condition}“ umkehren |
| `rule.joiner.all` | AND | UND |
| `rule.joiner.any` | OR | ODER |
| `rule.ruleTitle` | Group {number}: met if | Gruppe {number}: erfüllt bei |
| `rule.ruleMatchLabel` | How group {number} combines its conditions | Wie Gruppe {number} ihre Bedingungen verknüpft |
| `rule.removeRuleLabel` | Remove group {number} | Gruppe {number} entfernen |
| `rule.addConditionLabel` | Add a condition to group {number} | Bedingung zu Gruppe {number} hinzufügen |
| `rule.addCondition` | + Add condition… | + Bedingung hinzufügen … |
| `rule.ruleCount` | {count} of {maximum} groups | {count} von {maximum} Gruppen |
| `rule.simpleUnavailable.all` | Simple view is not available: the groups combine with ALL. | Die einfache Ansicht ist nicht verfügbar: Die Gruppen sind mit ALLEN verknüpft. |
| `rule.simpleUnavailable.not` | Simple view is not available: the rule uses "not". | Die einfache Ansicht ist nicht verfügbar: Die Regel verwendet „nicht“. |
| `rule.simpleUnavailable.severalAll` | Simple view is not available: more than one group needs ALL of several conditions. | Die einfache Ansicht ist nicht verfügbar: Mehr als eine Gruppe verlangt ALLE von mehreren Bedingungen. |
| `rule.simpleUnavailable.duplicate` | Simple view is not available: a condition appears in more than one group. | Die einfache Ansicht ist nicht verfügbar: Eine Bedingung steht in mehr als einer Gruppe. |
| `rule.savedNoConditions` | Rule saved. It has no conditions yet, so every sender qualifies. | Regel gespeichert. Sie hat noch keine Bedingungen, deshalb ist jede Person qualifiziert. |
| `rule.savedVacuous` | Rule saved. With nothing in the ALL box, every sender qualifies, so the ANY box has no effect. | Regel gespeichert. Ohne Einträge im ALLE-Kasten ist jede Person qualifiziert, deshalb wirkt der MINDESTENS-EINE-Kasten nicht. |
| `rule.saved` | Rule saved. Open JoyClub tabs update at once. | Regel gespeichert. Offene JoyClub-Tabs werden sofort aktualisiert. |
| `rule.notSaved` | {problem} The rule was not saved. | {problem} Die Regel wurde nicht gespeichert. |
| `rule.saveFailed` | JoyFox could not save the rule. Nothing was changed. Change the field again, or reload the page to see the saved rule. | JoyFox konnte die Regel nicht speichern. Es wurde nichts geändert. Ändere das Feld noch einmal, oder lade die Seite neu, um die gespeicherte Regel zu sehen. |
| `rule.deleteAll` | Delete whole contact rule | Ganze Kontaktregel löschen |
| `rule.confirmDeleteAll` | Confirm delete | Löschen bestätigen |
| `rule.deletePrompt` | Click again to delete the whole contact rule. JoyFox then stops sorting the inbox for this account. | Klicke noch einmal, um die ganze Kontaktregel zu löschen. JoyFox sortiert den Posteingang für dieses Konto dann nicht mehr. |
| `rule.removed` | Contact rule deleted. JoyFox no longer sorts the inbox for this account. | Kontaktregel gelöscht. JoyFox sortiert den Posteingang für dieses Konto nicht mehr. |
| `rule.removeFailed` | JoyFox could not delete the rule. Nothing was changed. | JoyFox konnte die Regel nicht löschen. Es wurde nichts geändert. |
| `rule.stale.account.saved` | The active account changed. The rule was not saved. Check the form and try again. | Das aktive Konto hat sich geändert. Die Regel wurde nicht gespeichert. Prüfe das Formular und versuche es noch einmal. |
| `rule.stale.account.removed` | The active account changed. The rule was not deleted. Check the form and try again. | Das aktive Konto hat sich geändert. Die Regel wurde nicht gelöscht. Prüfe das Formular und versuche es noch einmal. |
| `rule.stale.rule.saved` | The rule was changed in another tab. It was not saved. The form now shows the saved rule. | Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht gespeichert. Das Formular zeigt jetzt die gespeicherte Regel. |
| `rule.stale.rule.removed` | The rule was changed in another tab. It was not deleted. The form now shows the saved rule. | Die Regel wurde in einem anderen Tab geändert. Sie wurde nicht gelöscht. Das Formular zeigt jetzt die gespeicherte Regel. |
| `rule.changedElsewhere` | The rule was changed in another tab. The form now shows the saved rule. | Die Regel wurde in einem anderen Tab geändert. Das Formular zeigt jetzt die gespeicherte Regel. |

## templates

| Key | English | Deutsch |
| --- | --- | --- |
| `templates.readFailed` | JoyFox could not read your templates. No template was changed. Reload the page to try again. | JoyFox konnte deine Vorlagen nicht lesen. Es wurde keine Vorlage geändert. Lade die Seite neu, um es noch einmal zu versuchen. |
| `templates.heading` | Message templates | Nachrichtenvorlagen |
| `templates.hint` | On a JoyClub conversation, the "JoyFox templates" button below the message field inserts a template at the cursor. You can still edit the text, and you always click JoyClub's Send button yourself. JoyFox never sends a message. | In einer JoyClub-Unterhaltung fügt die Schaltfläche „JoyFox-Vorlagen“ unter dem Nachrichtenfeld eine Vorlage an der Cursorposition ein. Du kannst den Text danach noch ändern, und du klickst JoyClubs „Senden“ immer selbst. JoyFox sendet nie eine Nachricht. |
| `templates.noAccount` | Choose an active account on the [Accounts](#accounts) tab to store templates. | Wähle unter [Konten](#accounts) ein aktives Konto, um Vorlagen zu speichern. |
| `templates.empty` | No templates yet. Add one below. | Noch keine Vorlagen. Füge unten eine hinzu. |
| `templates.inFolder` | Templates in {folder} | Vorlagen in {folder} |
| `templates.edit` | Edit | Bearbeiten |
| `templates.editLabel` | Edit template {name} | Bearbeiten: Vorlage {name} |
| `templates.editing` | Editing {name}. | Du bearbeitest {name}. |
| `templates.delete` | Delete | Löschen |
| `templates.confirmDelete` | Confirm delete | Löschen bestätigen |
| `templates.deleteLabel` | Delete template {name} | Löschen: Vorlage {name} |
| `templates.confirmDeleteLabel` | Confirm delete: template {name} | Löschen bestätigen: Vorlage {name} |
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
| `entity.messagePhraseMatches` | Message phrase matches | Gefundene Formulierungen in Nachrichten |
| `entity.cachedMessages` | Stored messages (for search) | Gespeicherte Nachrichten (für die Suche) |

## data

| Key | English | Deutsch |
| --- | --- | --- |
| `data.readFailed` | JoyFox could not read its stored data. Nothing was changed. Reload the page to try again. | JoyFox konnte die gespeicherten Daten nicht lesen. Es wurde nichts geändert. Lade die Seite neu, um es noch einmal zu versuchen. |
| `data.hint` | Everything JoyFox stores stays in this browser profile. You can inspect it, save it as a JSON file and delete it here. Deleting here never changes anything on JoyClub. | Alles, was JoyFox speichert, bleibt in diesem Browserprofil. Hier kannst du es ansehen, als JSON-Datei speichern und löschen. Löschen hier ändert nie etwas auf JoyClub. |
| `data.importPointer` | To import a file, go to [Accounts](#accounts). | Eine Datei importierst du unter [Konten](#accounts). |
| `data.noAccounts` | No accounts yet. | Noch keine Konten. |
| `data.accountPicker` | Account to inspect | Konto ansehen (ändert nicht das aktive Konto) |
| `data.caption` | Stored records for this account | Gespeicherte Datensätze dieses Kontos |
| `data.col.type` | Data type | Datentyp |
| `data.col.records` | Records | Datensätze |
| `data.col.actions` | Actions | Aktionen |
| `data.show` | Show | Zeigen |
| `data.hide` | Hide | Ausblenden |
| `data.showLabel` | Show {label} | Zeigen: {label} |
| `data.hideLabel` | Hide {label} | Ausblenden: {label} |
| `data.deleteAll` | Delete all | Alle löschen |
| `data.deleteAllLabel` | Delete all {label} | Alle löschen: {label} |
| `data.deleteAllPrompt` | Click "Confirm" to delete all {count} {label} records of this account. | Klicke auf „Bestätigen“, um alle {count} Datensätze „{label}“ dieses Kontos zu löschen. |
| `data.deletedAll` | Deleted all {label} of this account. | Alle Datensätze „{label}“ dieses Kontos wurden gelöscht. |
| `data.recordsTitle` | {label} ({count}) | {label} ({count}) |
| `data.accountRecordHint` | The account record is removed only with the whole account, on the [Accounts](#accounts) tab. | Der Kontodatensatz wird nur mit dem ganzen Konto entfernt, unter [Konten](#accounts). |
| `data.recordSummary` | {id} (updated {updated}) | {id} (geändert: {updated}) |
| `data.recordSummaryNamed` | {name}: {id} (updated {updated}) | {name}: {id} (geändert: {updated}) |
| `data.recordNamed` | {name} ({id}) | {name} ({id}) |
| `data.valueYes` | yes | ja |
| `data.valueNo` | no | nein |
| `data.valueEmpty` | (empty) | (leer) |
| `data.rawJson` | Stored JSON | Gespeichertes JSON |
| `data.moreCharacters` | …and {count} more characters (see "Stored JSON") | …und {count} weitere Zeichen (siehe „Gespeichertes JSON“) |
| `data.moreValues` | …and {count} more (see "Stored JSON") | …und {count} weitere (siehe „Gespeichertes JSON“) |
| `data.delete` | Delete | Löschen |
| `data.deleteRecordLabel` | Delete record {record} | Löschen: Datensatz {record} |
| `data.deleteRecordPrompt` | Click "Confirm" to delete record {record}. | Klicke auf „Bestätigen“, um den Datensatz {record} zu löschen. |
| `data.deletedRecord` | Deleted record {record}. | Datensatz {record} wurde gelöscht. |
| `data.showMore` | Show {count} more | {count} weitere zeigen |
| `data.exportAccount` | Export this account (JSON) | Dieses Konto exportieren (JSON) |
| `data.exportedAccount` | Export of this account created. | Der Export dieses Kontos wurde erstellt. |
| `data.deleteAccountData` | Delete this account's data | Daten dieses Kontos löschen |
| `data.deleteAccountDataLabel` | Delete this account's data (every record) | Daten dieses Kontos löschen (alle Datensätze) |
| `data.deleteAccountDataPrompt` | Click "Confirm" to delete every record of this account. The account itself stays in Accounts. | Klicke auf „Bestätigen“, um alle Datensätze dieses Kontos zu löschen. Das Konto selbst bleibt unter „Konten“. |
| `data.deletedAccountData` | Deleted all data of this account. The account itself is kept. | Alle Daten dieses Kontos wurden gelöscht. Das Konto selbst bleibt erhalten. |
| `data.allAccounts` | All accounts | Alle Konten |
| `data.retentionLabel` | Profile snapshots kept per member | Gespeicherte Profil-Momentaufnahmen je Mitglied |
| `data.retentionHint` | JoyFox keeps the newest snapshots of each member's profile facts, always at least the latest one. Lowering the number deletes older snapshots at once, in every account. From {minimum} to {maximum}; the default is {default}. Click "Save" to apply. | JoyFox behält die neuesten Momentaufnahmen der Profilangaben jedes Mitglieds, immer mindestens die letzte. Eine kleinere Zahl löscht ältere Momentaufnahmen sofort, in allen Konten. Von {minimum} bis {maximum}; Standard ist {default}. Klicke auf „Speichern“, um die Zahl zu übernehmen. |
| `data.retentionSave` | Save | Speichern |
| `data.retentionSaved` | Saved. 1 older snapshot was / {deleted} older snapshots were deleted. | Gespeichert. 1 ältere Momentaufnahme wurde / {deleted} ältere Momentaufnahmen wurden gelöscht. |
| `data.retentionInvalid` | Enter a whole number from {minimum} to {maximum}. Nothing was changed. | Gib eine ganze Zahl von {minimum} bis {maximum} ein. Es wurde nichts geändert. |
| `data.retentionFailed` | JoyFox could not save the setting. The field shows the number in use now. Try again. | JoyFox konnte die Einstellung nicht speichern. Das Feld zeigt die Zahl, die jetzt gilt. Versuche es noch einmal. |
| `data.exportAll` | Export all JoyFox data (JSON) | Alle JoyFox-Daten exportieren (JSON) |
| `data.exportedAll` | Export of all JoyFox data created. | Der Export aller JoyFox-Daten wurde erstellt. |
| `data.deleteEverything` | Delete all JoyFox data | Alle JoyFox-Daten löschen |
| `data.deleteEverythingLabel` | Delete all JoyFox data in this browser | Alle JoyFox-Daten löschen (in diesem Browser) |
| `data.deleteEverythingPrompt` | Click "Confirm" to delete every account, every record and every JoyFox setting in this browser. This cannot be undone. | Klicke auf „Bestätigen“, um alle Konten, alle Datensätze und alle JoyFox-Einstellungen in diesem Browser zu löschen. Das kann nicht rückgängig gemacht werden. |
| `data.deletedEverything` | Deleted all JoyFox data in this browser. | Alle JoyFox-Daten in diesem Browser wurden gelöscht. |
| `data.confirm` | Confirm | Bestätigen |
| `data.confirmLabel` | Confirm: {label} | Bestätigen: {label} |
| `data.actionFailed` | That action could not be completed. The counts shown now are what is stored. | Diese Aktion konnte nicht abgeschlossen werden. Die angezeigten Zahlen zeigen, was jetzt gespeichert ist. |
| `data.exportFailed` | JoyFox could not create the export. Nothing was exported. Try again. | JoyFox konnte den Export nicht erstellen. Es wurde nichts exportiert. Versuche es noch einmal. |
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
| `data.setting.activeAccount` | active account | aktives Konto |
| `data.setting.language` | language | Sprache |
| `data.setting.messageCaching` | store messages | Nachrichten speichern |
| `data.setting.messageRetention` | keep messages for | Nachrichten behalten für |
| `data.setting.quickIgnoreDelete` | Ignore and Delete button | Schaltfläche „Ignorieren und löschen“ |
| `data.setting.templatePicker` | template picker | Vorlagenauswahl |
| `data.setting.sharedEventException` | shared-event exception | Ausnahme für gemeinsame Events |
| `data.setting.snapshotRetention` | snapshots kept per member | Momentaufnahmen je Mitglied |
| `data.setting.diagnostics` | diagnostics | Diagnose |
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
| `error.withSuffix.nothingExported` | {error}. Nothing was exported. Try again. | {error}. Es wurde nichts exportiert. Versuche es noch einmal. |
| `error.withSuffix.settingNotChanged` | {error}. The setting was not changed. Try again. | {error}. Die Einstellung wurde nicht geändert. Versuche es noch einmal. |
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
| `error.import.tooLarge` | The file is too large to be a JoyFox export. Choose a file exported by JoyFox | Die Datei ist zu groß für einen JoyFox-Export. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.notJson` | The file is not a JoyFox export. Choose a file exported by JoyFox | Die Datei ist kein JoyFox-Export. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.notExport` | The file is not a JoyFox export. Choose a file exported by JoyFox | Die Datei ist kein JoyFox-Export. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.noVersion` | The file does not say which JoyFox version made it. Choose a file exported by JoyFox | Die Datei sagt nicht, welche JoyFox-Version sie erstellt hat. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.newerVersion` | The file comes from a newer JoyFox version. Update JoyFox first | Die Datei stammt aus einer neueren JoyFox-Version. Aktualisiere zuerst JoyFox |
| `error.import.noScope` | The file does not say if it holds one account or all data. Choose a file exported by JoyFox | Die Datei sagt nicht, ob sie ein Konto oder alle Daten enthält. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.noAccountNamed` | The file is an export of one account, but it does not name the account. Choose a file exported by JoyFox | Die Datei ist der Export eines Kontos, nennt das Konto aber nicht. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.unknownType` | The file holds a type of data that JoyFox does not know ({name}). Choose a file exported by JoyFox | Die Datei enthält eine Art von Daten, die JoyFox nicht kennt ({name}). Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.notList` | The {entity} part of the file is damaged. Choose a file exported by JoyFox | Der Teil „{entity}“ der Datei ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.notRecord` | Record {index} in {entity} is damaged. Choose a file exported by JoyFox | Eintrag {index} in „{entity}“ ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.forbiddenKey` | Record {index} in {entity} holds a field name that JoyFox does not allow. Choose a file exported by JoyFox | Eintrag {index} in „{entity}“ enthält einen Feldnamen, den JoyFox nicht erlaubt. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.unknownField` | Record {index} in {entity} holds a field that JoyFox does not know ({field}). Choose a file exported by JoyFox | Eintrag {index} in „{entity}“ enthält ein Feld, das JoyFox nicht kennt ({field}). Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.tooLong` | Record {index} in {entity} is too long: {field} has more than {maximum} characters. Choose a file exported by JoyFox | Eintrag {index} in „{entity}“ ist zu lang: {field} hat mehr als {maximum} Zeichen. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.invalid` | Record {index} in {entity} is damaged. Choose a file exported by JoyFox | Eintrag {index} in „{entity}“ ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.future` | Record {index} in {entity} has a date in the future. Check the clock of the computer that made the file | Eintrag {index} in „{entity}“ hat ein Datum in der Zukunft. Prüfe die Uhr des Computers, der die Datei erstellt hat |
| `error.import.otherAccount` | Record {index} in {entity} belongs to another account. Choose a file exported by JoyFox | Eintrag {index} in „{entity}“ gehört zu einem anderen Konto. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.notOwnScope` | Account record {index} is damaged. Choose a file exported by JoyFox | Kontodatensatz {index} ist beschädigt. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.twice` | Record {index} in {entity} is in the file twice. Choose a file exported by JoyFox | Eintrag {index} in „{entity}“ kommt in der Datei zweimal vor. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.sameIdentifier` | Two accounts in the file have the same identifier. Choose a file exported by JoyFox | Zwei Konten in der Datei haben dieselbe Kennung. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.noAccountRecord` | The file is an export of one account, but it does not hold that account. Choose a file exported by JoyFox | Die Datei ist der Export eines Kontos, enthält dieses Konto aber nicht. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.settingsInvalid` | The settings in the file are damaged. Choose a file exported by JoyFox | Die Einstellungen in der Datei sind beschädigt. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.settingsForbidden` | The settings in the file hold a name that JoyFox does not allow. Choose a file exported by JoyFox | Die Einstellungen in der Datei enthalten einen Namen, den JoyFox nicht erlaubt. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.unknownSetting` | The file holds a setting that JoyFox does not use ({key}). Choose a file exported by JoyFox | Die Datei enthält eine Einstellung, die JoyFox nicht verwendet ({key}). Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.orphans` | Some records in the file belong to an account that the file does not hold. Choose a file exported by JoyFox | Einige Datensätze in der Datei gehören zu einem Konto, das die Datei nicht enthält. Wähle eine Datei, die JoyFox exportiert hat |
| `error.import.sameRecordTwice` | Two records in the file would become the same record here. Choose a file exported by JoyFox | Zwei Datensätze in der Datei würden hier zum selben Datensatz. Wähle eine Datei, die JoyFox exportiert hat |
