import Down
import Foundation
import JavaScriptCore

public final class PreviewEngine: @unchecked Sendable {
    public init() {}

    public func renderBody(markdown: String) async throws -> String {
        try Task.checkCancellation()
        return try renderDocument(markdown)
    }

    public func renderHTML(markdown: String) async throws -> String {
        let body = try await renderBody(markdown: markdown)
        return makeHTML(body: body)
    }

    public func renderPDFHTML(markdown: String, fontFamilyCSS: String, fontSize: Double) async throws -> String {
        let body = try await renderBody(markdown: markdown)
        return makePDFHTML(body: body, fontFamilyCSS: fontFamilyCSS, fontSize: fontSize)
    }

    private func makeHTML(body: String) -> String {
        """
        <html>
        <head>
        <meta charset="utf-8" />
        <style>
        :root { color-scheme: light dark; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            padding: 32px;
            line-height: 1.7;
            max-width: 860px;
            margin: 0 auto;
            color: #1f2937;
            background: transparent;
        }
        h1,h2,h3,h4,h5,h6 { line-height: 1.25; margin: 1.1em 0 0.45em; }
        h1 { font-size: 2em; }
        h2 { font-size: 1.6em; }
        h3 { font-size: 1.3em; }
        p, ul, ol, blockquote, pre { margin: 0 0 1em; }
        code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            background: rgba(127, 127, 127, 0.12);
            border-radius: 6px;
            padding: 0.12em 0.35em;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background: rgba(127, 127, 127, 0.1);
            border-radius: 12px;
            padding: 14px 16px;
            overflow-x: auto;
        }
        pre code { background: transparent; padding: 0; }
        blockquote {
            border-left: 3px solid rgba(59, 130, 246, 0.45);
            padding-left: 14px;
            color: #4b5563;
        }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; border-radius: 10px; }
        hr { border: none; border-top: 1px solid rgba(127, 127, 127, 0.2); margin: 1.5em 0; }
        ul.task-list { list-style: none; padding-left: 0; }
        ul.task-list li input { margin-right: 0.55em; }
        table {
            width: max(100%, max-content);
            min-width: 520px;
            display: block;
            overflow-x: auto;
            border-collapse: collapse;
            margin: 0 0 1em;
            table-layout: auto;
        }
        table, thead, tbody, tr, th, td {
            font-family: inherit;
            font-size: 1em;
            line-height: inherit;
        }
        th, td {
            border: 1px solid rgba(127, 127, 127, 0.24);
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
            min-width: 90px;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
        }
        th { background: rgba(127, 127, 127, 0.08); font-weight: 600; }
        .jm-meta-block {
            display: grid;
            grid-template-columns: minmax(120px, 180px) 1fr;
            gap: 10px 16px;
            margin: 0 0 1.25em;
            padding: 14px 16px;
            background: rgba(127, 127, 127, 0.08);
            border-radius: 12px;
        }
        .jm-meta-row { display: contents; }
        .jm-meta-block dt { font-weight: 600; color: #4b5563; }
        .jm-meta-block dd { margin: 0; }
        .jm-math-display {
            display: block;
            margin: 0 0 1em;
            overflow-x: auto;
        }
        .jm-math-inline {
            display: inline-block;
            vertical-align: middle;
        }
        .katex-display {
            overflow-x: auto;
            overflow-y: hidden;
            padding: 0.25em 0;
        }
        .katex-display > .katex { white-space: nowrap; }
        </style>
        \(mathAssetTags())
        \(mathBootstrapScript())
        </head>
        <body><main id="jm-preview-root">\(body)</main><script>window.__justmarkPrimeMath(document.getElementById('jm-preview-root'));</script></body>
        </html>
        """
    }

