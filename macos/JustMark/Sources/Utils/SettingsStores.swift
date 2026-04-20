import AppKit
import SwiftUI

@MainActor
final class SettingsStore: ObservableObject {
    @AppStorage("jm.attachmentFolder") var attachmentFolder: String = "00- Attachment"
    @AppStorage("jm.autoSaveEnabled") var autoSaveEnabled: Bool = true
    @AppStorage("jm.showHiddenFiles") var showHiddenFiles: Bool = false
    @AppStorage("jm.autoSyncOnLaunch") var autoSyncOnLaunch: Bool = false
    @AppStorage("jm.syncMode") private var syncModeRawValue: String = SyncMode.backup.rawValue
    @AppStorage("jm.webdavURL") var webdavURL: String = ""
    @AppStorage("jm.webdavUsername") var webdavUsername: String = ""
    @AppStorage("jm.webdavFolder") var webdavFolder: String = "/"
    @AppStorage("jm.layoutSidebarWidth") var layoutSidebarWidth: Double = 200
    @AppStorage("jm.layoutPreviewWidth") var layoutPreviewWidth: Double = 510
    @AppStorage("jm.layoutSidebarMinWidth") var layoutSidebarMinWidth: Double = 80
    @AppStorage("jm.layoutSidebarMaxWidth") var layoutSidebarMaxWidth: Double = 220
    @AppStorage("jm.layoutEditorMinWidth") var layoutEditorMinWidth: Double = 260
    @AppStorage("jm.layoutPreviewMinWidth") var layoutPreviewMinWidth: Double = 360
    @AppStorage("jm.layoutPreviewMaxWidth") var layoutPreviewMaxWidth: Double = 760
    @AppStorage("jm.layoutSidebarTopInset") var layoutSidebarTopInset: Double = 13
    @AppStorage("jm.layoutDividerWidth") var layoutDividerWidth: Double = 1
    @AppStorage("jm.previewMode") private var previewModeRawValue: String = PreviewMode.markdown.rawValue
    @AppStorage("jm.shortcutNewDocumentKey") private var shortcutNewDocumentKeyRaw: String = "n"
    @AppStorage("jm.shortcutNewDocumentModifiers") private var shortcutNewDocumentModifiersRaw: String = "command"
    @AppStorage("jm.shortcutOpenDocumentKey") private var shortcutOpenDocumentKeyRaw: String = "o"
    @AppStorage("jm.shortcutOpenDocumentModifiers") private var shortcutOpenDocumentModifiersRaw: String = "command"
    @AppStorage("jm.shortcutOpenFolderKey") private var shortcutOpenFolderKeyRaw: String = "o"
    @AppStorage("jm.shortcutOpenFolderModifiers") private var shortcutOpenFolderModifiersRaw: String = "command,shift"
    @AppStorage("jm.shortcutSaveKey") private var shortcutSaveKeyRaw: String = "s"
    @AppStorage("jm.shortcutSaveModifiers") private var shortcutSaveModifiersRaw: String = "command"
    @AppStorage("jm.shortcutSaveAsKey") private var shortcutSaveAsKeyRaw: String = "s"
    @AppStorage("jm.shortcutSaveAsModifiers") private var shortcutSaveAsModifiersRaw: String = "command,shift"
    @AppStorage("jm.shortcutCloseTabKey") private var shortcutCloseTabKeyRaw: String = "w"
    @AppStorage("jm.shortcutCloseTabModifiers") private var shortcutCloseTabModifiersRaw: String = "command"
    @AppStorage("jm.shortcutFindKey") private var shortcutFindKeyRaw: String = "f"
    @AppStorage("jm.shortcutFindModifiers") private var shortcutFindModifiersRaw: String = "command"
    @AppStorage("jm.shortcutTogglePreviewKey") private var shortcutTogglePreviewKeyRaw: String = "\\"
    @AppStorage("jm.shortcutTogglePreviewModifiers") private var shortcutTogglePreviewModifiersRaw: String = "command,option"

    init() {
        normalizeStoredWebDAVSettings()
    }

    var syncMode: SyncMode {
        get { SyncMode(rawValue: syncModeRawValue) ?? .backup }
        set { syncModeRawValue = newValue.rawValue }
    }

