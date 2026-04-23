import SwiftUI
import WebKit
import OSLog

struct PreviewView: NSViewRepresentable, Equatable {
    let markdown: String
    let renderedHTML: String
    let baseURL: URL?
    let fontSize: Double
    let fontFamilyCSS: String
    let isDark: Bool
    let backgroundColor: NSColor
    let pageBackgroundHex: String
    let onOpenLink: (URL) -> Void

    static func == (lhs: PreviewView, rhs: PreviewView) -> Bool {
        lhs.markdown == rhs.markdown &&
        lhs.renderedHTML == rhs.renderedHTML &&
        lhs.baseURL == rhs.baseURL &&
        lhs.fontSize == rhs.fontSize &&
        lhs.fontFamilyCSS == rhs.fontFamilyCSS &&
        lhs.isDark == rhs.isDark &&
        lhs.backgroundColor == rhs.backgroundColor &&
        lhs.pageBackgroundHex == rhs.pageBackgroundHex
    }

    func makeNSView(context: Context) -> PreviewSurfaceView {
        let view = PreviewSurfaceView(linkMessageHandler: context.coordinator)
        context.coordinator.previewSurfaceView = view
        return view
    }

    func updateNSView(_ nsView: PreviewSurfaceView, context: Context) {
        context.coordinator.previewSurfaceView = nsView
        context.coordinator.onOpenLink = onOpenLink
        nsView.onOpenLink = onOpenLink
        nsView.setAppearance(isDark: isDark, backgroundColor: backgroundColor)
        nsView.setTheme(isDark: isDark, pageBackgroundHex: pageBackgroundHex)
        nsView.load(
            renderedHTML: renderedHTML,
            baseURL: baseURL,
            fontSize: fontSize,
            fontFamilyCSS: fontFamilyCSS,
            pageBackgroundHex: pageBackgroundHex
        )
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onOpenLink: onOpenLink)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        weak var previewSurfaceView: PreviewSurfaceView?
        var onOpenLink: (URL) -> Void

        init(onOpenLink: @escaping (URL) -> Void) {
            self.onOpenLink = onOpenLink
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == PreviewSurfaceView.linkMessageHandlerName else { return }
            guard let href = message.body as? String else { return }
            previewSurfaceView?.handleLinkActivation(href)
        }
    }
}

final class PreviewSurfaceView: NSView {
    static let linkMessageHandlerName = "previewLink"

    private let webView: WKWebView
    private var didFinishInitialLoad = false
    private var pendingBodyHTML: String?
    private var pendingBaseURL: URL?
    private var lastRenderedSignature: UInt64?
    private var lastBaseURL: URL?
    private var lastFontSize: Double?
    private var lastFontFamilyCSS: String?
    private var lastIsDark: Bool?
    private var lastThemeIsDark: Bool?
    private var pendingThemeIsDark: Bool?
    private var lastPageBackgroundHex: String?
    private var pendingPageBackgroundHex: String?
    private var shouldSkipPostNavigationBootstrap = false
    private var initialLoadInFlight = false
    private var initialLoadedSignature: UInt64?
    private var initialLoadedBaseURL: URL?
    private var initialLoadedFontSize: Double?
    private var initialLoadedFontFamilyCSS: String?
    private var initialLoadedThemeIsDark: Bool?
    private var initialLoadedPageBackgroundHex: String?
    var onOpenLink: (URL) -> Void = { _ in }

    init(linkMessageHandler: WKScriptMessageHandler, frame frameRect: NSRect = .zero) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.setURLSchemeHandler(LocalAssetSchemeHandler(), forURLScheme: LocalAssetSchemeHandler.scheme)
        configuration.userContentController.add(linkMessageHandler, name: Self.linkMessageHandlerName)
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.cornerRadius = 0
        layer?.masksToBounds = true
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        layer?.borderWidth = 0
        layer?.borderColor = NSColor.clear.cgColor

        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.wantsLayer = true
        webView.alphaValue = 1
        webView.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        webView.underPageBackgroundColor = .windowBackgroundColor

        addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: trailingAnchor),
            webView.topAnchor.constraint(equalTo: topAnchor),
            webView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.configuration.userContentController.removeScriptMessageHandler(forName: Self.linkMessageHandlerName)
    }

    override var preservesContentDuringLiveResize: Bool {
        true
    }

    override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        window?.preservesContentDuringLiveResize = true
    }

    func load(renderedHTML: String, baseURL: URL?, fontSize: Double, fontFamilyCSS: String, pageBackgroundHex: String) {
        let renderSignature = htmlSignature(for: renderedHTML)
        guard renderSignature != lastRenderedSignature || baseURL != lastBaseURL || fontSize != lastFontSize || fontFamilyCSS != lastFontFamilyCSS || pageBackgroundHex != lastPageBackgroundHex else { return }
        let baseURLChanged = baseURL != lastBaseURL
        lastRenderedSignature = renderSignature
        lastBaseURL = baseURL
        lastFontSize = fontSize
        lastFontFamilyCSS = fontFamilyCSS
        lastPageBackgroundHex = pageBackgroundHex
        pendingBodyHTML = renderedHTML
        pendingPageBackgroundHex = pageBackgroundHex

        if !didFinishInitialLoad {
            pendingBaseURL = baseURL
            guard !initialLoadInFlight else {
                return
            }

            didFinishInitialLoad = false
            initialLoadInFlight = true
            let initialThemeIsDark = pendingThemeIsDark ?? lastIsDark ?? false
            initialLoadedSignature = renderSignature
            initialLoadedBaseURL = baseURL
            initialLoadedFontSize = fontSize
            initialLoadedFontFamilyCSS = fontFamilyCSS
            initialLoadedThemeIsDark = initialThemeIsDark
            initialLoadedPageBackgroundHex = pageBackgroundHex
            shouldSkipPostNavigationBootstrap = true
            webView.loadHTMLString(
                documentHTML(
                    bodyHTML: renderedHTML,
                    baseURL: baseURL,
                    fontSize: fontSize,
                    fontFamilyCSS: fontFamilyCSS,
                    isDark: initialThemeIsDark,
                    pageBackgroundHex: pageBackgroundHex
                ),
                baseURL: baseURL
            )
            return
        }

        if baseURLChanged {
            updateBaseURL(baseURL)
        }
        updateBodyHTML(
            renderedHTML,
            baseURL: baseURL,
            fontSize: fontSize,
            fontFamilyCSS: fontFamilyCSS,
            pageBackgroundHex: pageBackgroundHex
        )
    }

    func setAppearance(isDark: Bool, backgroundColor: NSColor) {
        guard lastIsDark != isDark || layer?.backgroundColor != backgroundColor.cgColor else { return }
        lastIsDark = isDark
        let appearanceName: NSAppearance.Name = isDark ? .darkAqua : .aqua
        let appearance = NSAppearance(named: appearanceName)
        self.appearance = appearance
        webView.appearance = appearance
        layer?.backgroundColor = backgroundColor.cgColor
        webView.layer?.backgroundColor = backgroundColor.cgColor
        webView.underPageBackgroundColor = backgroundColor
    }

    func setTheme(isDark: Bool, pageBackgroundHex: String) {
        pendingThemeIsDark = isDark
        pendingPageBackgroundHex = pageBackgroundHex
        guard didFinishInitialLoad else { return }
        applyTheme(isDark: isDark, pageBackgroundHex: pageBackgroundHex)
    }

    private func applyTheme(isDark: Bool, pageBackgroundHex: String) {
        guard lastThemeIsDark != isDark || lastPageBackgroundHex != pageBackgroundHex else { return }
        lastThemeIsDark = isDark
        let arguments: [String: Any] = ["isDark": isDark, "pageBackgroundHex": pageBackgroundHex]
        webView.callAsyncJavaScript(
            "window.__justmarkSetTheme(isDark, pageBackgroundHex);",
            arguments: arguments,
            in: nil,
            in: .page
        ) { _ in }
    }

    private func documentHTML(bodyHTML: String, baseURL: URL?, fontSize: Double, fontFamilyCSS: String, isDark: Bool, pageBackgroundHex: String) -> String {
        let resolvedBodyHTML = rewriteLocalImageSources(in: bodyHTML, baseURL: baseURL)
        let style = """
        <style>
        :root {
          color-scheme: light dark;
          --jm-text: #22262b;
          --jm-muted: #69717d;
          --jm-border: rgba(27, 31, 36, 0.08);
          --jm-code: rgba(175, 184, 193, 0.14);
          --jm-accent: #0a84ff;
          --jm-surface: rgba(255,255,255,0.88);
          --jm-page: \(pageBackgroundHex);
        }
        html, body {
          margin: 0;
          min-height: 100%;
          box-sizing: border-box;
          font: -apple-system-body;
        }
        body {
          padding: 17px 28px 40px;
          color: var(--jm-text);
          background: var(--jm-page);
          font-family: \(fontFamilyCSS);
          line-height: 1.76;
          font-size: \(Int(fontSize))px;
          -webkit-font-smoothing: antialiased;
          text-rendering: optimizeLegibility;
        }
        #jm-preview-root {
          display: block;
          max-width: 920px;
          margin-left: auto;
          margin-right: auto;
          overflow-wrap: anywhere;
        }
        h1, h2, h3, h4, h5, h6 {
          line-height: 1.25;
          margin: 1.3em 0 0.55em;
          letter-spacing: -0.01em;
        }
        p, ul, ol, blockquote, pre, table, hr {
          margin: 0 0 1em;
        }
        a {
          color: var(--jm-accent);
          text-decoration: none;
        }
        a:hover { text-decoration: underline; }
        code, pre {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        code {
          background: var(--jm-code);
          border-radius: 4px;
          padding: 0.14em 0.38em;
        }
        pre {
          padding: 14px 16px;
          border-radius: 10px;
          overflow: auto;
          background: rgba(27, 31, 36, 0.04);
          border: 1px solid var(--jm-border);
        }
        pre code {
          background: transparent;
          padding: 0;
        }
        blockquote {
          padding: 0.1em 0 0.1em 1em;
          border-left: 3px solid var(--jm-border);
          color: var(--jm-muted);
        }
        table {
          border-collapse: collapse;
          width: max(100%, max-content);
          min-width: 520px;
          display: block;
          overflow-x: auto;
          border-radius: 8px;
          border: 1px solid var(--jm-border);
          table-layout: auto;
        }
        table, thead, tbody, tr, th, td {
          font-family: inherit;
          font-size: 1em;
          line-height: inherit;
        }
        th, td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--jm-border);
          text-align: left;
          vertical-align: top;
          min-width: 90px;
          white-space: normal;
          word-break: break-word;
          overflow-wrap: anywhere;
        }
        th {
          background: rgba(27, 31, 36, 0.04);
        }
        hr {
          border: 0;
          border-top: 1px solid var(--jm-border);
          margin: 1.4em 0;
        }
        img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
        }
        \(PreviewMathSupport.previewCSS)
        :root[data-theme="dark"] {
          --jm-text: #e8eaed;
          --jm-muted: #a5adba;
          --jm-border: rgba(255, 255, 255, 0.10);
          --jm-code: rgba(255, 255, 255, 0.06);
          --jm-accent: #7cb7ff;
          --jm-page: \(pageBackgroundHex);
        }
        :root[data-theme="dark"] body {
          color: var(--jm-text);
          background: var(--jm-page);
        }
        :root[data-theme="dark"] pre {
          background: rgba(255, 255, 255, 0.04);
        }
        :root[data-theme="dark"] th {
          background: rgba(255, 255, 255, 0.04);
        }
        </style>
        \(PreviewMathSupport.assetTags())
        \(PreviewMathSupport.sharedScript)
        <script>
        window.__justmarkUpdate = function(html, fontSize, fontFamily, pageBackgroundHex) {
          const root = document.getElementById('jm-preview-root');
          if (root) {
            root.innerHTML = html;
          } else {
            document.body.innerHTML = '<main id="jm-preview-root"></main>';
            document.getElementById('jm-preview-root').innerHTML = html;
          }
          document.body.style.fontSize = fontSize + 'px';
          document.body.style.fontFamily = fontFamily;
          document.documentElement.style.setProperty('--jm-page', pageBackgroundHex);
          return window.__justmarkPrimeMath(document.getElementById('jm-preview-root'));
        };
        window.__justmarkSetTheme = function(isDark, pageBackgroundHex) {
          document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
          document.documentElement.style.setProperty('--jm-page', pageBackgroundHex);
        };
        window.__justmarkSetBase = function(href) {
          const baseTag = document.getElementById('jm-base');
          if (!baseTag) return;
          if (!href) {
            baseTag.removeAttribute('href');
            return;
          }
          baseTag.setAttribute('href', href);
        };
        window.__justmarkScrollToFragment = function(fragment) {
          const decoded = decodeURIComponent(fragment || '');
          const target = document.getElementById(decoded) || document.getElementsByName(decoded)[0];
          if (!target) {
            return false;
          }
          target.scrollIntoView({ block: 'start', behavior: 'smooth' });
          if (decoded) {
            history.replaceState(null, '', '#' + encodeURIComponent(decoded));
          }
          return true;
        };
        document.addEventListener('click', function(event) {
          const link = event.target.closest('a[href]');
          if (!link) return;
          const href = link.getAttribute('href');
          if (!href) return;
          event.preventDefault();
          if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.previewLink) {
            window.webkit.messageHandlers.previewLink.postMessage(href);
          }
        }, true);
        </script>
        """

        let escapedBaseURL = escapedHTMLAttribute(baseURL?.absoluteString ?? "")
        let initialTheme = isDark ? "dark" : "light"

        return """
        <html data-theme="\(initialTheme)">
        <head>
          <meta charset="utf-8">
          <base id="jm-base" href="\(escapedBaseURL)">
          \(style)
        </head>
        <body>
          <main id="jm-preview-root">\(resolvedBodyHTML)</main>
          <script>
          window.__justmarkPrimeMath(document.getElementById('jm-preview-root'));
          </script>
        </body>
        </html>
        """
    }

    private func updateBodyHTML(_ bodyHTML: String, baseURL: URL?, fontSize: Double, fontFamilyCSS: String, pageBackgroundHex: String) {
        let resolvedBodyHTML = rewriteLocalImageSources(in: bodyHTML, baseURL: baseURL)
        let arguments: [String: Any] = [
            "html": resolvedBodyHTML,
            "fontSize": Int(fontSize),
            "fontFamily": fontFamilyCSS,
            "pageBackgroundHex": pageBackgroundHex
        ]

        webView.callAsyncJavaScript(
            "window.__justmarkUpdate(html, fontSize, fontFamily, pageBackgroundHex);",
            arguments: arguments,
            in: nil,
            in: .page
        ) { _ in }
    }

    private func updateBaseURL(_ url: URL?) {
        let arguments: [String: Any] = [
            "href": url?.absoluteString ?? ""
        ]

        webView.callAsyncJavaScript(
            "window.__justmarkSetBase(href);",
            arguments: arguments,
            in: nil,
            in: .page
        ) { _ in }
    }

    private func rewriteLocalImageSources(in html: String, baseURL: URL?) -> String {
        guard let baseURL, baseURL.isFileURL else { return html }
        guard let regex = try? NSRegularExpression(pattern: #"<img\b([^>]*?)\bsrc="([^"]+)"([^>]*)>"#) else {
            return html
        }

        let nsRange = NSRange(html.startIndex..., in: html)
        var result = html
        let matches = regex.matches(in: html, options: [], range: nsRange).reversed()

        for match in matches {
            guard
                let srcRange = Range(match.range(at: 2), in: result)
            else {
                continue
            }

            let source = String(result[srcRange])
            guard let localAssetURL = resolvedLocalAssetURL(from: source, baseURL: baseURL) else {
                continue
            }

            result.replaceSubrange(srcRange, with: localAssetURL.absoluteString)
        }

        return result
    }

    private func resolvedLocalAssetURL(from source: String, baseURL: URL) -> URL? {
        if source.hasPrefix(LocalAssetSchemeHandler.scheme + ":") {
            return URL(string: source)
        }

        if let remoteURL = URL(string: source), let scheme = remoteURL.scheme?.lowercased() {
            if ["http", "https", "data"].contains(scheme) {
                return nil
            }

            if scheme == "file" {
                return LocalAssetSchemeHandler.url(for: remoteURL)
            }
        }

        guard let resolvedURL = URL(string: source, relativeTo: baseURL)?.standardizedFileURL else {
            return nil
        }

        return LocalAssetSchemeHandler.url(for: resolvedURL)
    }

    private func htmlSignature(for value: String) -> UInt64 {
        var hash: UInt64 = 0xcbf29ce484222325
        for byte in value.utf8 {
            hash ^= UInt64(byte)
            hash &*= 0x100000001b3
        }
        return hash ^ UInt64(value.utf8.count)
    }

    private func escapedHTMLAttribute(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    func handleLinkActivation(_ href: String) {
        let trimmedHref = href.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedHref.isEmpty else { return }

        if trimmedHref.hasPrefix("#") {
            scrollToFragment(String(trimmedHref.dropFirst()))
            return
        }

        guard let baseURL = pendingBaseURL ?? lastBaseURL else {
            if let absoluteURL = URL(string: trimmedHref) {
                openResolvedLink(absoluteURL)
            }
            return
        }

        guard let resolvedURL = URL(string: trimmedHref, relativeTo: baseURL)?.absoluteURL else {
            return
        }
        openResolvedLink(resolvedURL)
    }

    private func openResolvedLink(_ url: URL) {
        if url.isFileURL || ["http", "https"].contains(url.scheme?.lowercased()) == true {
            onOpenLink(url)
        }
    }

    private func scrollToFragment(_ fragment: String) {
        let arguments: [String: Any] = ["fragment": fragment]
        webView.callAsyncJavaScript(
            "window.__justmarkScrollToFragment(fragment);",
            arguments: arguments,
            in: nil,
            in: .page
        ) { _ in }
    }

}

