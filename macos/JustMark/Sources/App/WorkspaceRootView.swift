import AppKit
import SwiftUI
import UniformTypeIdentifiers

private func copyStringToPasteboard(_ value: String) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(value, forType: .string)
}

private func copyAbsolutePathToPasteboard(_ url: URL) {
    copyStringToPasteboard(url.path)
}

private func copyRelativePathToPasteboard(_ url: URL, rootURL: URL) {
    if url == rootURL {
        copyStringToPasteboard(".")
        return
    }
    let rootPath = rootURL.path
    let targetPath = url.path
    guard targetPath.hasPrefix(rootPath + "/") else {
        copyStringToPasteboard(targetPath)
        return
    }
    let relative = targetPath.replacingOccurrences(of: rootPath + "/", with: "")
    copyStringToPasteboard(relative.replacingOccurrences(of: "\\", with: "/"))
}

struct WorkspaceRootView: View {
    @EnvironmentObject private var settingsStore: SettingsStore
    @EnvironmentObject private var themeStore: ThemeStore
    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @Environment(\.windowService) private var windowService
    @State private var sidebarWidth: CGFloat = 120
    @State private var previewWidth: CGFloat = 510

    init() {
        let defaults = UserDefaults.standard
        let persistedSidebarWidth = defaults.object(forKey: "jm.layoutSidebarWidth") as? Double ?? 200
        let persistedPreviewWidth = defaults.object(forKey: "jm.layoutPreviewWidth") as? Double ?? 510
        _sidebarWidth = State(initialValue: CGFloat(persistedSidebarWidth))
        _previewWidth = State(initialValue: CGFloat(persistedPreviewWidth))
    }

    var body: some View {
        workspaceContent
        .background(themeStore.workspaceBackgroundColor)
        .ignoresSafeArea()
        .onChange(of: sidebarWidth) { _, newValue in
            settingsStore.layoutSidebarWidth = Double(newValue)
        }
        .onChange(of: previewWidth) { _, newValue in
            settingsStore.layoutPreviewWidth = Double(newValue)
        }
    }
}

struct WorkspaceTopChromeView: View {
    @EnvironmentObject private var settingsStore: SettingsStore
    @EnvironmentObject private var themeStore: ThemeStore
    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    let sidebarWidth: CGFloat
    let dividerWidth: CGFloat
    private let floatingToolbarTrailingPadding: CGFloat = 18

    var body: some View {
        HStack(spacing: 0) {
            if workspaceStore.isSidebarVisible {
                HStack {
                    leadingControls
                    Spacer(minLength: 0)
                }
                .frame(width: sidebarWidth, alignment: .leading)
            } else {
                leadingControls
                    .fixedSize()
            }

            HStack(spacing: 0) {
                DocumentTabStripView(placement: .titlebar)
                    .environmentObject(documentStore)
                    .environmentObject(themeStore)
                    .environmentObject(workspaceStore)
                Spacer(minLength: 0)
            }
            .padding(.leading, workspaceStore.isSidebarVisible ? 10 : 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: EditorDesignSystem.Chrome.topChromeHeight)
        .background(Color.clear)
        .overlay(alignment: .trailing) {
            trailingToolbar
                .padding(.trailing, floatingToolbarTrailingPadding)
        }
    }

    private var leadingControls: some View {
        HStack(spacing: 0) {
            HStack(spacing: 2) {
                TopChromeButton(
                    foregroundColor: themeStore.isDarkMode ? Color.white.opacity(0.72) : Color.black.opacity(0.76),
                    systemImage: "sidebar.leading",
                    helpText: workspaceStore.isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"
                ) {
                    workspaceStore.isSidebarVisible.toggle()
                }

                TopChromeButton(
                    foregroundColor: themeStore.isDarkMode ? Color.white.opacity(0.72) : Color.black.opacity(0.76),
                    systemImage: "folder",
                    helpText: "Open Folder"
                ) {
                    Task { await workspaceStore.openWorkspaceFolder() }
                }
            }
            .padding(.horizontal, 6)
            .padding(.vertical, 4)
            .background(themeStore.floatingToolbarBackgroundColor, in: Capsule(style: .continuous))
            .overlay {
                Capsule(style: .continuous)
                    .strokeBorder(themeStore.isDarkMode ? Color.white.opacity(0.12) : Color.black.opacity(0.14))
            }
        }
        .padding(.leading, 92)
        .padding(.trailing, workspaceStore.isSidebarVisible ? 0 : 6)
    }

    private var trailingToolbar: some View {
        FloatingToolbarGroup {
            FloatingToolbarButton(
                systemImage: themeStore.isDarkMode ? "sun.max" : "moon",
                helpText: themeStore.isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"
            ) {
                themeStore.isDarkMode.toggle()
            }

            FloatingToolbarButton(
                systemImage: "paperclip",
                helpText: "Clip URL"
            ) {
                _ = workspaceStore.clipURLFromSelectionOrClipboard()
            }

            FloatingToolbarButton(
                systemImage: settingsStore.previewMode == .markdown ? "doc.text" : "doc.richtext",
                helpText: settingsStore.previewMode == .markdown ? "Switch to PDF Preview" : "Switch to Markdown Preview"
            ) {
                let next = settingsStore.previewMode == .markdown ? PreviewMode.pdf : PreviewMode.markdown
                workspaceStore.setPreviewMode(next)
            }

            SyncToolbarButton(
                progress: workspaceStore.syncProgress,
                isSyncing: workspaceStore.isSyncing
            ) {
                Task { await workspaceStore.syncWorkspaceToWebDAV() }
            }

            FloatingToolbarButton(
                systemImage: workspaceStore.isPreviewVisible ? "eye.slash" : "eye",
                helpText: workspaceStore.isPreviewVisible ? "Hide Preview" : "Show Preview"
            ) {
                workspaceStore.isPreviewVisible.toggle()
            }
        }
    }
}

private struct TopChromeButton: View {
    let foregroundColor: Color
    let systemImage: String
    let helpText: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 12, weight: .medium))
                .frame(width: 24, height: 20)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(foregroundColor)
        .help(helpText)
    }
}

