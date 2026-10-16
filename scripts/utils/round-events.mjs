import { MODULE } from '../constants.mjs';

const { DialogV2 } = foundry.applications.api;
const { BooleanField, FilePathField, NumberField, StringField } = foundry.data.fields;

/**
 * @typedef {object} RoundEvent
 * @property {string} id Event id.
 * @property {string} label Name shown on the dock, tracker, banner and turn card.
 * @property {'reminder'|'turn'} mode A reminder fires a whisper and banner; a turn joins the turn order as its own combatant.
 * @property {string} schedule Rounds it happens on, in the schedule syntax or as a dice formula; blank for every round.
 * @property {number|null} next Round a formula event next happens on.
 * @property {number|null} initiative Initiative count, or null for the start of the round.
 * @property {string|null} img Image of a turn event's card.
 * @property {boolean} visible Whether players see it.
 * @property {string|null} lair Id of the actor whose lair actions this is.
 * @property {{round: number, result: 'fired'|'skipped'}[]} log What happened on each round it came up.
 */

/** @type {object} Values of the fields a new event leaves out. */
const EVENT_DEFAULTS = { mode: 'reminder', schedule: '', next: null, initiative: null, img: null, visible: false, lair: null };

/**
 * A combat's round events.
 * @param {Combat} combat The combat.
 * @returns {RoundEvent[]} Events.
 */
export function roundEvents(combat) {
  return combat?.getFlag(MODULE.ID, MODULE.FLAGS.EVENTS) ?? [];
}

/**
 * Events this user may see, with the round each next happens on.
 * @param {Combat} combat The combat.
 * @returns {object[]} Upcoming events, as `{event, round}`.
 */
export function upcomingEvents(combat) {
  return roundEvents(combat)
    .filter((event) => game.user.isGM || (event.mode === 'reminder' && event.visible))
    .map((event) => ({ event, round: nextOccurrence(combat, event) }))
    .filter(({ round }) => round != null);
}

/**
 * Whether a schedule is a dice formula.
 * @param {string} schedule Schedule text.
 * @returns {boolean} Whether it rolls.
 */
export function isFormula(schedule = '') {
  return /\dd\d|\bd\d/i.test(schedule);
}

/**
 * Turn a schedule into a test for a round.
 * @param {string} schedule Schedule text.
 * @param {number|null} [next] Round a formula event next happens on.
 * @returns {Function|null} Test taking a round number, or null when the text is not a valid schedule.
 */
export function parseSchedule(schedule = '', next = null) {
  if (isFormula(schedule)) return Roll.validate(schedule) ? (round) => next != null && round >= next : null;
  const parts = schedule
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return () => true;
  const tests = parts.map((part) => {
    let match = part.match(/^(\d+)$/);
    if (match) return (round) => round === Number(match[1]);
    match = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (match) return (round) => round >= Number(match[1]) && round <= Number(match[2]);
    match = part.match(/^(\d+)\s*\+$/);
    if (match) return (round) => round >= Number(match[1]);
    match = part.match(/^(\d+)\s*\/\s*([1-9]\d*)$/);
    if (match) return (round) => round >= Number(match[1]) && (round - Number(match[1])) % Number(match[2]) === 0;
    return null;
  });
  return tests.includes(null) ? null : (round) => tests.some((test) => test(round));
}

/**
 * The first rounds a schedule matches from a round on, for the dialog preview.
 * @param {string} schedule Schedule text.
 * @param {number} from First round to check.
 * @param {number} [count] Rounds to find.
 * @returns {number[]|null} Matching rounds, or null when the schedule is invalid.
 */
export function upcomingRounds(schedule, from, count = 5) {
  const test = parseSchedule(schedule);
  if (!test) return null;
  const rounds = [];
  for (let round = Math.max(from, 1); round < from + 500 && rounds.length < count; round++) if (test(round)) rounds.push(round);
  return rounds;
}

/**
 * Whether an event comes up on a round and has not already fired or been skipped there.
 * @param {RoundEvent} event The event.
 * @param {number} round Round number.
 * @returns {boolean} Whether it is pending on that round.
 */
export function pendingOn(event, round) {
  return !!parseSchedule(event.schedule, event.next)?.(round) && !loggedOn(event, round);
}

/**
 * Whether an event already fired or was skipped on a round.
 * @param {RoundEvent} event The event.
 * @param {number} round Round number.
 * @param {'fired'|'skipped'} [result] Only count this result.
 * @returns {boolean} Whether it is logged.
 */
function loggedOn(event, round, result) {
  return event.log.some((entry) => entry.round === round && (!result || entry.result === result));
}

/**
 * Whether the combat's current turn is at or past an event's initiative count this round.
 * @param {Combat} combat The combat.
 * @param {RoundEvent} event The event.
 * @returns {boolean} Whether the count has passed.
 */
function countPassed(combat, event) {
  return combat.started && reachedCount(combat.combatant?.initiative, event.initiative);
}

