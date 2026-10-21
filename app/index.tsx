/**
 * `/` has no screen of its own: the route guard (src/features/auth/RouteGuard)
 * sends a signed-out visitor to login and everyone else to `roleHome()`.
 */
export default function Index() {
  return null;
}
