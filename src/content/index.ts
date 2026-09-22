import { detectPage } from "./page-detector";
import { NavigationCoordinator } from "./navigation-coordinator";

const coordinator = new NavigationCoordinator(detectPage);
coordinator.subscribe(() => {
  /* Features remain disabled until selectors are verified. */
});
coordinator.start();
