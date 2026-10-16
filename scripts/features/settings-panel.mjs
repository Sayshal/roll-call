import { MODULE } from '../constants.mjs';
import { keepKeys, settingFormGroup, settingValue } from '../utils/_module.mjs';

const { ApplicationV2 } = foundry.applications.api;
const { createFontAwesomeIcon, createFormGroup } = foundry.applications.fields;
const { SchemaField } = foundry.data.fields;

/**
 * All of Roll Call's settings in one tabbed window.
 */
export class RollCallSettings extends ApplicationV2 {
  /**
   * Tabs in order, each a list of sections with an optional feature toggle.
   * @type {object[]}
   */
  static #TABS = [
    {
      id: 'dock',
      icon: 'swords',
      sections: [
        {
          toggle: MODULE.SETTINGS.DOCK_ENABLED,
          keys: [
            MODULE.SETTINGS.DOCK_VIEW,
            MODULE.SETTINGS.DOCK_MINIMAL,
            MODULE.SETTINGS.DOCK_TUCK,
            MODULE.SETTINGS.DOCK_SCALE,
            MODULE.SETTINGS.DOCK_HIDDEN,
            MODULE.SETTINGS.DOCK_STACKS,
            MODULE.SETTINGS.DOCK_LOCKED,
            MODULE.SETTINGS.DOCK_FORCED_EDGE,
            MODULE.SETTINGS.CARD_ELEMENTS
          ]
        }
      ]
    },
    {
      id: 'turns',
      icon: 'hourglass-half',
      sections: [
        {
          toggle: MODULE.SETTINGS.REMINDERS_ENABLED,
          keys: [MODULE.SETTINGS.REMINDER_BANNER, MODULE.SETTINGS.REMINDER_GLOW, MODULE.SETTINGS.REMINDER_PAN, MODULE.SETTINGS.SELECT_ACTIVE_TOKEN, MODULE.SETTINGS.ON_DECK_MARKER]
        },
        { keys: [MODULE.SETTINGS.NUDGE_ENABLED, MODULE.SETTINGS.TURN_DURATION, MODULE.SETTINGS.TURN_EXPIRY] }
      ]
    },
    {
      id: 'privacy',
      icon: 'user-secret',
      sections: [
        { toggle: MODULE.SETTINGS.PRIVACY_ENABLED, keys: [MODULE.SETTINGS.NAME_MASK, MODULE.SETTINGS.HIDE_UNTIL_SEEN, MODULE.SETTINGS.PRIVACY_RULES] },
        { toggle: MODULE.SETTINGS.HEALTH_ESTIMATE_ENABLED, keys: [MODULE.SETTINGS.HEALTH_CANVAS, MODULE.SETTINGS.HEALTH_BUCKETS] }
      ]
    },
    {
      id: 'initiative',
      icon: 'dice-d20',
      sections: [
        { keys: [MODULE.SETTINGS.INITIATIVE_AUTO_ROLL, MODULE.SETTINGS.INITIATIVE_FREEZE, MODULE.SETTINGS.INITIATIVE_REVERSE, MODULE.SETTINGS.INITIATIVE_GROUP, MODULE.SETTINGS.BULK_ADD_ENABLED] }
      ]
    },
    {
      id: 'encounter',
      icon: 'dungeon',
      sections: [
        { toggle: MODULE.SETTINGS.ROUND_EVENTS_ENABLED, keys: [MODULE.SETTINGS.LAIR_PROMPT] },
        { keys: [MODULE.SETTINGS.VS_SCREEN, MODULE.SETTINGS.LINK_SCENE, MODULE.SETTINGS.TARGET_ICONS, MODULE.SETTINGS.SUMMON_LINES, MODULE.SETTINGS.AUTO_DEFEAT] }
      ]
    },
    {
      id: 'focus',
      icon: 'eye-low-vision',
      sections: [{ toggle: MODULE.SETTINGS.FOCUS_ENABLED, keys: [MODULE.SETTINGS.FOCUS_ELEMENTS, MODULE.SETTINGS.FOCUS_SELECTORS, MODULE.SETTINGS.FOCUS_ON_DEVICE] }]
    },
    { id: 'core', icon: 'gear', sections: [{ keys: [MODULE.SETTINGS.HIDE_COMBAT_TAB] }], core: true }
  ];

  /** @type {Set<string>} Setting keys that do not apply to this world's system, filled at registration. */
  static hidden = new Set();

  /** @type {object|null} Edited values kept across re-renders while rows are added or removed, keyed by setting key. */
  #draft = null;

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: `${MODULE.ID}-settings`,
    classes: ['roll-call', 'rc-settings'],
    tag: 'form',
    window: { title: 'ROLLCALL.Settings.Panel.Title', icon: 'fa-solid fa-swords', contentClasses: ['standard-form'], resizable: true },
    position: { width: 760, height: 720 },
    form: { handler: RollCallSettings.#onSubmit, closeOnSubmit: true },
    actions: { addRow: RollCallSettings.#onAddRow, removeRow: RollCallSettings.#onRemoveRow, coreConfig: RollCallSettings.#onCoreConfig }
  };

  /**
   * The registered config of one of Roll Call's settings.
   * @param {string} key Setting key.
   * @returns {object} Setting config.
   */
  static #setting(key) {
    return game.settings.settings.get(`${MODULE.ID}.${key}`);
  }

  /**
   * Whether this user can change a setting here.
   * @param {string} key Setting key.
   * @returns {boolean} Whether it is shown.
   */
  static #editable(key) {
    return !!key && !RollCallSettings.hidden.has(key) && (game.user.isGM || RollCallSettings.#setting(key).scope !== 'world');
  }

  /**
   * Tabs this user sees, each holding only the sections and settings they can change.
   * @returns {object[]} Visible tabs.
   */
  #tabs() {
    return RollCallSettings.#TABS
      .map((tab) => ({
        ...tab,
        sections: tab.sections
          .map(({ toggle, keys }) => ({ toggle: RollCallSettings.#editable(toggle) ? toggle : null, keys: keys.filter(RollCallSettings.#editable) }))
          .filter((section) => section.toggle || section.keys.length)
      }))
      .filter((tab) => tab.sections.length || tab.core);
  }

  /** @inheritdoc */
  async _renderHTML(_context, _options) {
    const tabs = this.#tabs();
    if (!tabs.some((tab) => tab.id === this.tabGroups.primary)) this.tabGroups.primary = tabs[0].id;
    const nav = document.createElement('nav');
    nav.className = 'tabs';
    nav.append(...tabs.map((tab) => this.#navItem(tab)));
    const sections = tabs.map((tab) => this.#section(tab));
    const save = document.createElement('button');
    save.type = 'submit';
    save.append(createFontAwesomeIcon('floppy-disk'), _loc('ATLAS.Common.Save'));
    const footer = document.createElement('footer');
    footer.className = 'form-footer';
    footer.append(save);
    return [nav, ...sections, footer];
  }

  /** @inheritdoc */
  _replaceHTML(result, content, _options) {
    content.replaceChildren(...result);
  }

  /**
   * Navigation item for a tab.
   * @param {{id: string, icon: string}} tab Tab definition.
   * @returns {HTMLAnchorElement} Nav item.
   */
  #navItem(tab) {
    const item = document.createElement('a');
    item.className = tab.id === this.tabGroups.primary ? 'item active' : 'item';
    Object.assign(item.dataset, { action: 'tab', group: 'primary', tab: tab.id });
    item.append(createFontAwesomeIcon(tab.icon), _loc(`ROLLCALL.Settings.Tab.${tab.id}`));
    return item;
  }

  /**
   * Section holding a tab's settings, plus the core combat settings button on the core tab.
   * @param {object} tab Visible tab.
   * @returns {HTMLElement} Tab section.
   */
  #section(tab) {
    const section = document.createElement('section');
    section.className = tab.id === this.tabGroups.primary ? 'tab active' : 'tab';
    Object.assign(section.dataset, { group: 'primary', tab: tab.id });
    section.append(...tab.sections.flatMap((part) => this.#feature(part)));
    if (tab.core) {
      const core = document.createElement('button');
      core.type = 'button';
      core.dataset.action = 'coreConfig';
      core.id = `${this.id}-coreConfig`;
      core.append(createFontAwesomeIcon('swords'), _loc('ROLLCALL.Settings.CombatConfig.Label'));
      const group = createFormGroup({ label: 'ROLLCALL.Settings.CombatConfig.Name', hint: 'ROLLCALL.Settings.CombatConfig.Hint', input: core, localize: true });
      group.querySelector('label').htmlFor = core.id;
      section.append(group);
    }
    return section;
  }

  /**
   * A section's settings, with its feature toggle in a callout.
   * @param {{toggle: string|null, keys: string[]}} part Visible section.
   * @returns {HTMLElement[]} Section markup.
   */
  #feature({ toggle, keys }) {
    const groups = keys.map((key) => this.#group(key));
    if (!toggle) return groups;
    const feature = document.createElement('div');
    feature.className = 'rc-feature';
    const callout = this.#group(toggle);
    callout.classList.add('rc-feature-toggle');
    const body = document.createElement('div');
    body.className = 'rc-feature-body';
    body.append(...groups);
    feature.append(callout, body);
    return [feature];
  }

  /**
   * Form markup for one setting.
   * @param {string} key Setting key.
   * @returns {HTMLElement} Form group or fieldset.
   */
  #group(key) {
    const setting = RollCallSettings.#setting(key);
    const value = this.#draft?.[key] ?? game.settings.get(MODULE.ID, key);
    if (setting.type instanceof SchemaField) {
      const fieldset = settingFormGroup(setting.type, key, value, this.id);
      const legend = Object.assign(document.createElement('legend'), { textContent: _loc(setting.name) });
      fieldset.prepend(legend, Object.assign(document.createElement('p'), { className: 'hint', textContent: _loc(setting.hint) }));
      return fieldset;
    }
    return setting.type.toFormGroup({ label: setting.name, hint: setting.hint, rootId: this.id, localize: true }, { name: key, value, localize: true });
  }

  /**
   * Values in the form, keyed by setting key, so unsaved edits survive a re-render.
   * @returns {object} Setting values.
   */
  #readForm() {
    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    for (const [key, value] of Object.entries(data)) {
      const { type } = RollCallSettings.#setting(key);
      if (type instanceof SchemaField) data[key] = keepKeys(settingValue(type, value), this.#draft?.[key] ?? game.settings.get(MODULE.ID, key));
    }
    return data;
  }

  /**
   * Change the rows of the array a row button edits, keeping the form's unsaved values, and re-render.
   * @param {HTMLElement} target The row button.
   * @param {Function} change Receives the rows and the array's field.
   */
  #editRows(target, change) {
    const [key, ...rest] = target.dataset.name.split('.');
    const path = rest.join('.');
    this.#draft = this.#readForm();
    change(foundry.utils.getProperty(this.#draft[key], path), RollCallSettings.#setting(key).type.getField(path));
    this.render();
  }

  /**
   * Append a row with default values to the clicked array.
   * @this {RollCallSettings}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The add button.
   */
  static #onAddRow(_event, target) {
    this.#editRows(target, (rows, field) => rows.push(field.element.getInitialValue()));
  }

  /**
   * Remove the clicked row.
   * @this {RollCallSettings}
   * @param {PointerEvent} _event The click event.
   * @param {HTMLElement} target The remove button.
   */
  static #onRemoveRow(_event, target) {
    this.#editRows(target, (rows) => rows.splice(Number(target.dataset.index), 1));
  }

  /**
   * Open core's combat tracker settings.
   * @this {RollCallSettings}
   */
  static #onCoreConfig() {
    new foundry.applications.apps.CombatTrackerConfig().render({ force: true });
  }

  /**
   * Save every changed setting, then ask once for the reload any of them need.
   * @this {RollCallSettings}
   */
  static async #onSubmit() {
    const changed = Object.entries(this.#readForm())
      .map(([key, value]) => ({ key, setting: RollCallSettings.#setting(key), value: RollCallSettings.#setting(key).type.clean(value) }))
      .filter(({ key, value }) => !foundry.utils.objectsEqual({ value: game.settings.get(MODULE.ID, key) }, { value }));
    await Promise.all(changed.map(({ key, value }) => game.settings.set(MODULE.ID, key, value)));
    this.#draft = null;
    const reload = changed.filter(({ setting }) => setting.requiresReload);
    if (reload.length) await foundry.applications.settings.SettingsConfig.reloadConfirm({ world: reload.some(({ setting }) => setting.scope === 'world') });
  }
}
