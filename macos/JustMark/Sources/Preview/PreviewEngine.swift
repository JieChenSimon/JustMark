import Down
import Foundation

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
        </style>
        </head>
        <body>\(body)</body>
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
        </style>
        </head>
        <body>\(body)</body>
        </html>
        """
    }

    private func renderDocument(_ markdown: String) throws -> String {
        let document = parseDocument(markdown)
        try Task.checkCancellation()

        let rawBodyHTML = try Down(markdownString: document.bodyMarkdown).toHTML(.unsafe)
        let bodyHTML = postprocessRenderedHTML(rawBodyHTML)
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

    private func escapeHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}

private struct ParsedDocument {
    let metadata: [(String, String)]
    let bodyMarkdown: String
}
