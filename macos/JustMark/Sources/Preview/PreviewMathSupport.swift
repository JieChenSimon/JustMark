import Foundation

enum PreviewMathSupport {
    static func assetTags() -> String {
        [embeddedStylesheetTag(), embeddedScriptTag()]
            .compactMap { $0 }
            .joined(separator: "\n")
    }

    static let sharedScript = """
    <script>
    window.__justmarkRenderMath = function(root) {
      if (!root || !window.katex || !window.katex.render) {
        return Promise.resolve(false);
      }
      root.querySelectorAll('.jm-math-placeholder[data-expr]').forEach(function(node) {
        try {
          window.katex.render(node.dataset.expr || '', node, {
            displayMode: node.classList.contains('jm-math-display'),
            throwOnError: false,
            strict: 'warn'
          });
          node.dataset.rendered = 'true';
        } catch (error) {
          console.error('KaTeX render failed', error);
        }
      });
      return (document.fonts && document.fonts.ready)
        ? document.fonts.ready.then(function() { return true; })
        : Promise.resolve(true);
    };

    window.__justmarkMathReady = Promise.resolve(false);
    window.__justmarkPrimeMath = function(root) {
      window.__justmarkMathReady = window.__justmarkRenderMath(root);
      return window.__justmarkMathReady;
    };

    window.__justmarkWaitForMath = function() {
      return window.__justmarkMathReady || Promise.resolve(true);
    };
    </script>
    """

    static let previewCSS = """
    .katex-display {
      overflow-x: auto;
      overflow-y: hidden;
      padding: 0.25em 0;
    }
    .katex-display > .katex {
      white-space: nowrap;
    }
    """

    private static func embeddedStylesheetTag() -> String? {
        guard let css = loadAssetText(named: "katex.min.css") else { return nil }
        return "<style>\(rewriteFontURLs(in: css))</style>"
    }

    private static func embeddedScriptTag() -> String? {
        guard let script = loadAssetText(named: "katex.min.js") else { return nil }
        return "<script>\(script)</script>"
    }

    private static func localAssetURL(named name: String) -> URL? {
        guard let resourceURL = locateMathAsset(named: name) else {
            return nil
        }

        var components = URLComponents(url: resourceURL, resolvingAgainstBaseURL: false)
        components?.scheme = "justmark-file"
        return components?.url
    }

    private static func escapedHTMLAttribute(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private static var previewBundle: Bundle {
        let candidateBundles = [Bundle.main] + Bundle.allFrameworks + Bundle.allBundles
        for bundle in candidateBundles {
            if locateMathAsset(named: "katex.min.css", in: bundle) != nil {
                return bundle
            }
        }
        return .main
    }

    private static func locateMathAsset(named name: String, in bundle: Bundle? = nil) -> URL? {
        let bundle = bundle ?? previewBundle
        guard let resourceRoot = bundle.resourceURL else { return nil }

        let candidates = [
            resourceRoot.appendingPathComponent(name),
            resourceRoot
                .appendingPathComponent("Vendor", isDirectory: true)
                .appendingPathComponent("KaTeX", isDirectory: true)
                .appendingPathComponent(name)
        ]

        for candidate in candidates where FileManager.default.fileExists(atPath: candidate.path) {
            return candidate.standardizedFileURL
        }

        return nil
    }

    private static func loadAssetText(named name: String) -> String? {
        guard let url = locateMathAsset(named: name) else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }

    private static func rewriteFontURLs(in css: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"url\((['"]?)(fonts/)?([^'")]+)\1\)"#) else {
            return css
        }

        let matches = regex.matches(in: css, range: NSRange(css.startIndex..., in: css)).reversed()
        var result = css

        for match in matches {
            guard
                let wholeRange = Range(match.range(at: 0), in: result),
                let fileRange = Range(match.range(at: 3), in: result),
                let fontURL = localAssetURL(named: String(result[fileRange]))
            else {
                continue
            }

            result.replaceSubrange(
                wholeRange,
                with: "url(\"\(escapedHTMLAttribute(fontURL.absoluteString))\")"
            )
        }

        return result
    }
}
