import AppKit
import SwiftUI

struct SettingsRootView: View {
    var body: some View {
        TabView {
            GeneralSettingsPane()
                .tabItem {
                    Label("General", systemImage: "gearshape")
                }

            AppearanceSettingsPane()
                .tabItem {
                    Label("Appearance", systemImage: "textformat")
                }

            ShortcutSettingsPane()
                .tabItem {
                    Label("Shortcuts", systemImage: "command")
                }

            SyncSettingsPane()
                .tabItem {
                    Label("Sync", systemImage: "arrow.triangle.2.circlepath")
                }
        }
        .frame(width: 660, height: 500)
        .padding(20)
    }
}

private struct ShortcutSettingsPane: View {
    @EnvironmentObject private var settingsStore: SettingsStore

    var body: some View {
        Form {
            Section {
                ForEach(ShortcutAction.allCases) { action in
                    ShortcutRow(
                        title: action.title,
                        binding: Binding(
                            get: { settingsStore.shortcutBinding(for: action) },
                            set: { settingsStore.setShortcutBinding($0, for: action) }
                        ),
                        onReset: { settingsStore.resetShortcutBinding(for: action) }
                    )
                }
            } header: {
                Text("Bindings")
            } footer: {
                Text("Default shortcuts follow common macOS conventions. Changes apply immediately.")
            }
        }
        .formStyle(.grouped)
    }
}

private struct ShortcutRow: View {
    let title: String
    @Binding var binding: ShortcutBinding
    let onReset: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))

            HStack(alignment: .center, spacing: 12) {
                HStack(spacing: 8) {
                    Text("Key")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(.secondary)
                        .frame(width: 28, alignment: .leading)

                    TextField("", text: Binding(
                        get: { binding.keyDisplay },
                        set: { binding.key = String($0.trimmingCharacters(in: .whitespacesAndNewlines).prefix(1)) }
                    ))
                    .labelsHidden()
                    .textFieldStyle(.roundedBorder)
                    .frame(width: 52)
                }

                Toggle("Cmd", isOn: $binding.command)
                    .toggleStyle(.checkbox)
                Toggle("Shift", isOn: $binding.shift)
                    .toggleStyle(.checkbox)
                Toggle("Opt", isOn: $binding.option)
                    .toggleStyle(.checkbox)
                Toggle("Ctrl", isOn: $binding.control)
                    .toggleStyle(.checkbox)

                Spacer(minLength: 12)

                Text(binding.displayString)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.secondary)
                    .frame(minWidth: 110, alignment: .trailing)

                Button("Reset", action: onReset)
                    .buttonStyle(.link)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.vertical, 6)
    }
}

private struct GeneralSettingsPane: View {
    @EnvironmentObject private var settingsStore: SettingsStore

    var body: some View {
        Form {
            Section {
                Toggle("Auto Save", isOn: Binding(
                    get: { settingsStore.autoSaveEnabled },
                    set: { settingsStore.autoSaveEnabled = $0 }
                ))
                Toggle("Show Hidden Files", isOn: Binding(
                    get: { settingsStore.showHiddenFiles },
                    set: { settingsStore.showHiddenFiles = $0 }
                ))
                TextField("Attachment Folder", text: Binding(
                    get: { settingsStore.attachmentFolder },
                    set: { settingsStore.attachmentFolder = $0 }
                ))
            } header: {
                Text("Files")
            }
        }
        .formStyle(.grouped)
    }
}

private struct AppearanceSettingsPane: View {
    @EnvironmentObject private var themeStore: ThemeStore

