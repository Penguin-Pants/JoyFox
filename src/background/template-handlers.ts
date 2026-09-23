import type { MessageRouter } from "../messaging/router";
import { folderOf, type TemplateService } from "../templates/template-service";

export interface TemplateHandlerDeps {
  templates: TemplateService;
  /** The active account's ID, or `undefined` when none is selected. */
  activeAccountId: () => Promise<string | undefined>;
}

/**
 * Register the template read for the composer picker. It is read-only: a
 * content script can list the active account's templates but never write
 * one. Templates are created and edited on the options page only.
 */
export function registerTemplateHandlers(
  router: MessageRouter,
  deps: TemplateHandlerDeps,
): void {
  router.register("template.list", async () => {
    const accountId = await deps.activeAccountId();
    if (!accountId) return { templates: [] };
    const templates = await deps.templates.list(accountId);
    return {
      accountId,
      templates: templates.map((template) => ({
        id: template.id,
        name: template.name,
        folder: folderOf(template),
        body: template.body,
      })),
    };
  });
}
