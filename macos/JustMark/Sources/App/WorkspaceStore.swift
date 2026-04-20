import Combine
import Foundation
import OSLog
import AppKit
import UniformTypeIdentifiers
#if SWIFT_PACKAGE
import JustMarkCore
#endif

struct SidebarInlineEditState: Equatable {
    enum Operation: String, Equatable {
        case createFile
        case createFolder
        case rename
        case duplicate
    }

    let id: UUID
    let operation: Operation
    let sourceURL: URL?
    let parentURL: URL
    let placeholderURL: URL?
    let isFolder: Bool
    let originalName: String
    var draftName: String

    init(
        operation: Operation,
        sourceURL: URL?,
        parentURL: URL,
        placeholderURL: URL?,
        isFolder: Bool,
        originalName: String,
        draftName: String
    ) {
        self.id = UUID()
        self.operation = operation
        self.sourceURL = sourceURL
        self.parentURL = parentURL
        self.placeholderURL = placeholderURL
        self.isFolder = isFolder
        self.originalName = originalName
        self.draftName = draftName
    }
}

@MainActor
final class WorkspaceStore: ObservableObject {
    enum SidebarPanelMode {
        case files
        case outline
    }

    @Published var currentFolderURL: URL?
    @Published var fileTree: [FileTreeNode] = []
    @Published var selectedSidebarNodeID: String? {
        didSet {
            guard !suppressSelectionSync else { return }
            if let selectedSidebarNodeID {
                selectedSidebarNodeIDs = [selectedSidebarNodeID]
            } else {
                selectedSidebarNodeIDs = []
            }
        }
    }
    @Published var selectedSidebarNodeIDs: Set<String> = []
    @Published var draggingSidebarNodeIDs: Set<String> = []
    @Published var expandedFolderIDs: Set<String> = []
    @Published var sidebarPanelMode: SidebarPanelMode = .files
    @Published var isSidebarVisible: Bool = true
    @Published var isPreviewVisible: Bool = true
    @Published private(set) var previewState: PreviewState = .idle
    @Published private(set) var sidebarEditState: SidebarInlineEditState?
    @Published var syncSummary: String?
    @Published var isSyncing: Bool = false
    @Published var syncProgress: Double = 0
    @Published private(set) var webDAVSettingsState = WebDAVSettingsState()

    private let settingsStore: SettingsStore
    private let themeStore: ThemeStore
    private let documentStore: DocumentStore
    private let recentHistoryStore: RecentHistoryStore
    private let fileSystemService: FileSystemService
    private let webDAVService: WebDAVService
    private let previewEngine: PreviewEngine
    private let exportService: ExportService
    private let logger = Logger(subsystem: "com.justmark.mac", category: "Workspace")
    private var cancellables: Set<AnyCancellable> = []
    private let defaults = UserDefaults.standard
    private let sessionKey = "jm.workspaceSession"
    private let syncSnapshotPrefix = "jm.syncSnapshot."
    private let syncToleranceSeconds: TimeInterval = 2
    private let isAutomatedLaunch: Bool
    private var suppressSelectionSync = false
    private var previewRefreshTask: Task<Void, Never>?
    private var previewRefreshInFlightRequest: PreviewRequest?
    private var previewRefreshActiveTaskID: UInt64?
    private var previewRefreshSequence: UInt64 = 0
    private var previewNeedsRefreshWhenVisible = false
    private var persistSessionTask: Task<Void, Never>?
    private var lastPersistedSessionDigest: Int?
    private var fileTreeLoadSequence: UInt64 = 0
    private var openDocumentSequence: UInt64 = 0
    private var folderChildLoadTasks: [String: Task<Void, Never>] = [:]
    private var fileTreePathIndex: [String: [Int]] = [:]
    private let fileTreeBatchSize = 200

    init(
        settingsStore: SettingsStore,
        themeStore: ThemeStore,
        documentStore: DocumentStore,
        recentHistoryStore: RecentHistoryStore,
        fileSystemService: FileSystemService,
        webDAVService: WebDAVService,
        previewEngine: PreviewEngine,
        exportService: ExportService
    ) {
        self.settingsStore = settingsStore
        self.themeStore = themeStore
        self.documentStore = documentStore
        self.recentHistoryStore = recentHistoryStore
        self.fileSystemService = fileSystemService
        self.webDAVService = webDAVService
        self.previewEngine = previewEngine
        self.exportService = exportService
        let processInfo = ProcessInfo.processInfo
        self.isAutomatedLaunch =
            processInfo.environment.keys.contains { $0.hasPrefix("JUSTMARK_AUTOTEST_") } ||
            processInfo.arguments.contains { $0.hasPrefix("--autotest-") }
        bindDocumentLifecycle()
        bindApplicationLifecycle()
        prepareInitialLaunchState()
        refreshWebDAVSettingsState()
    }

    func openWorkspaceFolder() async {
        guard let url = await fileSystemService.openFolderPanel() else { return }
        await openWorkspaceFolder(at: url)
    }

    func openWorkspaceFolder(at url: URL) async {
        logger.log("Selected workspace folder: \(url.path, privacy: .public)")
        currentFolderURL = url
        recentHistoryStore.addFolder(url)
        await loadFileTree(for: url)
    }

    func openDocument() async {
        guard let url = await fileSystemService.openDocumentPanel() else { return }
        await openDocument(at: url)
    }

    func reopenRecentFile(_ url: URL) async {
        await openDocument(at: url)
    }

    func reopenRecentFolder(_ url: URL) async {
        guard fileSystemService.fileExists(at: url) else {
            syncSummary = "Folder not found"
            return
        }

        await openWorkspaceFolder(at: url)
    }

    func openNode(_ node: FileTreeNode) async {
        selectedSidebarNodeID = node.id
        switch node.kind {
        case .folder:
            await toggleFolderExpansion(for: node)
        case .file:
            await openDocument(at: node.url)
        }
    }

    func createNewDocument() async {
        if let targetFolderURL = preferredNewDocumentFolderURL() {
            _ = await createMarkdownDocument(in: targetFolderURL)
        } else {
            documentStore.createUntitledDocument()
        }
    }

    @discardableResult
    func createMarkdownDocument(in folderURL: URL) async -> URL? {
        do {
            let targetURL = try availableChildURL(in: folderURL, preferredName: "Untitled.md")
            try fileSystemService.writeTextFile("", to: targetURL)
            try await revealCreatedItem(at: targetURL)
            documentStore.openDocument(name: targetURL.lastPathComponent, url: targetURL, content: "")
            recentHistoryStore.addFile(targetURL)
            selectedSidebarNodeID = targetURL.path
            sidebarEditState = SidebarInlineEditState(
                operation: .createFile,
                sourceURL: nil,
                parentURL: folderURL,
                placeholderURL: targetURL,
                isFolder: false,
                originalName: targetURL.lastPathComponent,
                draftName: renameDraftText(for: FileTreeNode(
                    id: targetURL.path,
                    name: targetURL.lastPathComponent,
                    url: targetURL,
                    kind: .file
                ))
            )
            syncSummary = "Created \(targetURL.lastPathComponent)"
            return targetURL
        } catch {
            syncSummary = "Create document failed: \(error.localizedDescription)"
            return nil
        }
    }

    @discardableResult
    func createFolder(in parentFolderURL: URL) async -> URL? {
        do {
            let targetURL = try availableChildURL(in: parentFolderURL, preferredName: "New Folder", pathExtension: nil)
            try fileSystemService.createDirectory(at: targetURL)
            try await revealCreatedItem(at: targetURL)
            selectedSidebarNodeID = targetURL.path
            sidebarEditState = SidebarInlineEditState(
                operation: .createFolder,
                sourceURL: nil,
                parentURL: parentFolderURL,
                placeholderURL: targetURL,
                isFolder: true,
                originalName: targetURL.lastPathComponent,
                draftName: targetURL.lastPathComponent
            )
            syncSummary = "Created \(targetURL.lastPathComponent)"
            return targetURL
        } catch {
            syncSummary = "Create folder failed: \(error.localizedDescription)"
            return nil
        }
    }

    func refreshWorkspaceFileTree() async {
        guard let currentFolderURL else { return }
        await loadFileTree(for: currentFolderURL, preserveExpansionState: true, selectedNodeID: selectedSidebarNodeID)
    }

    func revealInFinder(_ url: URL) {
        fileSystemService.revealInFinder(url)
    }

    func updateSidebarSelection(_ ids: Set<String>, primaryID: String?) {
        suppressSelectionSync = true
        selectedSidebarNodeIDs = ids
        selectedSidebarNodeID = primaryID
        suppressSelectionSync = false
    }

