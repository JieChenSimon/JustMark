import Foundation

struct DocumentTab: Identifiable, Equatable {
    let id: UUID
    var displayName: String
    var fileURL: URL?
    var content: String
    var savedContent: String
    var selectedRange: NSRange
    var verticalScrollFraction: Double

    init(
        id: UUID = UUID(),
        displayName: String,
        fileURL: URL?,
        content: String,
        savedContent: String,
        selectedRange: NSRange = .init(location: 0, length: 0),
        verticalScrollFraction: Double = 0
    ) {
        self.id = id
        self.displayName = displayName
        self.fileURL = fileURL
        self.content = content
        self.savedContent = savedContent
        self.selectedRange = selectedRange
        self.verticalScrollFraction = verticalScrollFraction
    }

    var hasUnsavedChanges: Bool {
        content != savedContent
    }
}

struct SessionDocumentSnapshot: Codable {
    let id: UUID
    let displayName: String
    let fileURL: URL?
    let content: String?
    let savedContent: String?
    let selectedRangeLocation: Int
    let selectedRangeLength: Int
    let verticalScrollFraction: Double
}

struct WorkspaceSessionSnapshot: Codable {
    let currentFolderURL: URL?
    let activeDocumentID: UUID?
    let openDocuments: [SessionDocumentSnapshot]
}

struct SyncSnapshotEntry: Codable {
    let localSignature: String?
    let remoteSignature: String?
}

struct FileTreeNode: Identifiable, Hashable {
    enum Kind {
        case file
        case folder
    }

    let id: String
    let name: String
    let url: URL
    let kind: Kind
    var children: [FileTreeNode]
    var isChildrenLoaded: Bool

    init(
        id: String,
        name: String,
        url: URL,
        kind: Kind,
        children: [FileTreeNode] = [],
        isChildrenLoaded: Bool? = nil
    ) {
        self.id = id
        self.name = name
        self.url = url
        self.kind = kind
        self.children = children
        self.isChildrenLoaded = isChildrenLoaded ?? (kind == .file)
    }

    var isFolder: Bool {
        kind == .folder
    }
}

struct TableOfContentsHeading: Identifiable, Hashable {
    let id: String
    let text: String
    let level: Int
    let line: Int
}

enum SyncMode: String, CaseIterable, Codable {
    case backup
    case twoWay = "two-way"

    var label: String {
        switch self {
        case .backup:
            return "Backup"
        case .twoWay:
            return "Two-way"
        }
    }
}

enum WebDAVStatusKind: Equatable {
    case neutral
    case success
    case error
}

struct WebDAVSettingsState: Equatable {
    var hasStoredPassword = false
    var isTestingConnection = false
    var statusMessage: String?
    var statusKind: WebDAVStatusKind = .neutral
}

enum PreviewMode: String, CaseIterable, Codable {
    case markdown
    case pdf
}

enum ContentAppearanceMode: String, CaseIterable, Codable, Identifiable {
    case followApp
    case light
    case dark

    var id: String { rawValue }

    var title: String {
        switch self {
        case .followApp:
            return "Follow App"
        case .light:
            return "Light"
        case .dark:
            return "Dark"
        }
    }
}

struct PreviewRequest: Equatable {
    let documentID: UUID?
    let markdown: String
    let baseURL: URL?
    let mode: PreviewMode
    let pdfFontSize: Double
    let pdfFontFamilyCSS: String
}

enum PreviewArtifact: Equatable {
    case markdown(String)
    case pdf(Data)
}

enum PreviewPhase: Equatable {
    case idle
    case loading
    case ready(PreviewArtifact)
    case failed(String)
}

struct PreviewState: Equatable {
    var request: PreviewRequest?
    var phase: PreviewPhase

    static let idle = PreviewState(request: nil, phase: .idle)
}

enum ShortcutAction: String, CaseIterable, Identifiable {
    case newDocument
    case openDocument
    case openFolder
    case save
    case saveAs
    case closeTab
    case find
    case togglePreview

    var id: String { rawValue }

    var title: String {
        switch self {
        case .newDocument: return "New Document"
        case .openDocument: return "Open File"
        case .openFolder: return "Open Folder"
        case .save: return "Save"
        case .saveAs: return "Save As"
        case .closeTab: return "Close Tab"
        case .find: return "Find"
        case .togglePreview: return "Show or Hide Preview"
        }
    }
}
