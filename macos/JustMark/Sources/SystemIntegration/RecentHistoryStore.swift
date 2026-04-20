import Foundation

@MainActor
final class RecentHistoryStore: ObservableObject {
    @Published private(set) var recentFiles: [URL] = []
    @Published private(set) var recentFolders: [URL] = []
    private let defaults = UserDefaults.standard
    private let recentFilesKey = "jm.recentFiles"
    private let recentFoldersKey = "jm.recentFolders"

    init() {
        recentFiles = loadURLs(forKey: recentFilesKey)
        recentFolders = loadURLs(forKey: recentFoldersKey)
    }

    func addFile(_ url: URL) {
        recentFiles.removeAll { $0 == url }
        recentFiles.insert(url, at: 0)
        recentFiles = Array(recentFiles.prefix(10))
        persist(recentFiles, key: recentFilesKey)
    }

    func addFolder(_ url: URL) {
        recentFolders.removeAll { $0 == url }
        recentFolders.insert(url, at: 0)
        recentFolders = Array(recentFolders.prefix(10))
        persist(recentFolders, key: recentFoldersKey)
    }

    private func loadURLs(forKey key: String) -> [URL] {
        guard let values = defaults.array(forKey: key) as? [String] else {
            return []
        }
        return values.compactMap(URL.init(string:))
    }

    private func persist(_ urls: [URL], key: String) {
        defaults.set(urls.map(\.absoluteString), forKey: key)
    }
}