    func prepareDragging(nodeID: String) {
        if selectedSidebarNodeIDs.contains(nodeID), selectedSidebarNodeIDs.count > 1 {
            draggingSidebarNodeIDs = selectedSidebarNodeIDs
        } else {
            draggingSidebarNodeIDs = [nodeID]
        }
    }

    func deleteSelectedNodes() async {
        let ids = selectedSidebarNodeIDs
        guard !ids.isEmpty else { return }
        let nodes = ids.compactMap { node(for: $0) }
        let urls = nodes.map(\.url)
        guard !urls.isEmpty else { return }
        guard await fileSystemService.confirmBulkDeletion(count: urls.count) else { return }

        do {
            for url in urls {
                try fileSystemService.trashItem(at: url)
                documentStore.closeDocuments(atOrInside: url)
            }
            if let currentFolderURL {
                await loadFileTree(for: currentFolderURL, preserveExpansionState: true, selectedNodeID: currentFolderURL.path)
            }
            updateSidebarSelection([], primaryID: nil)
            syncSummary = "Deleted \(urls.count) items"
        } catch {
            syncSummary = "Delete failed: \(error.localizedDescription)"
        }
    }

    func moveSelectedNodes() async {
        let ids = selectedSidebarNodeIDs
        guard !ids.isEmpty else { return }
        let nodes = ids.compactMap { node(for: $0) }
        let urls = nodes.map(\.url)
        guard !urls.isEmpty else { return }
        guard let destinationURL = await fileSystemService.openFolderPanel() else { return }
        await moveNodes(urls, to: destinationURL)
    }

    func handleDrop(_ providers: [NSItemProvider], onto node: FileTreeNode) async {
        guard node.isFolder else { return }
        await handleDrop(providers, ontoFolderURL: node.url)
    }

    func handleDrop(_ providers: [NSItemProvider], ontoFolderURL folderURL: URL) async {
        let urls = await dropURLs(from: providers, fallbackNodeIDs: draggingSidebarNodeIDs)
        draggingSidebarNodeIDs = []
        await moveNodes(urls, to: folderURL)
    }

    func relativePathForCopy(of url: URL) -> String? {
        guard let currentFolderURL else { return nil }
        if url == currentFolderURL {
            return "."
        }
        let rootPath = currentFolderURL.path
        let targetPath = url.path
        guard targetPath.hasPrefix(rootPath + "/") else {
            return targetPath
        }
        return relativePath(from: currentFolderURL, to: url)
    }

    func revealActiveFileInSidebar() async {
        guard let currentFolderURL,
              let activeURL = documentStore.activeDocument?.fileURL else { return }
        guard activeURL.path.hasPrefix(currentFolderURL.path + "/") || activeURL == currentFolderURL else { return }

        await loadFileTree(for: currentFolderURL, preserveExpansionState: true, selectedNodeID: activeURL.path)
        let parentURL = activeURL.deletingLastPathComponent()
        await expandFolderChain(from: currentFolderURL, to: parentURL)
        selectedSidebarNodeID = activeURL.path
    }

    func renameNode(_ node: FileTreeNode) async {
        await beginRenameNode(node)
    }

    func renameNode(_ node: FileTreeNode, to enteredName: String) async {
        let trimmedName = enteredName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        let normalizedName = normalizedRenameInput(trimmedName, pathExtension: node.url.pathExtension, isFolder: node.isFolder)
        let newURL = node.url.deletingLastPathComponent().appendingPathComponent(normalizedName, isDirectory: node.isFolder)
        guard newURL != node.url else { return }

        do {
            remapSidebarSelectionAndExpansion(from: node.url, to: newURL, isFolder: node.isFolder)
            try fileSystemService.renameItem(at: node.url, to: newURL)
            if node.isFolder {
                documentStore.remapDocumentURLs(from: node.url, to: newURL)
            } else {
                documentStore.renameDocument(from: node.url, to: newURL)
            }
            if !remapNodeURLsInLoadedTree(from: node.url, to: newURL) {
                try await refreshAfterFilesystemChange(affectedParentURL: newURL.deletingLastPathComponent(), selectedNodeID: newURL.path)
            }
            syncSummary = "Renamed to \(newURL.lastPathComponent)"
        } catch {
            syncSummary = "Rename failed: \(error.localizedDescription)"
        }
    }

    func deleteNode(_ node: FileTreeNode) async {
        guard await fileSystemService.confirmDeletion(name: node.name, isFolder: node.isFolder) else { return }

        do {
            try fileSystemService.trashItem(at: node.url)
            documentStore.closeDocuments(atOrInside: node.url)
            let targetPath = node.url.path
            let targetPrefix = targetPath + "/"
            expandedFolderIDs = expandedFolderIDs.filter { $0 != targetPath && !$0.hasPrefix(targetPrefix) }
            if let currentSelectedSidebarNodeID = selectedSidebarNodeID,
               currentSelectedSidebarNodeID == targetPath || currentSelectedSidebarNodeID.hasPrefix(targetPrefix) {
                self.selectedSidebarNodeID = node.url.deletingLastPathComponent().path
            }
            if !removeNodeFromLoadedTree(at: node.url) {
                try await refreshAfterFilesystemChange(
                    affectedParentURL: node.url.deletingLastPathComponent(),
                    selectedNodeID: node.url.deletingLastPathComponent().path
                )
            }
            syncSummary = "Deleted \(node.name)"
        } catch {
            syncSummary = "Delete failed: \(error.localizedDescription)"
        }
    }

    func beginCreateMarkdownDocument(in folderURL: URL) async {
        _ = await createMarkdownDocument(in: folderURL)
    }

    func beginCreateFolder(in parentFolderURL: URL) async {
        _ = await createFolder(in: parentFolderURL)
    }

    func beginRenameNode(_ node: FileTreeNode) async {
        sidebarEditState = SidebarInlineEditState(
            operation: .rename,
            sourceURL: node.url,
            parentURL: node.url.deletingLastPathComponent(),
            placeholderURL: nil,
            isFolder: node.isFolder,
            originalName: node.name,
            draftName: renameDraftText(for: node)
        )
        selectedSidebarNodeID = node.id
    }

    func beginDuplicateNode(_ node: FileTreeNode) async {
        do {
            let targetURL = try duplicateItemURL(for: node)
            try copyNode(at: node.url, to: targetURL, isFolder: node.isFolder)
            sidebarEditState = SidebarInlineEditState(
                operation: .duplicate,
                sourceURL: node.url,
                parentURL: node.url.deletingLastPathComponent(),
                placeholderURL: targetURL,
                isFolder: node.isFolder,
                originalName: node.name,
                draftName: renameDraftText(for: FileTreeNode(
                    id: targetURL.path,
                    name: targetURL.lastPathComponent,
                    url: targetURL,
                    kind: node.kind
                ))
            )
            try await revealCreatedItem(at: targetURL)
            if !node.isFolder, let content = try? fileSystemService.readTextFile(at: targetURL) {
                documentStore.openDocument(name: targetURL.lastPathComponent, url: targetURL, content: content)
            }
            selectedSidebarNodeID = targetURL.path
            syncSummary = "Duplicated \(targetURL.lastPathComponent)"
        } catch {
            syncSummary = "Duplicate failed: \(error.localizedDescription)"
        }
    }

    func updateSidebarEditName(_ name: String) {
        guard var state = sidebarEditState else { return }
        state.draftName = name
        sidebarEditState = state
    }

    func commitSidebarEdit() async {
        guard let state = sidebarEditState else { return }
        sidebarEditState = nil

        do {
            try await commitSidebarEdit(state)
        } catch {
            syncSummary = "Sidebar edit failed: \(error.localizedDescription)"
        }
    }

    func cancelSidebarEdit() async {
        guard let state = sidebarEditState else { return }
        sidebarEditState = nil

        if let placeholderURL = state.placeholderURL {
            documentStore.closeDocuments(atOrInside: placeholderURL)
            do {
                try fileSystemService.removeItem(at: placeholderURL)
                if !removeNodeFromLoadedTree(at: placeholderURL), let currentFolderURL {
                    await loadFileTree(for: currentFolderURL, preserveExpansionState: true, selectedNodeID: selectedSidebarNodeID)
                }
            } catch {
                syncSummary = "Sidebar edit cancel failed: \(error.localizedDescription)"
            }
        }
    }

    func toggleFolderExpansion(_ nodeID: String) {
        guard let node = node(for: nodeID) else {
            return
        }
        Task { @MainActor in
            await toggleFolderExpansion(for: node)
        }
    }

    private func toggleFolderExpansion(for node: FileTreeNode) async {
        if expandedFolderIDs.contains(node.id) {
            expandedFolderIDs.remove(node.id)
            return
        }

        expandedFolderIDs.insert(node.id)
        await loadChildrenIfNeeded(for: node)
    }

