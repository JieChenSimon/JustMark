import AppKit
import WebKit

@MainActor
public final class ExportService {
    public init() {}

    public func exportPDF(html: String, baseURL: URL?, destinationURL: URL) async throws {
        let data = try await renderPDFData(html: html, baseURL: baseURL)
        try data.write(to: destinationURL, options: .atomic)
    }

    public func renderPDFData(html: String, baseURL: URL?) async throws -> Data {
        let webView = WKWebView(frame: NSRect(x: 0, y: 0, width: 794, height: 1123))
        try await loadHTML(html, in: webView, baseURL: baseURL)
        try await waitForPreviewScripts(in: webView)
        let contentSize = try await measureContentSize(in: webView)
        if contentSize.height > 0 {
            webView.setFrameSize(contentSize)
        }
        let pdfConfiguration = WKPDFConfiguration()
        pdfConfiguration.rect = webView.bounds

        return try await webView.pdf(configuration: pdfConfiguration)
    }

    private func loadHTML(_ html: String, in webView: WKWebView, baseURL: URL?) async throws {
        try await withCheckedThrowingContinuation { continuation in
            let delegate = NavigationDelegate {
                continuation.resume()
            } onFailure: { error in
                continuation.resume(throwing: error)
            }

            webView.navigationDelegate = delegate
            objc_setAssociatedObject(webView, &NavigationDelegate.associationKey, delegate, .OBJC_ASSOCIATION_RETAIN_NONATOMIC)
            webView.loadHTMLString(html, baseURL: baseURL)
        }
    }

    private func measureContentSize(in webView: WKWebView) async throws -> CGSize {
        try await Task.sleep(for: .milliseconds(30))
        let script = """
        ({
          width: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
          height: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
        })
        """
        let result = try await webView.evaluateJavaScript(script)
        if let dict = result as? [String: Any],
           let width = dict["width"] as? Double,
           let height = dict["height"] as? Double {
            return CGSize(width: max(1, width), height: max(1, height))
        }
        if let scrollView = webView.enclosingScrollView {
            return scrollView.contentSize
        }
        return webView.bounds.size
    }

    private func waitForPreviewScripts(in webView: WKWebView) async throws {
        _ = try await webView.callAsyncJavaScript(
            "window.__justmarkWaitForMath ? window.__justmarkWaitForMath() : Promise.resolve(true);",
            arguments: [:],
            in: nil,
            in: .page
        )
    }
}

private final class NavigationDelegate: NSObject, WKNavigationDelegate {
    static var associationKey: UInt8 = 0

    private let onFinish: () -> Void
    private let onFailure: (Error) -> Void

    init(onFinish: @escaping () -> Void, onFailure: @escaping (Error) -> Void) {
        self.onFinish = onFinish
        self.onFailure = onFailure
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        onFinish()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        onFailure(error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        onFailure(error)
    }
}
