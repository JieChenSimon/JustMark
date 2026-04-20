import Foundation
import SwiftUI
#if SWIFT_PACKAGE
import JustMarkCore
#endif

@MainActor
final class AppEnvironment: ObservableObject {
    struct LaunchAutomationConfiguration {
        var openFolderPath: String?
        var openFilePaths: [String] = []
        var activateFilePath: String?
        var switchFilePaths: [String] = []
        var switchDelayMilliseconds: UInt64 = 350
        var shouldShowPreview = false
        var editorFontName: String?
        var editorFontSize: Double?
        var previewFontSize: Double?

        var isEnabled: Bool {
            openFolderPath != nil ||
            !openFilePaths.isEmpty ||
            activateFilePath != nil ||
            !switchFilePaths.isEmpty ||
            shouldShowPreview ||
            editorFontName != nil ||
            editorFontSize != nil ||
            previewFontSize != nil
        }

        static func load(from processInfo: ProcessInfo = .processInfo) -> LaunchAutomationConfiguration {
            var configuration = LaunchAutomationConfiguration()
            let environment = processInfo.environment

            configuration.openFolderPath = environment["JUSTMARK_AUTOTEST_OPEN_FOLDER"]
            if let filePath = environment["JUSTMARK_AUTOTEST_OPEN_FILE"], !filePath.isEmpty {
                configuration.openFilePaths.append(filePath)
            }
            if let fileList = environment["JUSTMARK_AUTOTEST_OPEN_FILES"], !fileList.isEmpty {
                configuration.openFilePaths.append(
                    contentsOf: fileList
                        .split(whereSeparator: \.isNewline)
                        .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }
                )
            }
            configuration.activateFilePath = environment["JUSTMARK_AUTOTEST_ACTIVATE_FILE"]
            if let fileList = environment["JUSTMARK_AUTOTEST_SWITCH_FILES"], !fileList.isEmpty {
                configuration.switchFilePaths = fileList
                    .split(whereSeparator: \.isNewline)
                    .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
            }
            if let rawDelay = environment["JUSTMARK_AUTOTEST_SWITCH_DELAY_MS"], let delay = UInt64(rawDelay) {
                configuration.switchDelayMilliseconds = delay
            }
            configuration.shouldShowPreview = environment["JUSTMARK_AUTOTEST_SHOW_PREVIEW"] == "1"
            configuration.editorFontName = environment["JUSTMARK_AUTOTEST_EDITOR_FONT"]
            configuration.editorFontSize = environment["JUSTMARK_AUTOTEST_EDITOR_FONT_SIZE"].flatMap(Double.init)
            configuration.previewFontSize = environment["JUSTMARK_AUTOTEST_PREVIEW_FONT_SIZE"].flatMap(Double.init)

            let arguments = Array(processInfo.arguments.dropFirst())
            var index = 0
            while index < arguments.count {
                let argument = arguments[index]
                switch argument {
                case "--autotest-open-folder":
                    if index + 1 < arguments.count {
                        configuration.openFolderPath = arguments[index + 1]
                        index += 1
                    }
                case "--autotest-open-file":
                    if index + 1 < arguments.count {
                        configuration.openFilePaths.append(arguments[index + 1])
                        index += 1
                    }
                case "--autotest-activate-file":
                    if index + 1 < arguments.count {
                        configuration.activateFilePath = arguments[index + 1]
                        index += 1
                    }
                case "--autotest-show-preview":
                    configuration.shouldShowPreview = true
                case "--autotest-switch-file":
                    if index + 1 < arguments.count {
                        configuration.switchFilePaths.append(arguments[index + 1])
                        index += 1
                    }
                case "--autotest-switch-delay-ms":
                    if index + 1 < arguments.count, let value = UInt64(arguments[index + 1]) {
                        configuration.switchDelayMilliseconds = value
                        index += 1
                    }
                case "--autotest-editor-font":
                    if index + 1 < arguments.count {
                        configuration.editorFontName = arguments[index + 1]
                        index += 1
                    }
                case "--autotest-editor-font-size":
                    if index + 1 < arguments.count, let value = Double(arguments[index + 1]) {
                        configuration.editorFontSize = value
                        index += 1
                    }
                case "--autotest-preview-font-size":
                    if index + 1 < arguments.count, let value = Double(arguments[index + 1]) {
                        configuration.previewFontSize = value
                        index += 1
                    }
                default:
                    break
                }
                index += 1
            }