/**
 * Whether a turn at one initiative has reached an event's initiative count, honouring reversed turn order.
 * @param {number|null} turnInitiative Initiative of the turn.
 * @param {number|null} eventInitiative Event's initiative count, or null for the start of the round.
 * @returns {boolean} Whether the event's count has been reached.
 */
export function reachedCount(turnInitiative, eventInitiative) {
  if (eventInitiative == null) return true;
  if (!Number.isNumeric(turnInitiative)) return false;
  const reverse = game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_REVERSE);
  return reverse ? turnInitiative >= eventInitiative : turnInitiative <= eventInitiative;
}

/**
 * The next round an event happens on.
 * @param {Combat} combat The combat.
 * @param {RoundEvent} event The event.
 * @returns {number|null} Round, or null when it never comes up again.
 */
export function nextOccurrence(combat, event) {
  const test = parseSchedule(event.schedule, event.next);
  if (!test) return null;
  const now = Math.max(combat.round, 1);
  const from = countPassed(combat, event) ? now + 1 : now;
  for (let round = from; round < from + 50; round++) if (test(round) && !loggedOn(event, round)) return round;
  return null;
}

/**
 * When an event happens, as shown on its dock card and core tracker row.
 * @param {RoundEvent} event The event.
 * @param {number|null} round Round it next happens on.
 * @returns {string} Localized round and initiative count.
 */
export function eventWhen(event, round) {
  return _loc('ROLLCALL.RoundEvents.When', { round: round ?? '–', initiative: event.initiative ?? '–' });
}

/**
 * Write a combat's events.
 * @param {Combat} combat The combat.
 * @param {RoundEvent[]} events Events.
 * @returns {Promise<Combat>} The updated combat.
 */
function saveEvents(combat, events) {
  return combat.setFlag(MODULE.ID, MODULE.FLAGS.EVENTS, events);
}

/**
 * Add events in one write, logging past occurrences as skipped.
 * @param {Combat} combat The combat.
 * @param {object[]} entries Event data; missing fields take their defaults.
 * @returns {Promise<RoundEvent[]>} The events.
 */
export async function addRoundEvents(combat, entries) {
  const events = [];
  for (const data of entries) {
    const event = { id: foundry.utils.randomID(), ...EVENT_DEFAULTS, log: [], ...data };
    if (isFormula(event.schedule)) event.next = await rollNext(event, combat.started ? combat.round : 0);
    else if (countPassed(combat, event) && pendingOn(event, combat.round)) event.log.push({ round: combat.round, result: 'skipped' });
    events.push(event);
  }
  await saveEvents(combat, [...roundEvents(combat), ...events]);
  if (events.some((event) => event.mode === 'turn')) await syncTurnEvents(combat);
  return events;
}

/**
 * Record in one write that events fired on a round, rerolling formula events.
 * @param {Combat} combat The combat.
 * @param {string[]} eventIds Event ids.
 * @param {number} round Round number.
 * @returns {Promise<Combat>} The updated combat.
 */
export async function logFired(combat, eventIds, round) {
  const events = [];
  for (const event of roundEvents(combat)) {
    if (!eventIds.includes(event.id) || loggedOn(event, round)) events.push(event);
    else events.push({ ...event, log: [...event.log, { round, result: 'fired' }], next: isFormula(event.schedule) ? await rollNext(event, round) : event.next });
  }
  return saveEvents(combat, events);
}

/**
 * Roll a formula event's gap and whisper it to GMs.
 * @param {RoundEvent} event The event.
 * @param {number} round Round the gap counts from.
 * @returns {Promise<number>} Round it next happens on.
 */
async function rollNext(event, round) {
  const roll = await new Roll(event.schedule).evaluate();
  const next = round + Math.max(1, roll.total);
  await roll.toMessage({ flavor: _loc('ROLLCALL.RoundEvents.Rolled', { label: foundry.utils.escapeHTML(event.label), round: next }) }, { messageMode: 'gm' });
  return next;
}

/**
 * Remove an event and its turn combatant.
 * @param {Combat} combat The combat.
 * @param {string} eventId Event id.
 * @returns {Promise<void>}
 */
export async function removeRoundEvent(combat, eventId) {
  await saveEvents(
    combat,
    roundEvents(combat).filter((event) => event.id !== eventId)
  );
  await combat.combatants.find((combatant) => combatant.getFlag(MODULE.ID, MODULE.FLAGS.EVENT) === eventId)?.delete({ rollCallSync: true });
}

/**
 * Add or remove each turn event's combatant for the current round.
 * @param {Combat} combat The combat.
 * @returns {Promise<void>}
 */
