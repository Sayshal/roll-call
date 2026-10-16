import { MODULE } from '../constants.mjs';

/**
 * Elapsed combat and turn time from the combat's clock flag, frozen while the game is paused.
 * @param {Combat} combat The combat.
 * @returns {{total: number, turn: number}|null} Milliseconds, or null before the primary GM stamped the clock.
 */
export function combatClock(combat) {
  const clock = combat.getFlag(MODULE.ID, MODULE.FLAGS.CLOCK);
  if (!clock) return null;
  const now = clock.pausedAt ?? game.time.serverTime;
  return { total: now - clock.startedAt, turn: now - clock.turnStartedAt };
}

/**
 * Format milliseconds as `m:ss`, or `h:mm:ss` from one hour, with a leading minus when negative.
 * @param {number} ms Milliseconds.
 * @returns {string} Clock text.
 */
export function formatClock(ms) {
  const seconds = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = (seconds % 60).paddedString(2);
  const text = h ? `${h}:${m.paddedString(2)}:${s}` : `${m}:${s}`;
  return ms < 0 && seconds ? `-${text}` : text;
}

/**
 * Stamp combat and turn start times on turn changes and shift them across pauses, on the primary GM only.
 * Times use the server clock so every client computes the same elapsed time.
 */
export function registerCombatClock() {
  Hooks.on('combatTurnChange', onTurnChange);
  Hooks.on('pauseGame', onPause);
}

/**
 * Start the turn clock, and the combat clock on the first turn.
 * @param {Combat} combat The combat whose turn changed.
 */
function onTurnChange(combat) {
  if (!ATLAS.isPrimaryGM) return;
  const clock = combat.getFlag(MODULE.ID, MODULE.FLAGS.CLOCK) ?? {};
  const now = game.time.serverTime;
  const pausedAt = clock.pausedAt ?? (game.paused ? now : null);
  combat.setFlag(MODULE.ID, MODULE.FLAGS.CLOCK, { startedAt: clock.startedAt ?? now, turnStartedAt: pausedAt ?? now, pausedAt, turnKey: `${combat.round}.${combat.turn}` });
}

/**
 * Freeze every started combat's clock on pause; on unpause, shift its start times by the paused duration.
 * @param {boolean} paused Whether the game is now paused.
 */
function onPause(paused) {
  if (!ATLAS.isPrimaryGM) return;
  const now = game.time.serverTime;
  for (const combat of game.combats) {
    const clock = combat.getFlag(MODULE.ID, MODULE.FLAGS.CLOCK);
    if (!combat.started || !clock) continue;
    if (paused && clock.pausedAt == null) combat.setFlag(MODULE.ID, MODULE.FLAGS.CLOCK, { ...clock, pausedAt: now });
    if (!paused && clock.pausedAt != null) {
      const shift = now - clock.pausedAt;
      combat.setFlag(MODULE.ID, MODULE.FLAGS.CLOCK, { startedAt: clock.startedAt + shift, turnStartedAt: clock.turnStartedAt + shift, pausedAt: null });
    }
  }
}
