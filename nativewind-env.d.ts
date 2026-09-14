/// <reference types="nativewind/types" />

/**
 * The Tailwind entry is imported for its side effect only; Metro hands it to
 * NativeWind rather than to TypeScript, which otherwise has no declaration for it.
 */
declare module "*.css" {}
