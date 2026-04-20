import Foundation
import OSLog

@MainActor
final class DocumentStore: ObservableObject {
    @Published private(set) var openDocuments: [DocumentTab] = []
    @Published var activeDocumentID: UUID?
    @Published private(set) var recentlySavedDocumentID: UUID?
    @Published var currentSelection: NSRange = .init(location: 0, length: 0)
    @Published var currentVisibleLine: Int = 0
    @Published var currentScrollFraction: Double = 0
    @Published var findReplaceState = FindReplaceState()
    @Published private(set) var tableOfContents: [TableOfContentsHeading] = []
    @Published private(set) var statusText: String = "0 words · 0 lines"

    private struct PendingDocumentUpdate {
        var content: String?
        var selection: NSRange?
        var scrollFraction: Double?
    }

    private var pendingUpdatesByDocumentID: [UUID: PendingDocumentUpdate] = [:]
    private var pendingCommitTask: Task<Void, Never>?
    private var clearSaveFeedbackTask: Task<Void, Never>?
    private let logger = Logger(subsystem: "com.justmark.mac", category: "Document")

    var activeDocument: DocumentTab? {
        get {
            guard let documentID = activeDocumentID,
                  let document = openDocuments.first(where: { $0.id == documentID }) else {
                return nil
            }
            return resolvedDocument(document)
        }
        set {
            guard let newValue, let index = openDocuments.firstIndex(where: { $0.id == newValue.id }) else { return }
            openDocuments[index] = newValue
            pendingUpdatesByDocumentID.removeValue(forKey: newValue.id)
        }
    }

    func createUntitledDocument() {
        flushPendingEdits(for: activeDocumentID)
        let document = DocumentTab(
            displayName: "Untitled",
            fileURL: nil,
            content: "",
            savedContent: ""
        )
        openDocuments.append(document)
        activeDocumentID = document.id
    }

    func resetForFreshLaunch() {
        resetDocumentState()
    }

    func resetForAutomatedLaunch() {
        resetDocumentState()
    }

    func restoreSessionDocuments(_ snapshots: [SessionDocumentSnapshot], activeDocumentID: UUID?) {
        pendingCommitTask?.cancel()
        pendingCommitTask = nil
        pendingUpdatesByDocumentID.removeAll()
        openDocuments = snapshots.map {
            DocumentTab(
                id: $0.id,
                displayName: $0.displayName,
                fileURL: $0.fileURL,
                content: $0.content ?? "",
                savedContent: $0.savedContent ?? "",
                selectedRange: NSRange(location: $0.selectedRangeLocation, length: $0.selectedRangeLength),
                verticalScrollFraction: $0.verticalScrollFraction
            )
        }
        self.activeDocumentID = activeDocumentID ?? openDocuments.first?.id
        recentlySavedDocumentID = nil
        if let activeDocument = activeDocument {
            currentSelection = activeDocument.selectedRange
            currentScrollFraction = activeDocument.verticalScrollFraction
        }
        refreshDerivedState()
    }

    private func resetDocumentState() {
        pendingCommitTask?.cancel()
        pendingCommitTask = nil
        pendingUpdatesByDocumentID.removeAll()
        openDocuments = []
        activeDocumentID = nil
        currentSelection = .init(location: 0, length: 0)
        currentVisibleLine = 0
        currentScrollFraction = 0
        findReplaceState = FindReplaceState()
        recentlySavedDocumentID = nil
        refreshDerivedState()
    }

    func openDocument(name: String, url: URL?, content: String) {
        if let existing = openDocuments.first(where: { $0.fileURL == url && url != nil }) {
            activateDocument(id: existing.id)
            return
        }

        flushPendingEdits(for: activeDocumentID)
        let document = DocumentTab(
            displayName: name,
            fileURL: url,
            content: content,
            savedContent: content
        )
        openDocuments.append(document)
        activeDocumentID = document.id
        currentSelection = document.selectedRange
        currentScrollFraction = document.verticalScrollFraction
        refreshDerivedState()
    }

