import AppKit

final class WindowService {
    func bringAllToFront() {
        NSApplication.shared.windows.forEach { window in
            window.makeKeyAndOrderFront(nil)
        }
        NSApplication.shared.activate(ignoringOtherApps: true)
    }
}
