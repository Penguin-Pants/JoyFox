import { isMessageKey, paramsOf } from "./message";
import { currentLocale, t } from "./translator";

/**
 * Fill static text from the catalog. `data-i18n="key"` sets an element's
 * text, and `data-i18n-attr="aria-label:key;placeholder:key"` sets
 * attributes. Only plain keys (no params) are allowed here. A key the
 * catalog does not know leaves the English text in the HTML, which is the
 * fallback before the script runs. Given the whole document, it also sets
 * `<html lang>`. Safe to run again on each language change.
 */
export function applyStaticText(root: Document | Element): void {
  const scope = "documentElement" in root ? root.documentElement : root;
  if ("documentElement" in root)
    root.documentElement.setAttribute("lang", currentLocale());
  const nodes = [
    ...(scope.matches("[data-i18n], [data-i18n-attr]") ? [scope] : []),
    ...Array.from(scope.querySelectorAll("[data-i18n], [data-i18n-attr]")),
  ];
  for (const node of nodes) {
    const key = node.getAttribute("data-i18n");
    if (key !== null) {
      const text = plainText(key);
      if (text !== undefined && node.textContent !== text)
        node.textContent = text;
    }
    for (const pair of (node.getAttribute("data-i18n-attr") ?? "").split(";")) {
      const [name, attrKey] = pair.split(":").map((part) => part.trim());
      if (!name || !attrKey) continue;
      const text = plainText(attrKey);
      if (text !== undefined) node.setAttribute(name, text);
    }
  }
}

function plainText(key: string): string | undefined {
  if (!isMessageKey(key) || paramsOf(key) !== null) {
    console.warn(`JoyFox: no plain catalog text for "${key}"`);
    return undefined;
  }
  return t({ key } as Parameters<typeof t>[0]);
}
