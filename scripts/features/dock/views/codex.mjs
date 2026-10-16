import { MODULE } from '../../../constants.mjs';

/** @type {object} Codex view: arched cards in fixed turn order, the active card rising in place. */
export const codexView = {
  templates: { strip: MODULE.TEMPLATES.DOCK.CODEX.STRIP, card: MODULE.TEMPLATES.DOCK.CODEX.CARD },
  className: 'rc-view-codex',
  order: 'fixed'
};