    var previewMode: PreviewMode {
        get { PreviewMode(rawValue: previewModeRawValue) ?? .markdown }
        set { previewModeRawValue = newValue.rawValue }
    }

    func shortcutBinding(for action: ShortcutAction) -> ShortcutBinding {
        switch action {
        case .newDocument:
            return .init(key: shortcutNewDocumentKeyRaw, modifiersRaw: shortcutNewDocumentModifiersRaw)
        case .openDocument:
            return .init(key: shortcutOpenDocumentKeyRaw, modifiersRaw: shortcutOpenDocumentModifiersRaw)
        case .openFolder:
            return .init(key: shortcutOpenFolderKeyRaw, modifiersRaw: shortcutOpenFolderModifiersRaw)
        case .save:
            return .init(key: shortcutSaveKeyRaw, modifiersRaw: shortcutSaveModifiersRaw)
        case .saveAs:
            return .init(key: shortcutSaveAsKeyRaw, modifiersRaw: shortcutSaveAsModifiersRaw)
        case .closeTab:
            return .init(key: shortcutCloseTabKeyRaw, modifiersRaw: shortcutCloseTabModifiersRaw)
        case .find:
            return .init(key: shortcutFindKeyRaw, modifiersRaw: shortcutFindModifiersRaw)
        case .togglePreview:
            return .init(key: shortcutTogglePreviewKeyRaw, modifiersRaw: shortcutTogglePreviewModifiersRaw)
        }
    }

    func setShortcutBinding(_ binding: ShortcutBinding, for action: ShortcutAction) {
        let normalized = binding.normalized()
        switch action {
        case .newDocument:
            shortcutNewDocumentKeyRaw = normalized.key
            shortcutNewDocumentModifiersRaw = normalized.modifiersRaw
        case .openDocument:
            shortcutOpenDocumentKeyRaw = normalized.key
            shortcutOpenDocumentModifiersRaw = normalized.modifiersRaw
        case .openFolder:
            shortcutOpenFolderKeyRaw = normalized.key
            shortcutOpenFolderModifiersRaw = normalized.modifiersRaw
        case .save:
            shortcutSaveKeyRaw = normalized.key
            shortcutSaveModifiersRaw = normalized.modifiersRaw
        case .saveAs:
            shortcutSaveAsKeyRaw = normalized.key
            shortcutSaveAsModifiersRaw = normalized.modifiersRaw
        case .closeTab:
            shortcutCloseTabKeyRaw = normalized.key
            shortcutCloseTabModifiersRaw = normalized.modifiersRaw
        case .find:
            shortcutFindKeyRaw = normalized.key
            shortcutFindModifiersRaw = normalized.modifiersRaw
        case .togglePreview:
            shortcutTogglePreviewKeyRaw = normalized.key
            shortcutTogglePreviewModifiersRaw = normalized.modifiersRaw
        }
        objectWillChange.send()
    }

    func resetShortcutBinding(for action: ShortcutAction) {
        setShortcutBinding(Self.defaultShortcutBinding(for: action), for: action)
    }

    static func defaultShortcutBinding(for action: ShortcutAction) -> ShortcutBinding {
        switch action {
        case .newDocument:
            return ShortcutBinding(key: "n", command: true)
        case .openDocument:
            return ShortcutBinding(key: "o", command: true)
        case .openFolder:
            return ShortcutBinding(key: "o", command: true, shift: true)
        case .save:
            return ShortcutBinding(key: "s", command: true)
        case .saveAs:
            return ShortcutBinding(key: "s", command: true, shift: true)
        case .closeTab:
            return ShortcutBinding(key: "w", command: true)
        case .find:
            return ShortcutBinding(key: "f", command: true)
        case .togglePreview:
            return ShortcutBinding(key: "\\", command: true, option: true)
        }
    }

    func sanitizedWebDAVURL(_ value: String) -> String {
        sanitizeWebDAVValue(value)
    }

    func sanitizedWebDAVUsername(_ value: String) -> String {
        sanitizeWebDAVValue(value)
    }

    func sanitizedWebDAVFolder(_ value: String) -> String {
        let sanitized = sanitizeWebDAVValue(value)
        return sanitized.isEmpty ? "/" : sanitized
    }