    private func makePDFHTML(body: String, fontFamilyCSS: String, fontSize: Double) -> String {
        """
        <html>
        <head>
        <meta charset="utf-8" />
        <style>
        :root { color-scheme: light; }
        body {
            font-family: \(fontFamilyCSS);
            padding: 32px;
            line-height: 1.7;
            max-width: 860px;
            margin: 0 auto;
            color: #1b1b1b;
            background: #ffffff;
            font-size: \(Int(fontSize))px;
        }
        h1,h2,h3,h4,h5,h6 { line-height: 1.25; margin: 1.1em 0 0.45em; }
        h1 { font-size: 2em; }
        h2 { font-size: 1.6em; }
        h3 { font-size: 1.3em; }
        p, ul, ol, blockquote, pre { margin: 0 0 1em; }
        code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            background: rgba(127, 127, 127, 0.12);
            border-radius: 6px;
            padding: 0.12em 0.35em;
        }
        pre {
            white-space: pre-wrap;
            word-wrap: break-word;
            background: rgba(127, 127, 127, 0.1);
            border-radius: 12px;
            padding: 14px 16px;
            overflow-x: auto;
        }
        pre code { background: transparent; padding: 0; }
        blockquote {
            border-left: 3px solid rgba(59, 130, 246, 0.45);
            padding-left: 14px;
            color: #4b5563;
        }
        a { color: #2563eb; text-decoration: none; }
        a:hover { text-decoration: underline; }
        img { max-width: 100%; border-radius: 10px; }
        hr { border: none; border-top: 1px solid rgba(127, 127, 127, 0.2); margin: 1.5em 0; }
        ul.task-list { list-style: none; padding-left: 0; }
        ul.task-list li input { margin-right: 0.55em; }
        table {
            width: max(100%, max-content);
            min-width: 520px;
            display: block;
            overflow-x: auto;
            border-collapse: collapse;
            margin: 0 0 1em;
            table-layout: auto;
        }
        table, thead, tbody, tr, th, td {
            font-family: inherit;
            font-size: 1em;
            line-height: inherit;
        }
        th, td {
            border: 1px solid rgba(127, 127, 127, 0.24);
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
            min-width: 90px;
            white-space: normal;
            word-break: break-word;
            overflow-wrap: anywhere;
        }
        th { background: rgba(127, 127, 127, 0.08); font-weight: 600; }
        .jm-meta-block {
            display: grid;
            grid-template-columns: minmax(120px, 180px) 1fr;
            gap: 10px 16px;
            margin: 0 0 1.25em;
            padding: 14px 16px;
            background: rgba(127, 127, 127, 0.08);
            border-radius: 12px;
        }
        .jm-meta-row { display: contents; }
        .jm-meta-block dt { font-weight: 600; color: #4b5563; }
        .jm-meta-block dd { margin: 0; }
        .jm-math-display {
            display: block;
            margin: 0 0 1em;
            overflow-x: auto;
        }
        .jm-math-inline {
            display: inline-block;
            vertical-align: middle;
        }
        .katex-display {
            overflow-x: auto;
            overflow-y: hidden;
            padding: 0.25em 0;
        }
        .katex-display > .katex { white-space: nowrap; }
        </style>
        \(mathAssetTags())
        \(mathBootstrapScript())
        </head>
        <body><main id="jm-preview-root">\(body)</main><script>window.__justmarkPrimeMath(document.getElementById('jm-preview-root'));</script></body>
        </html>
        """
    }

    private func renderDocument(_ markdown: String) throws -> String {
        let document = parseDocument(markdown)
        try Task.checkCancellation()

        let mathProcessed = preprocessMath(in: document.bodyMarkdown)
        let rawBodyHTML = try Down(markdownString: mathProcessed.markdown).toHTML(.unsafe)
        let bodyHTML = renderMathPlaceholders(
            in: postprocessRenderedHTML(rawBodyHTML),
            placeholders: mathProcessed.placeholders
        )
        if document.metadata.isEmpty {
            return bodyHTML
        }

        return renderMetadataBlock(document.metadata) + bodyHTML
    }

    private func parseDocument(_ markdown: String) -> ParsedDocument {
        let normalized = markdown.replacingOccurrences(of: "\r\n", with: "\n")
        let lines = normalized.split(separator: "\n", omittingEmptySubsequences: false)

        guard lines.count >= 3, lines[0].trimmingCharacters(in: .whitespaces) == "---" else {
            return ParsedDocument(metadata: [], bodyMarkdown: normalized)
        }

        var metadata: [(String, String)] = []
        var index = 1

        while index < lines.count {
            let trimmed = lines[index].trimmingCharacters(in: .whitespaces)
            if trimmed == "---" {
                let bodyMarkdown = lines[(index + 1)...].joined(separator: "\n")
                return ParsedDocument(metadata: metadata, bodyMarkdown: bodyMarkdown)
            }

            guard let divider = trimmed.firstIndex(of: ":") else {
                return ParsedDocument(metadata: [], bodyMarkdown: normalized)
            }

            let key = trimmed[..<divider].trimmingCharacters(in: .whitespaces)
            let value = trimmed[trimmed.index(after: divider)...].trimmingCharacters(in: .whitespaces)
            if !key.isEmpty {
                metadata.append((key, value))
            }
            index += 1
        }

        return ParsedDocument(metadata: [], bodyMarkdown: normalized)
    }

