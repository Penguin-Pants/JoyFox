# JoyFox Browser Extension Branding Implementation

## Chrome

Chrome does not support SVG files for icons declared in the extension manifest. Use the PNG files in `icons/chrome/`.

Recommended manifest configuration:

```json
{
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_title": "JoyFox",
    "default_icon": {
      "16": "icons/action-16.png",
      "24": "icons/action-24.png",
      "32": "icons/action-32.png"
    }
  }
}
```

Chrome's extension UI uses a 16-DIP toolbar icon and can select higher-resolution images based on device scaling. The package includes 16, 24 and 32 px action assets and 16, 32, 48 and 128 px general extension assets.

### Chrome Web Store assets

Included:
- `chrome-web-store-icon-128.png`
- `small-promo-440x280.jpg`
- `marquee-1400x560.jpg`
- `screenshot-template-1280x800.jpg`

The 128 px store icon uses a 96 px visible icon with 16 px transparent padding on each side.

For screenshots, replace the placeholder area with **actual JoyFox UI**. Do not submit the template itself as evidence of product functionality.

## Firefox

Firefox supports raster icons and SVG. The package uses PNG for predictable cross-browser output while also providing SVG masters.

Recommended manifest configuration:

```json
{
  "icons": {
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "64": "icons/icon-64.png",
    "96": "icons/icon-96.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_title": "JoyFox",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png",
      "64": "icons/icon-64.png"
    },
    "theme_icons": [
      {
        "light": "icons/toolbar-light-on-dark-16.png",
        "dark": "icons/toolbar-dark-on-light-16.png",
        "size": 16
      },
      {
        "light": "icons/toolbar-light-on-dark-32.png",
        "dark": "icons/toolbar-dark-on-light-32.png",
        "size": 32
      }
    ]
  }
}
```

Important Firefox naming detail:
- `theme_icons.light` is used when the browser theme uses light text, normally a dark browser theme.
- `theme_icons.dark` is used when the browser theme uses dark text, normally a light browser theme.

### Firefox Add-ons assets

Included:
- `amo-icon-32.png`
- `amo-icon-64.png`
- `screenshot-template-1280x800.jpg`

Use actual JoyFox product screenshots for the AMO gallery. A 1280x800 capture is the recommended maximum display size and gives a 1.6:1 aspect ratio.

## Repository integration

Suggested repository layout:

```text
assets/
  brand/
    joyfox-icon-primary.svg
    joyfox-lockup-dark-bg.svg
    joyfox-lockup-light-bg.svg
  icons/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-64.png
    icon-96.png
    icon-128.png
```

For JoyFox's current Firefox Manifest V3 build, add the `icons` object and `action.default_icon` paths to the generated `manifest.json` or to the manifest source file used by the build.

## Accessibility and contrast

The logo is not a substitute for status text. Do not communicate qualification, trust, compatibility or danger through red alone.

For the extension UI, keep semantic success, warning and danger colors separate from the brand red.

## Store positioning

Use this independence sentence consistently in both stores:

> JoyFox is an independent browser extension for JoyClub users. It is not made, sponsored or supported by JOYclub or Mozilla.

Keep the statement visible in the detailed description. Do not place JOYclub's logo or pixel-heart inside JoyFox store artwork.