private extension WorkspaceRootView {
    var workspaceContent: some View {
        ZStack(alignment: .top) {
            WorkspaceSplitContainer(
                sidebar: AnyView(
                    SidebarView()
                        .environmentObject(settingsStore)
                        .environmentObject(documentStore)
                        .environmentObject(workspaceStore)
                        .environment(\.windowService, windowService)
                ),
                editor: AnyView(
                    EditorContainerView()
                        .environmentObject(settingsStore)
                        .environmentObject(themeStore)
                        .environmentObject(documentStore)
                        .environmentObject(workspaceStore)
                        .environment(\.windowService, windowService)
                ),
                preview: AnyView(
                    PreviewPaneView(
                        previewMode: settingsStore.previewMode,
                        activeDocument: documentStore.activeDocument,
                        previewState: workspaceStore.previewState,
                        currentFolderURL: workspaceStore.currentFolderURL,
                        previewFontSize: themeStore.previewFontSize,
                        previewFontFamilyCSS: themeStore.previewFontFamilyCSS(),
                        isDark: themeStore.effectivePreviewIsDark,
                        backgroundColor: themeStore.previewBackgroundNSColor,
                        onOpenLink: { url in
                            Task { await workspaceStore.openPreviewLink(url) }
                        }
                    )
                ),
                isSidebarVisible: workspaceStore.isSidebarVisible,
                isPreviewVisible: workspaceStore.isPreviewVisible,
                sidebarWidth: $sidebarWidth,
                previewWidth: $previewWidth,
                minSidebarWidth: CGFloat(settingsStore.layoutSidebarMinWidth),
                maxSidebarWidth: CGFloat(settingsStore.layoutSidebarMaxWidth),
                minEditorWidth: CGFloat(settingsStore.layoutEditorMinWidth),
                minPreviewWidth: CGFloat(settingsStore.layoutPreviewMinWidth),
                maxPreviewWidth: CGFloat(settingsStore.layoutPreviewMaxWidth),
                dividerWidth: CGFloat(settingsStore.layoutDividerWidth),
                prefersInstantSidebarTransitions: workspaceStore.isPreviewVisible && settingsStore.previewMode == .markdown,
                isDark: themeStore.isDarkMode,
                workspaceBackgroundColor: themeStore.workspaceBackgroundNSColor,
                dividerColor: themeStore.dividerNSColor
            )
            .transaction { transaction in
                transaction.animation = nil
                transaction.disablesAnimations = true
            }

            WorkspaceTopChromeView(
                sidebarWidth: sidebarWidth,
                dividerWidth: CGFloat(settingsStore.layoutDividerWidth)
            )
            .environmentObject(themeStore)
            .environmentObject(documentStore)
            .environmentObject(workspaceStore)
        }
    }
}

private struct FloatingToolbarGroup<Content: View>: View {
    @ViewBuilder let content: Content
    @EnvironmentObject private var themeStore: ThemeStore
    private let horizontalPadding: CGFloat = 6
    private let verticalPadding: CGFloat = 4

    var body: some View {
        HStack(spacing: 2) {
            content
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, verticalPadding)
        .background(themeStore.floatingToolbarBackgroundColor, in: Capsule(style: .continuous))
        .overlay {
            Capsule(style: .continuous)
                .strokeBorder(themeStore.isDarkMode ? Color.white.opacity(0.15) : Color.black.opacity(0.08))
        }
        .shadow(color: Color.black.opacity(themeStore.isDarkMode ? 0.35 : 0.12), radius: 14, y: 6)
        .animation(.easeInOut(duration: 0.22), value: themeStore.isDarkMode)
    }
}

