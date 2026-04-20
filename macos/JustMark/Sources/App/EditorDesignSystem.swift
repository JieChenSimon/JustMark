import AppKit
import CoreGraphics

enum EditorDesignSystem {
    enum Canvas {
        static let outerGutter: CGFloat = 0
        static let readableWidthWithPreview: CGFloat = 760
        static let readableWidthWithoutPreview: CGFloat = 760
        static let textInsetHorizontal: CGFloat = 10
        static let textInsetVertical: CGFloat = 22
        static let surfaceCornerRadius: CGFloat = 10
        static let surfaceStrokeWidth: CGFloat = 1

        static func lineSpacing(for font: NSFont) -> CGFloat {
            max(2, floor(font.pointSize * 0.22))
        }

        static func paragraphSpacing(for font: NSFont) -> CGFloat {
            max(3, floor(font.pointSize * 0.16))
        }
    }

    enum Chrome {
        static let windowControlsLeadingClearance: CGFloat = 168
        static let topChromeHeight: CGFloat = 38
        static let paneContentTopInset: CGFloat = topChromeHeight
        static let sidebarContentTopInset: CGFloat = 8
        static let previewContentTopInset: CGFloat = 0
        static let tabStripHeight: CGFloat = 28
        static let tabHeight: CGFloat = 22
        static let tabStripVerticalOffset: CGFloat = 0
        static let tabCornerRadius: CGFloat = 7
        static let tabHorizontalPadding: CGFloat = 8
        static let tabLabelMaxWidth: CGFloat = 132
        static let tabItemSpacing: CGFloat = 4
        static let tabAccessoryButtonSize: CGFloat = 16
        static let tabStripHorizontalPadding: CGFloat = 8
        static let tabStripVerticalPadding: CGFloat = 5

        static let statusBarHeight: CGFloat = 26
        static let statusHorizontalPadding: CGFloat = 12

        static let findPanelPadding: CGFloat = 12
        static let findPanelSpacing: CGFloat = 10
        static let findPanelCornerRadius: CGFloat = 12
        static let findPanelMaxWidth: CGFloat = 520
        static let overlayPadding: CGFloat = 12
    }
}
