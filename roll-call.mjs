import { getAdapter, resolveAdapter } from './scripts/adapters/registry.mjs';
import { createGlobalNamespace, RollCallAPI } from './scripts/api.mjs';
import { MODULE } from './scripts/constants.mjs';
import {
  AutoDefeat,
  BulkAdd,
  CoreSettings,
  FocusMode,
  HealthEstimate,
  Initiative,
  Keybindings,
  LairActions,
  Nudge,
  Privacy,
  RollCallDock,
  RoundEvents,
  SceneLink,
  SidebarTab,
  SummonLines,
  TurnMarkers,
  TurnReminders,
  TurnTimer,
  VsScreen
} from './scripts/features/_module.mjs';
import { registerSettings } from './scripts/settings.mjs';
import { registerCombatClock, registerNudge } from './scripts/utils/_module.mjs';
import './styles/announce.css';
import './styles/dock.css';
import './styles/roll-call.css';
import './styles/settings.css';
import './styles/vs.css';
import './styles/views/blade.css';
import './styles/views/codex.css';

/**
 * ATLAS troubleshooter debug lines.
 * @returns {string[]} Markdown lines.
 */
function troubleshooterDebug() {
  return [`Adapter: ${getAdapter().id}`];
}

Hooks.once('init', () => {
  const atlas = ATLAS.register(MODULE.ID, {
    title: MODULE.NAME,
    github: 'Sayshal/roll-call',
    theme: { scope: '.roll-call', default: 'heromancer', apps: { dock: { label: 'ROLLCALL.Dock.Name', selector: '.rc-dock' } } },
    events: [{ name: MODULE.RELAY.REVEAL, gmAuthoritative: true }, MODULE.RELAY.NUDGE, MODULE.RELAY.VS, MODULE.RELAY.EVENT],
    debug: troubleshooterDebug
  });
  registerSettings();
  registerCombatClock();
  registerNudge(atlas);
  RollCallDock.register();
  Privacy.register(atlas);
  HealthEstimate.register();
  SidebarTab.register();
  CoreSettings.register();
  TurnMarkers.register();
  TurnReminders.register();
  TurnTimer.register();
  Nudge.register();
  Keybindings.register();
  LairActions.register();
  Initiative.register();
  BulkAdd.register();
  FocusMode.register();
  RoundEvents.register(atlas);
  SceneLink.register();
  VsScreen.register(atlas);
  SummonLines.register();
  AutoDefeat.register();
  createGlobalNamespace();
});

Hooks.once('setup', () => {
  resolveAdapter(RollCallAPI);
  Initiative.patchSort();
  Privacy.patchCore();
});

Hooks.once('ready', () => {
  Hooks.callAll(MODULE.HOOKS.READY, MODULE);
});