    private func normalizeStoredWebDAVSettings() {
        let normalizedURL = sanitizedWebDAVURL(webdavURL)
        let normalizedUsername = sanitizedWebDAVUsername(webdavUsername)
        let normalizedFolder = sanitizedWebDAVFolder(webdavFolder)

        if normalizedURL != webdavURL {
            webdavURL = normalizedURL
        }
        if normalizedUsername != webdavUsername {
            webdavUsername = normalizedUsername
        }
        if normalizedFolder != webdavFolder {
            webdavFolder = normalizedFolder
        }
    }

    private func sanitizeWebDAVValue(_ value: String) -> String {
        value
            .replacingOccurrences(of: "\r", with: "")
            .replacingOccurrences(of: "\n", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

struct ShortcutBinding: Equatable {
    var key: String
    var command: Bool = false
    var option: Bool = false
    var control: Bool = false
    var shift: Bool = false

    init(key: String, command: Bool = false, option: Bool = false, control: Bool = false, shift: Bool = false) {
        self.key = key
        self.command = command
        self.option = option
        self.control = control
        self.shift = shift
    }

    init(key: String, modifiersRaw: String) {
        self.init(key: key)
        let parts = Set(modifiersRaw.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) })
        command = parts.contains("command")
        option = parts.contains("option")
        control = parts.contains("control")
        shift = parts.contains("shift")
    }

    var modifiersRaw: String {
        var values: [String] = []
        if command { values.append("command") }
        if option { values.append("option") }
        if control { values.append("control") }
        if shift { values.append("shift") }
        return values.joined(separator: ",")
    }

    var eventModifiers: EventModifiers {
        var modifiers: EventModifiers = []
        if command { modifiers.insert(.command) }
        if option { modifiers.insert(.option) }
        if control { modifiers.insert(.control) }
        if shift { modifiers.insert(.shift) }
        return modifiers
    }

    var keyEquivalent: KeyEquivalent {
        let value = normalized().key
        if let character = value.first {
            return KeyEquivalent(character)
        }
        return KeyEquivalent(" ")
    }

    var displayString: String {
        var parts: [String] = []
        if command { parts.append("Cmd") }
        if shift { parts.append("Shift") }
        if option { parts.append("Opt") }
        if control { parts.append("Ctrl") }
        parts.append(normalized().keyDisplay)
        return parts.joined(separator: "+")
    }

    var keyDisplay: String {
        let value = normalized().key
        switch value {
        case " ":
            return "Space"
        case "\\":
            return "\\"
        default:
            return value.uppercased()
        }
    }

    func matches(_ event: NSEvent) -> Bool {
        let normalized = normalized()
        let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
        return normalized.menuModifierFlags == flags &&
            event.charactersIgnoringModifiers?.lowercased() == normalized.key.lowercased()
    }

    func normalized() -> ShortcutBinding {
        var normalized = self
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        normalized.key = trimmed.isEmpty ? " " : String(trimmed.prefix(1)).lowercased()
        return normalized
    }

    var menuModifierFlags: NSEvent.ModifierFlags {
        var modifiers: NSEvent.ModifierFlags = []
        if command { modifiers.insert(.command) }
        if option { modifiers.insert(.option) }
        if control { modifiers.insert(.control) }
        if shift { modifiers.insert(.shift) }
        return modifiers
    }
}

@MainActor
final class ThemeStore: ObservableObject {
    @AppStorage("jm.isDarkMode") var isDarkMode: Bool = false {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.editorContentAppearance") private var editorContentAppearanceRaw: String = ContentAppearanceMode.followApp.rawValue {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.previewContentAppearance") private var previewContentAppearanceRaw: String = ContentAppearanceMode.followApp.rawValue {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.lightWorkspaceBackgroundHex") var lightWorkspaceBackgroundHex: String = "#FFFFFF" {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.editorFontName") var editorFontName: String = "SF Mono" {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.editorCJKFontName") var editorCJKFontName: String = "PingFang SC" {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.previewLatinFontName") var previewLatinFontName: String = "Iowan Old Style" {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.previewCJKFontName") var previewCJKFontName: String = "PingFang SC" {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.editorFontSize") var editorFontSize: Double = 13 {
        willSet { objectWillChange.send() }
    }
    @AppStorage("jm.previewFontSize") var previewFontSize: Double = 12 {
        willSet { objectWillChange.send() }
    }

