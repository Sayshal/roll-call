/** @enum {string} Public hook names in the rollCall namespace */
const HOOKS = {
  READY: 'rollCall.ready',
  REGISTER_ADAPTERS: 'rollCall.registerAdapters'
};

/** @enum {string} Document flag keys under the module scope */
const FLAGS = {
  AUTO_HIDDEN: 'autoHidden',
  CLOCK: 'clock',
  EVENT: 'event',
  EVENTS: 'events'
};

/** @enum {string} Hook events relayed across clients through ATLAS */
const RELAY = {
  EVENT: 'rollCall.event',
  REVEAL: 'rollCall.reveal',
  NUDGE: 'rollCall.nudge',
  VS: 'rollCall.vs'
};

/** @enum {string} Setting keys */
const SETTINGS = {
  AUTO_DEFEAT: 'autoDefeat',
  BULK_ADD_ENABLED: 'bulkAddEnabled',
  CARD_ELEMENTS: 'cardElements',
  COMBAT_CONFIG_MENU: 'combatConfigMenu',
  DOCK_ART: 'dockArt',
  DOCK_ENABLED: 'dockEnabled',
  DOCK_FORCED_EDGE: 'dockForcedEdge',
  DOCK_HIDDEN: 'dockHidden',
  DOCK_LOCKED: 'dockLocked',
  DOCK_MINIMAL: 'dockMinimal',
  DOCK_PLACEMENT: 'dockPlacement',
  DOCK_SCALE: 'dockScale',
  DOCK_STACKS: 'dockStacks',
  DOCK_TUCK: 'dockTuck',
  DOCK_VIEW: 'dockView',
  FOCUS_ELEMENTS: 'focusElements',
  FOCUS_ENABLED: 'focusEnabled',
  FOCUS_ON_DEVICE: 'focusOnDevice',
  FOCUS_SELECTORS: 'focusSelectors',
  HEALTH_BUCKETS: 'healthBuckets',
  HEALTH_CANVAS: 'healthCanvas',
  HEALTH_ESTIMATE_ENABLED: 'healthEstimateEnabled',
  HEALTH_SCALE: 'healthScale',
  HIDE_COMBAT_TAB: 'hideCombatTab',
  HIDE_UNTIL_SEEN: 'hideUntilSeen',
  INITIATIVE_AUTO_ROLL: 'initiativeAutoRoll',
  INITIATIVE_FREEZE: 'initiativeFreeze',
  INITIATIVE_GROUP: 'initiativeGroup',
  INITIATIVE_REVERSE: 'initiativeReverse',
  LAIR_PROMPT: 'lairPrompt',
  LINK_SCENE: 'linkScene',
  NAME_MASK: 'nameMask',
  NUDGE_ENABLED: 'nudgeEnabled',
  ON_DECK_BACKGROUND_COLOR: 'onDeckBackgroundColor',
  ON_DECK_FONT_COLOR: 'onDeckFontColor',
  ON_DECK_IMAGE: 'onDeckImage',
  ON_DECK_LABEL: 'onDeckLabel',
  ON_DECK_MARKER: 'onDeckMarker',
  ON_DECK_OUTLINE_COLOR: 'onDeckOutlineColor',
  PRIVACY_ENABLED: 'privacyEnabled',
  PRIVACY_RULES: 'privacyRules',
  REMINDERS_ENABLED: 'remindersEnabled',
  REMINDER_BANNER: 'reminderBanner',
  REMINDER_GLOW: 'reminderGlow',
  REMINDER_PAN: 'reminderPan',
  ROUND_EVENTS_ENABLED: 'roundEventsEnabled',
  SELECT_ACTIVE_TOKEN: 'selectActiveToken',
  SETTINGS_PANEL: 'settingsPanel',
  SUMMON_LINES: 'summonLines',
  TARGET_ICONS: 'targetIcons',
  TURN_DURATION: 'turnDuration',
  TURN_EXPIRY: 'turnExpiry',
  VS_SCREEN: 'vsScreen'
};

/** @enum {string} Keybinding action names */
const KEYBINDINGS = {
  END_TURN: 'endTurn',
  NEXT_TURN: 'nextTurn',
  PREVIOUS_TURN: 'previousTurn'
};

const TEMPLATE_ROOT = 'modules/roll-call/templates';

/** @enum {string|object} Template paths by feature */
const TEMPLATES = {
  ANNOUNCE: `${TEMPLATE_ROOT}/announce/banner.hbs`,
  VS: `${TEMPLATE_ROOT}/vs/screen.hbs`,
  DOCK: {
    EVENT: `${TEMPLATE_ROOT}/dock/_event.hbs`,
    LEGENDARY: `${TEMPLATE_ROOT}/dock/_legendary.hbs`,
    SEG: `${TEMPLATE_ROOT}/dock/_seg.hbs`,
    STACK: `${TEMPLATE_ROOT}/dock/_stack.hbs`,
    BLADE: {
      CARD: `${TEMPLATE_ROOT}/dock/views/blade/card.hbs`,
      STRIP: `${TEMPLATE_ROOT}/dock/views/blade/strip.hbs`
    },
    CODEX: {
      CARD: `${TEMPLATE_ROOT}/dock/views/codex/card.hbs`,
      STRIP: `${TEMPLATE_ROOT}/dock/views/codex/strip.hbs`
    }
  }
};

/** @type {object} Module identification and shared keys */
export const MODULE = {
  ID: 'roll-call',
  NAME: 'Roll Call',
  FLAGS,
  HOOKS,
  KEYBINDINGS,
  RELAY,
  SETTINGS,
  TEMPLATES
};
