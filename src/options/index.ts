import { mountAccountPanel } from "./account-panel";

const root = document.querySelector<HTMLElement>("#joyfox-accounts");
if (root)
  void mountAccountPanel(root).catch(() => {
    root.textContent =
      "JoyFox could not read its stored accounts. No account was changed.";
  });
