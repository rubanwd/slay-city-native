/**
 * Where crashes go (WP-6.7). Every error a route boundary catches, and every
 * uncaught JavaScript error, passes through `reportError`. In development it
 * is logged; in a release build it reaches whatever crash service
 * `setErrorReporter` installed — none yet: choosing one (Sentry, Bugsnag,
 * Crashlytics) adds a native SDK and a DSN, which is the owner's call. Until
 * then a release build reports nowhere, and the screens still recover.
 */
export type ErrorReporter = (error: Error, context: ErrorContext) => void;

export interface ErrorContext {
  /** Where it happened: a route group, or "global" for an uncaught error. */
  where: string;
  /** Whether the app could carry on (an uncaught error may be fatal). */
  fatal?: boolean;
}

let reporter: ErrorReporter | null = null;

/** Plugs in a crash service. Call once at start-up, before the first screen. */
export function setErrorReporter(next: ErrorReporter | null): void {
  reporter = next;
}

/** Sends an error on. Never throws: reporting a crash must not cause another. */
export function reportError(error: unknown, context: ErrorContext): void {
  const err = error instanceof Error ? error : new Error(String(error));
  if (__DEV__) console.error(`[${context.where}]`, err);
  try {
    reporter?.(err, context);
  } catch {
    // A broken reporter is not the student's problem.
  }
}

let installed = false;

/**
 * Routes uncaught JavaScript errors through `reportError` before React
 * Native's own handler (the red box in development, the crash in release)
 * runs as it would have. Installs once.
 */
export function installGlobalErrorHandler(): void {
  if (installed || typeof ErrorUtils === "undefined") return;
  installed = true;
  const previous = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    reportError(error, { where: "global", fatal: isFatal });
    previous(error, isFatal);
  });
}
