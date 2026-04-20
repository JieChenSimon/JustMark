import Foundation

enum TocParser {
    static func extractHeadings(from content: String) -> [TableOfContentsHeading] {
        let lines = content.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        var counts: [String: Int] = [:]

        return lines.enumerated().compactMap { index, line in
            guard let match = matchHeading(in: line) else {
                return nil
            }

            let level = match.hashCount
            let raw = match.title.trimmingCharacters(in: .whitespaces)
            guard !raw.isEmpty else {
                return nil
            }

            let slug = slugify(raw)
            let count = (counts[slug] ?? 0) + 1
            counts[slug] = count
            let id = count == 1 ? slug : "\(slug)-\(count)"
            return TableOfContentsHeading(id: id, text: raw, level: level, line: index)
        }
    }

    private static func slugify(_ text: String) -> String {
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

    private static func matchHeading(in line: String) -> (hashCount: Int, title: String)? {
        let trimmed = line.trimmingCharacters(in: .whitespaces)
        guard trimmed.hasPrefix("#") else {
            return nil
        }

        let hashes = trimmed.prefix { $0 == "#" }
        guard (1...6).contains(hashes.count) else {
            return nil
        }

        let remainder = trimmed.dropFirst(hashes.count)
        guard remainder.first == " " else {
            return nil
        }

        let title = remainder.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else {
            return nil
        }

        return (hashes.count, title)
    }
}
