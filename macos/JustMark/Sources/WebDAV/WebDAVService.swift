import Foundation

struct WebDAVConfiguration: Codable, Equatable {
    var url: String
    var username: String
    var folder: String

    var credentialID: String {
        "\(url.trimmingCharacters(in: .whitespacesAndNewlines))|\(username.trimmingCharacters(in: .whitespacesAndNewlines))"
    }

    var legacyCredentialID: String {
        "\(url.trimmingCharacters(in: .whitespacesAndNewlines))|\(username.trimmingCharacters(in: .whitespacesAndNewlines))|\(normalizedFolder)"
    }

    var normalizedFolder: String {
        let trimmed = folder.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == "/" {
            return "/"
        }
        return trimmed.hasPrefix("/") ? trimmed : "/" + trimmed
    }
}

struct WebDAVRemoteEntry: Hashable {
    let path: String
    let isDirectory: Bool
    let size: Int64?
    let lastModified: String?

    var signature: String {
        #"{"size":\#(size ?? 0),"mtime":"\#(lastModified ?? "")"}"#
    }
}

final class WebDAVService {
    private let keychainStore: KeychainStore
    private let keychainServiceName = "justmark-webdav"
    private let session: URLSession

    init(keychainStore: KeychainStore, session: URLSession = .shared) {
        self.keychainStore = keychainStore
        self.session = session
    }

