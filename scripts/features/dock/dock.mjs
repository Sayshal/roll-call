import { getAdapter } from '../../adapters/registry.mjs';
import { MODULE } from '../../constants.mjs';
import {
  activateCombatant,
  canNudge,
  canSee,
  combatantContextOptions,
  combatantFor,
  combatClock,
  displayName,
  eventWhen,
  formatClock,
  healthEstimate,
  healthPercent,
  nudge,
  onSettingChange,
  sideCounts,
  panToCombatant,
  pingCombatant,
  promptRoundEvent,
  reachedCount,
  removeRoundEvent,
  toggleDefeated,
  upcomingEvents,
  toggleHidden,
  viewedCombat
} from '../../utils/_module.mjs';
import { applyPlacement, dragDock, isCrowded } from './placement.mjs';
import { bladeView } from './views/blade.mjs';
import { VsScreen } from '../vs-screen.mjs';
import { codexView } from './views/codex.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Frameless combat dock with one render part per card plus a strip part. */
export class RollCallDock extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {Object<string, object>} Dock views by id. */
  static #VIEWS = { blade: bladeView, codex: codexView };

  /**
   * This client's chosen view.
   * @returns {object} View definition.
   */
  get #view() {
    return RollCallDock.#VIEWS[game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_VIEW)] ?? bladeView;
  }

  /** @type {Promise|null} Loading of the partials the card and strip templates use; renders wait for it. */
  static #partials = null;

  /** @type {number|null} Interval id of the one-second clock tick. */
  #ticker = null;

  /** @type {Map<string, DOMRect>} Card part positions captured before a render, keyed by part id. */
  #positions = new Map();

  /** @type {Map<string, Combatant[]>} Cards of the current render: each card's combatants in turn order, keyed by the first one's id. */
  #stacks = new Map();

  /** @type {Map<Combatant, number>} Each combatant's position in the dock order of the current render. */
  #indexes = new Map();

  /** @type {Set<string>} Token ids targeted for the active combatant in the current render. */
  #targets = new Set();

  /** @type {Map<string, string|null>} Group names worked out in the current render, keyed by group key. */
  #groupLabels = new Map();

  /** @type {Set<string>} Card parts waiting for the next batched render. */
  #pendingCards = new Set();

  /** @type {Map<string, {face: string, body: HTMLElement}>} Each re-rendered card's shown combatant and a copy of its face from before the render, keyed by part id, so a card flips when its face changes. */
  #faces = new Map();

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: `${MODULE.ID}-dock`,
    classes: ['roll-call', 'rc-dock'],
    window: { frame: false, positioned: false },
    actions: {
      activate: RollCallDock.#onActivate,
      addEvent: RollCallDock.#onAddEvent,
      endCombat: RollCallDock.#onCombatControl,
      endTurn: RollCallDock.#onEndTurn,
      nextRound: RollCallDock.#onCombatControl,
      nextTurn: RollCallDock.#onCombatControl,
      nudge: RollCallDock.#onNudge,
      pan: RollCallDock.#onPan,
      ping: RollCallDock.#onPing,
      previousRound: RollCallDock.#onCombatControl,
      previousTurn: RollCallDock.#onCombatControl,
      removeEvent: RollCallDock.#onRemoveEvent,
      rollAll: RollCallDock.#onCombatControl,
      rollInitiative: RollCallDock.#onRollInitiative,
      rollNPC: RollCallDock.#onCombatControl,
      settings: RollCallDock.#onSettings,
      showVs: RollCallDock.#onShowVs,
      spendLegendary: RollCallDock.#onSpendLegendary,
      startCombat: RollCallDock.#onCombatControl
    }
  };

  /** @type {object[]} GM turn and round navigation buttons. */
  static #NAV = [
    { action: 'previousRound', icon: 'fa-angles-left', label: 'COMBAT.RoundPrev' },
    { action: 'previousTurn', icon: 'fa-angle-left', label: 'COMBAT.TurnPrev' },
    { action: 'nextTurn', icon: 'fa-angle-right', label: 'COMBAT.TurnNext', cta: true },
    { action: 'nextRound', icon: 'fa-angles-right', label: 'COMBAT.RoundNext' }
  ];

  /** @type {object[]} GM initiative roll buttons. */
  static #ROLLS = [
    { action: 'rollAll', icon: 'fa-users', label: 'COMBAT.RollAll' },
    { action: 'rollNPC', icon: 'fa-users-gear', label: 'COMBAT.RollNPC' }
  ];

  /** @type {object} GM start combat button. */
  static #START = { action: 'startCombat', icon: 'fa-play', label: 'COMBAT.Begin', cta: true };

  /** @type {object} GM end combat button. */
  static #END = { action: 'endCombat', icon: 'fa-stop', label: 'COMBAT.End', danger: true };

  /** @type {object} GM add round event button. */
  static #ADD_EVENT = { action: 'addEvent', icon: 'fa-hourglass-half', label: 'ROLLCALL.RoundEvents.Add' };

  /** @type {number} Most mini portraits a stacked card shows, counting the `+N` mini for the rest. */
  static #MAX_MINIS = 5;

  /** @type {object} GM button replaying the VS screen for everyone. */
  static #SHOW_VS = { action: 'showVs', icon: 'fa-swords', label: 'ROLLCALL.Vs.Show' };

  /** @type {object} GM settings shortcut button. */
  static #SETTINGS = { action: 'settings', icon: 'fa-gear', label: 'ATLAS.Common.Settings' };

  /** @type {string[]} Combat changes that can move, add or remove cards; any other change re-renders only the strip. */
  static #LAYOUT_KEYS = ['round', 'turn', 'combatants', 'active', 'scene'];

  /** @type {string[]} Token changes a card shows; movement and the like skip the render. */
  static #TOKEN_KEYS = ['name', 'texture', 'disposition', 'hidden', 'delta', 'actorId', 'actorLink'];

  /** @type {string[]} Settings whose change only moves or scales the dock. */
  static #PLACEMENT_KEYS = [MODULE.SETTINGS.DOCK_PLACEMENT, MODULE.SETTINGS.DOCK_SCALE];

  /** @type {string[]} Settings whose change re-evaluates the dock. */
  static #SETTING_KEYS = [
    MODULE.SETTINGS.CARD_ELEMENTS,
    MODULE.SETTINGS.DOCK_ENABLED,
    MODULE.SETTINGS.DOCK_FORCED_EDGE,
    MODULE.SETTINGS.DOCK_HIDDEN,
    MODULE.SETTINGS.DOCK_LOCKED,
    MODULE.SETTINGS.DOCK_MINIMAL,
    MODULE.SETTINGS.DOCK_STACKS,
    MODULE.SETTINGS.DOCK_TUCK,
    MODULE.SETTINGS.DOCK_VIEW,
    MODULE.SETTINGS.HEALTH_BUCKETS,
    MODULE.SETTINGS.INITIATIVE_REVERSE,
    MODULE.SETTINGS.NAME_MASK,
    MODULE.SETTINGS.PRIVACY_RULES,
    MODULE.SETTINGS.TARGET_ICONS,
    MODULE.SETTINGS.TURN_DURATION,
    'core.combatTrackerConfig'
  ];

  /**
   * Create the dock and hook it into combat lifecycle events.
   */
  static register() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_ENABLED)) return;
    this.#partials = foundry.applications.handlebars.loadTemplates({
      rcEvent: MODULE.TEMPLATES.DOCK.EVENT,
      rcLegendary: MODULE.TEMPLATES.DOCK.LEGENDARY,
      rcSeg: MODULE.TEMPLATES.DOCK.SEG,
      rcStack: MODULE.TEMPLATES.DOCK.STACK
    });
    const dock = new this();
    const refresh = foundry.utils.debounce(() => dock.refresh(), 20);
    for (const hook of ['ready', 'canvasReady', 'createCombat', 'deleteCombat', 'createCombatant', 'deleteCombatant', 'updateCombatantGroup']) Hooks.on(hook, refresh);
    Hooks.on('updateCombat', dock.#onUpdateCombat.bind(dock));
    Hooks.on('updateCombatant', dock.#onUpdateCombatant.bind(dock));
    Hooks.on('updateActor', (actor, changes) => ['name', 'img', 'system'].some((key) => key in changes) && dock.#renderCards((combatant) => combatant.actor === actor));
    for (const hook of ['createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect']) {
      Hooks.on(hook, (effect) => effect.parent instanceof Actor && dock.#renderCards((combatant) => combatant.actor === effect.parent));
    }
    Hooks.on('updateToken', (token, changes) => this.#TOKEN_KEYS.some((key) => key in changes) && dock.#renderCards((combatant) => combatant.token === token));
    Hooks.on('targetToken', (_user, token) => dock.#renderCards((combatant) => combatant.token === token.document));
    onSettingChange(this.#PLACEMENT_KEYS, () => dock.rendered && dock.#reposition());
    onSettingChange(this.#SETTING_KEYS, refresh);
    const reposition = foundry.utils.debounce(() => dock.rendered && dock.#reposition(), 250);
    window.addEventListener('resize', reposition);
    Hooks.on('collapseSidebar', () => dock.rendered && dock.#followSidebar());
    for (const hook of ['renderHotbar', 'renderPlayers', 'renderSceneControls', 'renderSceneNavigation']) Hooks.on(hook, reposition);
    Hooks.on('renderSettingsConfig', (_app, html) => dock.#bindScalePreview(html));
    Hooks.on('closeSettingsConfig', () => dock.rendered && dock.#reposition());
    Hooks.on('3ds-atlas.themeChanged', ({ moduleId } = {}) => moduleId === MODULE.ID && dock.rendered && dock.render());
  }

  /** Open, re-render or close the dock to match the viewed combat and this client's opt-out. */
  refresh() {
    if (this.#shouldShow()) this.render({ force: true });
    else if (this.rendered) this.close();
  }

  /**
   * Whether this client should see the dock right now.
   * @returns {boolean} Visibility.
   */
  #shouldShow() {
    if (!game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_ENABLED)) return false;
    const combat = viewedCombat();
    if (!combat?.combatants.some((combatant) => combatant.visible)) return false;
    const optedOut = game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_HIDDEN);
    if (game.user.isGM) return !optedOut;
    if (!combat.started) return false;
    return !optedOut || game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_LOCKED);
  }

  /**
   * This user's dock placement, or the GM-forced edge for players.
   * @returns {{edge: string, offset: number, x: number, y: number, vertical: boolean}} Placement.
   */
  #placement() {
    const forced = game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_FORCED_EDGE);
    if (forced && !game.user.isGM) return { edge: forced, offset: 0.5, x: 0.5, y: 0.5 };
    return game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_PLACEMENT);
  }

  /**
   * Position, scale and tuck the dock for this user's placement.
   * @param {boolean} [tuck] Re-evaluate tucking.
   */
  #reposition(tuck = true) {
    const placement = this.#placement();
    const scale = game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_SCALE);
    const mode = tuck && game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_TUCK);
    const { classList } = this.element;
    if (mode === 'crowded') {
      classList.add('rc-measuring');
      classList.remove('rc-tucked');
      classList.toggle('rc-tucked', isCrowded(this.element, placement, scale));
    } else if (mode) classList.toggle('rc-tucked', mode === 'always');
    applyPlacement(this.element, placement, scale);
    classList.remove('rc-measuring');
  }

  /**
   * Reposition every frame while the sidebar opens or closes.
   */
  #followSidebar() {
    const until = performance.now() + 600;
    const step = (now) => {
      if (!this.rendered) return;
      this.#reposition(now >= until);
      if (now < until) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Turn a floating dock between horizontal and vertical. */
  #rotateFloating() {
    const placement = this.#placement();
    if (placement.edge === 'float') game.settings.set(MODULE.ID, MODULE.SETTINGS.DOCK_PLACEMENT, { ...placement, vertical: !placement.vertical });
  }

  /**
   * Scale the dock live while the scale slider is dragged.
   * @param {HTMLElement} html The settings window element.
   */
  #bindScalePreview(html) {
    const picker = html.querySelector(`[name="${MODULE.ID}.${MODULE.SETTINGS.DOCK_SCALE}"]`);
    picker?.addEventListener('input', () => this.rendered && applyPlacement(this.element, this.#placement(), picker.valueAsNumber));
  }

  /**
   * Re-render the whole dock when a change can move, add or remove cards, otherwise only the strip.
   * @param {Combat} combat The updated combat.
   * @param {object} changes Changed data.
   */
  #onUpdateCombat(combat, changes) {
    const layout = RollCallDock.#LAYOUT_KEYS.some((key) => key in changes);
    if (!layout && this.rendered && combat === viewedCombat()) this.render({ parts: ['strip'] });
    else this.refresh();
  }

  /**
   * Re-render one card, or the whole dock when order or membership may have changed.
   * @param {Combatant} combatant The updated combatant.
   * @param {object} changes Changed data.
   */
  #onUpdateCombatant(combatant, changes) {
    if (combatant.combat !== viewedCombat()) return;
    if (['initiative', 'hidden', 'defeated'].some((key) => key in changes)) this.refresh();
    else this.#renderCards((c) => c === combatant);
  }

  /**
   * Re-render the cards of matching combatants in the viewed combat, and the strip for its side counts.
   * @param {Function} predicate Receives each combatant, returns true to re-render its card.
   */
  #renderCards(predicate) {
    if (!this.rendered) return;
    for (const [id, members] of this.#stacks) if (members.some(predicate)) this.#pendingCards.add(`card-${id}`);
    if (this.#pendingCards.size) this.#flushCards();
  }

  /** Render the cards queued by {@link RollCallDock##renderCards} in one pass, so a burst of document changes renders once. */
  #flushCards = foundry.utils.debounce(() => {
    const parts = [...this.#pendingCards];
    this.#pendingCards.clear();
    if (this.rendered && parts.length && viewedCombat()) this.render({ parts: [...parts, 'strip'] });
  }, 20);

  /**
   * Dock order: creation order while frozen, otherwise turn order.
   * @param {Combat} combat The viewed combat.
   * @returns {Combatant[]} Combatants in dock order.
   */
  static #order(combat) {
    return RollCallDock.#frozen(combat) ? combat.combatants.contents : combat.turns;
  }

  /**
   * Whether the dock keeps creation order because the combat is being set up with the order frozen.
   * @param {Combat} combat The viewed combat.
   * @returns {boolean} Whether the order is frozen.
   */
  static #frozen(combat) {
    return !combat.started && game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_FREEZE);
  }

  /**
   * Group consecutive visible combatants into cards.
   * @param {Combatant[]} order Combatants in dock order.
   * @returns {Map<string, Combatant[]>} Card members by the first member's id.
   */
  static #buildStacks(order) {
    const adapter = getAdapter();
    const stacking = game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_STACKS);
    const stacks = new Map();
    let stack = null;
    for (const combatant of order.filter((member) => member.visible)) {
      if (stack && stacking && RollCallDock.#joins(stack, combatant, adapter)) stack.members.push(combatant);
      else {
        stack = { members: [combatant], key: adapter.groupKey(combatant), summons: null };
        stacks.set(combatant.id, stack.members);
      }
    }
    return stacks;
  }

  /**
   * Whether a combatant joins the card before it.
   * @param {{members: Combatant[], key: string|null, summons: Set<string>|null}} stack The card so far.
   * @param {Combatant} combatant The next combatant.
   * @param {object} adapter The system adapter.
   * @returns {boolean} Whether it joins.
   */
  static #joins(stack, combatant, adapter) {
    const key = adapter.groupKey(combatant);
    if (key && key === stack.key) return true;
    const [leader] = stack.members;
    stack.summons ??= new Set(adapter.summons(leader.actor).map((actor) => actor.uuid));
    return stack.summons.has(combatant.actor?.uuid) && stack.members.every((member) => member === leader || stack.summons.has(member.actor?.uuid));
  }

  /** @inheritdoc */
  _configureRenderParts(_options) {
    const parts = { strip: { template: this.#view.templates.strip } };
    const combat = viewedCombat();
    const order = combat ? RollCallDock.#order(combat) : [];
    this.#indexes = new Map(order.map((combatant, index) => [combatant, index]));
    this.#groupLabels.clear();
    const stacks = RollCallDock.#buildStacks(order);
    const shape = (map) => [...map].map(([id, members]) => `${id}:${members.map((member) => member.id)}`).join('|');
    if (_options.parts && shape(stacks) !== shape(this.#stacks)) _options.parts = undefined;
    this.#stacks = stacks;
    for (const id of this.#stacks.keys()) parts[`card-${id}`] = { template: this.#view.templates.card };
    return parts;
  }

  /** @inheritdoc */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const combat = viewedCombat();
    const turn = combat.turn ?? 0;
    const count = combat.turns.length;
    context.isGM = game.user.isGM;
    context.canMove = game.user.isGM || !game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_FORCED_EDGE);
    context.started = combat.started;
    context.round = combat.round;
    context.sides = sideCounts(combat);
    this.#targets = this.#activeTargets(combat);
    context.clock = combat.started && combatClock(combat) ? { total: context.isGM, turn: game.settings.get(MODULE.ID, MODULE.SETTINGS.TURN_DURATION) > 0 } : null;
    context.divider = this.#view.order === 'activeFirst' && combat.started && turn > 0 ? { order: count - turn, label: _loc('ROLLCALL.Dock.RoundShort', { round: combat.round + 1 }) } : null;
    context.nav = context.isGM && combat.started ? RollCallDock.#NAV : [];
    const eventsOn = game.settings.get(MODULE.ID, MODULE.SETTINGS.ROUND_EVENTS_ENABLED);
    context.events = eventsOn ? this.#prepareEvents(combat) : [];
    context.controls = context.isGM
      ? [
          ...RollCallDock.#ROLLS,
          combat.started ? RollCallDock.#END : RollCallDock.#START,
          ...(eventsOn ? [RollCallDock.#ADD_EVENT] : []),
          ...(combat.started && game.settings.get(MODULE.ID, MODULE.SETTINGS.VS_SCREEN) ? [RollCallDock.#SHOW_VS] : []),
          RollCallDock.#SETTINGS
        ]
      : [];
    return context;
  }

  /** @inheritdoc */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId.startsWith('card-')) context.card = this.#prepareCard(viewedCombat(), this.#stacks.get(partId.slice(5)) ?? []);
    return context;
  }

  /**
   * Upcoming reminders this user may see, ordered among the cards.
   * @param {Combat} combat The viewed combat.
   * @returns {object[]} Event contexts.
   */
  #prepareEvents(combat) {
    const { turns, started } = combat;
    const turn = combat.turn ?? 0;
    const fixed = this.#view.order === 'fixed';
    return upcomingEvents(combat)
      .filter(({ event }) => event.mode === 'reminder')
      .map(({ event, round }) => {
        const found = turns.findIndex((combatant) => reachedCount(combatant.initiative, event.initiative));
        const at = found < 0 ? turns.length : found;
        let order = 999;
        if (started && round === combat.round) order = fixed ? at : at - turn;
        else if (started && round === combat.round + 1 && !fixed) order = turns.length - turn + 1 + at;
        return { id: event.id, label: event.label, order: Math.max(order, 0), when: eventWhen(event, round), canRemove: game.user.isGM };
      });
  }

  /**
   * Token ids targeted by whoever controls the active combatant.
   * @param {Combat} combat The viewed combat.
   * @returns {Set<string>} Targeted token ids.
   */
  #activeTargets(combat) {
    const active = combat.started ? combat.combatant : null;
    if (!active || !game.settings.get(MODULE.ID, MODULE.SETTINGS.TARGET_ICONS)) return new Set();
    if (!active.visible) return new Set();
    const users = active.hasPlayerOwner ? active.players : game.users.filter((user) => user.isGM);
    return new Set(users.flatMap((user) => [...user.targets].map((token) => token.id)));
  }

  /**
   * Render data for one card.
   * @param {Combat} combat The viewed combat.
   * @param {Combatant[]} members The card's combatants in turn order.
   * @returns {object} Card context.
   */
  #prepareCard(combat, members) {
    const combatant = members.find((member) => combat.started && member === combat.combatant) ?? members[0];
    const adapter = getAdapter();
    const isGM = game.user.isGM;
    const index = this.#indexes.get(combatant) ?? 0;
    const turn = combat.turn ?? 0;
    const fixed = this.#view.order === 'fixed';
    let order = index - turn;
    if (fixed) order = index;
    else if (index < turn) order = combat.turns.length - turn + 1 + index;
    const { active, acted, onDeck } = this.#turnState(combat, combatant);
    const initiative = canSee(game.user, combatant, 'initiative') ? adapter.initiativeLabel(combatant) : null;
    const health = canSee(game.user, combatant, 'health') ? adapter.healthFraction(combatant.actor) : null;
    const temp = health == null ? null : adapter.tempFraction(combatant.actor);
    const bucket = canSee(game.user, combatant, 'estimate') ? healthEstimate(combatant.actor) : null;
    const canRoll = combatant.isOwner && combatant.initiative == null;
    const canEndTurn = active && combatant.isOwner;
    const canPing = combatant.sceneId === canvas.scene?.id && game.user.hasPermission('PING_CANVAS');
    const buttons = [];
    if (canRoll) buttons.push({ action: 'rollInitiative', icon: 'fa-dice-d20', label: 'COMBAT.InitiativeRoll', cta: !active });
    if (canEndTurn) buttons.push({ action: 'endTurn', icon: 'fa-forward-step', label: 'COMBAT.TurnEnd', tooltip: members.length > 1 ? 'ROLLCALL.Dock.EndTurnStack' : null, cta: true, text: true });
    if (isGM && game.settings.get(MODULE.ID, MODULE.SETTINGS.NUDGE_ENABLED) && canNudge(combatant)) buttons.push({ action: 'nudge', icon: 'fa-bell', label: 'ROLLCALL.Nudge.Action' });
    if (canPing) buttons.push({ action: 'ping', icon: 'fa-bullseye', label: 'COMBATANT.Ping' });
    if (!active && !canRoll && combatant.token) buttons.push({ action: 'pan', icon: 'fa-crosshairs', label: 'COMBATANT.PanTo' });
    if (isGM) buttons.push({ icon: 'fa-ellipsis-vertical', label: 'ROLLCALL.Dock.More', cssClass: 'rc-more', combatantId: combatant.id });
    return {
      id: combatant.id,
      name: displayName(game.user, combatant),
      img: combatant.img,
      obscured: !canSee(game.user, combatant, 'name'),
      order,
      depth: 100 - Math.abs(order - (fixed && combat.started ? turn : 0)),
      first: order === 0,
      active,
      acted,
      targeted: !active && this.#targets.has(combatant.tokenId),
      onDeck,
      defeated: adapter.isDefeated(combatant),
      hidden: combatant.hidden,
      initiative: initiative ?? '–',
      rolled: initiative != null,
      canDrag: isGM && !RollCallDock.#frozen(combat) && Number.isNumeric(combatant.initiative),
      group: canSee(game.user, combatant, 'name') ? this.#groupLabel(combatant, adapter) : null,
      health: health == null ? null : RollCallDock.#healthBar(health, temp, bucket),
      estimate: health == null && bucket ? { label: bucket.label, tier: RollCallDock.#tier(bucket.threshold), color: bucket.color } : null,
      disposition: foundry.utils.Color.from(combatant.token?.object?.getDispositionColor() ?? CONFIG.Canvas.dispositionColors.INACTIVE).css,
      effects: canSee(game.user, combatant, 'effects') ? this.#effects(combatant) : [],
      legendary: this.#legendary(combatant, combat.started && !active),
      stack: members.length > 1 ? this.#prepareStack(combat, members, combatant) : null,
      buttons
    };
  }

  /**
   * A combatant's group name, worked out once per group per render.
   * @param {Combatant} combatant The combatant.
   * @param {object} adapter The system adapter.
   * @returns {string|null} Group name, or null when ungrouped.
   */
  #groupLabel(combatant, adapter) {
    const key = adapter.groupKey(combatant);
    if (!key) return null;
    if (!this.#groupLabels.has(key)) this.#groupLabels.set(key, adapter.groupLabel(combatant));
    return this.#groupLabels.get(key);
  }

  /**
   * Where a combatant stands in the current round.
   * @param {Combat} combat The viewed combat.
   * @param {Combatant} combatant The combatant.
   * @returns {{active: boolean, acted: boolean, onDeck: boolean}} Acting now, already acted this round, or next.
   */
  #turnState(combat, combatant) {
    const index = this.#indexes.get(combatant) ?? -1;
    const active = combat.started && index === combat.turn;
    return { active, acted: combat.started && index < (combat.turn ?? 0), onDeck: combat.started && !active && combat.nextCombatant === combatant };
  }

  /**
   * Health bar data for a card.
   * @param {number} health Health as a 0..1 fraction.
   * @param {number|null} temp Temporary health as a 0..1 fraction.
   * @param {object|null} bucket The matching health bucket, for its colour.
   * @returns {{percent: number, tier: string, color: string|null, temp: number|null}} Bar data.
   */
  static #healthBar(health, temp, bucket) {
    const percent = healthPercent(health);
    return { percent, tier: RollCallDock.#tier(percent), color: bucket?.color, temp: temp && Math.round(temp * 100) };
  }

  /**
   * Mini portraits for a stacked card.
   * @param {Combat} combat The viewed combat.
   * @param {Combatant[]} members The card's combatants.
   * @param {Combatant} face The member the card shows.
   * @returns {{count: number|null, minis: object[], before: object|null, after: object|null}} Stack context.
   */
  #prepareStack(combat, members, face) {
    const adapter = getAdapter();
    const key = adapter.groupKey(face);
    const grouped = !!key && members.every((member) => adapter.groupKey(member) === key);
    const listed = members.filter((member) => grouped || member !== face);
    const max = RollCallDock.#MAX_MINIS;
    let start = 0;
    let end = listed.length;
    if (listed.length > max) {
      start = Math.clamp(listed.indexOf(face) - 1, 0, listed.length - (max - 2));
      end = start + max - 2;
      if (start === 0) end = max - 1;
      else if (end === listed.length) start = listed.length - (max - 1);
    }
    const folded = (list) => (list.length ? { count: list.length, names: list.map((member) => displayName(game.user, member)).join(', ') } : null);
    const minis = listed.slice(start, end).map((member) => ({
      id: member.id,
      img: member.img,
      obscured: !canSee(game.user, member, 'name'),
      name: displayName(game.user, member),
      ...this.#turnState(combat, member),
      defeated: adapter.isDefeated(member)
    }));
    return { count: grouped ? members.length : null, minis, before: folded(listed.slice(0, start)), after: folded(listed.slice(end)) };
  }

  /**
   * Colour tier for a health percent.
   * @param {number} percent Health percent, or a bucket's threshold.
   * @returns {string} `ok`, `warn` or `crit`.
   */
  static #tier(percent) {
    if (percent > 50) return 'ok';
    return percent > 25 ? 'warn' : 'crit';
  }

  /**
   * Legendary action pips for the GM and the actor's owners.
   * @param {Combatant} combatant The combatant.
   * @param {boolean} ready Whether another creature's turn is running, when legendary actions can be taken.
   * @returns {{pips: boolean[], ready: boolean, label: string}|null} Pips, true for each action left, or null when hidden or none.
   */
  #legendary(combatant, ready) {
    if (!combatant.actor?.isOwner) return null;
    const counts = getAdapter().legendaryActions(combatant.actor);
    if (!counts) return null;
    return {
      pips: Array.from({ length: counts.max }, (_, index) => index < counts.value),
      ready: ready && counts.value > 0,
      label: _loc('ROLLCALL.Legendary.Label', { value: counts.value, max: counts.max })
    };
  }

  /**
   * Effects shown on a card, matching the core tracker's icon rules.
   * @param {Combatant} combatant The combatant.
   * @returns {{img: string, name: string}[]} Effect icons.
   */
  #effects(combatant) {
    const SHOW_ICON = CONST.ACTIVE_EFFECT_SHOW_ICON;
    return (combatant.actor?.appliedEffects ?? [])
      .filter((effect) => effect.showIcon === SHOW_ICON.ALWAYS || (effect.showIcon === SHOW_ICON.CONDITIONAL && effect.isTemporary))
      .map(({ img, name }) => ({ img, name }));
  }

  /** @inheritdoc */
  _attachFrameListeners() {
    super._attachFrameListeners();
    this.element.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !event.target.closest('.rc-grip')) return;
      dragDock(event, this.element, (placement) => game.settings.set(MODULE.ID, MODULE.SETTINGS.DOCK_PLACEMENT, { ...placement, vertical: this.#placement().vertical }));
    });
    this.element.addEventListener('dragstart', (event) => {
      const card = event.target.closest?.('.rc-card[draggable="true"]');
      if (card) event.dataTransfer.setData('text/plain', card.dataset.combatantId);
    });
    this.element.addEventListener('dragover', (event) => event.target.closest('.rc-card') && event.preventDefault());
    this.element.addEventListener('drop', (event) => this.#onDropCard(event));
    this.element.addEventListener(
      'contextmenu',
      (event) => {
        const pips = event.target.closest('.rc-legendary');
        if (!pips) return;
        event.preventDefault();
        event.stopPropagation();
        getAdapter().spendLegendary(combatantFor(pips).actor, -1);
      },
      { capture: true }
    );
    this.element.addEventListener('dblclick', (event) => {
      if (event.target.closest('.rc-grip')) this.#rotateFloating();
      const card = event.target.closest('.rc-card-body');
      if (card && !event.target.closest('.rc-legendary')) activateCombatant(event, card);
    });
    const entries = [
      ...combatantContextOptions(),
      {
        label: 'COMBATANT.MarkDefeated',
        icon: 'fa-solid fa-skull',
        visible: (target) => game.user.isGM && !combatantFor(target)?.isDefeated,
        onClick: (_event, target) => toggleDefeated(combatantFor(target))
      },
      {
        label: 'COMBATANT.UnmarkDefeated',
        icon: 'fa-solid fa-heart-pulse',
        visible: (target) => game.user.isGM && !!combatantFor(target)?.isDefeated,
        onClick: (_event, target) => toggleDefeated(combatantFor(target))
      },
      {
        label: 'COMBATANT.Hide',
        icon: 'fa-solid fa-eye-slash',
        visible: (target) => game.user.isGM && !combatantFor(target)?.hidden,
        onClick: (_event, target) => toggleHidden(combatantFor(target))
      },
      {
        label: 'COMBATANT.Show',
        icon: 'fa-solid fa-eye',
        visible: (target) => game.user.isGM && !!combatantFor(target)?.hidden,
        onClick: (_event, target) => toggleHidden(combatantFor(target))
      }
    ];
    const ContextMenu = foundry.applications.ux.ContextMenu.implementation;
    new ContextMenu(this.element, '.rc-card', entries, { fixed: true, jQuery: false });
    new ContextMenu(this.element, '.rc-more', entries, { eventName: 'click', fixed: true, jQuery: false });
  }

  /** @inheritdoc */
  _onRender(context, options) {
    super._onRender(context, options);
    const modes = game.settings.get(MODULE.ID, MODULE.SETTINGS.CARD_ELEMENTS);
    for (const [element, mode] of Object.entries(modes)) this.element.dataset[element] = mode;
    for (const view of Object.values(RollCallDock.#VIEWS)) this.element.classList.toggle(view.className, view === this.#view);
    this.element.classList.toggle('rc-minimal', game.settings.get(MODULE.ID, MODULE.SETTINGS.DOCK_MINIMAL));
    const current = new Set([...this.#stacks.keys()].map((id) => `card-${id}`));
    for (const part of this.#cardParts()) {
      if (!current.has(part.dataset.applicationPart)) part.remove();
    }
    this.#flipCards();
    this.#reposition();
    this.#tick();
    this.#slideCards();
  }

  /** @inheritdoc */
  async _preRender(context, options) {
    await super._preRender(context, options);
    await RollCallDock.#partials;
    const parts = this.rendered && options.parts.some((id) => id.startsWith('card-')) ? this.#cardParts() : [];
    this.#positions = new Map(parts.map((part) => [part.dataset.applicationPart, part.getBoundingClientRect()]));
    this.#faces = new Map(
      parts.filter((part) => options.parts.includes(part.dataset.applicationPart)).map((part) => [part.dataset.applicationPart, { face: part.dataset.combatantId, body: RollCallDock.#faceCopy(part) }])
    );
  }

  /**
   * An inert copy of a card's face for the flip.
   * @param {HTMLElement} part The card part.
   * @returns {HTMLElement|undefined} The copy.
   */
  static #faceCopy(part) {
    const copy = part.querySelector('.rc-card-body')?.cloneNode(true);
    copy?.classList.remove('rc-card-body');
    copy?.removeAttribute('data-action');
    copy?.removeAttribute('data-combatant-id');
    return copy;
  }

  /**
   * Card part elements currently in the dock.
   * @returns {HTMLElement[]} Card parts.
   */
  #cardParts() {
    return [...this.element.querySelectorAll(':scope > [data-application-part^="card-"]')];
  }

  /**
   * Flip a card whose shown combatant changed.
   */
  #flipCards() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const turn = (degrees) => ({ transform: `perspective(40rem) rotateY(${degrees}deg)` });
    const timing = { duration: 800, easing: 'ease-in-out' };
    const flips = this.#cardParts()
      .map((part) => ({ before: this.#faces.get(part.dataset.applicationPart), body: part.querySelector('.rc-card-body'), face: part.dataset.combatantId }))
      .filter(({ before, body, face }) => before?.body && body && before.face !== face)
      .map(({ before, body }) => ({ old: before.body, body, box: { left: body.offsetLeft, top: body.offsetTop, width: body.offsetWidth, height: body.offsetHeight } }));
    for (const { old, body, box } of flips) {
      Object.assign(old.style, {
        position: 'absolute',
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        margin: '0',
        pointerEvents: 'none'
      });
      body.before(old);
      const away = old.animate([turn(0), { ...turn(90), offset: 0.5 }, turn(90)], timing);
      away.onfinish = away.oncancel = () => old.remove();
      body.animate([turn(-90), { ...turn(-90), offset: 0.5 }, turn(0)], timing);
    }
    this.#faces.clear();
  }

  /** Slide cards that moved since the last render from their old spot to their new one, so a re-sorted turn order moves together. */
  #slideCards() {
    if (!this.#positions.size || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const scale = this.element.getBoundingClientRect().width / this.element.offsetWidth || 1;
    for (const part of this.#cardParts()) {
      const before = this.#positions.get(part.dataset.applicationPart);
      if (!before) continue;
      const after = part.getBoundingClientRect();
      const dx = (before.left - after.left) / scale;
      const dy = (before.top - after.top) / scale;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      part.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 450, easing: 'cubic-bezier(0.16, 0.84, 0.24, 1)' });
    }
    this.#positions.clear();
  }

  /** @inheritdoc */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#ticker = setInterval(() => this.#tick(), 1000);
  }

  /** @inheritdoc */
  _onClose(options) {
    super._onClose(options);
    clearInterval(this.#ticker);
  }

  /** Update the clock readouts in place. */
  #tick() {
    const combat = viewedCombat();
    const clock = this.element && combat && combatClock(combat);
    if (!clock) return;
    const remaining = game.settings.get(MODULE.ID, MODULE.SETTINGS.TURN_DURATION) * 1000 - clock.turn;
    for (const element of this.element.querySelectorAll('[data-clock="total"]')) element.textContent = formatClock(clock.total);
    for (const element of this.element.querySelectorAll('[data-clock="turn"]')) {
      element.textContent = formatClock(remaining);
      element.classList.toggle('is-overtime', remaining < 0);
    }
  }

  /**
   * Move a dragged card before the card it was dropped on by giving it an initiative between its new neighbours.
   * @param {DragEvent} event The drop event.
   */
  #onDropCard(event) {
    const combat = viewedCombat();
    const source = combat?.combatants.get(event.dataTransfer.getData('text/plain'));
    const target = combatantFor(event.target);
    if (!game.user.isGM || !source || !target || source === target || !Number.isNumeric(target.initiative)) return;
    event.preventDefault();
    const turns = combat.turns.filter((combatant) => combatant !== source);
    const before = turns[turns.indexOf(target) - 1];
    const step = game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_REVERSE) ? -1 : 1;
    const high = Number.isNumeric(before?.initiative) ? before.initiative : target.initiative + step * 2;
    source.update({ initiative: (high + target.initiative) / 2 });
  }

  /**
   * Control and pan to the clicked card's token.
   * @this {RollCallDock}
   * @param {PointerEvent} event The click event.
   * @param {HTMLElement} target The card body.
   */
  static #onActivate(event, target) {
    activateCombatant(event, target);
  }

  /**
   * Run a core Combat method named by the button's action.
   * @this {RollCallDock}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The button.
   */
  static #onCombatControl(_event, target) {
    viewedCombat()?.[target.dataset.action]();
  }

  /**
   * End the active combatant's turn, or with Shift held on a stacked card, the turns of every member still to act in the stack.
   * @this {RollCallDock}
   * @param {PointerEvent} event The click event.
   * @param {HTMLElement} target The button.
   * @returns {Promise<Combat>} The updated combat.
   */
  static #onEndTurn(event, target) {
    const combat = viewedCombat();
    const members = this.#stacks.get(target.closest('[data-application-part]')?.dataset.applicationPart.slice(5)) ?? [];
    if (!event.shiftKey || members.length < 2) return combat.nextTurn();
    return getAdapter().endTurnsThrough(combat, Math.max(...members.map((member) => combat.turns.indexOf(member))));
  }

  /**
   * Pan to the card's token.
   * @this {RollCallDock}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The button.
   */
  static #onPan(_event, target) {
    panToCombatant(combatantFor(target));
  }

  /**
   * Nudge the players who own the card's combatant.
   * @this {RollCallDock}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The button.
   */
  static #onNudge(_event, target) {
    nudge(combatantFor(target));
  }

  /**
   * Ping the card's token.
   * @this {RollCallDock}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The button.
   */
  static #onPing(_event, target) {
    pingCombatant(combatantFor(target));
  }

  /**
   * Ask for a new round event on the viewed combat.
   * @this {RollCallDock}
   */
  static #onAddEvent() {
    promptRoundEvent(viewedCombat());
  }

  /**
   * Spend one legendary action.
   * @this {RollCallDock}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The pip row.
   */
  static #onSpendLegendary(_event, target) {
    getAdapter().spendLegendary(combatantFor(target).actor, 1);
  }

  /**
   * Remove the clicked round event.
   * @this {RollCallDock}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The remove button.
   */
  static #onRemoveEvent(_event, target) {
    removeRoundEvent(viewedCombat(), target.dataset.eventId);
  }

  /**
   * Roll initiative for the card's combatant through the system adapter.
   * @this {RollCallDock}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The button.
   */
  static #onRollInitiative(_event, target) {
    getAdapter().rollInitiative(combatantFor(target));
  }

  /**
   * Replay the VS screen for everyone.
   * @this {RollCallDock}
   */
  static #onShowVs() {
    VsScreen.replay(viewedCombat());
  }

  /**
   * Open the settings window on Roll Call's category.
   * @this {RollCallDock}
   */
  static #onSettings() {
    new foundry.applications.settings.SettingsConfig({ initialCategory: MODULE.ID }).render({ force: true });
  }
}