    private let editorLatinFonts: [String] = [
        "SF Mono",
        "Menlo",
        "Monaco",
        "Courier",
        "Helvetica Neue",
        "Avenir Next"
    ]
    private let editorCJKFonts: [String] = [
        "PingFang SC",
        "Hiragino Sans GB",
        "Songti SC",
        "Heiti SC",
        "Kaiti SC",
        "STSong"
    ]
    private let previewLatinFonts: [String] = [
        "Iowan Old Style",
        "Palatino",
        "Times New Roman",
        "Georgia",
        "Baskerville"
    ]
    private let previewCJKFonts: [String] = [
        "PingFang SC",
        "Hiragino Sans GB",
        "Songti SC",
        "Heiti SC",
        "Kaiti SC",
        "STSong"
    ]

    var availableEditorFonts: [String] { mergedLatinFonts }
    var availablePreviewLatinFonts: [String] { mergedLatinFonts }
    var availableEditorCJKFonts: [String] { mergedCJKFonts }
    var availablePreviewCJKFonts: [String] { mergedCJKFonts }

    private var mergedLatinFonts: [String] {
        ThemeStore.mergeUnique(editorLatinFonts, previewLatinFonts)
    }

    private var mergedCJKFonts: [String] {
        ThemeStore.mergeUnique(editorCJKFonts, previewCJKFonts)
    }

    var editorContentAppearance: ContentAppearanceMode {
        get { ContentAppearanceMode(rawValue: editorContentAppearanceRaw) ?? .followApp }
        set { editorContentAppearanceRaw = newValue.rawValue }
    }

    var previewContentAppearance: ContentAppearanceMode {
        get { ContentAppearanceMode(rawValue: previewContentAppearanceRaw) ?? .followApp }
        set { previewContentAppearanceRaw = newValue.rawValue }
    }

    var effectiveEditorIsDark: Bool {
        resolvedContentIsDark(editorContentAppearance)
    }

    var effectivePreviewIsDark: Bool {
        resolvedContentIsDark(previewContentAppearance)
    }

    var workspaceBackgroundColor: Color {
        Color(nsColor: workspaceBackgroundNSColor)
    }

    var editorBackgroundColor: Color {
        Color(nsColor: editorCanvasBackgroundNSColor)
    }

    var previewBackgroundNSColor: NSColor {
        if effectivePreviewIsDark {
            return NSColor(hex: "#1E1E21") ?? workspaceBackgroundNSColor
        }
        return NSColor(hex: "#F9F7F2") ?? workspaceBackgroundNSColor
    }

    var previewBackgroundColor: Color {
        Color(nsColor: previewBackgroundNSColor)
    }

    var sidebarBackgroundNSColor: NSColor {
        workspaceBackgroundNSColor
    }

    var sidebarBackgroundColor: Color {
        Color(nsColor: sidebarBackgroundNSColor)
    }

    var workspaceBackgroundNSColor: NSColor {
        if isDarkMode {
            return NSColor(hex: "#161618") ?? .black
        }
        let normalized = lightWorkspaceBackgroundHex
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()
        if normalized == "#FFFFFF" || normalized == "FFFFFF" || normalized.isEmpty {
            return NSColor(hex: "#F6F4EF") ?? .white
        }
        return NSColor(hex: lightWorkspaceBackgroundHex) ?? .white
    }

    var editorCanvasBackgroundNSColor: NSColor {
        if effectiveEditorIsDark {
            return NSColor(hex: "#1C1C1F") ?? workspaceBackgroundNSColor
        }
        return NSColor(hex: "#FCFBF8") ?? workspaceBackgroundNSColor
    }

    var editorChromeBackgroundColor: Color {
        if isDarkMode {
            return Color(nsColor: NSColor(hex: "#111214") ?? workspaceBackgroundNSColor)
        }
        return Color(nsColor: NSColor(hex: "#F1EEE8") ?? workspaceBackgroundNSColor)
    }

    var editorCanvasBackgroundColor: Color {
        Color(nsColor: editorCanvasBackgroundNSColor)
    }

    var editorPanelBackgroundColor: Color {
        Color(nsColor: editorCanvasBackgroundNSColor)
    }