            return configuration
        }
    }

    let settingsStore: SettingsStore
    let themeStore: ThemeStore
    let documentStore: DocumentStore
    let workspaceStore: WorkspaceStore
    let recentHistoryStore: RecentHistoryStore
    let windowLayoutStore: WindowLayoutStore
    let fileSystemService: FileSystemService
    let webDAVService: WebDAVService
    let keychainStore: KeychainStore
    let windowService: WindowService
    let previewEngine: PreviewEngine
    let exportService: ExportService

    init(
        settingsStore: SettingsStore,
        themeStore: ThemeStore,
        documentStore: DocumentStore,
        workspaceStore: WorkspaceStore,
        recentHistoryStore: RecentHistoryStore,
        windowLayoutStore: WindowLayoutStore,
        fileSystemService: FileSystemService,
        webDAVService: WebDAVService,
        keychainStore: KeychainStore,
        windowService: WindowService,
        previewEngine: PreviewEngine,
        exportService: ExportService
    ) {
        self.settingsStore = settingsStore
        self.themeStore = themeStore
        self.documentStore = documentStore
        self.workspaceStore = workspaceStore
        self.recentHistoryStore = recentHistoryStore
        self.windowLayoutStore = windowLayoutStore
        self.fileSystemService = fileSystemService
        self.webDAVService = webDAVService
        self.keychainStore = keychainStore
        self.windowService = windowService
        self.previewEngine = previewEngine
        self.exportService = exportService
    }

    static func bootstrap() -> AppEnvironment {
        let settingsStore = SettingsStore()
        let themeStore = ThemeStore()
        let recentHistoryStore = RecentHistoryStore()
        let windowLayoutStore = WindowLayoutStore()
        let fileSystemService = FileSystemService()
        let keychainStore = KeychainStore()
        let webDAVService = WebDAVService(keychainStore: keychainStore)
        let previewEngine = PreviewEngine()
        let exportService = ExportService()
        let documentStore = DocumentStore()
        let workspaceStore = WorkspaceStore(
            settingsStore: settingsStore,
            themeStore: themeStore,
            documentStore: documentStore,
            recentHistoryStore: recentHistoryStore,
            fileSystemService: fileSystemService,
            webDAVService: webDAVService,
            previewEngine: previewEngine,
            exportService: exportService
        )
        let windowService = WindowService()

        return AppEnvironment(
            settingsStore: settingsStore,
            themeStore: themeStore,
            documentStore: documentStore,
            workspaceStore: workspaceStore,
            recentHistoryStore: recentHistoryStore,
            windowLayoutStore: windowLayoutStore,
            fileSystemService: fileSystemService,
            webDAVService: webDAVService,
            keychainStore: keychainStore,
            windowService: windowService,
            previewEngine: previewEngine,
            exportService: exportService
        )
    }

    func performLaunchAutomationIfNeeded() async {
        let configuration = LaunchAutomationConfiguration.load()

        if let path = configuration.openFolderPath, !path.isEmpty {
            await workspaceStore.openWorkspaceFolder(at: URL(fileURLWithPath: path))
        }

        for path in configuration.openFilePaths where !path.isEmpty {
            let fileURL = URL(fileURLWithPath: path)
            if workspaceStore.currentFolderURL == nil {
                await workspaceStore.openWorkspaceFolder(at: fileURL.deletingLastPathComponent())
            }
            await workspaceStore.openDocument(at: fileURL)
            print("[JustMark] Automated launch opened file: \(fileURL.path)")
        }

        if let path = configuration.activateFilePath, !path.isEmpty {
            await workspaceStore.openDocument(at: URL(fileURLWithPath: path))
        }

        if !configuration.switchFilePaths.isEmpty {
            for path in configuration.switchFilePaths where !path.isEmpty {
                try? await Task.sleep(for: .milliseconds(configuration.switchDelayMilliseconds))
                await workspaceStore.openDocument(at: URL(fileURLWithPath: path))
            }
        }

        if configuration.shouldShowPreview {
            workspaceStore.isPreviewVisible = true
        }

        if let fontName = configuration.editorFontName, !fontName.isEmpty {
            themeStore.editorFontName = fontName
        }

        if let fontSize = configuration.editorFontSize {
            themeStore.editorFontSize = fontSize
        }

        if let previewSize = configuration.previewFontSize {
            themeStore.previewFontSize = previewSize
        }

        await workspaceStore.performLaunchSyncIfNeeded()
    }

    func handleExternalCommandURL(_ url: URL) async {
        do {
            let command = try JustMarkCLICommand(url: url)
            await handleExternalCommand(command)
        } catch {
            print("[JustMark] Ignoring unsupported external URL: \(url.absoluteString)")
        }
    }

    private func handleExternalCommand(_ command: JustMarkCLICommand) async {
        switch command {
        case let .open(paths, preview):
            apply(preview: preview)
            await openExternalPaths(paths)
        case let .new(preview):
            apply(preview: preview)
            await workspaceStore.createNewDocument()
        }
    }

    private func apply(preview: JustMarkPreviewVisibility?) {
        guard let preview else { return }
        workspaceStore.isPreviewVisible = preview == .show
    }

    private func openExternalPaths(_ paths: [URL]) async {
        guard !paths.isEmpty else { return }

        let resolvedPaths = paths.map(\.standardizedFileURL)
        let directoryURLs = resolvedPaths.filter { isDirectory(at: $0) }
        let fileURLs = resolvedPaths.filter { !isDirectory(at: $0) }

        if let workspaceURL = directoryURLs.first ?? fileURLs.first?.deletingLastPathComponent() {
            await workspaceStore.openWorkspaceFolder(at: workspaceURL)
        }

        for fileURL in fileURLs {
            await workspaceStore.openDocument(at: fileURL)
        }
    }

    private func isDirectory(at url: URL) -> Bool {
        var isDirectory: ObjCBool = false
        return FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory) && isDirectory.boolValue
    }
}

private struct WindowServiceEnvironmentKey: EnvironmentKey {
    static let defaultValue = WindowService()
}

extension EnvironmentValues {
    var windowService: WindowService {
        get { self[WindowServiceEnvironmentKey.self] }
        set { self[WindowServiceEnvironmentKey.self] = newValue }
    }
}
