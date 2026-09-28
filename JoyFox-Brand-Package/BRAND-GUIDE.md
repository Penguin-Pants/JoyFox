# JoyFox Brand Guide
## Angular JF Monogram

### Brand idea

The Angular JF Monogram combines **J** and **F** into one compact mark. The lower red sweep hints at a fox tail without becoming a mascot. The construction is deliberately angular and mechanical rather than playful.

The identity should communicate:

- **Independent**: JoyFox is not JoyClub or Mozilla.
- **Useful**: a practical layer that helps the user organize information.
- **Private**: local-first by default without using lock or shield clichés.
- **Controlled**: JoyFox supports the user's decisions instead of taking control.
- **Discreet**: strong enough to identify the extension but not styled like a dating app.
- **Direct**: high contrast, simple geometry and minimal ornament.

### Independence rule

Do not use the JOYclub pixel-heart, JOYclub wordmark, Firefox logo or Mozilla marks inside JoyFox branding. The red-and-black visual relationship is intentional, but the Angular JF geometry must remain the primary identifier. Never state or imply that JoyFox is made, sponsored or approved by JOYclub or Mozilla.

## Logo system

### Primary app icon
`master/joyfox-icon-primary.svg`

Black rounded square with:
- off-white J
- JoyFox red F and tail
- no gradient
- no shadow
- no additional symbol

Use this for extension managers, store listings, GitHub avatars and general product identity.

### Transparent mark
`master/joyfox-mark-transparent.svg`

Use when the surrounding surface is already controlled.

### Light-background mark
`master/joyfox-mark-dark-on-light.svg`

Black J plus red F. Use on white or very light neutral surfaces.

### Dark-background mark
`master/joyfox-mark-light-on-dark.svg`

Off-white J plus red F. Use on black, charcoal or dark neutral surfaces.

### Monochrome marks
Use only when two colors are not possible.

- `joyfox-mark-monochrome-black.svg`
- `joyfox-mark-monochrome-white.svg`
- `joyfox-mark-monochrome-red.svg`

## Color palette

| Token | HEX | Purpose |
|---|---|---|
| JoyFox Red | `#EA1C2C` | Primary identity, active accents |
| Deep Red | `#A41118` | Pressed/secondary red, large dark-red fields |
| Black | `#0A0A0B` | Primary icon tile, dark backgrounds |
| Charcoal | `#171719` | Secondary dark surfaces |
| Graphite | `#2A2A2D` | Neutral borders and secondary UI |
| Off-white | `#F5F5F4` | Primary light mark/text on dark |
| Mid gray | `#8A8A8E` | Secondary text |
| Light gray | `#D7D7D9` | Light borders and dividers |

This red family is intentionally adjacent to JOYclub's red/black visual environment. It is **not presented as an official JOYclub brand color**.

### Red usage
Red is an accent, not a page background default. Prefer black, charcoal, white and system surfaces for the extension UI. Use red for:
- JoyFox identity
- selected/active JoyFox states
- small status accents
- key onboarding emphasis

Do not use red as a generic warning color if the same screen also uses it as the brand accent. Use a separate semantic danger token in the application UI.

## Typography

### Brand / headings
**Inter Display Bold**, weight 700.

Fallback:
`Inter, Arial, sans-serif`

### UI
Keep JoyFox's existing system stack where practical:
`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

The brand does not require replacing native UI typography.

## Wordmark

Write the name exactly as:

**JoyFox**

- capital J
- capital F
- no space
- "Joy" uses black on light surfaces or off-white on dark surfaces
- "Fox" uses JoyFox Red

Do not stylize the letters as animal ears or add a fox face.

## Clear space

For the standalone icon, keep clear space equal to at least **12.5% of the icon width** on all sides.

For the horizontal lockup, keep clear space equal to at least the height of the lowercase `o` around the full lockup.

## Minimum sizes

- Primary app icon: **16 px**
- Transparent two-color mark: **24 px preferred**
- Horizontal lockup: **120 px wide**
- Wordmark without icon: **90 px wide**

Below 24 px, use the dedicated raster exports rather than shrinking a large PNG.

## Small-size behavior

The mark is simplified by geometry rather than by adding/removing details. At toolbar size:
- preserve the white/black J silhouette
- preserve both red F bars
- keep the red lower tail
- do not add texture, shadow or fine outlines

A subtle keyline is included in the smallest universal tile PNGs so the black tile remains visible on dark browser chrome.

## Correct use

- Use the master proportions.
- Keep the red F connected to the lower red tail.
- Keep the mark upright.
- Use black/charcoal/white neutral surfaces.
- Use full-color primary icon for store and product identity.

## Incorrect use

Do not:
- recolor the F to orange or purple
- add gradients
- add a heart
- add a fox face, eyes or ears
- wrap the mark around a globe
- use the JOYclub pixel-heart
- place "for JOYclub" inside the icon
- stretch, rotate or skew the icon
- apply drop shadows inside browser toolbar icons
- place the red mark on a similar red background

## Product UI extension

Use the brand lightly inside JoyFox:
- options-page header
- JoyFox-owned section labels
- selected JoyFox filters
- small badges
- onboarding and empty states

JoyClub's page remains the primary visual environment. JoyFox should read as an independent enhancement layer, not a reskin of JoyClub.

## Files

See `README.md` for the package structure and `IMPLEMENTATION.md` for Firefox and Chrome setup.