    func closeDocument(id: UUID) {
        pendingCommitTask?.cancel()
        pendingCommitTask = nil
        if pendingUpdatesByDocumentID[id] != nil, let index = openDocuments.firstIndex(where: { $0.id == id }) {
            openDocuments[index] = resolvedDocument(openDocuments[index])
        }
        pendingUpdatesByDocumentID.removeValue(forKey: id)

        guard let closingIndex = openDocuments.firstIndex(where: { $0.id == id }) else { return }
        openDocuments.remove(at: closingIndex)
        if activeDocumentID == id {
            if openDocuments.isEmpty {
                activeDocumentID = nil
                currentSelection = .init(location: 0, length: 0)
                currentScrollFraction = 0
            } else {
                let fallbackIndex = min(closingIndex, openDocuments.count - 1)
                activeDocumentID = openDocuments[fallbackIndex].id
                currentSelection = openDocuments[fallbackIndex].selectedRange
                currentScrollFraction = openDocuments[fallbackIndex].verticalScrollFraction
            }
        }
        refreshDerivedState()
    }

    func closeActiveDocument() {
        guard let activeDocumentID else { return }
        closeDocument(id: activeDocumentID)
    }

    func flushActiveDocumentEdits() {
        flushPendingEdits(for: activeDocumentID)
    }

    func updateActiveContent(_ content: String) {
        guard let documentID = activeDocumentID else { return }
        var pending = pendingUpdatesByDocumentID[documentID] ?? PendingDocumentUpdate()
        if pending.content == content { return }
        if recentlySavedDocumentID == documentID {
            clearSaveFeedbackTask?.cancel()
            recentlySavedDocumentID = nil
        }
        pending.content = content
        pending.selection = currentSelection
        pending.scrollFraction = currentScrollFraction
        pendingUpdatesByDocumentID[documentID] = pending
        schedulePendingCommit(for: documentID)
    }

    func markActiveDocumentSaved() {
        guard var document = activeDocument else { return }
        document.savedContent = document.content
        activeDocument = document
        publishSaveFeedback(for: document.id)
        refreshDerivedState()
    }

    func updateActiveDocumentFile(url: URL) {
        guard var document = activeDocument else { return }
        document.fileURL = url
        document.displayName = url.lastPathComponent
        activeDocument = document
        refreshDerivedState()
    }

    func renameDocument(from oldURL: URL, to newURL: URL) {
        var didUpdate = false
        openDocuments = openDocuments.map { document in
            guard document.fileURL == oldURL else { return document }
            didUpdate = true
            var updated = document
            updated.fileURL = newURL
            updated.displayName = newURL.lastPathComponent
            return updated
        }
        if didUpdate {
            refreshDerivedState()
        }
    }

    func remapDocumentURLs(from oldFolderURL: URL, to newFolderURL: URL) {
        let oldPrefix = oldFolderURL.path + "/"
        var didUpdate = false

        openDocuments = openDocuments.map { document in
            guard let fileURL = document.fileURL else { return document }
            guard fileURL.path == oldFolderURL.path || fileURL.path.hasPrefix(oldPrefix) else { return document }

            let suffix = fileURL.path == oldFolderURL.path
                ? ""
                : String(fileURL.path.dropFirst(oldPrefix.count))
            let newURL = suffix.isEmpty
                ? newFolderURL
                : newFolderURL.appendingPathComponent(suffix)

            var updated = document
            updated.fileURL = newURL
            updated.displayName = newURL.lastPathComponent
            didUpdate = true
            return updated
        }

        if didUpdate {
            refreshDerivedState()
        }
    }

    func closeDocuments(atOrInside targetURL: URL) {
        let targetPath = targetURL.path
        let prefix = targetPath + "/"
        let survivingDocuments = openDocuments.filter { document in
            guard let fileURL = document.fileURL else { return true }
            return !(fileURL.path == targetPath || fileURL.path.hasPrefix(prefix))
        }

        guard survivingDocuments.count != openDocuments.count else { return }
        openDocuments = survivingDocuments

        if let activeDocumentID, !openDocuments.contains(where: { $0.id == activeDocumentID }) {
            self.activeDocumentID = openDocuments.last?.id
        }

        if let activeDocument {
            currentSelection = activeDocument.selectedRange
            currentScrollFraction = activeDocument.verticalScrollFraction
        } else {
            currentSelection = .init(location: 0, length: 0)
            currentScrollFraction = 0
        }

        if let recentlySavedDocumentID, !openDocuments.contains(where: { $0.id == recentlySavedDocumentID }) {
            self.recentlySavedDocumentID = nil
        }

        refreshDerivedState()
    }