private struct FloatingToolbarButton: View {
    let systemImage: String
    let helpText: String
    var isEnabled: Bool = true
    let action: () -> Void
    @EnvironmentObject private var themeStore: ThemeStore
    private let iconSize: CGFloat = 12
    private let buttonSize: CGFloat = 20

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: iconSize, weight: .medium))
                .frame(width: buttonSize, height: buttonSize)
                .foregroundStyle(isEnabled ? (themeStore.isDarkMode ? Color.white : Color.black.opacity(0.85)) : Color.secondary.opacity(0.5))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!isEnabled)
        .help(helpText)
        .animation(.easeInOut(duration: 0.22), value: themeStore.isDarkMode)
    }
}

private struct SyncToolbarButton: View {
    let progress: Double
    let isSyncing: Bool
    let action: () -> Void
    @EnvironmentObject private var themeStore: ThemeStore
    private let buttonSize: CGFloat = 20

    var body: some View {
        Button(action: action) {
            ZStack {
                Circle()
                    .stroke((themeStore.isDarkMode ? Color.white : Color.black).opacity(0.18), lineWidth: 1.2)
                Circle()
                    .trim(from: 0, to: max(0.05, min(progress, 1)))
                    .stroke((themeStore.isDarkMode ? Color.white : Color.black).opacity(isSyncing ? 0.8 : 0.55), style: StrokeStyle(lineWidth: 1.6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.system(size: 11, weight: .semibold))
                    .rotationEffect(.degrees(isSyncing ? 360 : 0))
                    .animation(isSyncing ? .linear(duration: 1).repeatForever(autoreverses: false) : .default, value: isSyncing)
            }
            .frame(width: buttonSize, height: buttonSize)
            .foregroundStyle(isSyncing ? (themeStore.isDarkMode ? Color.white : Color.black.opacity(0.9)) : (themeStore.isDarkMode ? Color.white.opacity(0.75) : Color.black.opacity(0.65)))
        }
        .buttonStyle(.plain)
        .disabled(isSyncing)
        .help("Sync Workspace")
        .animation(.easeInOut(duration: 0.22), value: themeStore.isDarkMode)
    }
}

private struct SidebarView: View {
    @EnvironmentObject private var themeStore: ThemeStore
    @EnvironmentObject private var settingsStore: SettingsStore
    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @Environment(\.windowService) private var windowService
    private var topInset: CGFloat {
        EditorDesignSystem.Chrome.sidebarContentTopInset
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if workspaceStore.fileTree.isEmpty {
                SidebarEmptyState()
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    SidebarHeader()

                    ScrollView {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            if workspaceStore.sidebarPanelMode == .files {
                                ForEach(workspaceStore.fileTree) { node in
                                    SidebarTreeNodeRow(node: node, depth: 0)
                                }
                            } else {
                                ForEach(documentStore.tableOfContents) { heading in
                                    TocRow(heading: heading)
                                }
                            }
                        }
                        .padding(.horizontal, 6)
                        .padding(.top, 8)
                        .padding(.bottom, 8)
                    }
                    .onDrop(of: [UTType.fileURL], isTargeted: nil) { providers in
                        guard let rootURL = workspaceStore.currentFolderURL else { return false }
                        Task { await workspaceStore.handleDrop(providers, ontoFolderURL: rootURL) }
                        return true
                    }
                    .background(themeStore.sidebarBackgroundColor)
                }
                .padding(.top, topInset)
                .background(themeStore.sidebarBackgroundColor)
            }
        }
        .background(themeStore.sidebarBackgroundColor)
        .frame(maxHeight: .infinity)
        .contextMenu {
            SidebarWorkspaceContextMenu()
        }
        .onChange(of: workspaceStore.fileTree.count) { _, newValue in
            print("[JustMark] Sidebar rendered with \(newValue) rows")
        }
    }
}

private struct SidebarHeader: View {
    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var workspaceStore: WorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 8) {
                Text(workspaceStore.sidebarPanelMode == .files ? (workspaceStore.currentFolderURL?.lastPathComponent ?? "Workspace") : "Outline")
                    .font(.system(size: 10.5, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                Spacer(minLength: 6)

                Button {
                    workspaceStore.sidebarPanelMode =
                        workspaceStore.sidebarPanelMode == .files ? .outline : .files
                } label: {
                    Image(systemName: workspaceStore.sidebarPanelMode == .files ? "list.bullet.indent" : "sidebar.left")
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(documentStore.tableOfContents.isEmpty ? Color.secondary.opacity(0.5) : Color.secondary)
                        .frame(width: 16, height: 16)
                }
                .buttonStyle(.plain)
                .disabled(documentStore.tableOfContents.isEmpty)
                .help(workspaceStore.sidebarPanelMode == .files ? "Show Outline" : "Show Files")
            }

            Text(workspaceStore.sidebarPanelMode == .files ? "\(workspaceStore.fileTree.count) items" : "\(documentStore.tableOfContents.count) headings")
                .font(.system(size: 10))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12)
        .padding(.top, 4)
        .padding(.bottom, 6)
    }
}

