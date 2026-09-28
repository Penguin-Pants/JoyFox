/**
 * Stand-in host pages for store screenshots. Each has the structure JoyFox's
 * verified selectors read (`src/selectors/registry.ts`, as the synthetic
 * fixtures in `tests/fixtures/joyclub/` do), with invented members and text.
 * `standin.css` draws them as a plain page: no JoyClub logo, heart or other
 * JoyClub asset.
 */
const siteBar = `<div class="site-top"><i style="width:90px"></i><i style="width:60px"></i><i style="width:60px"></i><i style="width:60px;margin-left:auto"></i></div>`;

/** Member ID, nickname, shield code (null: none), time, preview, avatar color. */
const INBOX = [
  [
    "2000001",
    "Maple_and_Pine",
    1,
    "14:32",
    "Hi! I saw you are going to the garden social too. Shall we meet at the entrance?",
    "#c9d3e0",
  ],
  ["2000002", "RiverWalker", 0, "13:05", "hey", "#d8cfc4"],
  [
    "2000003",
    "Sunny_Afternoon",
    1,
    "11:47",
    "Thanks for the tip about the tango workshop, it sounds lovely.",
    "#d3dccb",
  ],
  [
    "2000004",
    "Paper_Lantern",
    null,
    "09:20",
    "Hello! Your profile made me smile. Do you like jazz evenings?",
    "#e0d0d8",
  ],
  [
    "2000005",
    "QuietHarbor",
    1,
    "Yesterday",
    "Good morning! Are you still looking for a dance partner for Saturday?",
    "#cfd8dc",
  ],
  [
    "2000006",
    "NorthStar_Demo",
    0,
    "Yesterday",
    "click my link for free pics",
    "#d6d6d6",
  ],
];

const inboxRow = ([id, name, code, time, text, color]) => `
<j-list-item class="cm-conversation-list cm-conversation-list-item">
  <j-avatar-image slot="image" class="cm-conversation-list-item__avatar" style="--av:${color}" href="https://www.joyclub.de/profile/${id}.${name.toLowerCase()}.html"></j-avatar-image>
  <div class="cm-conversation-list-item__line">
    <div data-e2e="conversation-list-item-name" class="cm-conversation-list-item__name">${name}</div>
    ${code === null ? "" : `<j-veri-icon verification-status="${code}"></j-veri-icon>`}
    <div class="cm-conversation-list-item__meta">${time}</div>
  </div>
  <div slot="description" class="cm-conversation-list-item__line cm-conversation-list-item__line--description">
    <div class="cm-conversation-list-item__text">${text}</div>
  </div>
</j-list-item>`;

export const inbox = {
  url: "https://www.joyclub.de/clubmail/",
  body: `${siteBar}<div class="site-page"><h2>Messages</h2>
<div class="cm-conversation-list" aria-label="Conversations">${INBOX.map(inboxRow).join("")}</div></div>`,
};

/** The profile's "Vorlieben" levels (site vocabulary) and invented tags. */
const PREFERENCES = {
  "Steh ich drauf": ["Dancing", "Jazz", "Travel"],
  Situationsabhängig: ["Gardening", "Hiking"],
  "Mag ich nicht so": ["Karaoke"],
};

// JoyClub draws each tag's label in a shadow root, and lists a hidden copy.
const preferenceScript = `(() => {
  const card = document.createElement("div");
  card.className = "profile-sed-card";
  for (let copy = 0; copy < 2; copy += 1) {
    const section = document.createElement("div");
    section.className = "profile-erotic-prefs";
    for (const [level, labels] of Object.entries(${JSON.stringify(PREFERENCES)})) {
      const group = document.createElement("div");
      group.className = "profile-erotic-prefs__category";
      const title = document.createElement("h4");
      title.className = "profile-erotic-prefs__category-title";
      title.textContent = " " + level + " ";
      const list = document.createElement("div");
      list.className = "profile-erotic-prefs__category-item-list";
      for (const label of labels) {
        const tag = document.createElement("j-tag");
        const link = document.createElement("a");
        link.className = "j-tag";
        link.textContent = label;
        tag.attachShadow({ mode: "open" }).append(link);
        list.append(tag);
      }
      group.append(title, list);
      section.append(group);
    }
    card.append(section);
  }
  document.getElementById("prefs").append(card);
})();`;

export const profile = {
  url: "https://www.joyclub.de/profile/2000001.maple_and_pine.html",
  body: `${siteBar}<div class="site-page" style="max-width:900px"><div class="profile-card"><div>
<div class="profile-head"><div class="pic"></div><div><h1>Maple_and_Pine</h1>
<div data-e2e="profile-header-base-info"><j-veri-icon verification-status="1"></j-veri-icon><div class="profile-base-info__line-2"><span>Woman</span><span>34</span><span>Example Town</span></div></div></div></div>
<div class="profile-main-album-slider"><span class="amount-badge" aria-label="8 Fotos"></span><div class="profile-album-card"></div><div class="profile-album-card"></div><div class="profile-album-card"></div><div class="profile-album-card"></div></div>
<p class="profile-description-maintext__text">Weekend gardener, weekday coffee enthusiast. I love live music, long walks by the river and trying new recipes with friends. In summer you find me at open-air concerts or dancing at garden parties; in winter I am learning tango. I value honesty, good humour and people who ask questions. Write to me if you would like to share a coffee and a story or two.</p>
<div id="prefs"></div></div>
<div class="profile-sidebar-container__badge-list"><j-list-item><div slot="image" class="profile-badge__icon"></div>Verifiziertes Mitglied</j-list-item><j-list-item><div slot="image" class="profile-badge__icon"></div>Angemeldet seit 2 Jahren</j-list-item></div>
</div></div><script>${preferenceScript}</script>`,
};