    func applyInlineFormat(_ format: MarkdownInlineFormat) {
        guard var document = activeDocument else { return }
        let result = MarkdownFormatter.apply(format, to: document.content, selection: currentSelection)
        document.content = result.text
        document.selectedRange = result.selection
        activeDocument = document
        currentSelection = result.selection
        refreshDerivedState()
    }

    func jumpTo(line: Int) {
        currentVisibleLine = line
    }

    func sessionSnapshots() -> [SessionDocumentSnapshot] {
        openDocuments.map { document in
            let resolved = resolvedDocument(document)
            let shouldPersistContent = resolved.fileURL == nil || resolved.hasUnsavedChanges
            return SessionDocumentSnapshot(
                id: resolved.id,
                displayName: resolved.displayName,
                fileURL: resolved.fileURL,
                content: shouldPersistContent ? resolved.content : nil,
                savedContent: shouldPersistContent ? resolved.savedContent : nil,
                selectedRangeLocation: resolved.selectedRange.location,
                selectedRangeLength: resolved.selectedRange.length,
                verticalScrollFraction: resolved.verticalScrollFraction
            )
        }
    }

    func activateDocument(id: UUID) {
        flushPendingEdits(for: activeDocumentID)
        activeDocumentID = id
        guard let document = activeDocument else { return }
        logger.info(
            "Activated document id=\(document.id.uuidString, privacy: .public) name=\(document.displayName, privacy: .public) path=\(document.fileURL?.path ?? "<untitled>", privacy: .public)"
        )
        currentSelection = document.selectedRange
        currentScrollFraction = document.verticalScrollFraction
        refreshDerivedState()
    }

    func updateSelection(_ range: NSRange) {
        currentSelection = range
        guard let documentID = activeDocumentID else { return }
        var pending = pendingUpdatesByDocumentID[documentID] ?? PendingDocumentUpdate()
        pending.selection = range
        pendingUpdatesByDocumentID[documentID] = pending
    }

    func updateScrollFraction(_ fraction: Double) {
        currentScrollFraction = fraction
        guard let documentID = activeDocumentID else { return }
        var pending = pendingUpdatesByDocumentID[documentID] ?? PendingDocumentUpdate()
        pending.scrollFraction = fraction
        pendingUpdatesByDocumentID[documentID] = pending
    }

    func selectedText() -> String? {
        guard let document = activeDocument else { return nil }
        guard let range = Range(currentSelection, in: document.content) else { return nil }
        return String(document.content[range])
    }

    func replaceSelection(with replacement: String) {
        guard var document = activeDocument, let range = Range(currentSelection, in: document.content) else { return }
        document.content = document.content.replacingCharacters(in: range, with: replacement)
        let cursor = currentSelection.location + (replacement as NSString).length
        let selection = NSRange(location: cursor, length: 0)
        document.selectedRange = selection
        activeDocument = document
        currentSelection = selection
        refreshDerivedState()
    }

    func replaceAllMatches() {
        guard let search = normalizedSearchTerm else { return }
        guard var document = activeDocument else { return }

        let source = document.content as NSString
        let regex = makeSearchRegex(search)
        let fullRange = NSRange(location: 0, length: source.length)
        let replaced = regex.stringByReplacingMatches(in: document.content, options: [], range: fullRange, withTemplate: findReplaceState.replaceTerm)
        document.content = replaced
        document.selectedRange = NSRange(location: 0, length: 0)
        activeDocument = document
        currentSelection = document.selectedRange
        refreshDerivedState()
    }

