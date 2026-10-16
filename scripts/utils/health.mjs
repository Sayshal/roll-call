import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';
import { onSettingChange } from './setting-menu.mjs';

/**
 * Health as a whole percent.
 * @param {number} fraction Health fraction.
 * @returns {number} Percent.
 */
export function healthPercent(fraction) {
  if (fraction >= 1) return 100;
  if (fraction <= 0) return 0;
  return Math.clamp(Math.round(fraction * 100), 1, 99);
}

/** @type {object[]|null} Labelled buckets sorted by threshold, rebuilt after the setting changes. */
let buckets = null;
onSettingChange([MODULE.SETTINGS.HEALTH_BUCKETS], () => (buckets = null));

/**
 * Health bucket for an actor.
 * @param {Actor} actor The combatant's actor.
 * @returns {{label: string, threshold: number, color: string|null}|null} Bucket, or null when Health Estimate is off, the actor has no health, or no buckets exist.
 */
export function healthEstimate(actor) {
  if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.HEALTH_ESTIMATE_ENABLED)) return null;
  const adapter = getAdapter();
  const fraction = adapter.healthFraction(actor);
  if (fraction == null) return null;
  buckets ??= game.settings
    .get(MODULE.ID, MODULE.SETTINGS.HEALTH_BUCKETS)
    .buckets.filter((bucket) => bucket.label)
    .map((bucket) => ({
      label: _loc(bucket.label),
      threshold: bucket.threshold,
      color: bucket.color ? foundry.utils.Color.from(bucket.color).css : null
    }))
    .sort((a, b) => a.threshold - b.threshold);
  const percent = healthPercent(fraction);
  return buckets.find((bucket) => percent <= bucket.threshold) ?? buckets.at(-1) ?? null;
}
