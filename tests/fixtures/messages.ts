/**
 * A ClubMail conversation in the shapes of 12-messages.md: a header link to
 * the other member, and one list item per message with JoyClub's message ID,
 * a sent or received bubble, its text and a time in the bubble's shadow
 * root. Every value is invented.
 */
export interface FixtureMessage {
  id: string;
  direction: "sent" | "received";
  /** Text as HTML inside the bubble content, such as `a<br>b`. */
  html: string;
  sentAt?: string;
  quote?: string;
}

export const messageId = (n: number) =>
  `cm-message-00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export function conversationPage(
  document: Document,
  memberId: string,
  messages: FixtureMessage[],
): void {
  const header = document.createElement("a");
  header.className = "cm-conversation-header";
  header.href = `/profile/${memberId}.synthetic.html`;
  header.textContent = "NAME";
  const list = document.createElement("ul");
  // A date separator carries a message ID but no bubble.
  const separator = document.createElement("li");
  separator.className = "cm-message-list-item cm-message-list__item";
  separator.setAttribute("data-message-id", messageId(999));
  separator.innerHTML =
    '<time class="cm-message-list-item__date" datetime="2026-09-26">Samstag</time>';
  list.append(separator);
  for (const message of messages) {
    const item = document.createElement("li");
    item.className = "cm-message-list-item cm-message-list__item";
    item.setAttribute("data-message-id", message.id);
    const bubble = document.createElement("div");
    bubble.className = `cm-message-bubble cm-message-bubble--${message.direction === "sent" ? "right" : "left"}`;
    bubble.setAttribute("data-e2e", `${message.direction}-message`);
    const component = document.createElement("j-message-bubble");
    if (message.quote) {
      const quote = document.createElement("j-message-bubble-quote");
      quote.className = "cm-message-bubble__quote";
      quote.setAttribute("slot", "quote");
      quote.textContent = message.quote;
      component.append(quote);
    }
    const content = document.createElement("div");
    content.className = "cm-message-bubble__content";
    content.innerHTML = message.html;
    component.append(content);
    if (message.sentAt) {
      const footer = document.createElement("div");
      footer.className = "footer";
      const time = document.createElement("time");
      time.setAttribute("datetime", message.sentAt);
      time.textContent = "00:00";
      footer.append(time);
      component.attachShadow({ mode: "open" }).append(footer);
    }
    bubble.append(component);
    item.append(bubble);
    list.append(item);
  }
  document.body.replaceChildren(header, list);
}
