# Profile preference checklist ("Vorlieben")

Captured 2026-09-26 with Claude in Chrome from the owner's account, using the
first version of `capture-prompt-e1-e4.md` (before its review fixes). Sanitized
again on review: the owner's own selected tags, the level they were in and the
profile types of both inspected profiles were removed; the first prompt version
asked for tag labels from the owner's profile, which `codex.md` forbids
committing.

Method: Opened the owner's own profile and one other member's profile (the
partner of the owner's most recent conversation, chosen by the owner). Inspected
the "Vorlieben" block with read-only `querySelectorAll`, class and attribute
reads and the `j-tag` shadow root. The profile edit page was not opened. On the
other member's profile only structure was recorded, never which tags are
selected. Only structure and value shapes were recorded, plus site vocabulary.

## Page signal

- URL pattern: `/profile/0000000.NAME.html` (7 or 8 digits)
- Unique root/signal: `body.body_profile`; `h1.profile-base-info__user-name`

## Identity

- Member ID: URL only (`/profile/<digits>.<slug>.html`). Not searched further on
  this page.
- Tag key: **Absent.** `j-tag` has no attributes except a Vue scope attribute.
  Its shadow root holds `a.j-tag[href="/search/top/?q=LABEL"][target="_blank"]`
  with the German label as text and as the `q` value. The visible label is the
  only key.

## Structure

Both profiles use the same structure:

```
div.profile-sed-card                          (one per person in the profile)
  div.expandable-content-box.profile-expandable-content-box
    div.expandable-content-box__content-wrapper[--expanded]
      ... j-card > div.profile-sed-card__expandable-content
            div.profile-erotic-prefs
              div.profile-erotic-prefs__header > h3.profile-erotic-prefs__headline   ("Vorlieben")
              div.profile-erotic-prefs__category            (one per level that has tags)
                h4.profile-erotic-prefs__category-title     (level name)
                div.profile-erotic-prefs__category-item-list
                  j-tag                                     (one per tag; label in shadow root)
    div.expandable-content-box__fade-overlay
    j-control-button.expandable-content-box__control-button   ("Mehr anzeigen")
```

- `div.profile-erotic-prefs` matches twice per person: one visible and one
  hidden. A couple profile has one pair per partner ("Steckbrief (Sie)" and
  "Steckbrief (Er)"). Inference: the hidden copy is an alternate responsive
  layout. Use `div.profile-erotic-prefs` filtered by `offsetParent !== null`, or
  de-duplicate by position.

## Fields

| Field           | Present? | Selector                                                  | Matches                  | Value shape                                         |
| --------------- | -------- | --------------------------------------------------------- | ------------------------ | --------------------------------------------------- |
| Section root    | Yes      | `div.profile-erotic-prefs`                                | 2 per person (1 visible) | –                                                   |
| Section heading | Yes      | `h3.profile-erotic-prefs__headline`                       | 2 per person             | "Vorlieben"                                         |
| Level group     | Yes      | `div.profile-erotic-prefs__category`                      | 1–6 per root             | –                                                   |
| Level name      | Yes      | `h4.profile-erotic-prefs__category-title`                 | 1 per group              | see list below                                      |
| Tag entry       | Yes      | `div.profile-erotic-prefs__category-item-list > j-tag`    | varies                   | label in shadow `a.j-tag` text                      |
| Tag label       | Yes      | `j-tag` → `shadowRoot.querySelector('a.j-tag')`           | 1 per tag                | German label, may contain a comma (e.g. "SM, BDSM") |
| Expand control  | Yes      | `j-control-button.expandable-content-box__control-button` | 1 per collapsed box      | "Mehr anzeigen"                                     |

### Level names (site vocabulary, page order)

1. Unbedingt
2. Steh ich drauf
3. Situationsabhängig
4. Mag ich nicht so
5. Geht gar nicht
6. Möchte ich gerne ausprobieren

### How state is shown

- **Only selected tags are shown.** The level is given by the enclosing
  `div.profile-erotic-prefs__category` and its `h4` title. No per-tag class,
  icon or attribute marks the level.
- A level with no tags is omitted, so the level set varies per profile.

### Tag labels

Removed on review: they were copied from the owner's own profile, which shows
only the owner's selected tags. The full tag vocabulary is not captured; it
needs a page that lists every available tag (see "Skipped or unclear").

### Other profile sections near "Vorlieben" (site vocabulary, page order)

- Suchkriterien (`div.profile-bs-property__title`): Wir suchen · Neigung ·
  Beziehungsstatus · Besuchbar (own profile only) · Swinger · Partnertausch ·
  BDSM · Fotoshooting (the first-person wording follows the profile type)
- `h2.profile-headline`: Account (own profile only) · Das mögen wir · Das mögen
  wir nicht
- Steckbrief (Sie) / Steckbrief (Er), `div.profile-sed-card__headline`: Größe ·
  Gewicht · Haarfarbe · Augenfarbe · Aussehen · Neigung · Sternzeichen ·
  Dominant / Devot · Sadomaso · Raucher · Kinder (set varies by profile)
- Profile sub-navigation (other member): Profil · Fotos & Videos · Dates &
  Events · Aktuelles · Gruppen · Freunde · Fans von

## Loading and navigation

- Hidden or collapsed: the Steckbrief box is collapsed behind "Mehr anzeigen"
  (`j-control-button.expandable-content-box__control-button`, with
  `.expandable-content-box__fade-overlay`). The tags are in the DOM while
  collapsed. Expanded state adds
  `expandable-content-box__content-wrapper--expanded`.
- ClubMail conversation → other member's profile (header link): full page load.
- Other profile → own profile (header avatar link): full page load.

## Skipped or unclear

- Full tag vocabulary from the profile edit page: Not captured (optional;
  skipped to limit page loads).
- Couple profiles: both partners' lists render at once (one visible root each).
  No switcher control was found.
- Why 2 roots are hidden: Unclear (inference: responsive duplicate).
