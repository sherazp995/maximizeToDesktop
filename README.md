# Maximize To New Desktop

A KWin script (Plasma 6) that automatically moves maximized windows to their own virtual desktop and cleans up empty desktops.

## Behavior

- **Maximize a window** → Creates a new desktop and moves the window there
- **Unmaximize a window** → Moves it back to its original desktop
- **Close a window** → Removes the desktop if it's now empty (except desktop 1)
- **New app window (not maximized)** → Moves to desktop 1
- **Popups/dialogs/pickers** → Stay on the current desktop (screen sharing, file dialogs, etc.)

## Install

Copy to KWin scripts directory:

```bash
cp -r maximizeToDesktop ~/.local/share/kwin/scripts/
```

Enable in **System Settings > Window Management > KWin Scripts**, then apply.

## Reload After Changes

```bash
qdbus-qt6 org.kde.KWin /KWin reconfigure
```

Or toggle the script off/on in System Settings.

## How It Works

The script listens for `windowAdded`, `windowRemoved`, `maximizedChanged`, and `minimizedChanged` signals.

Windows are classified as:

| Type | Action |
|------|--------|
| Maximized | Move to a new desktop |
| Popup / dialog / child window | Stay on current desktop |
| Independent non-maximized app | Move to desktop 1 |
| System windows (plasmashell, krunner, etc.) | Ignored |

Popup detection uses multiple signals: `transient`, `transientFor`, `modal`, `dialog`, window size relative to screen (<60%), and known resource classes (portal, pinentry, polkit).

## Debug

View script logs:

```bash
journalctl --user -u plasma-kwin_wayland -f | grep -E "➕|➖|ℹ️|❌|➡️"
```

## License

GPLv3
