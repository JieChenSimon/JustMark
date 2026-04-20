import Foundation

enum MarkdownInlineFormat {
    case bold
    case italic
    case code
}

enum MarkdownFormatter {
    static func apply(_ format: MarkdownInlineFormat, to text: String, selection: NSRange) -> (text: String, selection: NSRange) {
        guard let range = Range(selection, in: text) else {
            return (text, selection)
        }

        let selectedText = String(text[range])
        let wrapper: String
        switch format {
        case .bold:
            wrapper = "**"
        case .italic:
            wrapper = "*"
        case .code:
            wrapper = "`"
        }

        let replacement = wrapper + selectedText + wrapper
        let nextText = text.replacingCharacters(in: range, with: replacement)
        let nextLocation = selection.location + wrapper.count
        let nextSelection = NSRange(location: nextLocation, length: selection.length)
        return (nextText, nextSelection)
    }
}
