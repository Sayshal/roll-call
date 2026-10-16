# Roll Call

Keep your eyes on the fight.

Roll Call puts initiative front and center with a customizable combat dock, clear turn reminders, and a pile of tools to keep combat moving. Give your players a better view of the action and yourself a little less to juggle.

![The Roll Call combat dock](https://wiki.3deathsaves.com/roll-call/hero.png)

![GitHub release](https://img.shields.io/github/v/release/Sayshal/roll-call?style=for-the-badge)
![GitHub Downloads (specific asset, all releases)](<https://img.shields.io/github/downloads/Sayshal/roll-call/module.zip?style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Total)&color=ff144f>)

![Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FSayshal%2Froll-call%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
[![Discord](https://dcbadge.limes.pink/api/server/PzzUwU9gdz)](https://discord.gg/PzzUwU9gdz)

**[Read the Wiki](https://wiki.3deathsaves.com/roll-call/)** for guides, the full settings reference, and the adapter API.

---

## What You Get

**A combat dock.** Keep the turn order on the canvas, where everyone can see it. Snap the dock to a screen edge or drag it wherever it fits, with the GM's turn controls close at hand.

![Codex dock](https://wiki.3deathsaves.com/roll-call/dock-codex.png)

**Pick your style.** Go with the arched portraits of Codex or the angled panels of Blade. Everyone can choose the look they prefer.

![Blade dock](https://wiki.3deathsaves.com/roll-call/dock-blade.png)

**Group your combatants.** Keep a squad, a group of enemies, or a summoner and their summons together on one card. It flips to whoever's acting, and Shift-clicking End Turn wraps up the whole stack.

![Stacked card and round event](https://wiki.3deathsaves.com/roll-call/stacks-events.png)

**Make turns hard to miss.** Turn banners, screen glows, token camera jumps, and an On Deck marker help everyone keep track of who's up, who's next, and whether they should probably stop checking their inventory.

![Turn banner](https://wiki.3deathsaves.com/roll-call/turn-banner.png)

![Turn and On Deck markers](https://wiki.3deathsaves.com/roll-call/turn-markers.png)

**Keep secrets secret.** Decide what players can see for each token disposition. Mask names, fade portraits, and show health as labels like Bloodied instead of giving away exact numbers.

![Player view with privacy](https://wiki.3deathsaves.com/roll-call/privacy.png)

**Plan for more than initiative.** Schedule reminders and extra turns for specific rounds, ranges like `3, 5, 6-8`, or a `1d4` roll. Lair actions and other hidden turns are right at home here, too.

**Give combat an entrance.** Start a fight with a VS screen that lines up both sides in turn order. Because sometimes initiative deserves a little drama.

![VS screen](https://wiki.3deathsaves.com/roll-call/vs-screen.png)

**One settings panel, fewer rabbit holes.** Everything lives in a tabbed panel, with GM options kept away from players and each player able to manage their own preferences.

![Settings panel](https://wiki.3deathsaves.com/roll-call/settings.png)

---

## Also Included

- **Turn clock.** Give turns a time limit, with an optional nudge or automatic end when the clock runs out.
- **Nudge.** Remind a player it's their turn with a sound, banner, and whisper. No need to call their name three times.
- **Initiative tools.** Auto-roll NPCs, hold the order until combat starts, reverse turn order, or share initiative across a group.
- **Bulk add.** Throw every token of a chosen disposition into combat in one click.
- **Legendary actions.** Track and spend legendary actions straight from the combat card.
- **Focus mode.** Hide selected interface elements from players during combat.
- **Hide until seen.** Keep NPCs out of sight until a player spots their token.

---

## For the Tinkerers

Building something that works with Roll Call? The public API is available at `ROLLCALL.api` or through `game.modules.get('roll-call').api`.

Roll Call works with any system using Foundry's tracked resources, includes a built-in D&D 5e adapter, and lets you register adapters for other systems.

```javascript
Hooks.once('rollCall.registerAdapters', (api) => {
  api.registerAdapter('my-system', {
    healthFraction: (actor) => actor.system.hp.value / actor.system.hp.max
  });
});
```

See the [Wiki](https://wiki.3deathsaves.com/roll-call/) for the full API reference.

---

## Installation

Find **Roll Call** in Foundry's Module Browser, or install it using this manifest:

```
https://github.com/Sayshal/roll-call/releases/latest/download/module.json
```

Questions, suggestions, or something behaving strangely? Join us on [Discord](https://discord.gg/PzzUwU9gdz) or check the [Wiki](https://wiki.3deathsaves.com/roll-call/).