    func saveActiveDocument() async {
        documentStore.flushActiveDocumentEdits()
        guard let document = documentStore.activeDocument else { return }

        if let url = document.fileURL {
            do {
                try fileSystemService.writeTextFile(document.content, to: url)
                documentStore.markActiveDocumentSaved()
                persistSessionNow()
                recentHistoryStore.addFile(url)
                syncSummary = "Saved \(url.lastPathComponent)"
            } catch {
                syncSummary = "Save failed: \(error.localizedDescription)"
            }
            return
        }

        await saveActiveDocumentAs()
    }

    func saveActiveDocumentAs() async {
        guard let document = documentStore.activeDocument else { return }
        let suggestedName = document.fileURL?.lastPathComponent ?? fallbackDocumentName(for: document)
        guard let targetURL = await fileSystemService.saveDocumentPanel(suggestedName: suggestedName) else { return }

        do {
            try fileSystemService.writeTextFile(document.content, to: targetURL)
            documentStore.updateActiveDocumentFile(url: targetURL)
            documentStore.markActiveDocumentSaved()
            persistSessionNow()
            recentHistoryStore.addFile(targetURL)
            syncSummary = "Saved \(targetURL.lastPathComponent)"
        } catch {
            syncSummary = "Save As failed: \(error.localizedDescription)"
        }
    }

    func clipURLFromSelectionOrClipboard() -> Bool {
        guard documentStore.activeDocument != nil else { return false }
        let selected = documentStore.selectedText()?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let clipboard = NSPasteboard.general.string(forType: .string)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        let urlCandidate = isValidURLString(selected) ? selected : clipboard
        guard !urlCandidate.isEmpty, let urlString = normalizedURLString(urlCandidate) else {
            syncSummary = "No URL found to clip"
            return false
        }

        let title = selected.isEmpty || isValidURLString(selected) ? urlString : selected
        let markdown = "[\(title)](\(urlString))"
        documentStore.replaceSelection(with: markdown)
        syncSummary = "Clipped URL"
        return true
    }

    func savePastedImage(_ data: Data) async -> String? {
        guard let destination = imageDestination() else {
            syncSummary = "Save a document or open a workspace before pasting images"
            return nil
        }

        do {
            try fileSystemService.ensureDirectoryExists(at: destination.directoryURL)
            try fileSystemService.writeDataFile(data, to: destination.fileURL)

            if let currentFolderURL {
                await loadFileTree(for: currentFolderURL)
            }

            syncSummary = "Inserted \(destination.fileURL.lastPathComponent)"
            return "![](\(destination.relativePath))"
        } catch {
            syncSummary = "Image save failed: \(error.localizedDescription)"
            return nil
        }
    }

    @discardableResult
    func saveWebDAVConfiguration(password: String) async -> Bool {
        let configuration = currentWebDAVConfiguration()
        let enteredPassword = password.trimmingCharacters(in: .whitespacesAndNewlines)

        webDAVSettingsState.isTestingConnection = true
        defer {
            webDAVSettingsState.isTestingConnection = false
        }

        do {
            try webDAVService.validate(configuration)
            let savedPassword = try webDAVService.readPassword(for: configuration)
            let candidatePassword = enteredPassword.isEmpty ? savedPassword : enteredPassword
            guard let candidatePassword, !candidatePassword.isEmpty else {
                throw WebDAVError.missingPassword
            }

            try await webDAVService.testConnection(configuration, password: candidatePassword)
            if !enteredPassword.isEmpty {
                try webDAVService.savePassword(candidatePassword, for: configuration)
            }

            syncSummary = "WebDAV connected"
            webDAVSettingsState.statusMessage = "Connection verified. Password is stored securely in Keychain."
            webDAVSettingsState.statusKind = .success
            refreshWebDAVSettingsState(preservingStatus: true)
            return true
        } catch {
            let message = "WebDAV setup failed: \(error.localizedDescription)"
            syncSummary = message
            webDAVSettingsState.statusMessage = message
            webDAVSettingsState.statusKind = .error
            refreshWebDAVSettingsState(preservingStatus: true)
            return false
        }
    }

    func syncActiveDocumentToWebDAV() async {
        guard let document = documentStore.activeDocument else {
            let message = "Open a document first"
            syncSummary = message
            webDAVSettingsState.statusMessage = message
            webDAVSettingsState.statusKind = .error
            return
        }
        let configuration = currentWebDAVConfiguration()

        let remoteName = document.fileURL?.lastPathComponent ?? fallbackDocumentName(for: document)

        do {
            try await webDAVService.uploadTextFile(document.content, remotePath: remoteName, configuration: configuration)
            syncSummary = "Uploaded \(remoteName)"
            webDAVSettingsState.statusMessage = "Uploaded \(remoteName)"
            webDAVSettingsState.statusKind = .success
        } catch {
            let message = "Sync failed: \(error.localizedDescription)"
            syncSummary = message
            webDAVSettingsState.statusMessage = message
            webDAVSettingsState.statusKind = .error
        }
    }

    func syncWorkspaceToWebDAV() async {
        guard let currentFolderURL else {
            let message = "Open a workspace first"
            syncSummary = message
            webDAVSettingsState.statusMessage = message
            webDAVSettingsState.statusKind = .error
            return
        }

        let configuration = currentWebDAVConfiguration()

        isSyncing = true
        syncProgress = 0
        defer {
            isSyncing = false
        }

        do {
            let files = try fileSystemService.listTextFilesRecursively(
                at: currentFolderURL,
                showHiddenFiles: settingsStore.showHiddenFiles
            )
            let totalUploadCount = max(files.count, 1)
            var uploadedCount = 0
            var snapshots = loadSyncSnapshots(for: configuration, currentFolderURL: currentFolderURL)

            for fileURL in files {
                let content = try fileSystemService.readTextFile(at: fileURL)
                let relativePath = relativePath(from: currentFolderURL, to: fileURL)

                try await webDAVService.uploadTextFile(
                    content,
                    remotePath: relativePath,
                    configuration: configuration
                )

                let localSignature = try localSignature(for: fileURL)
                snapshots[relativePath] = SyncSnapshotEntry(
                    localSignature: localSignature,
                    remoteSignature: localSignature
                )
                uploadedCount += 1
                syncProgress = Double(uploadedCount) / Double(totalUploadCount)
            }

            var downloadedCount = 0
            var conflictCount = 0

            if settingsStore.syncMode == .twoWay {
                let result = try await downloadMissingRemoteFiles(
                    into: currentFolderURL,
                    configuration: configuration,
                    snapshots: &snapshots
                )
                downloadedCount = result.downloadedCount
                conflictCount = result.conflictCount
            }

            persistSyncSnapshots(snapshots, for: configuration, currentFolderURL: currentFolderURL)

            let uploadedSummary = uploadedCount == 1 ? "1 uploaded" : "\(uploadedCount) uploaded"
            let downloadedSummary = downloadedCount > 0 ? " · \(downloadedCount) downloaded" : ""
            let conflictSummary = conflictCount > 0 ? " · \(conflictCount) conflicts" : ""
            syncSummary = uploadedSummary + downloadedSummary + conflictSummary
            webDAVSettingsState.statusMessage = syncSummary
            webDAVSettingsState.statusKind = .success
            syncProgress = 1
        } catch {
            let message = "Workspace sync failed: \(error.localizedDescription)"
            syncSummary = message
            webDAVSettingsState.statusMessage = message
            webDAVSettingsState.statusKind = .error
        }
    }

    func exportCurrentPreviewAsPDF() async {
        documentStore.flushActiveDocumentEdits()
        guard let document = documentStore.activeDocument else { return }
        let suggestedName = fallbackDocumentName(for: document)
            .replacingOccurrences(of: ".md", with: ".pdf")
            .replacingOccurrences(of: ".markdown", with: ".pdf")
            .replacingOccurrences(of: ".txt", with: ".pdf")

        guard let destinationURL = await fileSystemService.savePDFPanel(suggestedName: suggestedName) else { return }

        do {
            let renderedHTML = try await previewEngine.renderHTML(markdown: document.content)
            try await exportService.exportPDF(
                html: renderedHTML,
                baseURL: document.fileURL?.deletingLastPathComponent() ?? currentFolderURL,
                destinationURL: destinationURL
            )
            syncSummary = "Exported \(destinationURL.lastPathComponent)"
        } catch {
            syncSummary = "PDF export failed: \(error.localizedDescription)"
        }
    }

    func refreshWebDAVSettingsState(
        for configuration: WebDAVConfiguration? = nil,
        preservingStatus: Bool = false
    ) {
        let configuration = configuration ?? currentWebDAVConfiguration()
        webDAVSettingsState.hasStoredPassword = webDAVService.hasPassword(for: configuration)
        if !preservingStatus {
            webDAVSettingsState.statusMessage = nil
            webDAVSettingsState.statusKind = .neutral
        }
    }

