import { MODULE } from '../constants.mjs';

/** @type {Promise} Settles when the last queued announcement is removed. */
let queue = Promise.resolve();

/**
 * Show a turn banner and/or edge glow over the play surface.
 * @param {object} options Announcement options.
 * @param {string} options.variant `turn`, `ondeck`, `nudge` or `event`.
 * @param {string} options.title Banner title.
 * @param {string} [options.subtitle] Line under the title.
 * @param {string} [options.img] Portrait shown beside the text.
 * @param {string} [options.tag] Highlighted tag beside the text.
 * @param {boolean} [options.banner] Show the banner.
 * @param {boolean} [options.glow] Show the edge glow.
 * @param {boolean} [options.wait] Queue behind the announcements showing or waiting instead of replacing them.
 * @returns {Promise<void>} Resolves when the overlay is removed.
 */
export function announce({ variant, title, subtitle, img, tag, banner = true, glow = true, wait = false }) {
  if (!banner && !glow) return Promise.resolve();
  const show = () => showOverlay({ variant, title, subtitle, img, tag, banner, glow });
  queue = wait ? queue.then(show, show) : show();
  return queue;
}

/**
 * Render an announcement overlay in place of any showing now.
 * @param {object} context Template context.
 * @returns {Promise<void>} Resolves when the overlay is removed.
 */
async function showOverlay(context) {
  const view = game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_VIEW);
  const html = await foundry.applications.handlebars.renderTemplate(MODULE.TEMPLATES.ANNOUNCE, { ...context, view });
  const overlay = foundry.utils.parseHTML(html);
  document.querySelector('.rc-announce')?.remove();
  document.body.append(overlay);
  await Promise.allSettled(overlay.getAnimations({ subtree: true }).map((animation) => animation.finished));
  overlay.remove();
}
