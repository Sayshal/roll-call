import { MODULE } from './constants.mjs';
import { RollCallSettings } from './features/_module.mjs';

const { ArrayField, BooleanField, ColorField, FilePathField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Display mode field for one dock card element.
 * @param {string} label Element label key.
 * @param {string} initial Default mode.
 * @returns {StringField} Mode field.
 */
function displayModeField(label, initial) {
  return new StringField({ label, initial, required: true, blank: false, choices: { never: 'ROLLCALL.Dock.Mode.Never', hover: 'ROLLCALL.Dock.Mode.Hover', always: 'ATLAS.Common.Always' } });
}

/**
 * What players see of combatants they don't own with one token disposition.
 * @param {string} label Disposition label key.
 * @param {{name: boolean, health: string, initiative: boolean, effects: boolean}} initial Defaults.
 * @returns {SchemaField} Rule field.
 */
function privacyRuleField(label, initial) {
  return new SchemaField(
    {
      name: new BooleanField({ label: 'ATLAS.Common.Name', initial: initial.name }),
      health: new StringField({
        label: 'ROLLCALL.Dock.Element.Health',
        initial: initial.health,
        required: true,
        blank: false,
        choices: { exact: 'ROLLCALL.Privacy.Health.Exact', estimate: 'ROLLCALL.Privacy.Health.Estimate', hidden: 'ATLAS.Common.Hidden' }
      }),
      initiative: new BooleanField({ label: 'ROLLCALL.Dock.Element.Initiative', initial: initial.initiative }),
      effects: new BooleanField({ label: 'ROLLCALL.Dock.Element.Effects', initial: initial.effects })
    },
    { label }
  );
}

/**
 * Register all module settings and the settings panel.
 */
export function registerSettings() {
  const r = (namespace, key, data) => game.settings.register(namespace, key, data.scope === 'world' ? { ...data, config: false } : data);
  const isDnd5e = game.system.id === 'dnd5e';
  for (const key of isDnd5e ? [MODULE.SETTINGS.INITIATIVE_GROUP, MODULE.SETTINGS.AUTO_DEFEAT] : [MODULE.SETTINGS.SUMMON_LINES]) RollCallSettings.hidden.add(key);
  game.settings.registerMenu(MODULE.ID, MODULE.SETTINGS.SETTINGS_PANEL, {
    name: 'ROLLCALL.Settings.Panel.Name',
    hint: 'ROLLCALL.Settings.Panel.Hint',
    label: 'ROLLCALL.Settings.Panel.Label',
    icon: 'fa-solid fa-swords',
    type: RollCallSettings,
    restricted: false
  });

  r(MODULE.ID, MODULE.SETTINGS.DOCK_ENABLED, {
    name: 'ROLLCALL.Settings.DockEnabled.Name',
    hint: 'ROLLCALL.Settings.DockEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.CARD_ELEMENTS, {
    name: 'ROLLCALL.Settings.CardElements.Name',
    hint: 'ROLLCALL.Settings.CardElements.Hint',
    scope: 'world',
    type: new SchemaField({
      name: displayModeField('ATLAS.Common.Name', 'always'),
      health: displayModeField('ROLLCALL.Dock.Element.Health', 'always'),
      initiative: displayModeField('ROLLCALL.Dock.Element.Initiative', 'always'),
      effects: displayModeField('ROLLCALL.Dock.Element.Effects', 'never')
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_HIDDEN, {
    name: 'ROLLCALL.Settings.DockHidden.Name',
    hint: 'ROLLCALL.Settings.DockHidden.Hint',
    scope: 'client',
    config: true,
    type: new BooleanField({ initial: false })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_VIEW, {
    name: 'ROLLCALL.Settings.DockView.Name',
    hint: 'ROLLCALL.Settings.DockView.Hint',
    scope: 'client',
    config: true,
    type: new StringField({ initial: 'blade', required: true, blank: false, choices: { blade: 'ROLLCALL.View.Blade', codex: 'ROLLCALL.View.Codex' } })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_ART, {
    name: 'ROLLCALL.Settings.DockArt.Name',
    hint: 'ROLLCALL.Settings.DockArt.Hint',
    scope: 'client',
    config: true,
    type: new StringField({ initial: 'token', required: true, blank: false, choices: { token: 'ROLLCALL.Settings.DockArt.Token', portrait: 'ROLLCALL.Settings.DockArt.Portrait' } })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_MINIMAL, {
    name: 'ROLLCALL.Settings.DockMinimal.Name',
    hint: 'ROLLCALL.Settings.DockMinimal.Hint',
    scope: 'client',
    config: true,
    type: new BooleanField({ initial: false })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_LOCKED, {
    name: 'ROLLCALL.Settings.DockLocked.Name',
    hint: 'ROLLCALL.Settings.DockLocked.Hint',
    scope: 'world',
    type: new BooleanField({ initial: false })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_PLACEMENT, {
    scope: 'user',
    config: false,
    type: new SchemaField({
      edge: new StringField({ initial: 'top', choices: ['top', 'bottom', 'left', 'right', 'float'] }),
      offset: new NumberField({ initial: 0.5, min: 0, max: 1 }),
      x: new NumberField({ initial: 0.5, min: 0, max: 1 }),
      y: new NumberField({ initial: 0.5, min: 0, max: 1 }),
      vertical: new BooleanField({ initial: false })
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_SCALE, {
    name: 'ROLLCALL.Settings.DockScale.Name',
    hint: 'ROLLCALL.Settings.DockScale.Hint',
    scope: 'user',
    config: true,
    type: new NumberField({ initial: 1, min: 0.5, max: 1.5, step: 0.05 })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_TUCK, {
    name: 'ROLLCALL.Settings.DockTuck.Name',
    hint: 'ROLLCALL.Settings.DockTuck.Hint',
    scope: 'client',
    config: true,
    type: new StringField({
      initial: 'off',
      required: true,
      blank: false,
      choices: { off: 'ROLLCALL.Settings.DockTuck.Off', crowded: 'ROLLCALL.Settings.DockTuck.Crowded', always: 'ROLLCALL.Settings.DockTuck.Always' }
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_STACKS, {
    name: 'ROLLCALL.Settings.DockStacks.Name',
    hint: 'ROLLCALL.Settings.DockStacks.Hint',
    scope: 'world',
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.DOCK_FORCED_EDGE, {
    name: 'ROLLCALL.Settings.DockForcedEdge.Name',
    hint: 'ROLLCALL.Settings.DockForcedEdge.Hint',
    scope: 'world',
    type: new StringField({
      initial: '',
      blank: true,
      choices: { '': 'ATLAS.Common.None', top: 'ROLLCALL.Dock.Edge.Top', bottom: 'ROLLCALL.Dock.Edge.Bottom', left: 'ROLLCALL.Dock.Edge.Left', right: 'ROLLCALL.Dock.Edge.Right' }
    })
  });

  r(MODULE.ID, MODULE.SETTINGS.TURN_DURATION, {
    name: 'ROLLCALL.Settings.TurnDuration.Name',
    hint: 'ROLLCALL.Settings.TurnDuration.Hint',
    scope: 'world',
    type: new NumberField({ initial: 60, min: 0, max: 600, step: 5, integer: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.TURN_EXPIRY, {
    name: 'ROLLCALL.Settings.TurnExpiry.Name',
    hint: 'ROLLCALL.Settings.TurnExpiry.Hint',
    scope: 'world',
    type: new StringField({
      initial: 'nothing',
      required: true,
      blank: false,
      choices: { nothing: 'ATLAS.Common.None', nudge: 'ROLLCALL.Nudge.Action', endTurn: 'COMBAT.TurnEnd' }
    }),
    requiresReload: true
  });

  r(MODULE.ID, MODULE.SETTINGS.PRIVACY_ENABLED, {
    name: 'ROLLCALL.Settings.PrivacyEnabled.Name',
    hint: 'ROLLCALL.Settings.PrivacyEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.PRIVACY_RULES, {
    name: 'ROLLCALL.Settings.PrivacyRules.Name',
    hint: 'ROLLCALL.Settings.PrivacyRules.Hint',
    scope: 'world',
    type: new SchemaField({
      friendly: privacyRuleField('TOKEN.DISPOSITION.FRIENDLY', { name: true, health: 'exact', initiative: true, effects: true }),
      neutral: privacyRuleField('TOKEN.DISPOSITION.NEUTRAL', { name: true, health: 'estimate', initiative: true, effects: true }),
      hostile: privacyRuleField('TOKEN.DISPOSITION.HOSTILE', { name: false, health: 'estimate', initiative: true, effects: false }),
      secret: privacyRuleField('TOKEN.DISPOSITION.SECRET', { name: false, health: 'hidden', initiative: false, effects: false })
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.NAME_MASK, {
    name: 'ROLLCALL.Settings.NameMask.Name',
    hint: 'ROLLCALL.Settings.NameMask.Hint',
    scope: 'world',
    type: new StringField({
      initial: 'generic',
      required: true,
      blank: false,
      choices: { generic: 'ROLLCALL.Privacy.Mask.Generic', token: 'ROLLCALL.Privacy.Mask.Token', actor: 'ROLLCALL.Privacy.Mask.Actor' }
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.HIDE_UNTIL_SEEN, {
    name: 'ROLLCALL.Settings.HideUntilSeen.Name',
    hint: 'ROLLCALL.Settings.HideUntilSeen.Hint',
    scope: 'world',
    type: new BooleanField({ initial: false })
  });

  r(MODULE.ID, MODULE.SETTINGS.HEALTH_ESTIMATE_ENABLED, {
    name: 'ROLLCALL.Settings.HealthEstimateEnabled.Name',
    hint: 'ROLLCALL.Settings.HealthEstimateEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.HEALTH_BUCKETS, {
    name: 'ROLLCALL.Settings.HealthBuckets.Name',
    hint: 'ROLLCALL.Settings.HealthBuckets.Hint',
    scope: 'world',
    type: new SchemaField({
      buckets: new ArrayField(
        new SchemaField({
          label: new StringField({ label: 'ATLAS.Common.Label', required: true, blank: true, initial: '' }),
          threshold: new NumberField({ label: 'ROLLCALL.Health.Threshold', required: true, nullable: false, integer: true, min: 0, max: 100, initial: 100 }),
          color: new ColorField({ label: 'ATLAS.Common.Color', nullable: true, initial: null })
        }),
        {
          initial: [
            { label: 'ROLLCALL.Health.Bucket.Down', threshold: 0 },
            { label: 'ROLLCALL.Health.Bucket.Critical', threshold: 25 },
            { label: 'ROLLCALL.Health.Bucket.Bloodied', threshold: 50 },
            { label: 'ROLLCALL.Health.Bucket.Injured', threshold: 99 },
            { label: 'ROLLCALL.Health.Bucket.Unharmed', threshold: 100 }
          ]
        }
      )
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.HEALTH_CANVAS, {
    name: 'ROLLCALL.Settings.HealthCanvas.Name',
    hint: 'ROLLCALL.Settings.HealthCanvas.Hint',
    scope: 'world',
    type: displayModeField(undefined, 'hover')
  });
  r(MODULE.ID, MODULE.SETTINGS.HEALTH_SCALE, {
    name: 'ROLLCALL.Settings.HealthScale.Name',
    hint: 'ROLLCALL.Settings.HealthScale.Hint',
    scope: 'user',
    config: true,
    type: new NumberField({ initial: 1, min: 0.5, max: 3, step: 0.05 })
  });

  r(MODULE.ID, MODULE.SETTINGS.REMINDERS_ENABLED, {
    name: 'ROLLCALL.Settings.RemindersEnabled.Name',
    hint: 'ROLLCALL.Settings.RemindersEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.REMINDER_BANNER, {
    name: 'ROLLCALL.Settings.ReminderBanner.Name',
    hint: 'ROLLCALL.Settings.ReminderBanner.Hint',
    scope: 'client',
    config: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.REMINDER_GLOW, {
    name: 'ROLLCALL.Settings.ReminderGlow.Name',
    hint: 'ROLLCALL.Settings.ReminderGlow.Hint',
    scope: 'client',
    config: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.REMINDER_PAN, {
    name: 'ROLLCALL.Settings.ReminderPan.Name',
    hint: 'ROLLCALL.Settings.ReminderPan.Hint',
    scope: 'client',
    config: true,
    type: new BooleanField({ initial: false })
  });
  r(MODULE.ID, MODULE.SETTINGS.SELECT_ACTIVE_TOKEN, {
    name: 'ROLLCALL.Settings.SelectActiveToken.Name',
    hint: 'ROLLCALL.Settings.SelectActiveToken.Hint',
    scope: 'client',
    config: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.ON_DECK_MARKER, {
    name: 'ROLLCALL.Settings.OnDeckMarker.Name',
    hint: 'ROLLCALL.Settings.OnDeckMarker.Hint',
    scope: 'world',
    type: new StringField({
      initial: 'arc',
      required: true,
      blank: false,
      choices: { off: 'ATLAS.Common.Off', arc: 'ROLLCALL.Settings.OnDeckMarker.Arc', ring: 'ROLLCALL.Settings.OnDeckMarker.Ring' }
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.ON_DECK_LABEL, {
    name: 'ROLLCALL.Settings.OnDeckLabel.Name',
    hint: 'ROLLCALL.Settings.OnDeckLabel.Hint',
    scope: 'world',
    type: new StringField({ initial: 'blade', required: true, blank: false, choices: { off: 'ATLAS.Common.Off', blade: 'ROLLCALL.View.Blade', codex: 'ROLLCALL.View.Codex' } })
  });
  r(MODULE.ID, MODULE.SETTINGS.ON_DECK_FONT_COLOR, {
    name: 'ROLLCALL.Settings.OnDeckFontColor.Name',
    hint: 'ROLLCALL.Settings.OnDeckFontColor.Hint',
    scope: 'world',
    type: new ColorField({ nullable: true, initial: null })
  });
  r(MODULE.ID, MODULE.SETTINGS.ON_DECK_BACKGROUND_COLOR, {
    name: 'ROLLCALL.Settings.OnDeckBackgroundColor.Name',
    hint: 'ROLLCALL.Settings.OnDeckBackgroundColor.Hint',
    scope: 'world',
    type: new ColorField({ nullable: true, initial: null })
  });
  r(MODULE.ID, MODULE.SETTINGS.ON_DECK_OUTLINE_COLOR, {
    name: 'ROLLCALL.Settings.OnDeckOutlineColor.Name',
    hint: 'ROLLCALL.Settings.OnDeckOutlineColor.Hint',
    scope: 'world',
    type: new ColorField({ nullable: true, initial: null })
  });
  r(MODULE.ID, MODULE.SETTINGS.ON_DECK_IMAGE, {
    name: 'ROLLCALL.Settings.OnDeckImage.Name',
    hint: 'ROLLCALL.Settings.OnDeckImage.Hint',
    scope: 'world',
    type: new FilePathField({ categories: ['IMAGE'], nullable: true, initial: null })
  });

  r(MODULE.ID, MODULE.SETTINGS.NUDGE_ENABLED, {
    name: 'ROLLCALL.Settings.NudgeEnabled.Name',
    hint: 'ROLLCALL.Settings.NudgeEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });

  r(MODULE.ID, MODULE.SETTINGS.INITIATIVE_AUTO_ROLL, {
    name: 'ROLLCALL.Settings.InitiativeAutoRoll.Name',
    hint: 'ROLLCALL.Settings.InitiativeAutoRoll.Hint',
    scope: 'world',
    type: new BooleanField({ initial: false })
  });
  r(MODULE.ID, MODULE.SETTINGS.INITIATIVE_FREEZE, {
    name: 'ROLLCALL.Settings.InitiativeFreeze.Name',
    hint: 'ROLLCALL.Settings.InitiativeFreeze.Hint',
    scope: 'world',
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.INITIATIVE_REVERSE, {
    name: 'ROLLCALL.Settings.InitiativeReverse.Name',
    hint: 'ROLLCALL.Settings.InitiativeReverse.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: false })
  });
  r(MODULE.ID, MODULE.SETTINGS.INITIATIVE_GROUP, {
    name: 'ROLLCALL.Settings.InitiativeGroup.Name',
    hint: 'ROLLCALL.Settings.InitiativeGroup.Hint',
    scope: 'world',
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.BULK_ADD_ENABLED, {
    name: 'ROLLCALL.Settings.BulkAddEnabled.Name',
    hint: 'ROLLCALL.Settings.BulkAddEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });

  r(MODULE.ID, MODULE.SETTINGS.VS_SCREEN, {
    name: 'ROLLCALL.Settings.VsScreen.Name',
    hint: 'ROLLCALL.Settings.VsScreen.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.LINK_SCENE, {
    name: 'ROLLCALL.Settings.LinkScene.Name',
    hint: 'ROLLCALL.Settings.LinkScene.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.LAIR_PROMPT, {
    name: 'ROLLCALL.Settings.LairPrompt.Name',
    hint: 'ROLLCALL.Settings.LairPrompt.Hint',
    scope: 'world',
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.ROUND_EVENTS_ENABLED, {
    name: 'ROLLCALL.Settings.RoundEventsEnabled.Name',
    hint: 'ROLLCALL.Settings.RoundEventsEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.TARGET_ICONS, {
    name: 'ROLLCALL.Settings.TargetIcons.Name',
    hint: 'ROLLCALL.Settings.TargetIcons.Hint',
    scope: 'world',
    type: new BooleanField({ initial: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.SUMMON_LINES, {
    name: 'ROLLCALL.Settings.SummonLines.Name',
    hint: 'ROLLCALL.Settings.SummonLines.Hint',
    scope: 'world',
    requiresReload: true,
    type: displayModeField(undefined, 'hover')
  });
  r(MODULE.ID, MODULE.SETTINGS.AUTO_DEFEAT, {
    name: 'ROLLCALL.Settings.AutoDefeat.Name',
    hint: 'ROLLCALL.Settings.AutoDefeat.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: false })
  });

  r(MODULE.ID, MODULE.SETTINGS.FOCUS_ENABLED, {
    name: 'ROLLCALL.Settings.FocusEnabled.Name',
    hint: 'ROLLCALL.Settings.FocusEnabled.Hint',
    scope: 'world',
    requiresReload: true,
    type: new BooleanField({ initial: false })
  });
  r(MODULE.ID, MODULE.SETTINGS.FOCUS_ELEMENTS, {
    name: 'ROLLCALL.Settings.FocusElements.Name',
    hint: 'ROLLCALL.Settings.FocusElements.Hint',
    scope: 'world',
    type: new SchemaField({
      sceneNavigation: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.SceneNavigation', initial: true }),
      players: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.Players', initial: true }),
      sceneControls: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.SceneControls', initial: true }),
      hotbar: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.Hotbar', initial: false }),
      cameraViews: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.CameraViews', initial: false }),
      chatTab: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.ChatTab', initial: true }),
      sidebarTabs: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.SidebarTabs', initial: true }),
      closeSheets: new BooleanField({ label: 'ROLLCALL.FocusMode.Element.CloseSheets', initial: true })
    })
  });
  r(MODULE.ID, MODULE.SETTINGS.FOCUS_SELECTORS, {
    name: 'ROLLCALL.Settings.FocusSelectors.Name',
    hint: 'ROLLCALL.Settings.FocusSelectors.Hint',
    scope: 'world',
    type: new StringField({ initial: '', blank: true })
  });
  r(MODULE.ID, MODULE.SETTINGS.FOCUS_ON_DEVICE, {
    name: 'ROLLCALL.Settings.FocusOnDevice.Name',
    hint: 'ROLLCALL.Settings.FocusOnDevice.Hint',
    scope: 'client',
    config: true,
    type: new BooleanField({ initial: true })
  });

  r(MODULE.ID, MODULE.SETTINGS.HIDE_COMBAT_TAB, {
    name: 'ROLLCALL.Settings.HideCombatTab.Name',
    hint: 'ROLLCALL.Settings.HideCombatTab.Hint',
    scope: 'world',
    type: new BooleanField({ initial: false })
  });
  game.settings.registerMenu(MODULE.ID, MODULE.SETTINGS.COMBAT_CONFIG_MENU, {
    name: 'ROLLCALL.Settings.CombatConfig.Name',
    hint: 'ROLLCALL.Settings.CombatConfig.Hint',
    label: 'ROLLCALL.Settings.CombatConfig.Label',
    icon: 'fa-solid fa-swords',
    type: foundry.applications.apps.CombatTrackerConfig,
    restricted: false
  });
}