    func performLaunchSyncIfNeeded() async {
        guard settingsStore.autoSyncOnLaunch else { return }
        guard !isAutomatedLaunch else { return }
        let configuration = currentWebDAVConfiguration()
        guard normalizedURLString(configuration.url) != nil else { return }
        guard !configuration.username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        guard webDAVService.hasPassword(for: configuration) else { return }
        guard currentFolderURL != nil || documentStore.activeDocument?.fileURL != nil else { return }

        if currentFolderURL != nil {
            await syncWorkspaceToWebDAV()
        } else if documentStore.activeDocument?.fileURL != nil {
            await syncActiveDocumentToWebDAV()
        }
    }

    private func loadFileTree(
        for folderURL: URL,
        preserveExpansionState: Bool = false,
        selectedNodeID: String? = nil
    ) async {
        fileTreeLoadSequence &+= 1
        let loadID = fileTreeLoadSequence
        let showHiddenFiles = settingsStore.showHiddenFiles
        let previouslyExpandedFolderIDs = preserveExpansionState ? expandedFolderIDs : []
        let nextSelectedNodeID = selectedNodeID ?? (preserveExpansionState ? self.selectedSidebarNodeID : nil)
        folderChildLoadTasks.values.forEach { $0.cancel() }
        folderChildLoadTasks.removeAll()

        do {
            let nodes = try await Task.detached(priority: .userInitiated) { [fileSystemService] in
                try fileSystemService.listDirectory(at: folderURL, showHiddenFiles: showHiddenFiles)
            }.value
            guard loadID == fileTreeLoadSequence else { return }
            self.selectedSidebarNodeID = nextSelectedNodeID
            expandedFolderIDs = preserveExpansionState ? previouslyExpandedFolderIDs : []
            await publishFileTreeIncrementally(nodes, loadID: loadID)
            if preserveExpansionState {
                await restoreExpandedFolders(previouslyExpandedFolderIDs)
                if let nextSelectedNodeID, fileTreePathIndex[nextSelectedNodeID] == nil {
                    self.selectedSidebarNodeID = nil
                }
            }
            syncSummary = "Loaded \(fileTree.count) items from \(folderURL.lastPathComponent)"
            logger.log("Loaded folder \(folderURL.path, privacy: .public) with \(self.fileTree.count) items")
        } catch {
            guard loadID == fileTreeLoadSequence else { return }
            syncSummary = "Folder load failed: \(error.localizedDescription)"
            logger.error("Folder load failed for \(folderURL.path, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }

    func refreshPreview(immediate: Bool = false) {
        guard let request = currentPreviewRequest() else {
            previewRefreshTask?.cancel()
            previewRefreshInFlightRequest = nil
            previewRefreshActiveTaskID = nil
            previewNeedsRefreshWhenVisible = false
            previewState = .idle
            logger.debug("Preview reset to idle because there is no active document content")
            return
        }

        if previewState.request == request {
            switch previewState.phase {
            case .loading, .ready:
                if case .loading = previewState.phase,
                   !(previewRefreshActiveTaskID != nil && previewRefreshInFlightRequest == request) {
                    logger.debug(
                        "Preview loading state was stale for id=\(request.documentID?.uuidString ?? "<nil>", privacy: .public); restarting render"
                    )
                    break
                }
                previewNeedsRefreshWhenVisible = false
                return
            case .idle, .failed:
                break
            }
        }

        guard isPreviewVisible else {
            previewNeedsRefreshWhenVisible = true
            previewRefreshTask?.cancel()
            previewRefreshInFlightRequest = nil
            previewRefreshActiveTaskID = nil
            return
        }

        previewNeedsRefreshWhenVisible = false
        previewRefreshSequence &+= 1
        let refreshID = previewRefreshSequence
        let engine = previewEngine
        let exporter = exportService
        previewRefreshTask?.cancel()
        previewRefreshInFlightRequest = request
        previewRefreshActiveTaskID = refreshID
        previewState = PreviewState(request: request, phase: .loading)
        logger.info(
            "Preview loading id=\(request.documentID?.uuidString ?? "<nil>", privacy: .public) mode=\(request.mode.rawValue, privacy: .public) base=\(request.baseURL?.path ?? "<nil>", privacy: .public)"
        )

        previewRefreshTask = Task.detached(priority: .userInitiated) {
            do {
                if !immediate {
                    let delay: UInt64 = request.mode == .pdf ? 300 : 120
                    try await Task.sleep(for: .milliseconds(delay))
                }

                try Task.checkCancellation()
                if request.mode == .markdown {
                    let rendered = try await engine.renderBody(markdown: request.markdown)
                    try Task.checkCancellation()

                    await MainActor.run {
                        let isCurrentTask = self.previewRefreshActiveTaskID == refreshID
                        guard refreshID == self.previewRefreshSequence else {
                            if isCurrentTask {
                                self.previewRefreshInFlightRequest = nil
                                self.previewRefreshActiveTaskID = nil
                            }
                            return
                        }
                        self.previewState = PreviewState(
                            request: request,
                            phase: .ready(.markdown(rendered))
                        )
                        if isCurrentTask {
                            self.previewRefreshInFlightRequest = nil
                            self.previewRefreshActiveTaskID = nil
                        }
                        self.logger.info(
                            "Preview ready markdown id=\(request.documentID?.uuidString ?? "<nil>", privacy: .public) base=\(request.baseURL?.path ?? "<nil>", privacy: .public)"
                        )
                    }
                } else {
                    let html = try await engine.renderPDFHTML(
                        markdown: request.markdown,
                        fontFamilyCSS: request.pdfFontFamilyCSS,
                        fontSize: request.pdfFontSize
                    )
                    try Task.checkCancellation()
                    let pdfData = try await exporter.renderPDFData(html: html, baseURL: request.baseURL)
                    try Task.checkCancellation()

                    await MainActor.run {
                        let isCurrentTask = self.previewRefreshActiveTaskID == refreshID
                        guard refreshID == self.previewRefreshSequence else {
                            if isCurrentTask {
                                self.previewRefreshInFlightRequest = nil
                                self.previewRefreshActiveTaskID = nil
                            }
                            return
                        }
                        self.previewState = PreviewState(
                            request: request,
                            phase: .ready(.pdf(pdfData))
                        )
                        if isCurrentTask {
                            self.previewRefreshInFlightRequest = nil
                            self.previewRefreshActiveTaskID = nil
                        }
                        self.logger.info(
                            "Preview ready pdf id=\(request.documentID?.uuidString ?? "<nil>", privacy: .public) base=\(request.baseURL?.path ?? "<nil>", privacy: .public)"
                        )
                    }
                }
            } catch {
                if error is CancellationError {
                    await MainActor.run {
                        if self.previewRefreshActiveTaskID == refreshID {
                            self.previewRefreshInFlightRequest = nil
                            self.previewRefreshActiveTaskID = nil
                        }
                        self.logger.debug(
                            "Preview render cancelled id=\(request.documentID?.uuidString ?? "<nil>", privacy: .public) mode=\(request.mode.rawValue, privacy: .public)"
                        )
                    }
                    return
                }
                await MainActor.run {
                    let isCurrentTask = self.previewRefreshActiveTaskID == refreshID
                    guard refreshID == self.previewRefreshSequence else {
                        if isCurrentTask {
                            self.previewRefreshInFlightRequest = nil
                            self.previewRefreshActiveTaskID = nil
                        }
                        return
                    }
                    if isCurrentTask {
                        self.previewRefreshInFlightRequest = nil
                        self.previewRefreshActiveTaskID = nil
                    }
                    self.previewState = PreviewState(
                        request: request,
                        phase: .failed(error.localizedDescription)
                    )
                    self.logger.error("Preview refresh failed: \(error.localizedDescription, privacy: .public)")
                }
            }
        }
    }

    func setPreviewMode(_ mode: PreviewMode) {
        guard settingsStore.previewMode != mode else { return }
        settingsStore.previewMode = mode
        previewState = .idle
        refreshPreview(immediate: true)
    }

    private func bindDocumentLifecycle() {
        documentStore.$openDocuments
            .dropFirst()
            .sink { [weak self] _ in
                self?.refreshPreview()
                self?.schedulePersistSession()
            }
            .store(in: &cancellables)

        $isPreviewVisible
            .dropFirst()
            .removeDuplicates()
            .sink { [weak self] isVisible in
                guard let self else { return }
                if isVisible {
                    let currentRequest = self.currentPreviewRequest()
                    let needsRefresh = self.previewNeedsRefreshWhenVisible ||
                        self.previewState.request != currentRequest ||
                        ({
                            switch self.previewState.phase {
                            case .idle, .failed:
                                return currentRequest != nil
                            case .loading, .ready:
                                return false
                            }
                        })()
                    if self.previewNeedsRefreshWhenVisible || needsRefresh {
                        self.refreshPreview(immediate: true)
                    }
                } else {
                    self.previewRefreshTask?.cancel()
                    self.previewRefreshInFlightRequest = nil
                    self.previewRefreshActiveTaskID = nil
                }
            }
            .store(in: &cancellables)

        documentStore.$activeDocumentID
            .dropFirst()
            .sink { [weak self] _ in
                self?.refreshPreview(immediate: true)
                self?.schedulePersistSession(immediate: true)
            }
            .store(in: &cancellables)

        documentStore.$openDocuments
            .dropFirst()
            .debounce(for: .seconds(1.5), scheduler: DispatchQueue.main)
            .sink { [weak self] _ in
                guard let self else { return }
                guard self.settingsStore.autoSaveEnabled else { return }
                guard let activeDocument = self.documentStore.activeDocument, activeDocument.hasUnsavedChanges, activeDocument.fileURL != nil else { return }

                Task { @MainActor in
                    await self.saveActiveDocument()
                }
            }
            .store(in: &cancellables)
    }

    private func bindApplicationLifecycle() {
        let center = NotificationCenter.default

        center.publisher(for: NSApplication.willResignActiveNotification)
            .sink { [weak self] _ in
                guard let self else { return }
                self.documentStore.flushActiveDocumentEdits()
                self.persistSessionNow()
            }
            .store(in: &cancellables)

        center.publisher(for: NSApplication.willTerminateNotification)
            .sink { [weak self] _ in
                guard let self else { return }
                self.documentStore.flushActiveDocumentEdits()
                self.persistSessionNow()
            }
            .store(in: &cancellables)
    }

    private func loadChildrenIfNeeded(for node: FileTreeNode) async {
        guard node.isFolder else { return }
        guard !node.isChildrenLoaded else { return }
        guard folderChildLoadTasks[node.id] == nil else { return }
        let showHiddenFiles = settingsStore.showHiddenFiles
        let nodeID = node.id
        let folderURL = node.url

        let task = Task { @MainActor [weak self] in
            guard let self else { return }
            defer { self.folderChildLoadTasks[nodeID] = nil }
            do {
                let children = try await Task.detached(priority: .userInitiated) { [fileSystemService] in
                    try fileSystemService.listDirectory(at: folderURL, showHiddenFiles: showHiddenFiles)
                }.value
                self.updateNodeChildren(id: nodeID, children: children, isLoaded: true)
            } catch {
                self.syncSummary = "Folder load failed: \(error.localizedDescription)"
            }
        }

        folderChildLoadTasks[nodeID] = task
        await task.value
    }

    private func renameDraftText(for node: FileTreeNode) -> String {
        guard !node.isFolder else { return node.name }
        let baseName = node.url.deletingPathExtension().lastPathComponent
        return node.url.pathExtension.isEmpty ? node.name : baseName
    }

    private func duplicateItemURL(for node: FileTreeNode) throws -> URL {
        let parentURL = node.url.deletingLastPathComponent()
        let preferredName: String
        if node.isFolder {
            preferredName = "\(node.name) copy"
            return try availableChildURL(in: parentURL, preferredName: preferredName, pathExtension: nil)
        }

        let baseName = node.url.deletingPathExtension().lastPathComponent
        let ext = node.url.pathExtension
        preferredName = ext.isEmpty ? "\(baseName) copy" : "\(baseName) copy.\(ext)"
        return try availableChildURL(in: parentURL, preferredName: preferredName, pathExtension: ext.isEmpty ? nil : ext)
    }

    private func copyNode(at sourceURL: URL, to destinationURL: URL, isFolder: Bool) throws {
        if isFolder {
            try fileSystemService.copyItem(at: sourceURL, to: destinationURL)
        } else {
            try fileSystemService.copyItem(at: sourceURL, to: destinationURL)
        }
    }

    private func commitSidebarEdit(_ state: SidebarInlineEditState) async throws {
        let currentURL = state.placeholderURL ?? state.sourceURL
        guard let currentURL else { return }

        let normalizedName = normalizedRenameInput(
            state.draftName,
            pathExtension: state.isFolder ? "" : currentURL.pathExtension,
            isFolder: state.isFolder
        )
        let targetURL = state.parentURL.appendingPathComponent(normalizedName, isDirectory: state.isFolder)
        guard targetURL != currentURL else {
            sidebarEditState = nil
            return
        }

        remapSidebarSelectionAndExpansion(from: currentURL, to: targetURL, isFolder: state.isFolder)
        try fileSystemService.renameItem(at: currentURL, to: targetURL)

        if state.isFolder {
            documentStore.remapDocumentURLs(from: currentURL, to: targetURL)
        } else {
            documentStore.renameDocument(from: currentURL, to: targetURL)
        }

        if !remapNodeURLsInLoadedTree(from: currentURL, to: targetURL) {
            try await refreshAfterFilesystemChange(
                affectedParentURL: targetURL.deletingLastPathComponent(),
                selectedNodeID: targetURL.path
            )
        } else {
            selectedSidebarNodeID = targetURL.path
        }

        if !state.isFolder {
            recentHistoryStore.addFile(targetURL)
        }

        syncSummary = switch state.operation {
        case .createFile, .createFolder:
            "Created \(targetURL.lastPathComponent)"
        case .rename:
            "Renamed to \(targetURL.lastPathComponent)"
        case .duplicate:
            "Duplicated to \(targetURL.lastPathComponent)"
        }
    }

    private func remapSidebarSelectionAndExpansion(from oldURL: URL, to newURL: URL, isFolder: Bool) {
        let oldPath = oldURL.path
        let newPath = newURL.path
        let oldPrefix = oldPath + "/"
        let newPrefix = newPath + "/"

        if let selectedSidebarNodeID {
            if selectedSidebarNodeID == oldPath {
                self.selectedSidebarNodeID = newPath
            } else if selectedSidebarNodeID.hasPrefix(oldPrefix) {
                let suffix = String(selectedSidebarNodeID.dropFirst(oldPrefix.count))
                self.selectedSidebarNodeID = newPrefix + suffix
            }
        }

        guard isFolder else { return }

        var remappedExpandedIDs: Set<String> = []
        remappedExpandedIDs.reserveCapacity(expandedFolderIDs.count)
        for folderID in expandedFolderIDs {
            if folderID == oldPath {
                remappedExpandedIDs.insert(newPath)
            } else if folderID.hasPrefix(oldPrefix) {
                let suffix = String(folderID.dropFirst(oldPrefix.count))
                remappedExpandedIDs.insert(newPrefix + suffix)
            } else {
                remappedExpandedIDs.insert(folderID)
            }
        }
        expandedFolderIDs = remappedExpandedIDs
    }

    @discardableResult
    private func remapNodeURLsInLoadedTree(from oldURL: URL, to newURL: URL) -> Bool {
        let (updatedTree, didUpdate) = remapNodeURLs(in: fileTree, from: oldURL, to: newURL)
        guard didUpdate else { return false }
        fileTree = updatedTree
        rebuildFileTreePathIndex()
        return true
    }

    private func remapNodeURLs(
        in nodes: [FileTreeNode],
        from oldURL: URL,
        to newURL: URL
    ) -> ([FileTreeNode], Bool) {
        var didUpdate = false
        let remappedNodes = nodes.map { node -> FileTreeNode in
            let (remappedNode, changed) = remapNodeURL(node, from: oldURL, to: newURL)
            didUpdate = didUpdate || changed
            return remappedNode
        }
        return (remappedNodes, didUpdate)
    }

    private func remapNodeURL(
        _ node: FileTreeNode,
        from oldURL: URL,
        to newURL: URL
    ) -> (FileTreeNode, Bool) {
        let oldPath = oldURL.path
        let oldPrefix = oldPath + "/"

        guard node.url.path == oldPath || node.url.path.hasPrefix(oldPrefix) else {
            return (node, false)
        }

        let suffix = node.url.path == oldPath ? "" : String(node.url.path.dropFirst(oldPrefix.count))
        let remappedURL = suffix.isEmpty ? newURL : newURL.appendingPathComponent(suffix)
        let remappedChildren = node.children.map { remapNodeURL($0, from: oldURL, to: newURL).0 }
        let remappedNode = FileTreeNode(
            id: remappedURL.path,
            name: remappedURL.lastPathComponent,
            url: remappedURL,
            kind: node.kind,
            children: remappedChildren,
            isChildrenLoaded: node.isChildrenLoaded
        )
        return (remappedNode, true)
    }

    private func removeNodeFromLoadedTree(at targetURL: URL) -> Bool {
        let (updatedTree, didRemove) = removeNode(in: fileTree, targetURL: targetURL)
        guard didRemove else { return false }
        fileTree = updatedTree
        rebuildFileTreePathIndex()
        return true
    }

    private func removeNode(
        in nodes: [FileTreeNode],
        targetURL: URL
    ) -> ([FileTreeNode], Bool) {
        let targetPath = targetURL.path
        let targetPrefix = targetPath + "/"
        var didRemove = false

        let filtered = nodes.compactMap { node -> FileTreeNode? in
            if node.url.path == targetPath || node.url.path.hasPrefix(targetPrefix) {
                didRemove = true
                return nil
            }

            guard node.isFolder else { return node }

            let (children, childRemoved) = removeNode(in: node.children, targetURL: targetURL)
            if childRemoved {
                didRemove = true
                return FileTreeNode(
                    id: node.id,
                    name: node.name,
                    url: node.url,
                    kind: node.kind,
                    children: children,
                    isChildrenLoaded: node.isChildrenLoaded
                )
            }

            return node
        }

        return (filtered, didRemove)
    }

    private func updateNodeChildren(id nodeID: String, children: [FileTreeNode], isLoaded: Bool) {
        guard let path = fileTreePathIndex[nodeID] else { return }
        var updatedTree = fileTree
        updateNodeChildren(in: &updatedTree, path: path, children: children, isLoaded: isLoaded)
        fileTree = updatedTree
        rebuildFileTreePathIndex()
    }

    private func updateNodeChildren(
        in nodes: inout [FileTreeNode],
        path: [Int],
        children: [FileTreeNode],
        isLoaded: Bool
    ) {
        guard let head = path.first, nodes.indices.contains(head) else { return }

        if path.count == 1 {
            nodes[head].children = children
            nodes[head].isChildrenLoaded = isLoaded
            return
        }

        updateNodeChildren(
            in: &nodes[head].children,
            path: Array(path.dropFirst()),
            children: children,
            isLoaded: isLoaded
        )
    }

    private func node(for nodeID: String) -> FileTreeNode? {
        guard let path = fileTreePathIndex[nodeID] else { return nil }
        return node(at: path, in: fileTree)
    }

    private func node(at path: [Int], in nodes: [FileTreeNode]) -> FileTreeNode? {
        guard let head = path.first, nodes.indices.contains(head) else { return nil }
        let currentNode = nodes[head]
        guard path.count > 1 else { return currentNode }
        return node(at: Array(path.dropFirst()), in: currentNode.children)
    }

    private func publishFileTreeIncrementally(_ nodes: [FileTreeNode], loadID: UInt64) async {
        guard loadID == fileTreeLoadSequence else { return }
        guard !nodes.isEmpty else {
            fileTree = []
            fileTreePathIndex = [:]
            return
        }

        var publishedNodes: [FileTreeNode] = []
        publishedNodes.reserveCapacity(nodes.count)
        var pathIndex: [String: [Int]] = [:]

        for start in stride(from: 0, to: nodes.count, by: fileTreeBatchSize) {
            guard loadID == fileTreeLoadSequence else { return }
            let end = min(start + fileTreeBatchSize, nodes.count)
            let chunk = Array(nodes[start..<end])
            let baseIndex = publishedNodes.count
            publishedNodes.append(contentsOf: chunk)

            for (offset, node) in chunk.enumerated() {
                indexTreeNode(node, path: [baseIndex + offset], into: &pathIndex)
            }

            fileTree = publishedNodes
            fileTreePathIndex = pathIndex

            if end < nodes.count {
                await Task.yield()
            }
        }
    }

    private func rebuildFileTreePathIndex() {
        var nextIndex: [String: [Int]] = [:]
        for (offset, node) in fileTree.enumerated() {
            indexTreeNode(node, path: [offset], into: &nextIndex)
        }
        fileTreePathIndex = nextIndex
    }

    private func indexTreeNode(_ node: FileTreeNode, path: [Int], into index: inout [String: [Int]]) {
        index[node.id] = path

        for (offset, child) in node.children.enumerated() {
            indexTreeNode(child, path: path + [offset], into: &index)
        }
    }

    private func restoreExpandedFolders(_ folderIDs: Set<String>) async {
        guard !folderIDs.isEmpty else { return }
        let sortedFolderIDs = folderIDs.sorted { $0.count < $1.count }
        expandedFolderIDs = []

        for folderID in sortedFolderIDs {
            guard let node = node(for: folderID), node.isFolder else { continue }
            expandedFolderIDs.insert(folderID)
            await loadChildrenIfNeeded(for: node)
        }
    }

    func openDocument(at url: URL) async {
        openDocumentSequence &+= 1
        let openID = openDocumentSequence
        logger.info("Opening document request path=\(url.path, privacy: .public)")
        do {
            let text = try await Task.detached(priority: .userInitiated) { [fileSystemService] in
                try fileSystemService.readTextFile(at: url)
            }.value
            guard openID == openDocumentSequence else { return }
            documentStore.openDocument(name: url.lastPathComponent, url: url, content: text)
            logger.info("Opened document path=\(url.path, privacy: .public)")
            recentHistoryStore.addFile(url)
            refreshPreview(immediate: true)
        } catch {
            guard openID == openDocumentSequence else { return }
            syncSummary = "Open failed: \(error.localizedDescription)"
        }
    }

    func openPreviewLink(_ url: URL) async {
        if url.isFileURL {
            let standardizedURL = url.standardizedFileURL
            let targetURL = URL(fileURLWithPath: standardizedURL.path)
            let resourceValues = try? targetURL.resourceValues(forKeys: [.isDirectoryKey])
            let isDirectory = resourceValues?.isDirectory == true

            if fileSystemService.fileExists(at: targetURL), !isDirectory {
                let pathExtension = targetURL.pathExtension.lowercased()
                if ["md", "markdown", "txt"].contains(pathExtension) {
                    let parentFolderURL = targetURL.deletingLastPathComponent()
                    if currentFolderURL?.standardizedFileURL != parentFolderURL.standardizedFileURL {
                        await openWorkspaceFolder(at: parentFolderURL)
                    }
                    await openDocument(at: targetURL)
                    return
                }

                NSWorkspace.shared.open(targetURL)
                return
            }

            if isDirectory {
                await openWorkspaceFolder(at: targetURL)
                return
            }
        }

        NSWorkspace.shared.open(url)
    }

    private func fallbackDocumentName(for document: DocumentTab) -> String {
        let base = document.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        if base.isEmpty || base == "Untitled" {
            return "Untitled.md"
        }
        if base.contains(".") {
            return base
        }
        return base + ".md"
    }

    private func preferredNewDocumentFolderURL() -> URL? {
        guard sidebarPanelMode == .files else { return currentFolderURL }
        guard let selectedSidebarNodeID, let node = node(for: selectedSidebarNodeID) else {
            return currentFolderURL
        }
        return node.isFolder ? node.url : node.url.deletingLastPathComponent()
    }

    private func availableChildURL(
        in folderURL: URL,
        preferredName: String,
        pathExtension: String? = nil
    ) throws -> URL {
        let preferredURL = folderURL.appendingPathComponent(preferredName)
        let resolvedExtension: String
        let baseName: String

        if let pathExtension {
            resolvedExtension = pathExtension
            baseName = preferredName
        } else {
            resolvedExtension = preferredURL.pathExtension
            baseName = preferredURL.deletingPathExtension().lastPathComponent
        }

        var candidateURL = preferredURL
        var index = 2

        while fileSystemService.fileExists(at: candidateURL) {
            let numberedName = resolvedExtension.isEmpty
                ? "\(baseName) \(index)"
                : "\(baseName) \(index).\(resolvedExtension)"
            candidateURL = folderURL.appendingPathComponent(numberedName)
            index += 1
        }

        return candidateURL
    }

    private func revealCreatedItem(at url: URL) async throws {
        try await refreshAfterFilesystemChange(
            affectedParentURL: url.deletingLastPathComponent(),
            selectedNodeID: url.path
        )
        if let currentFolderURL,
           url.path.hasPrefix(currentFolderURL.path + "/") {
            await expandFolderChain(from: currentFolderURL, to: url.deletingLastPathComponent())
        }
    }

    private func refreshAfterFilesystemChange(affectedParentURL: URL, selectedNodeID: String?) async throws {
        guard let currentFolderURL else { return }

        if affectedParentURL == currentFolderURL {
            await loadFileTree(for: currentFolderURL, preserveExpansionState: true, selectedNodeID: selectedNodeID)
            return
        }

        guard let parentNode = node(for: affectedParentURL.path) else {
            await loadFileTree(for: currentFolderURL, preserveExpansionState: true, selectedNodeID: selectedNodeID)
            return
        }

        expandedFolderIDs.insert(parentNode.id)
        await reloadChildren(for: parentNode, selectedNodeID: selectedNodeID)
    }

    private func reloadChildren(for node: FileTreeNode, selectedNodeID: String?) async {
        guard node.isFolder else { return }
        let showHiddenFiles = settingsStore.showHiddenFiles

        do {
            let children = try await Task.detached(priority: .userInitiated) { [fileSystemService] in
                try fileSystemService.listDirectory(at: node.url, showHiddenFiles: showHiddenFiles)
            }.value
            updateNodeChildren(id: node.id, children: children, isLoaded: true)
            self.selectedSidebarNodeID = selectedNodeID
        } catch {
            syncSummary = "Folder load failed: \(error.localizedDescription)"
        }
    }

    private func dropURLs(from providers: [NSItemProvider], fallbackNodeIDs: Set<String>) async -> [URL] {
        if !fallbackNodeIDs.isEmpty {
            return fallbackNodeIDs.compactMap { node(for: $0)?.url }
        }

        var urls: [URL] = []
        for provider in providers {
            if let url = await loadFileURL(from: provider) {
                urls.append(url)
            }
        }
        return urls
    }

    private func loadFileURL(from provider: NSItemProvider) async -> URL? {
        await withCheckedContinuation { continuation in
            provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                if let data = item as? Data,
                   let url = URL(dataRepresentation: data, relativeTo: nil) {
                    continuation.resume(returning: url)
                } else if let url = item as? URL {
                    continuation.resume(returning: url)
                } else {
                    continuation.resume(returning: nil)
                }
            }
        }
    }

    private func moveNodes(_ urls: [URL], to destinationFolderURL: URL) async {
        guard let currentFolderURL else { return }
        let fileManager = FileManager.default
        let uniqueURLs = Array(Set(urls))
        var movedCount = 0

        for sourceURL in uniqueURLs {
            if sourceURL == destinationFolderURL {
                continue
            }
            if destinationFolderURL.path.hasPrefix(sourceURL.path + "/") {
                continue
            }
            if sourceURL.deletingLastPathComponent() == destinationFolderURL {
                continue
            }

            let preferredName = sourceURL.lastPathComponent
            var isDirectory: ObjCBool = false
            let exists = fileManager.fileExists(atPath: sourceURL.path, isDirectory: &isDirectory)
            guard exists else { continue }
            let isFolder = isDirectory.boolValue
            let targetURL: URL
            do {
                targetURL = try availableChildURL(in: destinationFolderURL, preferredName: preferredName, pathExtension: isFolder ? nil : nil)
            } catch {
                syncSummary = "Move failed: \(error.localizedDescription)"
                return
            }

            do {
                try fileSystemService.renameItem(at: sourceURL, to: targetURL)
                if isFolder {
                    documentStore.remapDocumentURLs(from: sourceURL, to: targetURL)
                } else {
                    documentStore.renameDocument(from: sourceURL, to: targetURL)
                }
                movedCount += 1
            } catch {
                syncSummary = "Move failed: \(error.localizedDescription)"
                return
            }
        }

        guard movedCount > 0 else { return }
        await loadFileTree(for: currentFolderURL, preserveExpansionState: true, selectedNodeID: destinationFolderURL.path)
        updateSidebarSelection([destinationFolderURL.path], primaryID: destinationFolderURL.path)
        syncSummary = "Moved \(movedCount) items"
    }

    private func expandFolderChain(from rootURL: URL, to targetURL: URL) async {
        guard targetURL != rootURL else { return }
        let relative = relativePath(from: rootURL, to: targetURL)
        guard !relative.isEmpty else { return }
        let components = relative.split(separator: "/").map(String.init)
        var currentURL = rootURL

        for component in components {
            currentURL = currentURL.appendingPathComponent(component)
            guard let node = node(for: currentURL.path), node.isFolder else { continue }
            expandedFolderIDs.insert(node.id)
            await loadChildrenIfNeeded(for: node)
        }
    }

    private func normalizedRenameInput(_ rawValue: String, pathExtension: String, isFolder: Bool) -> String {
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return isFolder ? "Untitled Folder" : "Untitled.\(pathExtension)"
        }

        if isFolder || pathExtension.isEmpty || trimmed.lowercased().hasSuffix(".\(pathExtension.lowercased())") {
            return trimmed
        }

        return "\(trimmed).\(pathExtension)"
    }

    private func relativePath(from rootURL: URL, to fileURL: URL) -> String {
        fileURL.path
            .replacingOccurrences(of: rootURL.path + "/", with: "")
            .replacingOccurrences(of: "\\", with: "/")
    }

    private func currentPreviewRequest() -> PreviewRequest? {
        guard let activeDocument = documentStore.activeDocument, !activeDocument.content.isEmpty else {
            return nil
        }

        return PreviewRequest(
            documentID: activeDocument.id,
            markdown: activeDocument.content,
            baseURL: activeDocument.fileURL?.deletingLastPathComponent() ?? currentFolderURL,
            mode: settingsStore.previewMode,
            pdfFontSize: themeStore.previewFontSize,
            pdfFontFamilyCSS: themeStore.previewFontFamilyCSS()
        )
    }

    private func isValidURLString(_ value: String) -> Bool {
        guard let url = URL(string: value) else { return false }
        guard let scheme = url.scheme?.lowercased() else { return false }
        return scheme == "http" || scheme == "https"
    }

    private func normalizedURLString(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        if isValidURLString(trimmed) {
            return trimmed
        }
        if trimmed.hasPrefix("www."), let url = URL(string: "https://\(trimmed)") {
            return url.absoluteString
        }
        return nil
    }

    private func currentWebDAVConfiguration() -> WebDAVConfiguration {
        WebDAVConfiguration(
            url: settingsStore.webdavURL,
            username: settingsStore.webdavUsername,
            folder: settingsStore.webdavFolder
        )
    }

    private func downloadMissingRemoteFiles(
        into rootURL: URL,
        configuration: WebDAVConfiguration,
        snapshots: inout [String: SyncSnapshotEntry]
    ) async throws -> (downloadedCount: Int, conflictCount: Int) {
        var queue = [""]
        var downloadedCount = 0
        var conflictCount = 0
        let localFiles = try Set(
            fileSystemService
                .listTextFilesRecursively(at: rootURL, showHiddenFiles: settingsStore.showHiddenFiles)
                .map { relativePath(from: rootURL, to: $0) }
        )
        var knownLocalFiles = localFiles

        while let currentPath = queue.first {
            queue.removeFirst()
            let entries = try await webDAVService.listFiles(at: currentPath, configuration: configuration)

            for entry in entries {
                if entry.isDirectory {
                    queue.append(entry.path)
                    continue
                }

                let ext = URL(fileURLWithPath: entry.path).pathExtension.lowercased()
                guard ["md", "markdown", "txt"].contains(ext) else { continue }
                let localURL = rootURL.appendingPathComponent(entry.path)
                let content = try await webDAVService.downloadTextFile(remotePath: entry.path, configuration: configuration)

                if !knownLocalFiles.contains(entry.path) {
                    try fileSystemService.ensureDirectoryExists(at: localURL.deletingLastPathComponent())
                    try fileSystemService.writeTextFile(content, to: localURL)
                    knownLocalFiles.insert(entry.path)
                    let localSignature = try localSignature(for: localURL)
                    snapshots[entry.path] = SyncSnapshotEntry(
                        localSignature: localSignature,
                        remoteSignature: entry.signature
                    )
                    downloadedCount += 1
                    continue
                }

                if try shouldCreateConflictCopy(for: entry, localURL: localURL, snapshot: snapshots[entry.path]) {
                    let conflictURL = conflictCopyURL(for: localURL)
                    try fileSystemService.writeTextFile(content, to: conflictURL)
                    conflictCount += 1
                    continue
                }

                if try shouldUpdateLocalFile(for: entry, localURL: localURL, snapshot: snapshots[entry.path]) {
                    try fileSystemService.writeTextFile(content, to: localURL)
                    let updatedLocalSignature = try localSignature(for: localURL)
                    snapshots[entry.path] = SyncSnapshotEntry(
                        localSignature: updatedLocalSignature,
                        remoteSignature: entry.signature
                    )
                    downloadedCount += 1
                }
            }
        }

        if downloadedCount > 0 || conflictCount > 0 {
            await loadFileTree(for: rootURL)
        }

        return (downloadedCount, conflictCount)
    }

    private func shouldCreateConflictCopy(
        for remoteEntry: WebDAVRemoteEntry,
        localURL: URL,
        snapshot: SyncSnapshotEntry?
    ) throws -> Bool {
        guard fileSystemService.fileExists(at: localURL) else { return false }
        guard let snapshot else { return true }
        let localAttributes = try fileSystemService.fileAttributes(at: localURL)
        let remoteSize = remoteEntry.size ?? 0
        let localSize = localAttributes.size
        let localSignature = try self.localSignature(for: localURL)
        let remoteChanged = !signaturesMatch(snapshot.remoteSignature, remoteEntry.signature)
        let localChanged = !signaturesMatch(snapshot.localSignature, localSignature)

        guard remoteChanged && localChanged else { return false }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        let remoteDate = remoteEntry.lastModified.flatMap { formatter.date(from: $0) }

        guard let remoteDate, let localDate = localAttributes.modifiedAt else {
            return remoteSize != localSize
        }

        let timeDelta = remoteDate.timeIntervalSince(localDate)
        let sizeChanged = remoteSize != localSize
        return sizeChanged && timeDelta > 2
    }

    private func shouldUpdateLocalFile(
        for remoteEntry: WebDAVRemoteEntry,
        localURL: URL,
        snapshot: SyncSnapshotEntry?
    ) throws -> Bool {
        guard fileSystemService.fileExists(at: localURL) else { return true }
        guard let snapshot else { return false }
        let localSignature = try self.localSignature(for: localURL)
        let localChanged = !signaturesMatch(snapshot.localSignature, localSignature)
        let remoteChanged = !signaturesMatch(snapshot.remoteSignature, remoteEntry.signature)
        return !localChanged && remoteChanged
    }

    private func conflictCopyURL(for localURL: URL) -> URL {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        let stamp = formatter.string(from: Date())

        let directory = localURL.deletingLastPathComponent()
        let baseName = localURL.deletingPathExtension().lastPathComponent
        let ext = localURL.pathExtension
        let filename = ext.isEmpty
            ? "\(baseName).remote-conflict-\(stamp)"
            : "\(baseName).remote-conflict-\(stamp).\(ext)"
        return directory.appendingPathComponent(filename)
    }

    private func localSignature(for fileURL: URL) throws -> String {
        let attributes = try fileSystemService.fileAttributes(at: fileURL)
        let mtime = attributes.modifiedAt?.timeIntervalSince1970 ?? 0
        return #"{"size":\#(attributes.size),"mtime":\#(mtime)}"#
    }

    private func signaturesMatch(_ lhs: String?, _ rhs: String?) -> Bool {
        guard let lhs, let rhs else { return false }
        if lhs == rhs { return true }

        guard
            let left = parseSignature(lhs),
            let right = parseSignature(rhs)
        else {
            return false
        }

        guard left.size == right.size else { return false }
        guard let leftTime = left.mtime, let rightTime = right.mtime else { return false }
        return abs(leftTime - rightTime) <= syncToleranceSeconds
    }

    private func parseSignature(_ raw: String) -> (size: Int64, mtime: TimeInterval?)? {
        guard let data = raw.data(using: .utf8) else { return nil }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }

        let size = (json["size"] as? NSNumber)?.int64Value ?? 0
        if let mtime = json["mtime"] as? NSNumber {
            return (size, mtime.doubleValue)
        }
        if let mtimeString = json["mtime"] as? String, !mtimeString.isEmpty {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
            return (size, formatter.date(from: mtimeString)?.timeIntervalSince1970)
        }
        return (size, nil)
    }

