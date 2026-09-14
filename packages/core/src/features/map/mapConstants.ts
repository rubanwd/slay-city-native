/**
 * Aspect ratio (width / height) of the map frame on `/map`, which district
 * backgrounds are cropped and generated to. Single source of truth so the map,
 * the cropper, the position picker and the AI prompt stay in sync — change it
 * here if the map proportions change.
 *
 * 5:7 rather than the original 3:4: phone screens are taller than 3:4, so that
 * frame left a band of empty space above and below the map. 5:7 is exactly 5%
 * taller for the same width (0.75 / 1.05 = 5/7), which closes most of the gap.
 */
export const MAP_ASPECT_W = 5;
export const MAP_ASPECT_H = 7;

export const MAP_ASPECT = MAP_ASPECT_W / MAP_ASPECT_H;
