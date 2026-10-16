import { MODULE } from '../../../constants.mjs';

/** @type {object} Blade view: slanted cards, active combatant first. */
export const bladeView = {
  templates: { strip: MODULE.TEMPLATES.DOCK.BLADE.STRIP, card: MODULE.TEMPLATES.DOCK.BLADE.CARD },
  className: 'rc-view-blade',
  order: 'activeFirst'
};
