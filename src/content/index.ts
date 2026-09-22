import { detectPage } from "./page-detector";
import { NavigationCoordinator } from "./navigation-coordinator";
import { hasVerifiedSelectors } from "../selectors/registry";

if (hasVerifiedSelectors()) {
  const coordinator = new NavigationCoordinator(detectPage);
  coordinator.subscribe(() => {
    /* Features subscribe here only after their selectors are verified. */
  });
  coordinator.start();
}
