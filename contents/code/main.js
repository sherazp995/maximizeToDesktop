// maximizeToDesktop - KWin script for Plasma 6
var previousDesktops = new Map();
var clients = new Set();

// ignore list helper
function isIgnoredWindow(client) {
    if (!client) return true;
    var rc = (client.resourceClass || "").toLowerCase();

    var ignored = ["lattedock", "latte-dock", "org.kde.spectacle", 'kwin', 'kwin_wayland', 'ksmserver-logout-greeter', 'ksmserver',
                    'kscreenlocker_greet', 'ksplash', 'ksplashqml', 'plasmashell', 'org.kde.plasmashell', 'krunner',
                    'xdg-desktop-portal', 'xdg-desktop-portal-kde', 'xdg-desktop-portal-gnome'];
    for (var i = 0; i < ignored.length; i++) {
        var name = ignored[i];
        if (rc.indexOf(name) !== -1) {
            return true;
        }
    }
    return false;
}

// Check if a window is a popup/child that should stay on the current desktop
function isPopupOrChild(client) {
    if (!client) return true;

    // Has a parent window — it's a child dialog/popup
    if (client.transient || client.transientFor) return true;

    // Modal windows (e.g. "Save As", confirmations)
    if (client.modal) return true;

    // Explicit dialog/popup/utility types
    if (client.dialog || client.popupWindow || client.utility) return true;
    if (client.splash || client.dropdownMenu || client.popupMenu || client.comboBox) return true;
    if (client.tooltip || client.notification || client.criticalNotification) return true;
    if (client.onScreenDisplay || client.appletPopup || client.dndIcon) return true;

    // Small windows relative to screen are likely dialogs/pickers
    // (screen sharing picker, file dialogs, color pickers, etc.)
    try {
        var area = workspace.clientArea(KWin.MaximizeArea, client);
        var widthRatio = client.width / area.width;
        var heightRatio = client.height / area.height;
        // If window is less than 60% of screen in both dimensions, treat as popup
        if (widthRatio < 0.6 && heightRatio < 0.6) {
            print("ℹ️ Small window '" + client.caption + "' (" + Math.round(widthRatio*100) + "x" + Math.round(heightRatio*100) + "%), treating as popup");
            return true;
        }
    } catch (e) {}

    // Check resource class for known dialog-spawning processes
    var rc = (client.resourceClass || "").toLowerCase();
    var dialogClasses = ["portal", "pinentry", "polkit", "gcr-prompter", "ssh-askpass"];
    for (var i = 0; i < dialogClasses.length; i++) {
        if (rc.indexOf(dialogClasses[i]) !== -1) return true;
    }

    return false;
}

// Connect to signals
try {
    workspace.windowAdded.connect(handleNewClient);
    workspace.windowRemoved.connect(handleWindowRemoved);
} catch (e) {
    print("❌ Error connecting to signals: " + e);
}

function handleNewClient(client) {
    // skip ignored windows (latte dock, spectacle, etc.)
    if (isIgnoredWindow(client)) return;

    if (!client ||
        !client.normalWindow ||
        client.specialWindow ||
        client.desktopWindow ||
        client.dock ||
        client.toolbar ||
        client.menu ||
        client.notification ||
        client.appletPopup ||
        client.popupMenu
    ) return;

    clients.add(client);
    // Save initial desktop
    previousDesktops.set(client, client.desktops?.[0]);

    // Listen for maximize changes
    try {
        if (typeof client.maximizedChanged !== 'undefined') {
            client.maximizedChanged.connect(function() {
                handleMaximizeChange(client);
            });
        }

        if (typeof client.minimizedChanged !== 'undefined') {
            client.minimizedChanged.connect(function() {
                handleMinimizeChange(client);
            });
        }

        if (client.width >= workspace.clientArea(KWin.MaximizeArea, client).width &&
            client.height >= workspace.clientArea(KWin.MaximizeArea, client).height) {
            moveToNewDesktop(client);
        } else if (isPopupOrChild(client)) {
            // Popups/dialogs/children stay on the CURRENT desktop (don't move them)
            print("ℹ️ Popup/child window '" + client.caption + "' stays on current desktop");
        } else {
            // Only independent, non-maximized app windows go to desktop 1
            var firstDesk = workspace.desktops[0];
            client.desktops = [firstDesk];
            workspace.currentDesktop = firstDesk;
            print("➡️ New app window '" + client.caption + "' moved to desktop 1");
        }
    } catch (e) {
        print("❌ Error connecting to maximize signal: " + e);
    }
}