    func validate(_ configuration: WebDAVConfiguration) throws {
        guard let url = URL(string: configuration.url), let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme) else {
            throw WebDAVError.invalidURL
        }
        guard url.query == nil, url.fragment == nil else {
            throw WebDAVError.invalidURL
        }
        guard !configuration.normalizedFolder.contains("..") else {
            throw WebDAVError.invalidFolder
        }
    }

    func savePassword(_ password: String, for configuration: WebDAVConfiguration) throws {
        try keychainStore.savePassword(password, account: configuration.credentialID, service: keychainServiceName)
        if configuration.legacyCredentialID != configuration.credentialID {
            keychainStore.deletePassword(account: configuration.legacyCredentialID, service: keychainServiceName)
        }
    }

    func readPassword(for configuration: WebDAVConfiguration) throws -> String? {
        if let password = try keychainStore.readPassword(account: configuration.credentialID, service: keychainServiceName), !password.isEmpty {
            return password
        }
        if configuration.legacyCredentialID != configuration.credentialID {
            return try keychainStore.readPassword(account: configuration.legacyCredentialID, service: keychainServiceName)
        }
        return nil
    }

    func hasPassword(for configuration: WebDAVConfiguration) -> Bool {
        guard let password = try? readPassword(for: configuration) else {
            return false
        }
        return password.isEmpty == false
    }

    func deletePassword(for configuration: WebDAVConfiguration) {
        keychainStore.deletePassword(account: configuration.credentialID, service: keychainServiceName)
    }

    func testConnection(_ configuration: WebDAVConfiguration, password: String? = nil) async throws {
        try validate(configuration)
        let resolvedPassword = try password ?? readPassword(for: configuration)
        guard let resolvedPassword, !resolvedPassword.isEmpty else {
            throw WebDAVError.missingPassword
        }

        let requestURL = try endpointURL(for: configuration, path: "", isCollection: true)
        var request = URLRequest(url: requestURL)
        request.httpMethod = "PROPFIND"
        request.setValue("0", forHTTPHeaderField: "Depth")
        request.setValue("application/xml; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = """
        <?xml version="1.0" encoding="utf-8" ?>
        <propfind xmlns="DAV:"><prop><displayname/></prop></propfind>
        """.data(using: .utf8)
        applyBasicAuth(to: &request, username: configuration.username, password: resolvedPassword)

        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WebDAVError.invalidResponse(statusCode: nil, method: request.httpMethod ?? "PROPFIND", url: requestURL.absoluteString)
        }
        guard (200...299).contains(http.statusCode) || http.statusCode == 207 else {
            throw WebDAVError.invalidResponse(statusCode: http.statusCode, method: request.httpMethod ?? "PROPFIND", url: requestURL.absoluteString)
        }
    }

    func uploadTextFile(
        _ content: String,
        remotePath: String,
        configuration: WebDAVConfiguration,
        password: String? = nil
    ) async throws {
        try validate(configuration)
        let resolvedPassword = try password ?? readPassword(for: configuration)
        guard let resolvedPassword, !resolvedPassword.isEmpty else {
            throw WebDAVError.missingPassword
        }

        let requestURL = try endpointURL(for: configuration, path: remotePath, isCollection: false)
        try await ensureRemoteDirectory(for: remotePath, configuration: configuration, password: resolvedPassword)

        var request = URLRequest(url: requestURL)
        request.httpMethod = "PUT"
        request.httpBody = Data(content.utf8)
        request.setValue("text/markdown; charset=utf-8", forHTTPHeaderField: "Content-Type")
        applyBasicAuth(to: &request, username: configuration.username, password: resolvedPassword)

        let (_, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WebDAVError.invalidResponse(statusCode: nil, method: request.httpMethod ?? "PUT", url: requestURL.absoluteString)
        }
        guard (200...299).contains(http.statusCode) || http.statusCode == 201 || http.statusCode == 204 else {
            throw WebDAVError.invalidResponse(statusCode: http.statusCode, method: request.httpMethod ?? "PUT", url: requestURL.absoluteString)
        }
    }

    func listFiles(
        at remotePath: String = "",
        configuration: WebDAVConfiguration,
        password: String? = nil
    ) async throws -> [WebDAVRemoteEntry] {
        try validate(configuration)
        let resolvedPassword = try password ?? readPassword(for: configuration)
        guard let resolvedPassword, !resolvedPassword.isEmpty else {
            throw WebDAVError.missingPassword
        }

        let requestURL = try endpointURL(for: configuration, path: remotePath, isCollection: true)
        var request = URLRequest(url: requestURL)
        request.httpMethod = "PROPFIND"
        request.setValue("1", forHTTPHeaderField: "Depth")
        request.setValue("application/xml; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.httpBody = """
        <?xml version="1.0" encoding="utf-8" ?>
        <propfind xmlns="DAV:">
          <prop>
            <resourcetype/>
            <getcontentlength/>
            <getlastmodified/>
          </prop>
        </propfind>
        """.data(using: .utf8)
        applyBasicAuth(to: &request, username: configuration.username, password: resolvedPassword)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WebDAVError.invalidResponse(statusCode: nil, method: request.httpMethod ?? "PROPFIND", url: requestURL.absoluteString)
        }
        guard (200...299).contains(http.statusCode) || http.statusCode == 207 else {
            throw WebDAVError.invalidResponse(statusCode: http.statusCode, method: request.httpMethod ?? "PROPFIND", url: requestURL.absoluteString)
        }

        let parser = WebDAVPropfindParser(baseFolder: configuration.normalizedFolder, requestedPath: normalizeRemotePath(remotePath))
        return try parser.parse(data: data)
    }

    func downloadTextFile(
        remotePath: String,
        configuration: WebDAVConfiguration,
        password: String? = nil
    ) async throws -> String {
        try validate(configuration)
        let resolvedPassword = try password ?? readPassword(for: configuration)
        guard let resolvedPassword, !resolvedPassword.isEmpty else {
            throw WebDAVError.missingPassword
        }

        let requestURL = try endpointURL(for: configuration, path: remotePath, isCollection: false)
        var request = URLRequest(url: requestURL)
        request.httpMethod = "GET"
        applyBasicAuth(to: &request, username: configuration.username, password: resolvedPassword)

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw WebDAVError.invalidResponse(statusCode: nil, method: request.httpMethod ?? "GET", url: requestURL.absoluteString)
        }
        guard (200...299).contains(http.statusCode) else {
            throw WebDAVError.invalidResponse(statusCode: http.statusCode, method: request.httpMethod ?? "GET", url: requestURL.absoluteString)
        }

        guard let content = String(data: data, encoding: .utf8) else {
            throw WebDAVError.invalidEncoding
        }
        return content
    }

    private func endpointURL(for configuration: WebDAVConfiguration, path: String, isCollection: Bool) throws -> URL {
        guard let base = URL(string: configuration.url.trimmingCharacters(in: .whitespacesAndNewlines)) else {
            throw WebDAVError.invalidURL
        }

        let normalizedRemote = normalizeRemotePath(path)
        var url = base
        if configuration.normalizedFolder != "/" {
            url.append(path: configuration.normalizedFolder.trimmingCharacters(in: CharacterSet(charactersIn: "/")))
        }
        if !normalizedRemote.isEmpty {
            url.append(path: normalizedRemote)
        }
        if isCollection, !url.absoluteString.hasSuffix("/") {
            url.append(path: "")
        }
        return url
    }

    private func normalizeRemotePath(_ path: String) -> String {
        path
            .split(separator: "/")
            .filter { !$0.isEmpty && $0 != "." && $0 != ".." }
            .map(String.init)
            .joined(separator: "/")
    }

    private func ensureRemoteDirectory(
        for remotePath: String,
        configuration: WebDAVConfiguration,
        password: String
    ) async throws {
        let segments = remotePath.split(separator: "/").dropLast().map(String.init)
        guard !segments.isEmpty else { return }

        var current = ""
        for segment in segments {
            current = current.isEmpty ? segment : "\(current)/\(segment)"
            let requestURL = try endpointURL(for: configuration, path: current, isCollection: true)
            var request = URLRequest(url: requestURL)
            request.httpMethod = "MKCOL"
            applyBasicAuth(to: &request, username: configuration.username, password: password)

            let (_, response) = try await session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw WebDAVError.invalidResponse(statusCode: nil, method: request.httpMethod ?? "MKCOL", url: requestURL.absoluteString)
            }
            if !(200...299).contains(http.statusCode) && http.statusCode != 405 {
                throw WebDAVError.invalidResponse(statusCode: http.statusCode, method: request.httpMethod ?? "MKCOL", url: requestURL.absoluteString)
            }
        }
    }

    private func applyBasicAuth(to request: inout URLRequest, username: String, password: String) {
        let token = Data("\(username):\(password)".utf8).base64EncodedString()
        request.setValue("Basic \(token)", forHTTPHeaderField: "Authorization")
    }
}

enum WebDAVError: LocalizedError {
    case invalidURL
    case invalidFolder
    case missingPassword
    case invalidResponse(statusCode: Int?, method: String, url: String)
    case invalidEncoding
    case invalidXML

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "WebDAV URL is invalid"
        case .invalidFolder:
            return "WebDAV folder is invalid"
        case .missingPassword:
            return "WebDAV password is missing"
        case let .invalidResponse(statusCode, method, url):
            if let statusCode {
                return "WebDAV \(method) failed with HTTP \(statusCode) at \(url)"
            }
            return "WebDAV \(method) failed at \(url)"
        case .invalidEncoding:
            return "WebDAV response encoding is invalid"
        case .invalidXML:
            return "WebDAV response XML is invalid"
        }
    }
}

private final class WebDAVPropfindParser: NSObject, XMLParserDelegate {
    private let baseFolder: String
    private let requestedPath: String
    private var entries: [WebDAVRemoteEntry] = []
    private var currentElement = ""
    private var currentHref = ""
    private var currentSize = ""
    private var currentLastModified = ""
    private var currentIsCollection = false

    init(baseFolder: String, requestedPath: String) {
        self.baseFolder = baseFolder
        self.requestedPath = requestedPath
    }

    func parse(data: Data) throws -> [WebDAVRemoteEntry] {
        let parser = XMLParser(data: data)
        parser.delegate = self
        guard parser.parse() else {
            throw WebDAVError.invalidXML
        }
        return entries
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName qName: String?, attributes attributeDict: [String : String] = [:]) {
        currentElement = elementName.lowercased()
        if currentElement == "response" {
            currentHref = ""
            currentSize = ""
            currentLastModified = ""
            currentIsCollection = false
        }
        if currentElement == "collection" {
            currentIsCollection = true
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        switch currentElement {
        case "href":
            currentHref += string
        case "getcontentlength":
            currentSize += string
        case "getlastmodified":
            currentLastModified += string
        default:
            break
        }
    }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName qName: String?) {
        if elementName.lowercased() == "response" {
            if let entry = buildEntry() {
                entries.append(entry)
            }
        }
        currentElement = ""
    }

    private func buildEntry() -> WebDAVRemoteEntry? {
        let trimmedHref = currentHref.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedHref.isEmpty else { return nil }

        guard let url = URL(string: trimmedHref) ?? URL(string: trimmedHref.addingPercentEncoding(withAllowedCharacters: .urlFragmentAllowed) ?? "") else {
            return nil
        }

        var path = url.path
        if baseFolder != "/", path.hasPrefix(baseFolder) {
            path.removeFirst(baseFolder.count)
        }
        path = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))

        if path.isEmpty || path == requestedPath {
            return nil
        }

        return WebDAVRemoteEntry(
            path: path.removingPercentEncoding ?? path,
            isDirectory: currentIsCollection,
            size: Int64(currentSize.trimmingCharacters(in: .whitespacesAndNewlines)),
            lastModified: currentLastModified.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : currentLastModified.trimmingCharacters(in: .whitespacesAndNewlines)
        )
    }
}
