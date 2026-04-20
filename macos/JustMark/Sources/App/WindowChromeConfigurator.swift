import AppKit
import SwiftUI

struct WindowChromeConfigurator: NSViewRepresentable {
    let isDark: Bool
    let backgroundColor: NSColor
    let titlebarAccessory: AnyView?
    let canCloseTab: () -> Bool
    let onCloseTab: () -> Void
    let shortcutBinding: (ShortcutAction) -> ShortcutBinding
    let onPerformShortcut: (ShortcutAction) -> Void

    func makeNSView(context: Context) -> NSView {
        ChromeConfigView(
            isDark: isDark,
            backgroundColor: backgroundColor,
            titlebarAccessory: titlebarAccessory,
            canCloseTab: canCloseTab,
            onCloseTab: onCloseTab,
            shortcutBinding: shortcutBinding,
            onPerformShortcut: onPerformShortcut
        )
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        guard let configView = nsView as? ChromeConfigView else { return }
        configView.updateBehaviors(
            canCloseTab: canCloseTab,
            onCloseTab: onCloseTab,
            shortcutBinding: shortcutBinding,
            onPerformShortcut: onPerformShortcut
        )
        configView.updateTitlebarAccessory(titlebarAccessory)
        configView.applyAppearance(isDark: isDark, backgroundColor: backgroundColor)
    }

    private final class ChromeConfigView: NSView {
        private final class CloseTabCommandResponder: NSResponder, NSMenuItemValidation {
            var canCloseTab: () -> Bool = { false }
            var onCloseTab: () -> Void = {}

            @objc func closeDocumentTab(_ sender: Any?) {
                guard canCloseTab() else { return }
                onCloseTab()
            }

            func validateMenuItem(_ menuItem: NSMenuItem) -> Bool {
                guard menuItem.action == #selector(closeDocumentTab(_:)) else { return true }
                return canCloseTab()
            }
        }

        private var didConfigure = false
        private var didApplyInitialAppearance = false
        private var lastIsDark: Bool?
        private var lastBackgroundColor: NSColor?
        private let closeTabResponder = CloseTabCommandResponder()
        private weak var closeMenuItem: NSMenuItem?
        private var originalNextResponder: NSResponder?
        private var shortcutBindingProvider: ((ShortcutAction) -> ShortcutBinding)?
        private var shortcutActionHandler: ((ShortcutAction) -> Void)?
        private var currentTitlebarAccessory: AnyView?
        private var titlebarAccessoryController: NSTitlebarAccessoryViewController?
        private var titlebarAccessoryHostingView: NSHostingView<AnyView>?

