import { MODULE } from '../constants.mjs';

const { createFontAwesomeIcon } = foundry.applications.fields;
const { ArrayField, SchemaField, StringField } = foundry.data.fields;

/**
 * Run a callback when one of the given settings changes.
 * @param {string[]} keys Roll Call setting keys, or full `namespace.key` ids for other packages' settings.
 * @param {Function} callback Receives the changed setting's full id.
 */
export function onSettingChange(keys, callback) {
  const ids = new Set(keys.map((key) => (key.includes('.') ? key : `${MODULE.ID}.${key}`)));
  const run = (id) => ids.has(id) && callback(id);
  Hooks.on('clientSettingChanged', run);
  for (const hook of ['createSetting', 'updateSetting']) Hooks.on(hook, (setting) => run(setting.key));
}

/**
 * Form markup for a setting field.
 * @param {foundry.data.fields.DataField} field The field.
 * @param {string} name Dotted input name.
 * @param {*} value Current value.
 * @param {string} [rootId] Id prefix for the inputs, so each label points at its input.
 * @returns {HTMLElement} Form group or fieldset.
 */
export function settingFormGroup(field, name, value, rootId) {
  if (field instanceof ArrayField) return rows(field.element, name, value);
  if (!(field instanceof SchemaField)) return field.toFormGroup({ rootId, localize: true }, { name, value: shown(field, value), localize: true });
  const fieldset = document.createElement('fieldset');
  if (field.label) fieldset.append(Object.assign(document.createElement('legend'), { textContent: _loc(field.label) }));
  fieldset.append(...Object.entries(field.fields).map(([key, child]) => settingFormGroup(child, `${name}.${key}`, value?.[key], rootId)));
  return fieldset;
}

/**
 * A schema setting's value from expanded form data, with every array given as a list, empty when all its rows were removed.
 * @param {SchemaField} schema The setting's schema.
 * @param {object} data Expanded form data for the setting.
 * @returns {object} Setting value.
 */
export function settingValue(schema, data = {}) {
  const value = { ...data };
  for (const [key, field] of Object.entries(schema.fields)) if (field instanceof ArrayField) value[key] = Object.values(value[key] ?? {});
  return value;
}

/**
 * A submitted value with localized text put back to its stored key.
 * @param {*} value Submitted value.
 * @param {*} stored Stored value.
 * @returns {*} Value to save.
 */
export function keepKeys(value, stored) {
  if (typeof value === 'string') return typeof stored === 'string' && _loc(stored) === value ? stored : value;
  if (!value || typeof value !== 'object' || !stored || typeof stored !== 'object') return value;
  const result = Array.isArray(value) ? [] : {};
  for (const [key, entry] of Object.entries(value)) result[key] = keepKeys(entry, stored[key]);
  return result;
}

/**
 * A header of column labels, one input row per entry with a remove button, and an add button.
 * @param {SchemaField} element Schema of one row.
 * @param {string} name Input name of the array.
 * @param {object[]} entries Current rows.
 * @returns {HTMLFieldSetElement} Rows fieldset.
 */
function rows(element, name, entries = []) {
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'rc-rows';
  fieldset.style.setProperty('--roll-call-row-fields', Object.keys(element.fields).length);
  const header = document.createElement('div');
  header.className = 'rc-row rc-row-header';
  header.append(...Object.values(element.fields).map((field) => Object.assign(document.createElement('span'), { textContent: _loc(field.label) })), document.createElement('span'));
  const lines = entries.map((entry, index) => {
    const line = document.createElement('div');
    line.className = 'rc-row';
    const inputs = Object.entries(element.fields).map(([key, field]) => field.toInput({ name: `${name}.${index}.${key}`, value: shown(field, entry[key]), localize: true }));
    const remove = button('removeRow', 'trash', 'ATLAS.Common.Remove', name);
    remove.dataset.index = index;
    line.append(...inputs, remove);
    return line;
  });
  const add = button('addRow', 'plus', 'ATLAS.Common.Add', name);
  add.append(_loc('ATLAS.Common.Add'));
  fieldset.append(header, ...lines, add);
  return fieldset;
}

/**
 * Value as shown in an input.
 * @param {foundry.data.fields.DataField} field The field.
 * @param {*} value Stored value.
 * @returns {*} Display value.
 */
function shown(field, value) {
  return field instanceof StringField && !field.choices && typeof value === 'string' ? _loc(value) : value;
}

/**
 * Icon button bound to a row action.
 * @param {string} action Action name.
 * @param {string} icon Font Awesome icon name.
 * @param {string} label Accessible label key.
 * @param {string} name Input name of the array it edits.
 * @returns {HTMLButtonElement} Button.
 */
function button(action, icon, label, name) {
  const element = document.createElement('button');
  element.type = 'button';
  element.dataset.action = action;
  element.dataset.name = name;
  element.dataset.tooltip = '';
  element.ariaLabel = _loc(label);
  element.append(createFontAwesomeIcon(icon));
  return element;
}
