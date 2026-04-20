import Foundation

public enum JustMarkCLIConstants {
    public static let bundleIdentifier = "com.justmark.mac"
    public static let urlScheme = "justmark"
}

public enum JustMarkPreviewVisibility: String, Sendable {
    case show
    case hide
}

public enum JustMarkCLICommand: Sendable, Equatable {
    case open(paths: [URL], preview: JustMarkPreviewVisibility?)
    case new(preview: JustMarkPreviewVisibility?)

    public init(url: URL) throws {
        guard url.scheme?.lowercased() == JustMarkCLIConstants.urlScheme else {
            throw ParseError.unsupportedScheme
        }

        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            throw ParseError.invalidURL
        }

        let host = (components.host ?? "open").lowercased()
        let queryItems = components.queryItems ?? []
        let preview = queryItems
            .first(where: { $0.name == "preview" })?
            .value
            .flatMap(JustMarkPreviewVisibility.init(rawValue:))

        switch host {
        case "open":
            let paths = try queryItems
                .filter { $0.name == "path" }
                .compactMap(\.value)
                .map(Self.decodePath)
            self = .open(paths: paths, preview: preview)
        case "new":
            self = .new(preview: preview)
        default:
            throw ParseError.unsupportedCommand(host)
        }
    }

    public var url: URL {
        var components = URLComponents()
        components.scheme = JustMarkCLIConstants.urlScheme

        switch self {
        case let .open(paths, preview):
            components.host = "open"
            var queryItems = paths.map {
                URLQueryItem(name: "path", value: $0.standardizedFileURL.absoluteString)
            }
            if let preview {
                queryItems.append(URLQueryItem(name: "preview", value: preview.rawValue))
            }
            components.queryItems = queryItems.isEmpty ? nil : queryItems
        case let .new(preview):
            components.host = "new"
            if let preview {
                components.queryItems = [URLQueryItem(name: "preview", value: preview.rawValue)]
            }
        }

        guard let url = components.url else {
            preconditionFailure("Failed to construct JustMark CLI URL.")
        }
        return url
    }

    private static func decodePath(_ rawValue: String) throws -> URL {
        if let fileURL = URL(string: rawValue), fileURL.isFileURL {
            return fileURL.standardizedFileURL
        }
        return URL(fileURLWithPath: rawValue).standardizedFileURL
    }

    public enum ParseError: LocalizedError {
        case invalidURL
        case unsupportedScheme
        case unsupportedCommand(String)

        public var errorDescription: String? {
            switch self {
            case .invalidURL:
                return "Invalid JustMark command URL."
            case .unsupportedScheme:
                return "Unsupported URL scheme."
            case let .unsupportedCommand(command):
                return "Unsupported JustMark command: \(command)"
            }
        }
    }
}
