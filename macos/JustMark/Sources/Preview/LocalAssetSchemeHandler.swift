import Foundation
import UniformTypeIdentifiers
import WebKit
import OSLog

final class LocalAssetSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "justmark-file"
    private let logger = Logger(subsystem: "com.justmark.mac", category: "PreviewAssets")

    static func url(for fileURL: URL) -> URL? {
        guard fileURL.isFileURL else { return nil }
        var components = URLComponents(url: fileURL.standardizedFileURL, resolvingAgainstBaseURL: false)
        components?.scheme = scheme
        return components?.url
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: any WKURLSchemeTask) {
        guard
            let requestURL = urlSchemeTask.request.url,
            var components = URLComponents(url: requestURL, resolvingAgainstBaseURL: false)
        else {
            logger.error("Bad local asset request URL")
            urlSchemeTask.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorBadURL))
            return
        }

        components.scheme = "file"
        guard let fileURL = components.url else {
            logger.error("Failed to reconstruct file URL from \(requestURL.absoluteString, privacy: .public)")
            urlSchemeTask.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorBadURL))
            return
        }

        do {
            let data = try Data(contentsOf: fileURL)
            let mimeType = mimeType(for: fileURL)
            logger.debug("Loaded local preview asset \(fileURL.path(percentEncoded: false), privacy: .public)")
            let response = HTTPURLResponse(
                url: requestURL,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mimeType,
                    "Cache-Control": "no-cache"
                ]
            ) ?? URLResponse(
                url: requestURL,
                mimeType: mimeType,
                expectedContentLength: data.count,
                textEncodingName: nil
            )
            urlSchemeTask.didReceive(response)
            urlSchemeTask.didReceive(data)
            urlSchemeTask.didFinish()
        } catch {
            logger.error("Failed loading local preview asset \(fileURL.path(percentEncoded: false), privacy: .public): \(error.localizedDescription, privacy: .public)")
            urlSchemeTask.didFailWithError(error)
        }
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: any WKURLSchemeTask) {}

    private func mimeType(for url: URL) -> String {
        if let type = UTType(filenameExtension: url.pathExtension), let mimeType = type.preferredMIMEType {
            return mimeType
        }
        return "application/octet-stream"
    }
}
