import type { ImageSourcePropType } from "react-native";

import { DEFAULT_MASCOT_IMAGE } from "@slay/core";

/** The web app's public origin, for artwork stored as paths under its `public/`. */
const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_ORIGIN?.replace(/\/$/, "");

/**
 * Turns an image reference from the database into something `<Image>` can
 * load. Storage artwork is a full URL. Some artwork — the seeded wardrobe
 * items, the default mascot — is a path into the web app's `public/` folder
 * (`/wardrobe/hat-red-cap.webp`), which only means something next to the web
 * app: those resolve against `EXPO_PUBLIC_WEB_ORIGIN`. The default snake is
 * bundled, so the map always has a mascot even before that is configured.
 *
 * Returns null for a path with nowhere to resolve it, so the caller can leave
 * the image out instead of rendering a broken one.
 */
export function imageSource(url: string | null | undefined): ImageSourcePropType | null {
  if (!url) return null;
  if (url === DEFAULT_MASCOT_IMAGE) return require("../../assets/mascot/slay-base.webp");
  if (/^https?:\/\//.test(url)) return { uri: url };
  if (url.startsWith("/") && WEB_ORIGIN) return { uri: `${WEB_ORIGIN}${url}` };
  return null;
}