private struct SidebarEmptyState: View {
    private var topInset: CGFloat {
        EditorDesignSystem.Chrome.sidebarContentTopInset
    }

    var body: some View {
        Color.clear
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.top, topInset)
            .contentShape(Rectangle())
            .contextMenu {
                SidebarWorkspaceContextMenu()
            }
    }
}

private struct SidebarTreeNodeRow: View {
    let node: FileTreeNode
    let depth: Int
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @FocusState private var isEditingFocused: Bool

    private var editState: SidebarInlineEditState? {
        workspaceStore.sidebarEditState
    }

    private var inlineEditText: Binding<String> {
        Binding(
            get: { editState?.draftName ?? displayText(for: node) },
            set: { newValue in
                guard editState?.sourceURL == node.url || editState?.placeholderURL == node.url else { return }
                workspaceStore.updateSidebarEditName(newValue)
            }
        )
    }

    private func displayText(for node: FileTreeNode) -> String {
        if node.isFolder || node.url.pathExtension.isEmpty {
            return node.name
        }
        return node.url.deletingPathExtension().lastPathComponent
    }

    private func commitInlineEdit() {
        guard editState?.sourceURL == node.url || editState?.placeholderURL == node.url else { return }
        Task { await workspaceStore.commitSidebarEdit() }
    }

    private func handlePrimaryClick(clickCount: Int, modifiers: NSEvent.ModifierFlags) {
        guard !(editState?.sourceURL == node.url || editState?.placeholderURL == node.url) else { return }

        if clickCount >= 2 {
            workspaceStore.updateSidebarSelection([node.id], primaryID: node.id)
            Task { await workspaceStore.openNode(node) }
            return
        }

        if modifiers.contains(.command) {
            var next = workspaceStore.selectedSidebarNodeIDs
            if next.contains(node.id) {
                next.remove(node.id)
            } else {
                next.insert(node.id)
            }
            let primary = next.contains(node.id) ? node.id : next.first
            workspaceStore.updateSidebarSelection(next, primaryID: primary)
            return
        }

        workspaceStore.updateSidebarSelection([node.id], primaryID: node.id)
        if node.isFolder {
            workspaceStore.toggleFolderExpansion(node.id)
        } else {
            Task { await workspaceStore.openNode(node) }
        }
    }