        init(
            isDark: Bool,
            backgroundColor: NSColor,
            titlebarAccessory: AnyView?,
            canCloseTab: @escaping () -> Bool,
            onCloseTab: @escaping () -> Void,
            shortcutBinding: @escaping (ShortcutAction) -> ShortcutBinding,
            onPerformShortcut: @escaping (ShortcutAction) -> Void
        ) {
            self.lastIsDark = isDark
            self.lastBackgroundColor = backgroundColor
            self.currentTitlebarAccessory = titlebarAccessory
            super.init(frame: .zero)
            updateBehaviors(
                canCloseTab: canCloseTab,
                onCloseTab: onCloseTab,
                shortcutBinding: shortcutBinding,
                onPerformShortcut: onPerformShortcut
            )
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override func viewDidMoveToWindow() {
            super.viewDidMoveToWindow()
            guard let window, !didConfigure else { return }
            didConfigure = true
            installCloseTabResponder()
            configure(window: window)
            installOrUpdateTitlebarAccessory(in: window)
            applyAppearance(isDark: lastIsDark ?? false, backgroundColor: lastBackgroundColor)
            configureCloseMenuItemIfNeeded()
        }

        func updateBehaviors(
            canCloseTab: @escaping () -> Bool,
            onCloseTab: @escaping () -> Void,
            shortcutBinding: @escaping (ShortcutAction) -> ShortcutBinding,
            onPerformShortcut: @escaping (ShortcutAction) -> Void
        ) {
            closeTabResponder.canCloseTab = canCloseTab
            closeTabResponder.onCloseTab = onCloseTab
            shortcutBindingProvider = shortcutBinding
            shortcutActionHandler = onPerformShortcut
            closeMenuItem?.isEnabled = canCloseTab()
            updateCloseMenuItemShortcut()
        }

        func updateTitlebarAccessory(_ titlebarAccessory: AnyView?) {
            currentTitlebarAccessory = titlebarAccessory
            guard let window else { return }
            installOrUpdateTitlebarAccessory(in: window)
        }

        private func installCloseTabResponder() {
            guard nextResponder !== closeTabResponder else { return }
            originalNextResponder = nextResponder
            closeTabResponder.nextResponder = originalNextResponder
            nextResponder = closeTabResponder
        }

        private func configure(window: NSWindow) {
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.isMovableByWindowBackground = true
            window.styleMask.insert(.fullSizeContentView)
            window.toolbarStyle = .unifiedCompact
            window.toolbar?.showsBaselineSeparator = false
        }

        private func installOrUpdateTitlebarAccessory(in window: NSWindow) {
            guard let titlebarAccessory = currentTitlebarAccessory else {
                if let controller = titlebarAccessoryController,
                   let index = window.titlebarAccessoryViewControllers.firstIndex(of: controller) {
                    window.removeTitlebarAccessoryViewController(at: index)
                }
                titlebarAccessoryController = nil
                titlebarAccessoryHostingView = nil
                return
            }

            if let hostingView = titlebarAccessoryHostingView {
                hostingView.rootView = titlebarAccessory
                hostingView.invalidateIntrinsicContentSize()
                return
            }

            let hostingView = NSHostingView(rootView: titlebarAccessory)
            let controller = NSTitlebarAccessoryViewController()
            controller.view = hostingView
            controller.layoutAttribute = .left
            controller.fullScreenMinHeight = EditorDesignSystem.Chrome.tabStripHeight
            window.addTitlebarAccessoryViewController(controller)
            titlebarAccessoryController = controller
            titlebarAccessoryHostingView = hostingView
        }

        private func configureCloseMenuItemIfNeeded() {
            guard let mainMenu = NSApp.mainMenu else { return }
            guard let closeItem = findCloseMenuItem(in: mainMenu) else { return }
            closeItem.title = "Close Tab"
            closeItem.action = #selector(CloseTabCommandResponder.closeDocumentTab(_:))
            closeItem.target = nil
            closeItem.isEnabled = closeTabResponder.canCloseTab()
            closeMenuItem = closeItem
            updateCloseMenuItemShortcut()
        }

        private func updateCloseMenuItemShortcut() {
            guard let closeMenuItem, let shortcutBindingProvider else { return }
            let binding = shortcutBindingProvider(.closeTab).normalized()
            closeMenuItem.keyEquivalent = binding.key
            closeMenuItem.keyEquivalentModifierMask = binding.menuModifierFlags
        }


        override func performKeyEquivalent(with event: NSEvent) -> Bool {
            guard window?.isKeyWindow == true,
                  let shortcutBindingProvider,
                  let shortcutActionHandler else {
                return super.performKeyEquivalent(with: event)
            }

            for action in ShortcutAction.allCases {
                let binding = shortcutBindingProvider(action)
                guard binding.matches(event) else { continue }
                shortcutActionHandler(action)
                return true
            }

            return super.performKeyEquivalent(with: event)
        }

        private func findCloseMenuItem(in menu: NSMenu) -> NSMenuItem? {
            for item in menu.items {
                if let submenu = item.submenu {
                    if let closeItem = submenu.items.first(where: { $0.action == #selector(NSWindow.performClose(_:)) }) {
                        return closeItem
                    }
                    if let nested = findCloseMenuItem(in: submenu) {
                        return nested
                    }
                }
            }
            return nil
        }

        func applyAppearance(isDark: Bool, backgroundColor: NSColor? = nil) {
            let resolvedBackground = backgroundColor ?? lastBackgroundColor ?? .windowBackgroundColor
            let shouldApply = !didApplyInitialAppearance || lastIsDark != isDark || lastBackgroundColor != resolvedBackground
            lastIsDark = isDark
            lastBackgroundColor = resolvedBackground
            guard shouldApply else { return }
            guard let window else { return }
            didApplyInitialAppearance = true
            let appearance = NSAppearance(named: isDark ? .darkAqua : .aqua)
            window.appearance = appearance
            window.backgroundColor = resolvedBackground
        }
    }
}
