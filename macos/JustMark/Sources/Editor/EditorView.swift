import AppKit
import SwiftUI

struct EditorView: NSViewRepresentable {
    @ObservedObject var documentStore: DocumentStore
    let font: NSFont
    let isDark: Bool
    let backgroundColor: NSColor
    let imagePasteHandler: @MainActor (Data) async -> String?

    func makeNSView(context: Context) -> EditorSurfaceView {
        let surfaceView = EditorSurfaceView()
        let scrollView = surfaceView.scrollView
        let textView = surfaceView.textView

        textView.isRichText = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticDataDetectionEnabled = false
        textView.isAutomaticLinkDetectionEnabled = false
        textView.usesFindPanel = true
        textView.allowsUndo = true
        textView.isEditable = true
        textView.isSelectable = true
        textView.font = font
        textView.textContainerInset = NSSize(
            width: EditorDesignSystem.Canvas.textInsetHorizontal,
            height: EditorDesignSystem.Canvas.textInsetVertical
        )
        applyStandardParagraphStyle(to: textView, font: font)
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.containerSize = NSSize(width: scrollView.contentSize.width, height: .greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.lineFragmentPadding = 0
        textView.delegate = context.coordinator
        textView.drawsBackground = true
        textView.backgroundColor = backgroundColor
        textView.textColor = .labelColor
        textView.insertionPointColor = .controlAccentColor
        textView.selectedTextAttributes = [
            .backgroundColor: NSColor.selectedTextBackgroundColor.withAlphaComponent(0.82),
            .foregroundColor: NSColor.selectedTextColor
        ]
        textView.imagePasteHandler = { [weak coordinator = context.coordinator] data in
            guard let coordinator else { return }
            await coordinator.handlePastedImage(data)
        }
        scrollView.documentView = textView
        context.coordinator.textView = textView
        context.coordinator.scrollView = scrollView
        surfaceView.applyAppearance(isDark: isDark, backgroundColor: backgroundColor)
        return surfaceView
    }

    func updateNSView(_ nsView: EditorSurfaceView, context: Context) {
        guard let textView = context.coordinator.textView else { return }
        let isComposingMarkedText = textView.hasMarkedText()
        context.coordinator.isProgrammaticUpdate = true
        defer {
            context.coordinator.isProgrammaticUpdate = false
        }
        if !isComposingMarkedText {
            let expected = documentStore.activeDocument?.content ?? ""
            if textView.string != expected {
                textView.string = expected
            }

            if textView.selectedRange() != documentStore.currentSelection {
                textView.setSelectedRange(documentStore.currentSelection)
            }
        }

        if textView.font != font {
            textView.font = font
            print("[JustMark] Editor font applied: \(font.fontName) \(Int(font.pointSize))")
        }
        applyStandardParagraphStyle(to: textView, font: font)

        nsView.applyAppearance(isDark: isDark, backgroundColor: backgroundColor)

        if !isComposingMarkedText, documentStore.currentVisibleLine > 0 {
            context.coordinator.scrollToLine(documentStore.currentVisibleLine)
        }

        if !isComposingMarkedText {
            context.coordinator.restoreScrollPositionIfNeeded(documentID: documentStore.activeDocumentID, fraction: documentStore.currentScrollFraction)
        }
        context.coordinator.focusEditorIfNeeded(documentID: documentStore.activeDocumentID)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(documentStore: documentStore, imagePasteHandler: imagePasteHandler)
    }

    private func applyStandardParagraphStyle(to textView: NSTextView, font: NSFont) {
        let paragraphStyle = (textView.defaultParagraphStyle ?? NSParagraphStyle.default).mutableCopy() as? NSMutableParagraphStyle
            ?? NSMutableParagraphStyle()
        paragraphStyle.lineBreakMode = .byWordWrapping
        paragraphStyle.lineSpacing = EditorDesignSystem.Canvas.lineSpacing(for: font)
        paragraphStyle.paragraphSpacing = EditorDesignSystem.Canvas.paragraphSpacing(for: font)

        var attributes = textView.typingAttributes
        attributes[.paragraphStyle] = paragraphStyle
        attributes[.font] = font
        textView.typingAttributes = attributes

        let selection = textView.selectedRange()
        textView.defaultParagraphStyle = paragraphStyle
        textView.textStorage?.addAttributes([.paragraphStyle: paragraphStyle], range: NSRange(location: 0, length: textView.string.utf16.count))
        textView.setSelectedRange(selection)
    }

    @MainActor
    final class Coordinator: NSObject, NSTextViewDelegate {
        let documentStore: DocumentStore
        let imagePasteHandler: @MainActor (Data) async -> String?
        weak var textView: NSTextView?
        weak var scrollView: NSScrollView?
        private var lastJumpedLine: Int?
        private var lastRestoredDocumentID: UUID?
        private var lastFocusedDocumentID: UUID?
        var isProgrammaticUpdate = false

        init(documentStore: DocumentStore, imagePasteHandler: @escaping @MainActor (Data) async -> String?) {
            self.documentStore = documentStore
            self.imagePasteHandler = imagePasteHandler
        }

        func textDidChange(_ notification: Notification) {
            if isProgrammaticUpdate { return }
            guard let textView else { return }
            guard !textView.hasMarkedText() else { return }
            documentStore.updateActiveContent(textView.string)
            documentStore.updateSelection(textView.selectedRange())
            syncScrollFraction()
        }

        func textViewDidChangeSelection(_ notification: Notification) {
            if isProgrammaticUpdate { return }
            guard let textView else { return }
            if textView.hasMarkedText() { return }
            documentStore.updateSelection(textView.selectedRange())
        }

        func textDidEndEditing(_ notification: Notification) {
            syncScrollFraction()
            documentStore.flushActiveDocumentEdits()
        }

        func scrollToLine(_ line: Int) {
            guard let textView, lastJumpedLine != line else { return }
            lastJumpedLine = line
            let lines = textView.string.split(separator: "\n", omittingEmptySubsequences: false)
            let clamped = max(0, min(line, max(lines.count - 1, 0)))
            var location = 0

            for index in 0..<clamped {
                location += lines[index].count + 1
            }

            let range = NSRange(location: location, length: 0)
            textView.scrollRangeToVisible(range)
            textView.setSelectedRange(range)
        }

        func restoreScrollPositionIfNeeded(documentID: UUID?, fraction: Double) {
            guard let documentID, lastRestoredDocumentID != documentID else { return }
            lastRestoredDocumentID = documentID
            guard let scrollView else { return }
            let maxOffset = max(scrollView.documentView?.bounds.height ?? 0 - scrollView.contentView.bounds.height, 0)
            let y = maxOffset * fraction
            scrollView.contentView.scroll(to: NSPoint(x: 0, y: y))
            scrollView.reflectScrolledClipView(scrollView.contentView)
        }

        func focusEditorIfNeeded(documentID: UUID?) {
            guard let textView else { return }
            guard let documentID else {
                lastFocusedDocumentID = nil
                return
            }

            if lastFocusedDocumentID == documentID, textView.window?.firstResponder === textView {
                return
            }

            DispatchQueue.main.async {
                guard let window = textView.window else { return }
                if window.makeFirstResponder(textView) {
                    self.lastFocusedDocumentID = documentID
                }
            }
        }

        private func syncScrollFraction() {
            guard let scrollView else { return }
            let documentHeight = scrollView.documentView?.bounds.height ?? 0
            let viewportHeight = scrollView.contentView.bounds.height
            let maxOffset = max(documentHeight - viewportHeight, 0)
            guard maxOffset > 0 else {
                documentStore.updateScrollFraction(0)
                return
            }
            let fraction = min(max(scrollView.contentView.bounds.origin.y / maxOffset, 0), 1)
            documentStore.updateScrollFraction(fraction)
        }

        func handlePastedImage(_ data: Data) async {
            guard let markdown = await imagePasteHandler(data), let textView else { return }
            let selectedRange = textView.selectedRange()
            if let range = Range(selectedRange, in: textView.string) {
                let updated = textView.string.replacingCharacters(in: range, with: markdown)
                textView.string = updated
                let cursor = selectedRange.location + (markdown as NSString).length
                let selection = NSRange(location: cursor, length: 0)
                textView.setSelectedRange(selection)
                documentStore.updateActiveContent(updated)
                documentStore.updateSelection(selection)
            }
        }
    }
}

final class EditorSurfaceView: NSView {
    let scrollView = NSScrollView()
    let textView = PasteAwareTextView()
    private var lastIsDark: Bool?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        wantsLayer = true
        layer?.cornerRadius = EditorDesignSystem.Canvas.surfaceCornerRadius
        layer?.masksToBounds = true
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        layer?.borderWidth = 0
        layer?.borderColor = NSColor.clear.cgColor

        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.drawsBackground = true
        scrollView.backgroundColor = .windowBackgroundColor
        scrollView.verticalScrollElasticity = .allowed
        scrollView.scrollerStyle = .overlay

        addSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func applyAppearance(isDark: Bool, backgroundColor: NSColor) {
        guard lastIsDark != isDark || layer?.backgroundColor != backgroundColor.cgColor else { return }
        lastIsDark = isDark
        let appearanceName: NSAppearance.Name = isDark ? .darkAqua : .aqua
        let appearance = NSAppearance(named: appearanceName)
        self.appearance = appearance
        scrollView.appearance = appearance
        textView.appearance = appearance
        textView.textColor = .labelColor
        textView.insertionPointColor = .controlAccentColor
        textView.backgroundColor = backgroundColor
        scrollView.backgroundColor = backgroundColor
        textView.selectedTextAttributes = [
            .backgroundColor: NSColor.selectedTextBackgroundColor.withAlphaComponent(0.82),
            .foregroundColor: NSColor.selectedTextColor
        ]
        layer?.backgroundColor = backgroundColor.cgColor
    }
}

final class PasteAwareTextView: NSTextView {
    var imagePasteHandler: (@MainActor (Data) async -> Void)?

    override var acceptsFirstResponder: Bool {
        true
    }

    override func paste(_ sender: Any?) {
        guard let image = NSImage(pasteboard: .general), let data = image.pngData else {
            super.paste(sender)
            return
        }

        Task { @MainActor in
            await imagePasteHandler?(data)
        }
    }
}

private extension NSImage {
    var pngData: Data? {
        guard let tiff = tiffRepresentation, let bitmap = NSBitmapImageRep(data: tiff) else {
            return nil
        }
        return bitmap.representation(using: .png, properties: [:])
    }
}
