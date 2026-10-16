import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';
import { addRoundEvents, roundEvents } from '../utils/_module.mjs';

const { DialogV2 } = foundry.applications.api;

/** Offers the GM a hidden lair turn for creatures with lair actions. */
export class LairActions {
  /** @type {Map<Combat, Map<string, Combatant>>} First combatant of each lair creature added by this GM and waiting for the prompt, keyed by actor id, per combat. */
  static #pending = new Map();

  /** Watch combatants this GM adds while the prompt is on. */
  static register() {
    const prompt = foundry.utils.debounce(LairActions.#prompt, 100);
    Hooks.on('createCombatant', (combatant, _options, userId) => {
      if (userId !== game.user.id || !game.user.isGM || combatant.getFlag(MODULE.ID, MODULE.FLAGS.EVENT)) return;
      if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.LAIR_PROMPT) || !game.settings.get(MODULE.ID, MODULE.SETTINGS.ROUND_EVENTS_ENABLED)) return;
      if (getAdapter().lairInitiative(combatant.actor) == null) return;
      if (!LairActions.#pending.has(combatant.parent)) LairActions.#pending.set(combatant.parent, new Map());
      const queued = LairActions.#pending.get(combatant.parent);
      if (!queued.has(combatant.actor.id)) queued.set(combatant.actor.id, combatant);
      prompt();
    });
  }

  /** Ask once per combat about every queued creature without a lair turn yet, and add the turns on yes. */
  static async #prompt() {
    const queued = [...LairActions.#pending];
    LairActions.#pending.clear();
    for (const [combat, byActor] of queued) {
      const covered = new Set(
        roundEvents(combat)
          .map((event) => event.lair)
          .filter(Boolean)
      );
      const combatants = [...byActor.values()].filter((combatant) => !covered.has(combatant.actor.id));
      if (!combatants.length) continue;
      const names = combatants.map((combatant) => foundry.utils.escapeHTML(combatant.actor.name)).join(', ');
      const add = await DialogV2.confirm({
        window: { title: 'ROLLCALL.Lair.Title', icon: 'fa-solid fa-dungeon' },
        classes: ['roll-call'],
        content: `<p>${_loc('ROLLCALL.Lair.Prompt', { names })}</p>`,
        rejectClose: false
      });
      if (!add) continue;
      await addRoundEvents(
        combat,
        combatants.map(({ actor }) => ({ label: _loc('ROLLCALL.Lair.Name', { name: actor.name }), mode: 'turn', initiative: getAdapter().lairInitiative(actor), img: actor.img, lair: actor.id }))
      );
    }
  }
}