    var body: some View {
        Form {
            Section {
                Toggle("Dark Mode", isOn: Binding(
                    get: { themeStore.isDarkMode },
                    set: { themeStore.isDarkMode = $0 }
                ))

                ColorPicker("Light Theme Background", selection: Binding(
                    get: { Color(nsColor: NSColor(hex: themeStore.lightWorkspaceBackgroundHex) ?? .white) },
                    set: { newColor in
                        if let hex = newColor.toHexString() {
                            themeStore.lightWorkspaceBackgroundHex = hex
                        }
                    }
                ))
            } header: {
                Text("Theme")
            }

            Section {
                Picker("Editor Surface", selection: Binding(
                    get: { themeStore.editorContentAppearance },
                    set: { themeStore.editorContentAppearance = $0 }
                )) {
                    ForEach(ContentAppearanceMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.menu)

                Picker("Editor Background", selection: Binding(
                    get: { themeStore.editorContentSurfaceTint },
                    set: { themeStore.editorContentSurfaceTint = $0 }
                )) {
                    ForEach(ContentSurfaceTint.allCases) { tint in
                        Text(tint.title).tag(tint)
                    }
                }
                .pickerStyle(.menu)

                Picker("Preview Surface", selection: Binding(
                    get: { themeStore.previewContentAppearance },
                    set: { themeStore.previewContentAppearance = $0 }
                )) {
                    ForEach(ContentAppearanceMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.menu)

                Picker("Preview Background", selection: Binding(
                    get: { themeStore.previewContentSurfaceTint },
                    set: { themeStore.previewContentSurfaceTint = $0 }
                )) {
                    ForEach(ContentSurfaceTint.allCases) { tint in
                        Text(tint.title).tag(tint)
                    }
                }
                .pickerStyle(.menu)
            } header: {
                Text("Content Surfaces")
            } footer: {
                Text("Keep the window chrome on the app theme. Use surface mode to control light or dark behavior, and use background presets to pick a paper or canvas tone without introducing arbitrary colors.")
            }

            Section {
                Picker("Editor Latin Font", selection: Binding(
                    get: { themeStore.editorFontName },
                    set: { themeStore.editorFontName = $0 }
                )) {
                    ForEach(themeStore.availableEditorFonts, id: \.self) { fontName in
                        Text(fontName).tag(fontName)
                    }
                }
                .pickerStyle(.menu)

                Picker("Editor Chinese Font", selection: Binding(
                    get: { themeStore.editorCJKFontName },
                    set: { themeStore.editorCJKFontName = $0 }
                )) {
                    ForEach(themeStore.availableEditorCJKFonts, id: \.self) { fontName in
                        Text(fontName).tag(fontName)
                    }
                }
                .pickerStyle(.menu)

                Picker("Preview Latin Font", selection: Binding(
                    get: { themeStore.previewLatinFontName },
                    set: { themeStore.previewLatinFontName = $0 }
                )) {
                    ForEach(themeStore.availablePreviewLatinFonts, id: \.self) { fontName in
                        Text(fontName).tag(fontName)
                    }
                }
                .pickerStyle(.menu)

                Picker("Preview Chinese Font", selection: Binding(
                    get: { themeStore.previewCJKFontName },
                    set: { themeStore.previewCJKFontName = $0 }
                )) {
                    ForEach(themeStore.availablePreviewCJKFonts, id: \.self) { fontName in
                        Text(fontName).tag(fontName)
                    }
                }
                .pickerStyle(.menu)

                LabeledContent("Editor Size") {
                    Stepper(value: Binding(
                        get: { themeStore.editorFontSize },
                        set: { themeStore.editorFontSize = $0 }
                    ), in: 11...28) {
                        Text("\(Int(themeStore.editorFontSize)) pt")
                            .monospacedDigit()
                    }
                }

                LabeledContent("Preview Size") {
                    Stepper(value: Binding(
                        get: { themeStore.previewFontSize },
                        set: { themeStore.previewFontSize = $0 }
                    ), in: 10...28) {
                        Text("\(Int(themeStore.previewFontSize)) pt")
                            .monospacedDigit()
                    }
                }
            } header: {
                Text("Typography")
            }
        }
        .formStyle(.grouped)
    }
}

private struct SyncSettingsPane: View {
    @EnvironmentObject private var settingsStore: SettingsStore
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    @State private var draftWebDAVURL: String = ""
    @State private var draftWebDAVUsername: String = ""
    @State private var draftWebDAVFolder: String = "/"
    @State private var webdavPassword: String = ""
    @State private var didLoadDrafts = false
    private let sectionSpacing: CGFloat = 24

    private var statusColor: Color {
        switch workspaceStore.webDAVSettingsState.statusKind {
        case .neutral:
            return .secondary
        case .success:
            return .green
        case .error:
            return .red
        }
    }

    private var storedPasswordLabel: some View {
        Group {
            if workspaceStore.webDAVSettingsState.hasStoredPassword {
                Label("Stored securely in Keychain", systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
            } else {
                Label("No password saved yet", systemImage: "key.slash")
                    .foregroundStyle(.secondary)
            }
        }
        .font(.system(size: 12, weight: .medium))
    }

    private var webDAVURLBinding: Binding<String> {
        Binding(
            get: { draftWebDAVURL },
            set: { draftWebDAVURL = settingsStore.sanitizedWebDAVURL($0) }
        )
    }

    private var webDAVUsernameBinding: Binding<String> {
        Binding(
            get: { draftWebDAVUsername },
            set: { draftWebDAVUsername = settingsStore.sanitizedWebDAVUsername($0) }
        )
    }

    private var webDAVFolderBinding: Binding<String> {
        Binding(
            get: { draftWebDAVFolder },
            set: { draftWebDAVFolder = settingsStore.sanitizedWebDAVFolder($0) }
        )
    }

    private var draftConfiguration: WebDAVConfiguration {
        WebDAVConfiguration(
            url: settingsStore.sanitizedWebDAVURL(draftWebDAVURL),
            username: settingsStore.sanitizedWebDAVUsername(draftWebDAVUsername),
            folder: settingsStore.sanitizedWebDAVFolder(draftWebDAVFolder)
        )
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: sectionSpacing) {
                SettingsSectionCard(title: "Behavior") {
                    VStack(alignment: .leading, spacing: 16) {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Sync Mode")
                                .font(.system(size: 13, weight: .medium))
                            Picker("Sync Mode", selection: Binding(
                                get: { settingsStore.syncMode },
                                set: { settingsStore.syncMode = $0 }
                            )) {
                                ForEach(SyncMode.allCases, id: \.self) { mode in
                                    Text(mode.label).tag(mode)
                                }
                            }
                            .pickerStyle(.menu)
                            .frame(width: 220, alignment: .leading)
                        }

                        Toggle("Sync On Launch", isOn: Binding(
                            get: { settingsStore.autoSyncOnLaunch },
                            set: { settingsStore.autoSyncOnLaunch = $0 }
                        ))
                    }
                } footer: {
                    Text("The app now opens with a fresh blank document on each launch. Startup sync only runs when launch automation or an external open action has already provided a real file or workspace.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                SettingsSectionCard(title: "Connection") {
                    VStack(alignment: .leading, spacing: 14) {
                        SyncFieldRow(title: "Server URL") {
                            settingsTextField(
                                text: webDAVURLBinding,
                                prompt: "https://dav.example.com/.../username/"
                            )
                        }

                        SyncFieldRow(title: "Username") {
                            settingsTextField(
                                text: webDAVUsernameBinding,
                                prompt: "your-account-name"
                            )
                        }

                        SyncFieldRow(title: "Remote Folder") {
                            settingsTextField(
                                text: webDAVFolderBinding,
                                prompt: "/JustMark"
                            )
                        }

                        SyncFieldRow(title: "Password") {
                            SecureField(
                                "",
                                text: $webdavPassword,
                                prompt: Text("App password or WebDAV password")
                                    .foregroundStyle(.secondary)
                            )
                            .textFieldStyle(.roundedBorder)
                            .lineLimit(1)
                        }
                    }
                } footer: {
                    Text("Use the full WebDAV endpoint URL, your account name, and the target remote folder path. Leave the password field empty to keep the existing Keychain credential.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                SettingsSectionCard(title: "Status") {
                    VStack(alignment: .leading, spacing: 14) {
                        SettingsValueRow(title: "Credentials") {
                            storedPasswordLabel
                        }

                        if workspaceStore.webDAVSettingsState.isTestingConnection {
                            SettingsValueRow(title: "Connection Check") {
                                ProgressView()
                                    .controlSize(.small)
                            }
                        }

                        if let message = workspaceStore.webDAVSettingsState.statusMessage, !message.isEmpty {
                            SettingsValueRow(title: "Last Result") {
                                Text(message)
                                    .font(.system(size: 12))
                                    .foregroundStyle(statusColor)
                                    .multilineTextAlignment(.trailing)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                    }
                }

                SettingsSectionCard(title: "Actions") {
                    VStack(alignment: .leading, spacing: 12) {
                        Button("Verify and Save Connection") {
                            Task {
                                commitDraftWebDAVSettings()
                                let didSave = await workspaceStore.saveWebDAVConfiguration(password: webdavPassword)
                                if didSave {
                                    webdavPassword = ""
                                }
                            }
                        }
                        .disabled(workspaceStore.webDAVSettingsState.isTestingConnection || workspaceStore.isSyncing)

                        HStack(spacing: 10) {
                            Button("Sync Active Document") {
                                Task { await workspaceStore.syncActiveDocumentToWebDAV() }
                            }
                            Button("Sync Markdown Workspace") {
                                Task { await workspaceStore.syncWorkspaceToWebDAV() }
                            }
                        }
                        .disabled(workspaceStore.webDAVSettingsState.isTestingConnection || workspaceStore.isSyncing)

                        if workspaceStore.isSyncing {
                            SettingsValueRow(title: "Sync Progress") {
                                ProgressView(value: workspaceStore.syncProgress)
                                    .frame(width: 180)
                            }
                        }
                    }
                } footer: {
                    Text("Workspace sync currently covers Markdown and plain-text documents. Attachments and other binary assets are not uploaded yet.")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, 4)
            .padding(.vertical, 10)
        }
        .task {
            loadDraftsIfNeeded()
            refreshDraftConnectionState()
        }
        .onChange(of: draftWebDAVURL) { _, _ in
            refreshDraftConnectionState()
        }
        .onChange(of: draftWebDAVUsername) { _, _ in
            refreshDraftConnectionState()
        }
        .onChange(of: draftWebDAVFolder) { _, _ in
            refreshDraftConnectionState()
        }
    }

    private func loadDraftsIfNeeded() {
        guard !didLoadDrafts else { return }
        draftWebDAVURL = settingsStore.sanitizedWebDAVURL(settingsStore.webdavURL)
        draftWebDAVUsername = settingsStore.sanitizedWebDAVUsername(settingsStore.webdavUsername)
        draftWebDAVFolder = settingsStore.sanitizedWebDAVFolder(settingsStore.webdavFolder)
        didLoadDrafts = true
    }

    private func refreshDraftConnectionState() {
        workspaceStore.refreshWebDAVSettingsState(for: draftConfiguration)
    }

    private func commitDraftWebDAVSettings() {
        settingsStore.webdavURL = draftConfiguration.url
        settingsStore.webdavUsername = draftConfiguration.username
        settingsStore.webdavFolder = draftConfiguration.folder
        workspaceStore.refreshWebDAVSettingsState(for: draftConfiguration)
    }
}

private struct SettingsSectionCard<Content: View, Footer: View>: View {
    let title: String
    @ViewBuilder let content: Content
    @ViewBuilder let footer: Footer

    init(
        title: String,
        @ViewBuilder content: () -> Content,
        @ViewBuilder footer: () -> Footer = { EmptyView() }
    ) {
        self.title = title
        self.content = content()
        self.footer = footer()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 14, weight: .semibold))

            VStack(alignment: .leading, spacing: 0) {
                content
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.primary.opacity(0.06))
            )

            footer
        }
    }
}

private struct SyncFieldRow<Field: View>: View {
    let title: String
    @ViewBuilder let field: Field

    init(title: String, @ViewBuilder field: () -> Field) {
        self.title = title
        self.field = field()
    }

    var body: some View {
        HStack(alignment: .center, spacing: 16) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .frame(width: 110, alignment: .leading)
            field
                .frame(maxWidth: .infinity)
        }
    }
}

private struct SettingsValueRow<Value: View>: View {
    let title: String
    @ViewBuilder let value: Value

    init(title: String, @ViewBuilder value: () -> Value) {
        self.title = title
        self.value = value()
    }

    var body: some View {
        HStack(alignment: .top, spacing: 16) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .frame(width: 120, alignment: .leading)
            Spacer(minLength: 0)
            value
        }
    }
}

private func settingsTextField(text: Binding<String>, prompt: String) -> some View {
    TextField(
        "",
        text: text,
        prompt: Text(prompt)
            .foregroundStyle(.secondary)
    )
    .textFieldStyle(.roundedBorder)
    .lineLimit(1)
}
