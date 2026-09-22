export type PageType =
  | "inbox"
  | "conversation"
  | "profile"
  | "search"
  | "event"
  | "event-calendar"
  | "unknown";
export type SelectorStatus = "unverified" | "verified";

export interface PageSelectorDefinition {
  status: SelectorStatus;
  root?: string;
  fields: Readonly<Record<string, string>>;
}

const unverified = (): PageSelectorDefinition => ({
  status: "unverified",
  fields: {},
});

export const selectorRegistry: Readonly<
  Record<Exclude<PageType, "unknown">, PageSelectorDefinition>
> = {
  inbox: unverified(),
  conversation: unverified(),
  profile: unverified(),
  search: unverified(),
  event: unverified(),
  "event-calendar": unverified(),
};

export function verifiedSelector(
  page: Exclude<PageType, "unknown">,
  field: string,
): string | undefined {
  const definition = selectorRegistry[page];
  return definition.status === "verified"
    ? definition.fields[field]
    : undefined;
}

export function hasVerifiedSelectors(): boolean {
  return Object.values(selectorRegistry).some(
    (definition) => definition.status === "verified",
  );
}