function handleWindowRemoved(client) {
    if (!client || !client.normalWindow) return;

    // ensure ignored windows are not processed
    if (isIgnoredWindow(client)) return;

    clients.delete(client);
    previousDesktops.delete(client);
    cleanupEmptyDesktops();
}

function handleMaximizeChange(client) {
    // Check if window is fully maximized by checking both dimensions
    if (client.width >= workspace.clientArea(KWin.MaximizeArea, client).width &&
        client.height >= workspace.clientArea(KWin.MaximizeArea, client).height) {
        previousDesktops.set(client, client.desktops?.[0]);
        moveToNewDesktop(client);
    } else {
        moveToOldDesktop(client);
    }
}

function handleMinimizeChange(client) {
    if (client.minimized) {
        moveToOldDesktop(client);
    } else {
        handleMaximizeChange(client);
    }
}

function moveToOldDesktop(client) {
    if (previousDesktops.has(client)) {
        var oldDesk = previousDesktops.get(client);
        if (oldDesk.x11DesktopNumber > 0) {
            client.desktops = [oldDesk];
            workspace.currentDesktop = oldDesk;
            cleanupEmptyDesktops();
        }
    }
}

function moveToNewDesktop(client) {
    if (!client) return;

    try {
        var currentDesktop = workspace.currentDesktop;
        var currentDesktopNumber = currentDesktop.x11DesktopNumber;
        var desktops = workspace.desktops;
        let _windowId = client.internalId.toString();

        // Don't move if already on a higher desktop
        if (client.desktops.length > 0 && client.desktops[0].x11DesktopNumber > currentDesktopNumber) {
            print("ℹ️ Already on desktop " + client.desktops[0].x11DesktopNumber + ", skipping move");
            return;
        }

        // Create new desktop after current one
        var newPosition = currentDesktopNumber; // Insert after current desktop
        workspace.createDesktop(newPosition, client.caption);

        // Get the newly created desktop from updated desktops list
        desktops = workspace.desktops; // Refresh list
        var newDesktop = desktops[newPosition]; // Get desktop at the position we created

        if (newDesktop) {
            // Move window to the new desktop
            client.desktops = [newDesktop];
            // Switch to new desktop
            workspace.currentDesktop = newDesktop;
            print("➕ Created and moved to desktop " + newDesktop.x11DesktopNumber);
        } else {
            print("❌ Failed to get new desktop reference");
        }

    } catch (e) {
        print("❌ Error moving desktop: " + e);
    }
}

function cleanupEmptyDesktops() {
    try {
        var desktops = workspace.desktops;
        if (desktops.length <= 1) {
            print("ℹ️ Only one desktop, no cleanup needed");
            return;
        }

        var openClients = Array.from(clients);
        print("🔍 Checking " + openClients.length + " clients across " + desktops.length + " desktops");

        // Check each desktop from the last to the second
        for (var i = desktops.length - 1; i > 0; i--) {
            var desktop = desktops[i];
            var hasWindows = false;

            for (var j = 0; j < openClients.length; j++) {
                if (openClients[j].desktops.includes(desktop)) {
                    hasWindows = true;
                    break;
                }
            }

            if (!hasWindows) {
                workspace.removeDesktop(desktop);
                print("➖ Removed empty desktop: " + (i + 1));
            } else {
                print("ℹ️ Desktop " + (i + 1) + " has windows, keeping it");
            }
        }
    } catch (e) {
        print("❌ Error cleaning desktops: " + e);
    }
}