export async function syncTurnEvents(combat) {
  const present = new Map(combat.combatants.map((combatant) => [combatant.getFlag(MODULE.ID, MODULE.FLAGS.EVENT), combatant]));
  const events = roundEvents(combat).filter((event) => event.mode === 'turn');
  const due = events.filter((event) => combat.started && parseSchedule(event.schedule, event.next)?.(combat.round) && !loggedOn(event, combat.round, 'skipped'));
  const create = due
    .filter((event) => !present.has(event.id))
    .map((event) => ({
      name: event.label,
      img: event.img || CONST.DEFAULT_TOKEN,
      initiative: event.initiative ?? firstCount(combat),
      hidden: !event.visible,
      flags: { [MODULE.ID]: { [MODULE.FLAGS.EVENT]: event.id } }
    }));
  const remove = events.filter((event) => !due.includes(event) && present.has(event.id)).map((event) => present.get(event.id).id);
  const [created] = await Promise.all([
    create.length ? combat.createEmbeddedDocuments('Combatant', create) : [],
    remove.length && combat.deleteEmbeddedDocuments('Combatant', remove, { rollCallSync: true })
  ]);
  const first = Math.min(...created.map((combatant) => combat.turns.indexOf(combatant)));
  if (first < combat.turn) await combat.update({ turn: first });
}

/**
 * An initiative count ahead of every combatant now in the combat.
 * @param {Combat} combat The combat.
 * @returns {number|null} Count, or null when nobody has rolled yet.
 */
function firstCount(combat) {
  const counts = combat.combatants.filter((combatant) => !combatant.getFlag(MODULE.ID, MODULE.FLAGS.EVENT) && Number.isNumeric(combatant.initiative)).map((combatant) => combatant.initiative);
  if (!counts.length) return null;
  return game.settings.get(MODULE.ID, MODULE.SETTINGS.INITIATIVE_REVERSE) ? Math.floor(Math.min(...counts)) - 1 : Math.ceil(Math.max(...counts)) + 1;
}

/**
 * Ask the GM for a new round event.
 * @param {Combat} combat The combat.
 * @returns {Promise<RoundEvent|null>} The added event, or null when cancelled.
 */
export async function promptRoundEvent(combat) {
  const fields = {
    label: new StringField({ label: 'ATLAS.Common.Label', required: true, blank: false }),
    mode: new StringField({
      label: 'ROLLCALL.RoundEvents.Mode',
      hint: 'ROLLCALL.RoundEvents.ModeHint',
      required: true,
      choices: { reminder: 'ROLLCALL.RoundEvents.Reminder', turn: 'ROLLCALL.RoundEvents.Turn' }
    }),
    schedule: new StringField({ label: 'ROLLCALL.RoundEvents.Schedule', hint: 'ROLLCALL.RoundEvents.ScheduleHint', blank: true }),
    initiative: new NumberField({ label: 'ROLLCALL.RoundEvents.Initiative', hint: 'ROLLCALL.RoundEvents.InitiativeHint', nullable: true }),
    img: new FilePathField({ label: 'ROLLCALL.RoundEvents.Image', categories: ['IMAGE'] }),
    visible: new BooleanField({ label: 'ROLLCALL.RoundEvents.Visible', hint: 'ROLLCALL.RoundEvents.VisibleHint' })
  };
  const start = Math.max(combat.round, 1);
  const values = { mode: 'reminder', schedule: String(start), visible: false };
  const groups = Object.entries(fields).map(([name, field]) => field.toFormGroup({ localize: true }, { name, value: values[name], autofocus: name === 'label', localize: true }).outerHTML);
  const preview = '<p class="hint rc-schedule-preview"></p>';
  const data = await DialogV2.input({
    window: { title: 'ROLLCALL.RoundEvents.Add', icon: 'fa-solid fa-hourglass-half' },
    classes: ['roll-call'],
    content: groups.join('') + preview,
    rejectClose: false,
    render: (_event, dialog) => bindPreview(dialog.element, start)
  });
  if (!data?.label) return null;
  if (!parseSchedule(data.schedule)) {
    ui.notifications.warn('ROLLCALL.RoundEvents.Invalid', { localize: true });
    return null;
  }
  const [event] = await addRoundEvents(combat, [
    { label: data.label, mode: data.mode, schedule: data.schedule.trim(), initiative: data.initiative ?? null, img: data.img || null, visible: data.visible }
  ]);
  return event;
}

/**
 * Keep the dialog's preview of matching rounds in step with its schedule field, and show the image field only for turn events.
 * @param {HTMLElement} element The dialog element.
 * @param {number} start First round to preview.
 */
function bindPreview(element, start) {
  const schedule = element.querySelector('[name="schedule"]');
  const mode = element.querySelector('[name="mode"]');
  const preview = element.querySelector('.rc-schedule-preview');
  const image = element.querySelector('[name="img"]')?.closest('.form-group');
  const update = () => {
    const rounds = upcomingRounds(schedule.value, start);
    if (!rounds) preview.textContent = _loc('ROLLCALL.RoundEvents.Invalid');
    else if (isFormula(schedule.value)) preview.textContent = _loc('ROLLCALL.RoundEvents.FormulaPreview', { formula: schedule.value.trim() });
    else if (!schedule.value.trim()) preview.textContent = _loc('ROLLCALL.RoundEvents.EveryRound');
    else preview.textContent = _loc('ROLLCALL.RoundEvents.Preview', { rounds: rounds.length ? rounds.join(', ') : '–' });
    if (image) image.hidden = mode.value !== 'turn';
  };
  schedule.addEventListener('input', update);
  mode.addEventListener('change', update);
  update();
}