extension PreviewSurfaceView: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        didFinishInitialLoad = true
        initialLoadInFlight = false
        if shouldSkipPostNavigationBootstrap {
            shouldSkipPostNavigationBootstrap = false
            if let pendingThemeIsDark {
                lastThemeIsDark = pendingThemeIsDark
            }

            if pendingBaseURL != initialLoadedBaseURL {
                updateBaseURL(pendingBaseURL)
            }
            if let pendingBodyHTML,
               let lastFontSize,
               let lastFontFamilyCSS,
               let pendingPageBackgroundHex,
               htmlSignature(for: pendingBodyHTML) != initialLoadedSignature ||
                lastFontSize != initialLoadedFontSize ||
                lastFontFamilyCSS != initialLoadedFontFamilyCSS ||
                pendingPageBackgroundHex != initialLoadedPageBackgroundHex {
                updateBodyHTML(
                    pendingBodyHTML,
                    baseURL: pendingBaseURL,
                    fontSize: lastFontSize,
                    fontFamilyCSS: lastFontFamilyCSS,
                    pageBackgroundHex: pendingPageBackgroundHex
                )
            }
            if let pendingThemeIsDark,
               let pendingPageBackgroundHex,
               pendingThemeIsDark != initialLoadedThemeIsDark {
                applyTheme(isDark: pendingThemeIsDark, pageBackgroundHex: pendingPageBackgroundHex)
            }

            return
        }

        guard
            let pendingBodyHTML,
            let lastFontSize,
            let lastFontFamilyCSS,
            let pendingPageBackgroundHex
        else {
            return
        }

        updateBaseURL(pendingBaseURL ?? lastBaseURL)
        updateBodyHTML(
            pendingBodyHTML,
            baseURL: pendingBaseURL ?? lastBaseURL,
            fontSize: lastFontSize,
            fontFamilyCSS: lastFontFamilyCSS,
            pageBackgroundHex: pendingPageBackgroundHex
        )
        if let pendingThemeIsDark {
            applyTheme(isDark: pendingThemeIsDark, pageBackgroundHex: pendingPageBackgroundHex)
        }
    }
}
