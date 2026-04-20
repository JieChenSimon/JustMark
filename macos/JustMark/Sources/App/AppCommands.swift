import SwiftUI

struct JustMarkCommands: Commands {
    @ObservedObject var settingsStore: SettingsStore
    @ObservedObject var documentStore: DocumentStore
    @ObservedObject var workspaceStore: WorkspaceStore
    @ObservedObject var recentHistoryStore: RecentHistoryStore
    let windowService: WindowService

    var body: some Commands {
        SidebarCommands()

        CommandGroup(replacing: .newItem) {
            Button("New Document") {
                Task { await workspaceStore.createNewDocument() }
            }
            .keyboardShortcut(
                settingsStore.shortcutBinding(for: .newDocument).keyEquivalent,
                modifiers: settingsStore.shortcutBinding(for: .newDocument).eventModifiers
            )

            Button("Open…") {
                Task { await workspaceStore.openDocument() }
            }
            .keyboardShortcut(
                settingsStore.shortcutBinding(for: .openDocument).keyEquivalent,
                modifiers: settingsStore.shortcutBinding(for: .openDocument).eventModifiers
            )

            Button("Open Folder…") {
                Task { await workspaceStore.openWorkspaceFolder() }
            }
            .keyboardShortcut(
                settingsStore.shortcutBinding(for: .openFolder).keyEquivalent,
                modifiers: settingsStore.shortcutBinding(for: .openFolder).eventModifiers
            )

            Divider()

            Menu("Open Recent File") {
                if recentHistoryStore.recentFiles.isEmpty {
                    Text("No Recent Files")
                } else {
                    ForEach(recentHistoryStore.recentFiles, id: \.self) { url in
                        Button(url.lastPathComponent) {
                            Task { await workspaceStore.reopenRecentFile(url) }
                        }
                    }
                }
            }

            Menu("Open Recent Folder") {
                if recentHistoryStore.recentFolders.isEmpty {
                    Text("No Recent Folders")
                } else {
                    ForEach(recentHistoryStore.recentFolders, id: \.self) { url in
                        Button(url.lastPathComponent) {
                            Task { await workspaceStore.reopenRecentFolder(url) }
                        }
                    }
                }
            }

            Divider()

            Button("Save") {
                Task { await workspaceStore.saveActiveDocument() }
            }
            .keyboardShortcut(
                settingsStore.shortcutBinding(for: .save).keyEquivalent,
                modifiers: settingsStore.shortcutBinding(for: .save).eventModifiers
            )
        }

        CommandGroup(after: .saveItem) {
            Button("Save As…") {
                Task { await workspaceStore.saveActiveDocumentAs() }
            }
            .keyboardShortcut(
                settingsStore.shortcutBinding(for: .saveAs).keyEquivalent,
                modifiers: settingsStore.shortcutBinding(for: .saveAs).eventModifiers
            )

            Button("Export PDF…") {
                Task { await workspaceStore.exportCurrentPreviewAsPDF() }
            }
            .keyboardShortcut("p", modifiers: [.command, .shift])
        }

        CommandGroup(after: .sidebar) {
            Button(workspaceStore.isPreviewVisible ? "Hide Preview" : "Show Preview") {
                workspaceStore.isPreviewVisible.toggle()
            }
            .keyboardShortcut(
                settingsStore.shortcutBinding(for: .togglePreview).keyEquivalent,
                modifiers: settingsStore.shortcutBinding(for: .togglePreview).eventModifiers
            )
        }

        CommandMenu("Format") {
            Button("Bold") {
                documentStore.applyInlineFormat(.bold)
            }
            .keyboardShortcut("b")

            Button("Italic") {
                documentStore.applyInlineFormat(.italic)
            }
            .keyboardShortcut("i")

            Button("Code") {
                documentStore.applyInlineFormat(.code)
            }
            .keyboardShortcut("e", modifiers: [.command, .shift])
        }

        CommandMenu("Search") {
            Button("Find…") {
                documentStore.findReplaceState.isPresented = true
            }
            .keyboardShortcut(
                settingsStore.shortcutBinding(for: .find).keyEquivalent,
                modifiers: settingsStore.shortcutBinding(for: .find).eventModifiers
            )

            Button("Find Next") {
                documentStore.findNextMatch()
            }
            .keyboardShortcut("g")

            Button("Find Previous") {
                documentStore.findPreviousMatch()
            }
            .keyboardShortcut("G", modifiers: [.command, .shift])
        }

        CommandMenu("Sync") {
            Button("Sync Current Document") {
                Task { await workspaceStore.syncActiveDocumentToWebDAV() }
            }

            Button("Sync Workspace") {
                Task { await workspaceStore.syncWorkspaceToWebDAV() }
            }
        }

        CommandGroup(after: .windowArrangement) {
            Button("Bring All to Front") {
                windowService.bringAllToFront()
            }
        }
    }
}