    private func renderMetadataBlock(_ metadata: [(String, String)]) -> String {
        let rows = metadata.map { key, value in
            "<div class=\"jm-meta-row\"><dt>\(escapeHTML(key))</dt><dd>\(escapeHTML(value))</dd></div>"
        }
        return "<dl class=\"jm-meta-block\">\(rows.joined())</dl>"
    }

    private func postprocessRenderedHTML(_ html: String) -> String {
        injectHeadingIDs(in: convertPipeTableParagraphs(in: html))
    }

    private func convertPipeTableParagraphs(in html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"<p>(.*?)</p>"#, options: [.dotMatchesLineSeparators]) else {
            return html
        }

        let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html)).reversed()
        var result = html

        for match in matches {
            guard
                let paragraphRange = Range(match.range(at: 0), in: result),
                let contentRange = Range(match.range(at: 1), in: result),
                let tableHTML = renderPipeTable(from: String(result[contentRange]))
            else {
                continue
            }

            result.replaceSubrange(paragraphRange, with: tableHTML)
        }

        return result
    }

    private func renderPipeTable(from paragraphHTML: String) -> String? {
        let lines = paragraphHTML
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        guard lines.count >= 2 else { return nil }
        guard isPipeTableDividerLine(lines[1]) else { return nil }

        let headerCells = pipeTableCells(from: lines[0])
        guard !headerCells.isEmpty else { return nil }

        let alignments = pipeTableAlignments(from: lines[1], expectedCount: headerCells.count)
        let rowLines = Array(lines.dropFirst(2))
        guard !rowLines.isEmpty else { return nil }

        let rowCells = rowLines.map(pipeTableCells(from:))
        guard rowCells.allSatisfy({ !$0.isEmpty }) else { return nil }

        let headerHTML = zip(headerCells.indices, headerCells).map { index, cell in
            let alignment = index < alignments.count ? alignments[index] : nil
            return "<th\(tableAlignmentStyle(for: alignment))>\(cell)</th>"
        }.joined()

        let bodyHTML = rowCells.map { row in
            let cells = zip(row.indices, row).map { index, cell in
                let alignment = index < alignments.count ? alignments[index] : nil
                return "<td\(tableAlignmentStyle(for: alignment))>\(cell)</td>"
            }.joined()
            return "<tr>\(cells)</tr>"
        }.joined()

        return "<table><thead><tr>\(headerHTML)</tr></thead><tbody>\(bodyHTML)</tbody></table>"
    }

    private func isPipeTableDividerLine(_ line: String) -> Bool {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.contains("|") else { return false }
        let stripped = trimmed
            .replacingOccurrences(of: "|", with: "")
            .replacingOccurrences(of: ":", with: "")
            .replacingOccurrences(of: "-", with: "")
            .trimmingCharacters(in: .whitespaces)
        return stripped.isEmpty
    }

    private func pipeTableCells(from line: String) -> [String] {
        var cells: [String] = []
        var current = ""
        var insideTag = false

        for character in line {
            switch character {
            case "<":
                insideTag = true
                current.append(character)
            case ">":
                insideTag = false
                current.append(character)
            case "|" where !insideTag:
                cells.append(current.trimmingCharacters(in: .whitespaces))
                current = ""
            default:
                current.append(character)
            }
        }
        cells.append(current.trimmingCharacters(in: .whitespaces))

        if cells.first?.isEmpty == true {
            cells.removeFirst()
        }
        if cells.last?.isEmpty == true {
            cells.removeLast()
        }

        return cells
    }

    private func pipeTableAlignments(from dividerLine: String, expectedCount: Int) -> [String?] {
        pipeTableCells(from: dividerLine).prefix(expectedCount).map { cell in
            let trimmed = cell.trimmingCharacters(in: .whitespaces)
            let startsWithColon = trimmed.hasPrefix(":")
            let endsWithColon = trimmed.hasSuffix(":")

            switch (startsWithColon, endsWithColon) {
            case (true, true): return "center"
            case (true, false): return "left"
            case (false, true): return "right"
            default: return nil
            }
        }
    }

    private func tableAlignmentStyle(for alignment: String?) -> String {
        guard let alignment else { return "" }
        return " style=\"text-align: \(alignment);\""
    }

    private func injectHeadingIDs(in html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"<h([1-6])>(.*?)</h\1>"#, options: [.dotMatchesLineSeparators]) else {
            return html
        }

        let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))
        var result = ""
        var currentIndex = html.startIndex
        var counts: [String: Int] = [:]

        for match in matches {
            guard
                let headingRange = Range(match.range(at: 0), in: html),
                let levelRange = Range(match.range(at: 1), in: html),
                let contentRange = Range(match.range(at: 2), in: html)
            else {
                continue
            }

            result += html[currentIndex..<headingRange.lowerBound]

            let level = html[levelRange]
            let content = String(html[contentRange])
            let plainText = stripHTMLTags(from: content)
            let slug = slugifyHeading(plainText)
            let count = (counts[slug] ?? 0) + 1
            counts[slug] = count
            let id = count == 1 ? slug : "\(slug)-\(count)"
            result += "<h\(level) id=\"\(escapeHTML(id))\">\(content)</h\(level)>"
            currentIndex = headingRange.upperBound
        }

        result += html[currentIndex...]
        return result
    }

    private func stripHTMLTags(from html: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"<[^>]+>"#) else {
            return html
        }
        let range = NSRange(html.startIndex..., in: html)
        return regex.stringByReplacingMatches(in: html, range: range, withTemplate: "")
    }

    private func slugifyHeading(_ text: String) -> String {
        let allowed = CharacterSet.letters.union(.decimalDigits)
        let lowered = text.lowercased()
        var slug = ""
        var previousWasSeparator = false

        for scalar in lowered.unicodeScalars {
            if allowed.contains(scalar) {
                slug.unicodeScalars.append(scalar)
                previousWasSeparator = false
            } else if scalar == " " || scalar == "-" {
                guard !slug.isEmpty, !previousWasSeparator else { continue }
                slug.append("-")
                previousWasSeparator = true
            }
        }

        while slug.last == "-" {
            slug.removeLast()
        }

        return slug.isEmpty ? "section" : slug
    }

    private func preprocessMath(in markdown: String) -> PreprocessedMathDocument {
        let displayPass = preprocessDisplayMath(in: markdown)
        let inlinePass = preprocessInlineMath(in: displayPass.markdown, startingAt: displayPass.placeholders.count)
        return PreprocessedMathDocument(
            markdown: inlinePass.markdown,
            placeholders: displayPass.placeholders + inlinePass.placeholders
        )
    }

    private func preprocessDisplayMath(in markdown: String) -> PreprocessedMathDocument {
        let lines = markdown.components(separatedBy: "\n")
        var processed: [String] = []
        var placeholders: [MathPlaceholder] = []
        var index = 0
        var inFence = false

        while index < lines.count {
            let line = lines[index]
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            if isFenceDelimiter(trimmed) {
                inFence.toggle()
                processed.append(line)
                index += 1
                continue
            }

            if !inFence, trimmed == "$$" || trimmed == "\\[" {
                let closing = trimmed == "$$" ? "$$" : "\\]"
                var cursor = index + 1
                var content: [String] = []

                while cursor < lines.count {
                    let candidate = lines[cursor].trimmingCharacters(in: .whitespaces)
                    if candidate == closing {
                        let token = mathToken(for: placeholders.count)
                        placeholders.append(
                            .init(token: token, expression: content.joined(separator: "\n"), displayMode: true)
                        )
                        processed.append(token)
                        index = cursor + 1
                        break
                    }
                    content.append(lines[cursor])
                    cursor += 1
                }

                if cursor < lines.count {
                    continue
                }
            }

            processed.append(line)
            index += 1
        }

        return PreprocessedMathDocument(markdown: processed.joined(separator: "\n"), placeholders: placeholders)
    }

    private func preprocessInlineMath(in markdown: String, startingAt offset: Int) -> PreprocessedMathDocument {
        var output = ""
        var placeholders: [MathPlaceholder] = []
        var index = markdown.startIndex
        var nextTokenIndex = offset
        var inFence = false

        while index < markdown.endIndex {
            if markdown[index...].hasPrefix("```") || markdown[index...].hasPrefix("~~~") {
                inFence.toggle()
                output.append(contentsOf: markdown[index...markdown.index(index, offsetBy: 2)])
                index = markdown.index(index, offsetBy: 3)
                continue
            }

            if inFence {
                output.append(markdown[index])
                index = markdown.index(after: index)
                continue
            }

            if markdown[index] == "`" {
                let delimiterCount = consecutiveCharacterCount(in: markdown, from: index, matching: "`")
                let delimiter = String(repeating: "`", count: delimiterCount)
                output.append(delimiter)
                index = markdown.index(index, offsetBy: delimiterCount)
                if let range = markdown[index...].range(of: delimiter) {
                    output.append(contentsOf: markdown[index..<range.lowerBound])
                    output.append(delimiter)
                    index = range.upperBound
                }
                continue
            }

            if markdown[index...].hasPrefix("\\("), let closing = markdown[index...].range(of: "\\)") {
                let expressionStart = markdown.index(index, offsetBy: 2)
                let expression = String(markdown[expressionStart..<closing.lowerBound])
                let token = mathToken(for: nextTokenIndex)
                placeholders.append(.init(token: token, expression: expression, displayMode: false))
                output.append(token)
                nextTokenIndex += 1
                index = closing.upperBound
                continue
            }

            if markdown[index] == "$",
               let closing = findInlineDollarClosing(in: markdown, from: markdown.index(after: index)) {
                let expression = String(markdown[markdown.index(after: index)..<closing])
                if !expression.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    let token = mathToken(for: nextTokenIndex)
                    placeholders.append(.init(token: token, expression: expression, displayMode: false))
                    output.append(token)
                    nextTokenIndex += 1
                    index = markdown.index(after: closing)
                    continue
                }
            }

            output.append(markdown[index])
            index = markdown.index(after: index)
        }

        return PreprocessedMathDocument(markdown: output, placeholders: placeholders)
    }

    private func renderMathPlaceholders(in html: String, placeholders: [MathPlaceholder]) -> String {
        placeholders.reduce(html) { partial, placeholder in
            partial.replacingOccurrences(
                of: placeholder.token,
                with: renderedMathHTML(for: placeholder)
            )
        }
    }

    private func renderedMathHTML(for placeholder: MathPlaceholder) -> String {
        if let rendered = KaTeXRenderer.shared.render(
            expression: placeholder.expression,
            displayMode: placeholder.displayMode,
            assetResolver: { self.mathAssetURL(named: $0) }
        ) {
            return placeholder.displayMode
                ? "<span class=\"jm-math-display\">\(rendered)</span>"
                : "<span class=\"jm-math-inline\">\(rendered)</span>"
        }

        let klass = placeholder.displayMode ? "jm-math-placeholder jm-math-display" : "jm-math-placeholder jm-math-inline"
        return "<span class=\"\(klass)\" data-expr=\"\(escapeHTMLAttribute(placeholder.expression))\"></span>"
    }

    private func mathToken(for index: Int) -> String {
        "@@JMATH_\(index)_TOKEN@@"
    }

    private func findInlineDollarClosing(in markdown: String, from start: String.Index) -> String.Index? {
        var cursor = start
        while cursor < markdown.endIndex {
            let character = markdown[cursor]
            if character == "\n" {
                return nil
            }
            if character == "\\", markdown.index(after: cursor) < markdown.endIndex {
                cursor = markdown.index(cursor, offsetBy: 2)
                continue
            }
            if character == "$" {
                return cursor
            }
            cursor = markdown.index(after: cursor)
        }
        return nil
    }

    private func consecutiveCharacterCount(in markdown: String, from index: String.Index, matching character: Character) -> Int {
        var count = 0
        var cursor = index
        while cursor < markdown.endIndex, markdown[cursor] == character {
            count += 1
            cursor = markdown.index(after: cursor)
        }
        return count
    }

    private func isFenceDelimiter(_ trimmedLine: String) -> Bool {
        trimmedLine.hasPrefix("```") || trimmedLine.hasPrefix("~~~")
    }

    private func mathAssetTags() -> String {
        [embeddedStylesheetTag(), embeddedScriptTag()]
            .compactMap { $0 }
            .joined(separator: "\n")
    }

    private func mathBootstrapScript() -> String {
        """
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
    }

    private func embeddedStylesheetTag() -> String? {
        guard let css = loadMathAssetText(named: "katex.min.css") else { return nil }
        return "<style>\(rewriteMathFontURLs(in: css))</style>"
    }

    private func embeddedScriptTag() -> String? {
        guard let script = loadMathAssetText(named: "katex.min.js") else { return nil }
        return "<script>\(script)</script>"
    }

    private func mathAssetURL(named name: String) -> URL? {
        let candidateBundles = [Bundle.main] + Bundle.allFrameworks + Bundle.allBundles
        for bundle in candidateBundles {
            guard let resourceRoot = bundle.resourceURL else { continue }
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
        }

        let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath, isDirectory: true)
        let localCandidates = [
            cwd.appendingPathComponent("Resources", isDirectory: true)
                .appendingPathComponent("Vendor", isDirectory: true)
                .appendingPathComponent("KaTeX", isDirectory: true)
                .appendingPathComponent(name),
            cwd.deletingLastPathComponent()
                .appendingPathComponent("Resources", isDirectory: true)
                .appendingPathComponent("Vendor", isDirectory: true)
                .appendingPathComponent("KaTeX", isDirectory: true)
                .appendingPathComponent(name)
        ]

        for candidate in localCandidates where FileManager.default.fileExists(atPath: candidate.path) {
            return candidate.standardizedFileURL
        }
        return nil
    }

    private func loadMathAssetText(named name: String) -> String? {
        guard let url = mathAssetURL(named: name) else { return nil }
        return try? String(contentsOf: url, encoding: .utf8)
    }

    private func rewriteMathFontURLs(in css: String) -> String {
        guard let regex = try? NSRegularExpression(pattern: #"url\((['"]?)(fonts/)?([^'")]+)\1\)"#) else {
            return css
        }

        let matches = regex.matches(in: css, range: NSRange(css.startIndex..., in: css)).reversed()
        var result = css

        for match in matches {
            guard
                let wholeRange = Range(match.range(at: 0), in: result),
                let fileRange = Range(match.range(at: 3), in: result),
                let fontURL = mathAssetURL(named: String(result[fileRange]))
            else {
                continue
            }

            result.replaceSubrange(
                wholeRange,
                with: "url(\"\(escapeHTMLAttribute(fontURL.absoluteString))\")"
            )
        }

        return result
    }

    private func escapeHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private func escapeHTMLAttribute(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\n", with: "&#10;")
    }
}

private final class KaTeXRenderer {
    static let shared = KaTeXRenderer()

    private var context: JSContext?
    private var loadedAssetPath: String?

    func render(
        expression: String,
        displayMode: Bool,
        assetResolver: (String) -> URL?
    ) -> String? {
        guard let scriptURL = assetResolver("katex.min.js") else { return nil }
        let scriptPath = scriptURL.path
        if context == nil || loadedAssetPath != scriptPath {
            guard let script = try? String(contentsOf: scriptURL, encoding: .utf8) else { return nil }
            let context = JSContext()
            context?.exceptionHandler = { _, exception in
                if let exception {
                    NSLog("KaTeX JS exception: %@", exception)
                }
            }
            context?.evaluateScript(script)
            self.context = context
            self.loadedAssetPath = scriptPath
        }

        guard
            let context,
            let katex = context.objectForKeyedSubscript("katex"),
            !katex.isUndefined
        else {
            return nil
        }

        let options: [String: Any] = [
            "displayMode": displayMode,
            "throwOnError": false,
            "strict": "warn"
        ]

        return katex.invokeMethod("renderToString", withArguments: [expression, options])?.toString()
    }
}

private struct ParsedDocument {
    let metadata: [(String, String)]
    let bodyMarkdown: String
}

private struct PreprocessedMathDocument {
    let markdown: String
    let placeholders: [MathPlaceholder]
}

private struct MathPlaceholder {
    let token: String
    let expression: String
    let displayMode: Bool
}
