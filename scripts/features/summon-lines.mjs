import { getAdapter } from '../adapters/registry.mjs';
import { MODULE } from '../constants.mjs';

/** Lines on the canvas from each combatant's token to the tokens of the creatures it summoned, during a started combat. */
export class SummonLines {
  /** @type {PIXI.Graphics|null} Lines drawn on the interface layer. */
  static #lines = null;

  /** @type {boolean} Whether a redraw is already queued for the next frame. */
  static #queued = false;

  /** @type {Set<string>} Ids of the summoner and summon tokens found by the last draw; only their refreshes trigger a redraw. */
  static #linked = new Set();

  /** Redraw on combat changes, token creation and deletion, and refreshes of linked tokens, when the mode is not "never". */
  static register() {
    if (game.settings.get(MODULE.ID, MODULE.SETTINGS.SUMMON_LINES) === 'never') return;
    const queue = () => SummonLines.#queue();
    for (const hook of ['canvasReady', 'createCombat', 'updateCombat', 'deleteCombat', 'createCombatant', 'deleteCombatant', 'updateCombatant', 'createToken', 'deleteToken', 'hoverToken'])
      Hooks.on(hook, queue);
    Hooks.on('refreshToken', (token, flags) => SummonLines.#linked.has(token.id) && (flags.refreshPosition || flags.refreshVisibility || flags.refreshState) && queue());
  }

  /** Redraw once on the next animation frame, however many changes arrive before it. */
  static #queue() {
    if (SummonLines.#queued) return;
    SummonLines.#queued = true;
    requestAnimationFrame(() => {
      SummonLines.#queued = false;
      SummonLines.#draw();
    });
  }

  /**
   * Pairs of visible summoner and summon tokens in the active combat. Players get no line touching a hidden combatant. Records every summoner and summon token found, visible or not, as linked.
   * @param {string} mode `hover` or `always`.
   * @returns {Token[][]} Summoner and summon token pairs.
   */
  static #pairs(mode) {
    const combat = game.combat;
    SummonLines.#linked.clear();
    if (!combat?.started) return [];
    const pairs = [];
    for (const combatant of combat.combatants) {
      const summoner = combatant.token?.object;
      if (!summoner) continue;
      for (const actor of getAdapter().summons(combatant.actor)) {
        for (const summon of actor.getActiveTokens()) {
          SummonLines.#linked.add(summoner.id).add(summon.id);
          if (!summoner.visible || !combatant.visible || !summon.visible || summon.combatant?.visible === false || (mode === 'hover' && !summoner.hover && !summon.hover)) continue;
          pairs.push([summoner, summon]);
        }
      }
    }
    return pairs;
  }

  /** Clear and redraw every line. */
  static #draw() {
    if (!canvas.ready) return;
    const mode = game.settings.get(MODULE.ID, MODULE.SETTINGS.SUMMON_LINES);
    if (!SummonLines.#lines || SummonLines.#lines.destroyed) SummonLines.#lines = canvas.interface.addChild(new PIXI.Graphics());
    const lines = SummonLines.#lines.clear();
    if (mode === 'never') return;
    const width = Math.max(2, canvas.dimensions.size / 40);
    for (const [summoner, summon] of SummonLines.#pairs(mode)) {
      const color = summoner.getDispositionColor();
      lines
        .lineStyle({ width: width * 3, color, alpha: 0.2 })
        .moveTo(summoner.center.x, summoner.center.y)
        .lineTo(summon.center.x, summon.center.y);
      lines.lineStyle({ width, color, alpha: 0.9 }).moveTo(summoner.center.x, summoner.center.y).lineTo(summon.center.x, summon.center.y);
      lines
        .beginFill(color, 0.9)
        .drawCircle(summon.center.x, summon.center.y, width * 2)
        .endFill();
    }
  }
}
