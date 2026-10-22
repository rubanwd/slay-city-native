import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Longest edge a screenshot is uploaded at — plenty to read a bug from, a fraction of a phone photo's size. */
export const MAX_SCREENSHOT_EDGE = 1600;

/** JPEG quality the screenshot is re-encoded at. */
export const SCREENSHOT_QUALITY = 0.7;

export interface PreparedScreenshot {
  body: ArrayBuffer;
  contentType: "image/jpeg";
  ext: "jpg";
}

/**
 * Shrinks and re-encodes a picked image before upload (WP-4.6 AC3). A phone
 * photo is often 4 000+ px and several megabytes; the web uploads whatever the
 * browser hands it, but on mobile data that is the difference between a report
 * that sends and one that times out. Every screenshot becomes a JPEG no larger
 * than {@link MAX_SCREENSHOT_EDGE} on its long side, which also normalises
 * HEIC from an iPhone's camera roll into something every browser in the admin
 * inbox can show.
 */
export async function prepareScreenshot(asset: { uri: string; width: number; height: number }): Promise<PreparedScreenshot> {
  const context = ImageManipulator.manipulate(asset.uri);
  // Width and height can be 0 when the system did not report them; then leave the size alone.
  if (Math.max(asset.width, asset.height) > MAX_SCREENSHOT_EDGE) {
    context.resize(asset.width >= asset.height ? { width: MAX_SCREENSHOT_EDGE } : { height: MAX_SCREENSHOT_EDGE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: SCREENSHOT_QUALITY, format: SaveFormat.JPEG });
  const body = await (await fetch(saved.uri)).arrayBuffer();
  return { body, contentType: "image/jpeg", ext: "jpg" };
}
