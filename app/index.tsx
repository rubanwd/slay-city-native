import { RoleSwitcher } from "~/features/dev";

/**
 * Temporary dev route-switcher (WP-1.5). Real role-based redirects arrive
 * with the auth milestone (WP-2.6); until then this is how `/` is reached
 * and how a role's route tree is entered on a device.
 */
export default function Index() {
  return <RoleSwitcher />;
}
