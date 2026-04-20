import AppKit
import Foundation
import UniformTypeIdentifiers

final class FileSystemService {
    private let fileManager = FileManager.default

    func openDocumentPanel() async -> URL? {
        return await presentOpenPanel { panel in
            panel.canChooseDirectories = false
            panel.canChooseFiles = true
            panel.allowedContentTypes = []
        }
    }

    func openFolderPanel() async -> URL? {
        await presentOpenPanel { panel in
            panel.canChooseDirectories = true
            panel.canChooseFiles = false
            panel.canCreateDirectories = true
        }
    }

    func saveDocumentPanel(suggestedName: String) async -> URL? {
        await presentSavePanel { panel in
            panel.canCreateDirectories = true
            panel.nameFieldStringValue = suggestedName
            panel.allowedContentTypes = [UTType(filenameExtension: "md") ?? .plainText, .plainText]
        }
    }

    func savePDFPanel(suggestedName: String) async -> URL? {
        await presentSavePanel { panel in
            panel.canCreateDirectories = true
            panel.nameFieldStringValue = suggestedName
            panel.allowedContentTypes = [.pdf]
        }
    }

    @MainActor
    private func presentOpenPanel(configure: @MainActor (NSOpenPanel) -> Void) async -> URL? {
        let panel = NSOpenPanel()
        configure(panel)
        NSApp.activate(ignoringOtherApps: true)

        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
            return await withCheckedContinuation { continuation in
                panel.beginSheetModal(for: window) { response in
                    continuation.resume(returning: response == .OK ? panel.url : nil)
                }
            }
        }

