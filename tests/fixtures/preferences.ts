/**
 * A "Vorlieben" checklist in the shape of 13-preferences.md: one list per
 * person, each with a hidden copy, one group per level, each tag a `j-tag`
 * whose label is in its shadow root. Labels are invented.
 */
export function checklist(
  people: Array<Record<string, string[]>>,
  document: Document = globalThis.document,
): HTMLElement {
  const root = document.createElement("div");
  for (const levels of people) {
    const card = document.createElement("div");
    card.className = "profile-sed-card";
    // The visible list and its hidden copy.
    for (let copy = 0; copy < 2; copy += 1) {
      const section = document.createElement("div");
      section.className = "profile-erotic-prefs";
      for (const [level, labels] of Object.entries(levels)) {
        const group = document.createElement("div");
        group.className = "profile-erotic-prefs__category";
        const title = document.createElement("h4");
        title.className = "profile-erotic-prefs__category-title";
        title.textContent = ` ${level} `;
        const list = document.createElement("div");
        list.className = "profile-erotic-prefs__category-item-list";
        for (const label of labels) {
          const tag = document.createElement("j-tag");
          if (label !== "") {
            const link = document.createElement("a");
            link.className = "j-tag";
            link.textContent = label;
            tag.attachShadow({ mode: "open" }).append(link);
          }
          list.append(tag);
        }
        group.append(title, list);
        section.append(group);
      }
      card.append(section);
    }
    root.append(card);
  }
  return root;
}