    private func syncSnapshotKey(for configuration: WebDAVConfiguration, currentFolderURL: URL) -> String {
        let payload = [
            currentFolderURL.path,
            configuration.normalizedFolder,
            configuration.url.trimmingCharacters(in: .whitespacesAndNewlines),
            configuration.username.trimmingCharacters(in: .whitespacesAndNewlines)
        ].joined(separator: "|")
        return syncSnapshotPrefix + payload
    }

    private func loadSyncSnapshots(
        for configuration: WebDAVConfiguration,
        currentFolderURL: URL
    ) -> [String: SyncSnapshotEntry] {
        let key = syncSnapshotKey(for: configuration, currentFolderURL: currentFolderURL)
        guard let data = defaults.data(forKey: key) else { return [:] }
        return (try? JSONDecoder().decode([String: SyncSnapshotEntry].self, from: data)) ?? [:]
    }

    private func persistSyncSnapshots(
        _ snapshots: [String: SyncSnapshotEntry],
        for configuration: WebDAVConfiguration,
        currentFolderURL: URL
    ) {
        let key = syncSnapshotKey(for: configuration, currentFolderURL: currentFolderURL)
        guard let data = try? JSONEncoder().encode(snapshots) else { return }
        defaults.set(data, forKey: key)
    }

    private func imageDestination() -> (directoryURL: URL, fileURL: URL, relativePath: String)? {
        let trimmedAttachmentFolder = settingsStore.attachmentFolder.trimmingCharacters(in: .whitespacesAndNewlines)
        let attachmentFolder = trimmedAttachmentFolder.isEmpty ? "00- Attachment" : trimmedAttachmentFolder

        let baseDirectory: URL?
        if let documentURL = documentStore.activeDocument?.fileURL {
            baseDirectory = documentURL.deletingLastPathComponent()
        } else {
            baseDirectory = currentFolderURL
        }

        guard let baseDirectory else { return nil }
        let attachmentDirectory = baseDirectory.appendingPathComponent(attachmentFolder, isDirectory: true)
        let filename = "pasted-image-\(timestampForFilename()).png"
        let fileURL = attachmentDirectory.appendingPathComponent(filename)
        return (attachmentDirectory, fileURL, "\(attachmentFolder)/\(filename)")
    }