    private func handleSecondaryClick() {
        guard !(editState?.sourceURL == node.url || editState?.placeholderURL == node.url) else { return }
        let current = workspaceStore.selectedSidebarNodeIDs
        guard !current.contains(node.id) else { return }
        workspaceStore.updateSidebarSelection([node.id], primaryID: node.id)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            SidebarRowInteractionContainer(
                onPrimaryClick: handlePrimaryClick(clickCount:modifiers:),
                onSecondaryClick: handleSecondaryClick
            ) {
                HStack(spacing: 6) {
                    if node.isFolder {
                        Button {
                            workspaceStore.toggleFolderExpansion(node.id)
                        } label: {
                            Image(systemName: workspaceStore.expandedFolderIDs.contains(node.id) ? "chevron.down" : "chevron.right")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(.tertiary)
                                .frame(width: 10)
                        }
                        .buttonStyle(.plain)
                        .help(workspaceStore.expandedFolderIDs.contains(node.id) ? "Collapse Folder" : "Expand Folder")
                    } else {
                        Color.clear
                            .frame(width: 10, height: 10)
                    }

                    Image(systemName: node.kind == .folder ? "folder" : "doc.text")
                        .foregroundStyle(.secondary)
                        .font(.system(size: 12))

                    if editState?.sourceURL == node.url || editState?.placeholderURL == node.url {
                        TextField("", text: inlineEditText)
                            .textFieldStyle(.plain)
                            .font(.system(size: 12.5))
                            .foregroundStyle(.primary)
                            .padding(.horizontal, 4)
                            .padding(.vertical, 2)
                            .background(
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .fill(Color(nsColor: .textBackgroundColor).opacity(0.88))
                            )
                            .overlay {
                                RoundedRectangle(cornerRadius: 4, style: .continuous)
                                    .strokeBorder(Color.accentColor.opacity(0.35))
                            }
                            .focused($isEditingFocused)
                            .onSubmit {
                                commitInlineEdit()
                            }
                            .onChange(of: isEditingFocused) { _, isFocused in
                                if !isFocused {
                                    commitInlineEdit()
                                }
                            }
                            .onAppear {
                                isEditingFocused = true
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                    } else {
                        Text(node.name)
                            .font(.system(size: 12.5))
                            .lineLimit(1)
                            .foregroundStyle(.primary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.leading, CGFloat(depth) * 12)
                .padding(.horizontal, 6)
                .padding(.vertical, 4)
                .background(
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(workspaceStore.selectedSidebarNodeIDs.contains(node.id) ? Color.primary.opacity(0.08) : Color.clear)
                )
                .contentShape(Rectangle())
            }
            .contextMenu {
                SidebarNodeContextMenu(node: node)
            }
            .onDrag {
                workspaceStore.prepareDragging(nodeID: node.id)
                return NSItemProvider(object: node.url as NSURL)
            }
            .onDrop(of: [UTType.fileURL], isTargeted: nil) { providers in
                guard node.isFolder else { return false }
                Task { await workspaceStore.handleDrop(providers, onto: node) }
                return true
            }

            if node.isFolder && workspaceStore.expandedFolderIDs.contains(node.id) {
                if node.isChildrenLoaded {
                    ForEach(node.children) { child in
                        SidebarTreeNodeRow(node: child, depth: depth + 1)
                    }
                } else {
                    HStack(spacing: 6) {
                        ProgressView()
                            .controlSize(.small)
                        Text("Loading…")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    .padding(.leading, CGFloat(depth + 1) * 12 + 16)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 4)
                }
            }
        }
    }
}

private struct SidebarWorkspaceContextMenu: View {
    @EnvironmentObject private var workspaceStore: WorkspaceStore

    var body: some View {
        Group {
            if let currentFolderURL = workspaceStore.currentFolderURL {
                Button("New File") {
                    Task { await workspaceStore.beginCreateMarkdownDocument(in: currentFolderURL) }
                }

                Button("New Folder") {
                    Task { await workspaceStore.beginCreateFolder(in: currentFolderURL) }
                }

                Divider()

                Button("Reveal Active File") {
                    Task { await workspaceStore.revealActiveFileInSidebar() }
                }

                Button("Reveal in Finder") {
                    workspaceStore.revealInFinder(currentFolderURL)
                }

                Button("Copy Relative Path") {
                    copyRelativePathToPasteboard(currentFolderURL, rootURL: currentFolderURL)
                }

                Button("Copy Path") {
                    copyAbsolutePathToPasteboard(currentFolderURL)
                }

                Button("Refresh") {
                    Task { await workspaceStore.refreshWorkspaceFileTree() }
                }
            } else {
                Button("Open Folder…") {
                    Task { await workspaceStore.openWorkspaceFolder() }
                }
            }
        }
    }
}

private struct SidebarNodeContextMenu: View {
    let node: FileTreeNode
    @EnvironmentObject private var workspaceStore: WorkspaceStore

    var body: some View {
        Group {
            let selectedIDs = workspaceStore.selectedSidebarNodeIDs
            let isMultiSelection = selectedIDs.count > 1 && selectedIDs.contains(node.id)

            if isMultiSelection {
                Button("Move \(selectedIDs.count) Items…") {
                    Task { await workspaceStore.moveSelectedNodes() }
                }

                Button("Delete \(selectedIDs.count) Items", role: .destructive) {
                    Task { await workspaceStore.deleteSelectedNodes() }
                }

                if workspaceStore.currentFolderURL != nil {
                    Divider()

                    Button("Refresh") {
                        Task { await workspaceStore.refreshWorkspaceFileTree() }
                    }
                }
            } else {
                if node.isFolder {
                    Button("New File") {
                        Task { await workspaceStore.beginCreateMarkdownDocument(in: node.url) }
                    }

                    Button("New Folder") {
                        Task { await workspaceStore.beginCreateFolder(in: node.url) }
                    }

                    Divider()

                    Button(workspaceStore.expandedFolderIDs.contains(node.id) ? "Collapse Folder" : "Expand Folder") {
                        workspaceStore.toggleFolderExpansion(node.id)
                    }
                } else {
                    Button("Open") {
                        Task { await workspaceStore.openDocument(at: node.url) }
                    }
                }

                Divider()

                Button("Reveal in Finder") {
                    workspaceStore.revealInFinder(node.url)
                }

                if let rootURL = workspaceStore.currentFolderURL {
                    Button("Copy Relative Path") {
                        copyRelativePathToPasteboard(node.url, rootURL: rootURL)
                    }
                }

                Button("Copy Path") {
                    copyAbsolutePathToPasteboard(node.url)
                }

                Button("Duplicate") {
                    Task { await workspaceStore.beginDuplicateNode(node) }
                }

                Button("Rename") {
                    workspaceStore.selectedSidebarNodeID = node.id
                    Task { await workspaceStore.beginRenameNode(node) }
                }

                Button("Delete", role: .destructive) {
                    Task { await workspaceStore.cancelSidebarEdit() }
                    Task { await workspaceStore.deleteNode(node) }
                }

                if workspaceStore.currentFolderURL != nil {
                    Button("Refresh") {
                        Task { await workspaceStore.refreshWorkspaceFileTree() }
                    }
                }
            }
        }
    }
}

private struct SidebarRowInteractionContainer<Content: View>: NSViewRepresentable {
    let onPrimaryClick: (Int, NSEvent.ModifierFlags) -> Void
    let onSecondaryClick: () -> Void
    let content: Content

    init(
        onPrimaryClick: @escaping (Int, NSEvent.ModifierFlags) -> Void,
        onSecondaryClick: @escaping () -> Void,
        @ViewBuilder content: () -> Content
    ) {
        self.onPrimaryClick = onPrimaryClick
        self.onSecondaryClick = onSecondaryClick
        self.content = content()
    }

    func makeNSView(context: Context) -> SidebarRowContainerView<Content> {
        let view = SidebarRowContainerView(rootView: content)
        view.onPrimaryClick = onPrimaryClick
        view.onSecondaryClick = onSecondaryClick
        return view
    }

    func updateNSView(_ nsView: SidebarRowContainerView<Content>, context: Context) {
        nsView.onPrimaryClick = onPrimaryClick
        nsView.onSecondaryClick = onSecondaryClick
        nsView.hostingView.rootView = content
    }

    final class SidebarRowContainerView<HostedContent: View>: NSView, NSGestureRecognizerDelegate {
        let hostingView: NSHostingView<HostedContent>
        var onPrimaryClick: ((Int, NSEvent.ModifierFlags) -> Void)?
        var onSecondaryClick: (() -> Void)?

        private lazy var singleClickRecognizer: NSClickGestureRecognizer = {
            let recognizer = NSClickGestureRecognizer(target: self, action: #selector(handleSingleClick(_:)))
            recognizer.numberOfClicksRequired = 1
            recognizer.delegate = self
            return recognizer
        }()

        private lazy var doubleClickRecognizer: NSClickGestureRecognizer = {
            let recognizer = NSClickGestureRecognizer(target: self, action: #selector(handleDoubleClick(_:)))
            recognizer.numberOfClicksRequired = 2
            recognizer.delegate = self
            return recognizer
        }()

        init(rootView: HostedContent) {
            self.hostingView = NSHostingView(rootView: rootView)
            super.init(frame: .zero)
            setupHostingView()
            setupRecognizers()
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override var acceptsFirstResponder: Bool {
            false
        }

        private func setupHostingView() {
            hostingView.translatesAutoresizingMaskIntoConstraints = false
            addSubview(hostingView)
            NSLayoutConstraint.activate([
                hostingView.leadingAnchor.constraint(equalTo: leadingAnchor),
                hostingView.trailingAnchor.constraint(equalTo: trailingAnchor),
                hostingView.topAnchor.constraint(equalTo: topAnchor),
                hostingView.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
        }

        private func setupRecognizers() {
            addGestureRecognizer(singleClickRecognizer)
            addGestureRecognizer(doubleClickRecognizer)
        }

        override func rightMouseDown(with event: NSEvent) {
            onSecondaryClick?()
            super.rightMouseDown(with: event)
        }

        func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: NSGestureRecognizer) -> Bool {
            true
        }

        func gestureRecognizer(_ gestureRecognizer: NSGestureRecognizer, shouldRequireFailureOf otherGestureRecognizer: NSGestureRecognizer) -> Bool {
            gestureRecognizer === singleClickRecognizer && otherGestureRecognizer === doubleClickRecognizer
        }

        @objc
        private func handleSingleClick(_ recognizer: NSClickGestureRecognizer) {
            guard recognizer.state == .ended else { return }
            onPrimaryClick?(1, NSApp.currentEvent?.modifierFlags ?? [])
        }

        @objc
        private func handleDoubleClick(_ recognizer: NSClickGestureRecognizer) {
            guard recognizer.state == .ended else { return }
            onPrimaryClick?(2, NSApp.currentEvent?.modifierFlags ?? [])
        }
    }
}

private struct TocRow: View {
    let heading: TableOfContentsHeading
    @EnvironmentObject private var documentStore: DocumentStore

    var body: some View {
        Text(heading.text)
            .font(.system(size: 12))
            .lineLimit(1)
            .foregroundStyle(.secondary)
            .padding(.leading, CGFloat(max(heading.level - 1, 0)) * 10)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .contentShape(Rectangle())
            .onTapGesture {
                documentStore.jumpTo(line: heading.line)
            }
    }
}

private struct EditorContainerView: View {
    @EnvironmentObject private var themeStore: ThemeStore
    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var workspaceStore: WorkspaceStore

    var body: some View {
        VStack(spacing: 0) {
            ZStack {
                if documentStore.activeDocument != nil {
                    HStack(spacing: 0) {
                        Spacer(minLength: EditorDesignSystem.Canvas.outerGutter)

                        EditorView(
                            documentStore: documentStore,
                            font: themeStore.editorNSFont(),
                            isDark: themeStore.effectiveEditorIsDark,
                            backgroundColor: themeStore.editorCanvasBackgroundNSColor,
                            imagePasteHandler: { data in
                                await workspaceStore.savePastedImage(data)
                            }
                        )
                        .frame(
                            maxWidth: workspaceStore.isPreviewVisible
                                ? EditorDesignSystem.Canvas.readableWidthWithPreview
                                : EditorDesignSystem.Canvas.readableWidthWithoutPreview,
                            maxHeight: .infinity
                        )

                        Spacer(minLength: EditorDesignSystem.Canvas.outerGutter)
                    }
                    .padding(.top, EditorDesignSystem.Chrome.paneContentTopInset)
                    .background(themeStore.editorCanvasBackgroundColor)
                } else {
                    WorkspaceEmptyDocumentView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .overlay(alignment: .topTrailing) {
                if documentStore.findReplaceState.isPresented {
                    FindReplacePanel()
                        .padding(.top, EditorDesignSystem.Chrome.overlayPadding + EditorDesignSystem.Chrome.paneContentTopInset)
                        .padding(.trailing, EditorDesignSystem.Chrome.overlayPadding)
                }
            }
            .overlay(alignment: .bottomLeading) {
                FloatingStatusView()
                    .padding(.leading, EditorDesignSystem.Chrome.overlayPadding)
                    .padding(.bottom, EditorDesignSystem.Chrome.overlayPadding)
            }
        }
        .frame(maxHeight: .infinity)
    }
}

private struct WorkspaceEmptyDocumentView: View {
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @EnvironmentObject private var themeStore: ThemeStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("No document open")
                .font(.system(size: 18, weight: .medium))

            HStack(spacing: 8) {
                Button("Open File") {
                    Task { await workspaceStore.openDocument() }
                }
                .buttonStyle(.bordered)

                Button("Open Folder") {
                    Task { await workspaceStore.openWorkspaceFolder() }
                }
                .buttonStyle(.bordered)
            }
        }
        .padding(.horizontal, 40)
        .padding(.top, 36 + EditorDesignSystem.Chrome.paneContentTopInset)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(themeStore.workspaceBackgroundColor)
    }
}

private struct PreviewPaneView: View, Equatable {
    let previewMode: PreviewMode
    let activeDocument: DocumentTab?
    let previewState: PreviewState
    let currentFolderURL: URL?
    let previewFontSize: Double
    let previewFontFamilyCSS: String
    let isDark: Bool
    let backgroundColor: NSColor
    let onOpenLink: (URL) -> Void

    static func == (lhs: PreviewPaneView, rhs: PreviewPaneView) -> Bool {
        lhs.previewMode == rhs.previewMode &&
        lhs.activeDocument == rhs.activeDocument &&
        lhs.previewState == rhs.previewState &&
        lhs.currentFolderURL == rhs.currentFolderURL &&
        lhs.previewFontSize == rhs.previewFontSize &&
        lhs.previewFontFamilyCSS == rhs.previewFontFamilyCSS &&
        lhs.isDark == rhs.isDark &&
        lhs.backgroundColor.isVisuallyEqual(to: rhs.backgroundColor)
    }

    var body: some View {
        ZStack {
            if let document = activeDocument, !document.content.isEmpty {
                VStack(spacing: 0) {
                    if case let .ready(.markdown(renderedHTML)) = previewState.phase,
                       previewState.request?.documentID == document.id,
                       previewState.request?.mode == .markdown {
                        PreviewView(
                            markdown: document.content,
                            renderedHTML: renderedHTML,
                            baseURL: previewState.request?.baseURL ?? document.fileURL?.deletingLastPathComponent() ?? currentFolderURL,
                            fontSize: previewFontSize,
                            fontFamilyCSS: previewFontFamilyCSS,
                            isDark: isDark,
                            backgroundColor: backgroundColor,
                            pageBackgroundHex: backgroundColor.hexString(),
                            onOpenLink: onOpenLink
                        )
                        .equatable()
                    } else if case let .ready(.pdf(pdfData)) = previewState.phase,
                              previewState.request?.documentID == document.id,
                              previewState.request?.mode == .pdf {
                        PDFPreviewView(data: pdfData)
                    } else if case let .failed(message) = previewState.phase,
                              previewState.request?.documentID == document.id {
                        VStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle")
                                .font(.system(size: 18, weight: .medium))
                                .foregroundStyle(surfaceSecondaryColor)
                            Text("Preview failed")
                                .font(.system(size: 13, weight: .medium))
                            Text(message)
                                .font(.system(size: 12))
                                .foregroundStyle(surfaceSecondaryColor)
                                .multilineTextAlignment(.center)
                                .lineLimit(4)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .padding(.horizontal, 24)
                    } else if case .loading = previewState.phase,
                              previewState.request?.documentID == document.id,
                              previewState.request?.mode == previewMode {
                        VStack(spacing: 8) {
                            ProgressView()
                                .controlSize(.small)
                            Text(previewMode == .markdown ? "Rendering preview…" : "Rendering PDF…")
                                .font(.system(size: 12))
                                .foregroundStyle(surfaceSecondaryColor)
                        }
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    } else {
                        Text("Preview")
                            .font(.system(size: 13))
                            .foregroundStyle(surfaceSecondaryColor)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
                .padding(.top, EditorDesignSystem.Chrome.previewContentTopInset)
                .padding(.horizontal, 0)
            } else {
                Text("Preview")
                    .font(.system(size: 13))
                    .foregroundStyle(surfaceSecondaryColor)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: backgroundColor))
    }

    private var surfaceSecondaryColor: Color {
        isDark ? Color.white.opacity(0.58) : Color.black.opacity(0.52)
    }
}

private extension NSColor {
    func isVisuallyEqual(to other: NSColor) -> Bool {
        guard
            let lhs = usingColorSpace(.deviceRGB),
            let rhs = other.usingColorSpace(.deviceRGB)
        else {
            return self == other
        }

        return abs(lhs.redComponent - rhs.redComponent) < 0.0001 &&
            abs(lhs.greenComponent - rhs.greenComponent) < 0.0001 &&
            abs(lhs.blueComponent - rhs.blueComponent) < 0.0001 &&
            abs(lhs.alphaComponent - rhs.alphaComponent) < 0.0001
    }
}

private struct FloatingStatusView: View {
    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var themeStore: ThemeStore

    var body: some View {
        HStack(spacing: 6) {
            Text(documentStore.statusText)
                .lineLimit(1)
        }
        .font(.system(size: 10, weight: .medium))
        .foregroundStyle(themeStore.editorSecondaryTextColor)
        .padding(.horizontal, 7)
        .padding(.vertical, 4)
        .background(themeStore.floatingToolbarBackgroundColor, in: Capsule(style: .continuous))
        .overlay {
            Capsule(style: .continuous)
                .strokeBorder(themeStore.isDarkMode ? Color.white.opacity(0.12) : Color.black.opacity(0.08))
        }
        .shadow(color: Color.black.opacity(themeStore.isDarkMode ? 0.22 : 0.08), radius: 12, y: 4)
    }
}

private struct FindReplacePanel: View {
    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var themeStore: ThemeStore
    @Environment(\.windowService) private var windowService

    var body: some View {
        VStack(spacing: EditorDesignSystem.Chrome.findPanelSpacing) {
            HStack(spacing: 8) {
                TextField("Find", text: Binding(
                    get: { documentStore.findReplaceState.searchTerm },
                    set: { documentStore.findReplaceState.searchTerm = $0 }
                ))
                .textFieldStyle(.roundedBorder)

                Button("Prev") {
                    documentStore.findPreviousMatch()
                }

                Button("Next") {
                    documentStore.findNextMatch()
                }

                Toggle("Aa", isOn: Binding(
                    get: { documentStore.findReplaceState.isCaseSensitive },
                    set: { documentStore.findReplaceState.isCaseSensitive = $0 }
                ))
                .toggleStyle(.checkbox)

                Button {
                    documentStore.findReplaceState.isPresented = false
                } label: {
                    Image(systemName: "xmark")
                }
                .buttonStyle(.borderless)
            }

            HStack(spacing: 8) {
                TextField("Replace", text: Binding(
                    get: { documentStore.findReplaceState.replaceTerm },
                    set: { documentStore.findReplaceState.replaceTerm = $0 }
                ))
                .textFieldStyle(.roundedBorder)

                Button("Replace") {
                    documentStore.replaceCurrentMatch()
                }

                Button("Replace All") {
                    documentStore.replaceAllMatches()
                }
            }
        }
        .padding(EditorDesignSystem.Chrome.findPanelPadding)
        .frame(maxWidth: EditorDesignSystem.Chrome.findPanelMaxWidth)
        .background(
            themeStore.editorPanelBackgroundColor,
            in: RoundedRectangle(cornerRadius: EditorDesignSystem.Chrome.findPanelCornerRadius, style: .continuous)
        )
        .overlay {
            RoundedRectangle(cornerRadius: EditorDesignSystem.Chrome.findPanelCornerRadius, style: .continuous)
                .strokeBorder(themeStore.editorHairlineColor)
        }
        .shadow(color: Color.black.opacity(themeStore.isDarkMode ? 0.22 : 0.08), radius: 16, y: 8)
    }
}
