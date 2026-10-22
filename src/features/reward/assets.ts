/**
 * The reward screen's bundled media, in one place so tests can stand them in
 * — vitest can't load an image or a sound file.
 */

/** Upstream's `public/wardrobe/slay-hero.webp`, the celebrating mascot. */
export const HERO_IMAGE = require("../../../assets/mascot/slay-hero.webp");

/** Upstream's synthesised applause, rendered by `scripts/render-sfx.mjs`. */
export const APPLAUSE_SOUND = require("../../../assets/sounds/reward-applause.m4a");
