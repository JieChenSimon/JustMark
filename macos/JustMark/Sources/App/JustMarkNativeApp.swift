import AppKit
import SwiftUI

@main
struct JustMarkNativeApp: App {
    @StateObject private var appEnvironment = AppEnvironment.bootstrap()

    init() {
        AppIconConfigurator.applyFallbackIcon()
    }

    var body: some Scene {
        Window("JustMark", id: "main") {
            WorkspaceRootView()
                .environmentObject(appEnvironment.settingsStore)
                .environmentObject(appEnvironment.themeStore)
                .environmentObject(appEnvironment.documentStore)
                .environmentObject(appEnvironment.workspaceStore)
                .environment(\.windowService, appEnvironment.windowService)
                .preferredColorScheme(appEnvironment.themeStore.isDarkMode ? .dark : .light)
                .background(WindowChromeConfigurator(
                    isDark: appEnvironment.themeStore.isDarkMode,
                    backgroundColor: appEnvironment.themeStore.workspaceBackgroundNSColor,
                    titlebarAccessory: nil,
                    canCloseTab: { !appEnvironment.documentStore.openDocuments.isEmpty },
                    onCloseTab: { appEnvironment.documentStore.closeActiveDocument() },
                    shortcutBinding: { action in
                        appEnvironment.settingsStore.shortcutBinding(for: action)
                    },
                    onPerformShortcut: { action in
                        switch action {
                        case .newDocument:
                            Task { await appEnvironment.workspaceStore.createNewDocument() }
                        case .openDocument:
                            Task { await appEnvironment.workspaceStore.openDocument() }
                        case .openFolder:
                            Task { await appEnvironment.workspaceStore.openWorkspaceFolder() }
                        case .save:
                            Task { await appEnvironment.workspaceStore.saveActiveDocument() }
                        case .saveAs:
                            Task { await appEnvironment.workspaceStore.saveActiveDocumentAs() }
                        case .closeTab:
                            appEnvironment.documentStore.closeActiveDocument()
                        case .find:
                            appEnvironment.documentStore.findReplaceState.isPresented = true
                        case .togglePreview:
                            appEnvironment.workspaceStore.isPreviewVisible.toggle()
                        }
                    }
                ))
                .frame(minWidth: 1100, minHeight: 720)
                .task {
                    await appEnvironment.performLaunchAutomationIfNeeded()
                }
                .onOpenURL { url in
                    Task {
                        await appEnvironment.handleExternalCommandURL(url)
                    }
                }
        }
        .defaultSize(width: 1276, height: 768)
        .windowStyle(.hiddenTitleBar)
        .commands {
            JustMarkCommands(
                settingsStore: appEnvironment.settingsStore,
                documentStore: appEnvironment.documentStore,
                workspaceStore: appEnvironment.workspaceStore,
                recentHistoryStore: appEnvironment.recentHistoryStore,
                windowService: appEnvironment.windowService
            )
        }

        Settings {
            SettingsRootView()
                .environmentObject(appEnvironment.settingsStore)
                .environmentObject(appEnvironment.themeStore)
                .environmentObject(appEnvironment.workspaceStore)
                .frame(width: 720, height: 520)
        }
    }
}

private enum AppIconConfigurator {
    static func applyFallbackIcon() {
        guard let iconURL = Bundle.main.url(forResource: "JustMark", withExtension: "icns") else {
            return
        }
        guard let iconImage = NSImage(contentsOf: iconURL) else {
            return
        }
        NSApplication.shared.applicationIconImage = iconImage
    }
}