        return panel.runModal() == .OK ? panel.url : nil
    }

    @MainActor
    private func presentSavePanel(configure: @MainActor (NSSavePanel) -> Void) async -> URL? {
        let panel = NSSavePanel()
        configure(panel)
        NSApp.activate(ignoringOtherApps: true)

        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
            return await withCheckedContinuation { continuation in
                panel.beginSheetModal(for: window) { response in
                    continuation.resume(returning: response == .OK ? panel.url : nil)
                }
            }
        }

        return panel.runModal() == .OK ? panel.url : nil
    }

    func readTextFile(at url: URL) throws -> String {
        try String(contentsOf: url, encoding: .utf8)
    }

    func writeTextFile(_ text: String, to url: URL) throws {
        try text.write(to: url, atomically: true, encoding: .utf8)
    }

    func createDirectory(at url: URL) throws {
        try fileManager.createDirectory(at: url, withIntermediateDirectories: false)
    }

    func writeDataFile(_ data: Data, to url: URL) throws {
        try data.write(to: url, options: .atomic)
    }

    func ensureDirectoryExists(at url: URL) throws {
        try fileManager.createDirectory(at: url, withIntermediateDirectories: true)
    }

    func fileAttributes(at url: URL) throws -> (size: Int64, modifiedAt: Date?) {
        let attributes = try fileManager.attributesOfItem(atPath: url.path)
        let size = (attributes[.size] as? NSNumber)?.int64Value ?? 0
        let modifiedAt = attributes[.modificationDate] as? Date
        return (size, modifiedAt)
    }

    func fileExists(at url: URL) -> Bool {
        fileManager.fileExists(atPath: url.path)
    }

    func revealInFinder(_ url: URL) {
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    func renameItem(at url: URL, to newURL: URL) throws {
        try fileManager.moveItem(at: url, to: newURL)
    }

    func copyItem(at url: URL, to newURL: URL) throws {
        try fileManager.copyItem(at: url, to: newURL)
    }

    func trashItem(at url: URL) throws {
        var resultingURL: NSURL?
        try fileManager.trashItem(at: url, resultingItemURL: &resultingURL)
    }

    func removeItem(at url: URL) throws {
        try fileManager.removeItem(at: url)
    }

    @MainActor
    func promptForName(title: String, message: String, defaultValue: String) async -> String? {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.alertStyle = .informational

        let textField = NSTextField(string: defaultValue)
        textField.frame = NSRect(x: 0, y: 0, width: 280, height: 24)
        alert.accessoryView = textField

        NSApp.activate(ignoringOtherApps: true)

        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
            return await withCheckedContinuation { continuation in
                alert.beginSheetModal(for: window) { response in
                    let value = response == .alertFirstButtonReturn
                        ? textField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
                        : ""
                    continuation.resume(returning: value.isEmpty ? nil : value)
                }
            }
        }

        let response = alert.runModal()
        let value = textField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return response == .alertFirstButtonReturn && !value.isEmpty ? value : nil
    }

    @MainActor
    func confirmDeletion(name: String, isFolder: Bool) async -> Bool {
        let alert = NSAlert()
        alert.messageText = isFolder ? "Delete Folder?" : "Delete File?"
        alert.informativeText = "Move \"\(name)\" to Trash?"
        alert.addButton(withTitle: "Delete")
        alert.addButton(withTitle: "Cancel")
        alert.alertStyle = .warning

        NSApp.activate(ignoringOtherApps: true)

        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
            return await withCheckedContinuation { continuation in
                alert.beginSheetModal(for: window) { response in
                    continuation.resume(returning: response == .alertFirstButtonReturn)
                }
            }
        }

        return alert.runModal() == .alertFirstButtonReturn
    }

    @MainActor
    func confirmBulkDeletion(count: Int) async -> Bool {
        let alert = NSAlert()
        alert.messageText = "Delete \(count) Items?"
        alert.informativeText = "This will move the selected items to the Trash."
        alert.addButton(withTitle: "Delete")
        alert.addButton(withTitle: "Cancel")
        alert.alertStyle = .warning

        NSApp.activate(ignoringOtherApps: true)

        if let window = NSApp.keyWindow ?? NSApp.mainWindow {
            return await withCheckedContinuation { continuation in
                alert.beginSheetModal(for: window) { response in
                    continuation.resume(returning: response == .alertFirstButtonReturn)
                }
            }
        }

        return alert.runModal() == .alertFirstButtonReturn
    }

    func listDirectory(at url: URL, showHiddenFiles: Bool) throws -> [FileTreeNode] {
        try listDirectoryContents(at: url, showHiddenFiles: showHiddenFiles)
    }

    private func listDirectoryContents(at url: URL, showHiddenFiles: Bool) throws -> [FileTreeNode] {
        let keys: [URLResourceKey] = [.isDirectoryKey]
        let items = try fileManager.contentsOfDirectory(at: url, includingPropertiesForKeys: keys)
            .filter { showHiddenFiles || !$0.lastPathComponent.hasPrefix(".") }
        let keyedItems = items.map { itemURL in
            let values = try? itemURL.resourceValues(forKeys: Set(keys))
            return (url: itemURL, isDirectory: values?.isDirectory == true)
        }
        let sortedItems = keyedItems.sorted { lhs, rhs in
                let lhsIsDirectory = lhs.isDirectory
                let rhsIsDirectory = rhs.isDirectory

                if lhsIsDirectory != rhsIsDirectory {
                    return lhsIsDirectory && !rhsIsDirectory
                }

                return lhs.url.lastPathComponent.localizedCaseInsensitiveCompare(rhs.url.lastPathComponent) == .orderedAscending
            }

        return sortedItems.map { item in
            let itemURL = item.url
            let isDirectory = item.isDirectory
            return FileTreeNode(
                id: itemURL.path,
                name: itemURL.lastPathComponent,
                url: itemURL,
                kind: isDirectory ? .folder : .file,
                children: [],
                isChildrenLoaded: !isDirectory
            )
        }
    }

    func listTextFilesRecursively(at rootURL: URL, showHiddenFiles: Bool) throws -> [URL] {
        guard let enumerator = fileManager.enumerator(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: showHiddenFiles ? [] : [.skipsHiddenFiles]
        ) else {
            return []
        }

        var files: [URL] = []
        while let item = enumerator.nextObject() as? URL {
            let values = try? item.resourceValues(forKeys: [.isDirectoryKey])
            if values?.isDirectory == true {
                continue
            }

            let ext = item.pathExtension.lowercased()
            if ["md", "markdown", "txt"].contains(ext) {
                files.append(item)
            }
        }

        return files.sorted { $0.path.localizedCaseInsensitiveCompare($1.path) == .orderedAscending }
    }
}