    var editorHairlineColor: Color {
        if isDarkMode {
            return Color.white.opacity(0.08)
        }
        return Color.black.opacity(0.09)
    }

    var editorInactiveTabFillColor: Color {
        if isDarkMode {
            return Color.clear
        }
        return Color(nsColor: NSColor(calibratedWhite: 0.975, alpha: 1))
    }

    var editorInactiveTabStrokeColor: Color {
        if isDarkMode {
            return Color.clear
        }
        return Color.black.opacity(0.08)
    }

    var editorActiveTabFillColor: Color {
        if isDarkMode {
            return Color.white.opacity(0.08)
        }
        return Color(nsColor: NSColor(calibratedWhite: 0.88, alpha: 1))
    }

    var editorActiveTabStrokeColor: Color {
        if isDarkMode {
            return Color.white.opacity(0.13)
        }
        return Color.black.opacity(0.24)
    }

    var editorActiveTabTitleColor: Color {
        isDarkMode ? Color.primary.opacity(0.96) : Color.black.opacity(0.84)
    }

    var editorSecondaryTextColor: Color {
        isDarkMode ? Color.white.opacity(0.62) : Color.black.opacity(0.68)
    }

    var dividerNSColor: NSColor {
        if isDarkMode {
            return NSColor(hex: "#2A2B2F") ?? .black
        }
        return NSColor(hex: "#E1E4E8") ?? .separatorColor
    }

    var floatingToolbarBackgroundColor: Color {
        if isDarkMode {
            return Color(nsColor: NSColor.black.withAlphaComponent(0.65))
        }
        return Color(nsColor: NSColor(calibratedWhite: 0.94, alpha: 1))
    }

    private func resolvedContentIsDark(_ mode: ContentAppearanceMode) -> Bool {
        switch mode {
        case .followApp:
            return isDarkMode
        case .light:
            return false
        case .dark:
            return true
        }
    }

    func editorNSFont() -> NSFont {
        let baseFont: NSFont
        if editorFontName == "SF Mono" {
            baseFont = .monospacedSystemFont(ofSize: editorFontSize, weight: .regular)
        } else {
            baseFont = NSFont(name: editorFontName, size: editorFontSize)
                ?? .monospacedSystemFont(ofSize: editorFontSize, weight: .regular)
        }

        let cjkDescriptor = NSFontDescriptor(fontAttributes: [.name: editorCJKFontName])
        let descriptor = baseFont.fontDescriptor.addingAttributes([
            .cascadeList: [cjkDescriptor]
        ])

        return NSFont(descriptor: descriptor, size: editorFontSize) ?? baseFont
    }

    func previewFontFamilyCSS() -> String {
        let latinFamilies = [
            "\"\(previewLatinFontName)\"",
            "\"Palatino Linotype\"",
            "\"Times New Roman\""
        ]
        let cjkFamilies = [
            "\"\(previewCJKFontName)\"",
            "\"Hiragino Sans GB\"",
            "\"Source Han Serif SC\""
        ]
        return (latinFamilies + cjkFamilies + ["serif"]).joined(separator: ", ")
    }

    private static func mergeUnique(_ first: [String], _ second: [String]) -> [String] {
        var seen = Set<String>()
        var merged: [String] = []
        for item in first + second {
            if seen.insert(item).inserted {
                merged.append(item)
            }
        }
        return merged
    }
}

extension NSColor {
    convenience init?(hex: String) {
        var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if cleaned.hasPrefix("#") {
            cleaned.removeFirst()
        }
        guard cleaned.count == 6, let value = Int(cleaned, radix: 16) else {
            return nil
        }
        let red = CGFloat((value >> 16) & 0xFF) / 255
        let green = CGFloat((value >> 8) & 0xFF) / 255
        let blue = CGFloat(value & 0xFF) / 255
        self.init(srgbRed: red, green: green, blue: blue, alpha: 1)
    }

    func hexString() -> String {
        let color = usingColorSpace(.deviceRGB) ?? self
        let red = Int(round(color.redComponent * 255))
        let green = Int(round(color.greenComponent * 255))
        let blue = Int(round(color.blueComponent * 255))
        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}

extension Color {
    func toHexString() -> String? {
        let nsColor = NSColor(self)
        return nsColor.hexString()
    }
}