    private func timestampForFilename() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd-HHmmss"
        return formatter.string(from: Date())
    }

    private func prepareInitialLaunchState() {
        defaults.removeObject(forKey: sessionKey)
        lastPersistedSessionDigest = nil
        currentFolderURL = nil
        fileTree = []
        selectedSidebarNodeID = nil
        selectedSidebarNodeIDs = []
        draggingSidebarNodeIDs = []
        expandedFolderIDs = []
        sidebarEditState = nil
        syncSummary = nil
        previewState = .idle
        previewNeedsRefreshWhenVisible = false
        previewRefreshTask?.cancel()

        if isAutomatedLaunch {
            documentStore.resetForAutomatedLaunch()
            refreshPreview(immediate: true)
            return
        }

        documentStore.resetForFreshLaunch()
        documentStore.createUntitledDocument()
        refreshPreview(immediate: true)
    }

    private func schedulePersistSession(immediate: Bool = false) {
        persistSessionTask?.cancel()
        persistSessionTask = Task { @MainActor [weak self] in
            guard let self else { return }
            if !immediate {
                try? await Task.sleep(for: .milliseconds(900))
            }
            guard !Task.isCancelled else { return }
            self.persistSessionNow()
        }
    }

    private func persistSessionNow() {
        persistSessionTask?.cancel()
        persistSessionTask = nil
        documentStore.flushActiveDocumentEdits()

        let snapshot = WorkspaceSessionSnapshot(
            currentFolderURL: currentFolderURL,
            activeDocumentID: documentStore.activeDocumentID,
            openDocuments: documentStore.sessionSnapshots()
        )

        guard let data = try? JSONEncoder().encode(snapshot) else {
            return
        }
        let digest = data.hashValue
        guard digest != lastPersistedSessionDigest else { return }
        lastPersistedSessionDigest = digest
        defaults.set(data, forKey: sessionKey)
    }

    nonisolated private static func resolveSessionSnapshot(_ snapshot: SessionDocumentSnapshot) -> SessionDocumentSnapshot {
        guard snapshot.content == nil || snapshot.savedContent == nil else {
            return snapshot
        }
        guard let fileURL = snapshot.fileURL, FileManager.default.fileExists(atPath: fileURL.path) else {
            return SessionDocumentSnapshot(
                id: snapshot.id,
                displayName: snapshot.displayName,
                fileURL: snapshot.fileURL,
                content: snapshot.content ?? "",
                savedContent: snapshot.savedContent ?? "",
                selectedRangeLocation: snapshot.selectedRangeLocation,
                selectedRangeLength: snapshot.selectedRangeLength,
                verticalScrollFraction: snapshot.verticalScrollFraction
            )
        }
        guard let content = try? String(contentsOf: fileURL, encoding: .utf8) else {
            return SessionDocumentSnapshot(
                id: snapshot.id,
                displayName: snapshot.displayName,
                fileURL: snapshot.fileURL,
                content: snapshot.content ?? "",
                savedContent: snapshot.savedContent ?? "",
                selectedRangeLocation: snapshot.selectedRangeLocation,
                selectedRangeLength: snapshot.selectedRangeLength,
                verticalScrollFraction: snapshot.verticalScrollFraction
            )
        }

        return SessionDocumentSnapshot(
            id: snapshot.id,
            displayName: snapshot.displayName,
            fileURL: snapshot.fileURL,
            content: snapshot.content ?? content,
            savedContent: snapshot.savedContent ?? content,
            selectedRangeLocation: snapshot.selectedRangeLocation,
            selectedRangeLength: snapshot.selectedRangeLength,
            verticalScrollFraction: snapshot.verticalScrollFraction
        )
    }
}