    func findNextMatch() {
        guard let search = normalizedSearchTerm, let document = activeDocument else { return }
        let regex = makeSearchRegex(search)
        let source = document.content as NSString
        let fullRange = NSRange(location: 0, length: source.length)
        let startLocation = min(max(currentSelection.location + currentSelection.length, 0), fullRange.length)

        if let next = regex.firstMatch(in: document.content, options: [], range: NSRange(location: startLocation, length: fullRange.length - startLocation)) ??
            regex.firstMatch(in: document.content, options: [], range: fullRange) {
            updateSelection(next.range)
        }
    }

    func findPreviousMatch() {
        guard let search = normalizedSearchTerm, let document = activeDocument else { return }
        let regex = makeSearchRegex(search)
        let source = document.content as NSString
        let fullRange = NSRange(location: 0, length: source.length)
        let matches = regex.matches(in: document.content, options: [], range: fullRange)
        guard !matches.isEmpty else { return }

        let currentLocation = currentSelection.location
        let previous = matches.last(where: { $0.range.location < currentLocation }) ?? matches.last
        if let previous {
            updateSelection(previous.range)
        }
    }

    func replaceCurrentMatch() {
        guard let search = normalizedSearchTerm else { return }
        guard let document = activeDocument, let range = Range(currentSelection, in: document.content) else {
            findNextMatch()
            return
        }

        let selected = String(document.content[range])
        let options: String.CompareOptions = findReplaceState.isCaseSensitive ? [] : [.caseInsensitive]
        guard selected.range(of: search, options: options) != nil else {
            findNextMatch()
            return
        }

        replaceSelection(with: findReplaceState.replaceTerm)
        findNextMatch()
    }

    private var normalizedSearchTerm: String? {
        let trimmed = findReplaceState.searchTerm.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func makeSearchRegex(_ search: String) -> NSRegularExpression {
        let pattern = NSRegularExpression.escapedPattern(for: search)
        let options: NSRegularExpression.Options = findReplaceState.isCaseSensitive ? [] : [.caseInsensitive]
        return (try? NSRegularExpression(pattern: pattern, options: options)) ?? (try! NSRegularExpression(pattern: pattern))
    }

    private func schedulePendingCommit(for documentID: UUID) {
        pendingCommitTask?.cancel()
        pendingCommitTask = Task {
            try? await Task.sleep(for: .milliseconds(140))
            guard !Task.isCancelled else { return }
            await MainActor.run {
                self.flushPendingEdits(for: documentID)
            }
        }
    }

    private func flushPendingEdits(for documentID: UUID?) {
        guard let documentID else { return }
        pendingCommitTask?.cancel()
        pendingCommitTask = nil

        guard let index = openDocuments.firstIndex(where: { $0.id == documentID }) else {
            pendingUpdatesByDocumentID.removeValue(forKey: documentID)
            return
        }

        let resolved = resolvedDocument(openDocuments[index])
        if resolved != openDocuments[index] {
            openDocuments[index] = resolved
        }
        pendingUpdatesByDocumentID.removeValue(forKey: documentID)
        refreshDerivedState()
    }

    private func resolvedDocument(_ document: DocumentTab) -> DocumentTab {
        guard let pending = pendingUpdatesByDocumentID[document.id] else { return document }
        var resolved = document
        if let content = pending.content {
            resolved.content = content
        }
        if let selection = pending.selection {
            resolved.selectedRange = selection
        }
        if let scrollFraction = pending.scrollFraction {
            resolved.verticalScrollFraction = scrollFraction
        }
        return resolved
    }

    private func refreshDerivedState() {
        let text = activeDocument?.content ?? ""
        tableOfContents = TocParser.extractHeadings(from: text)
        let words = text.split { $0.isWhitespace || $0.isNewline }.count
        let lines = text.isEmpty ? 0 : text.split(separator: "\n", omittingEmptySubsequences: false).count
        statusText = "\(words) words · \(lines) lines"
    }

    private func publishSaveFeedback(for documentID: UUID) {
        clearSaveFeedbackTask?.cancel()
        recentlySavedDocumentID = documentID
        clearSaveFeedbackTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(1.4))
            guard let self, self.recentlySavedDocumentID == documentID else { return }
            self.recentlySavedDocumentID = nil
        }
    }
}

struct FindReplaceState {
    var isPresented = false
    var searchTerm = ""
    var replaceTerm = ""
    var isCaseSensitive = false
}
