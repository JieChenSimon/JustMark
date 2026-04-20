import SwiftUI

struct DocumentTabStripView: View {
    enum Placement {
        case content
        case titlebar
    }

    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var themeStore: ThemeStore
    @EnvironmentObject private var workspaceStore: WorkspaceStore
    private let placement: Placement

    init(placement: Placement = .content) {
        self.placement = placement
    }

    private var leadingInset: CGFloat {
        guard placement == .content else { return 0 }
        return workspaceStore.isSidebarVisible ? 0 : EditorDesignSystem.Chrome.windowControlsLeadingClearance
    }

    private var stripBackground: Color {
        placement == .content ? themeStore.editorChromeBackgroundColor : .clear
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: EditorDesignSystem.Chrome.tabItemSpacing) {
                ForEach(documentStore.openDocuments) { document in
                    DocumentTabItemView(document: document)
                        .environmentObject(documentStore)
                        .environmentObject(themeStore)
                }

                Button {
                    Task { await workspaceStore.createNewDocument() }
                } label: {
                    Image(systemName: "plus")
                        .font(.system(size: 11, weight: .medium))
                        .frame(
                            width: EditorDesignSystem.Chrome.tabAccessoryButtonSize,
                            height: EditorDesignSystem.Chrome.tabAccessoryButtonSize
                        )
                }
                .buttonStyle(.plain)
                .foregroundStyle(themeStore.editorSecondaryTextColor)
            }
            .padding(.leading, EditorDesignSystem.Chrome.tabStripHorizontalPadding + leadingInset)
            .padding(.trailing, EditorDesignSystem.Chrome.tabStripHorizontalPadding)
            .padding(.vertical, EditorDesignSystem.Chrome.tabStripVerticalPadding)
        }
        .background(stripBackground)
        .overlay(alignment: .bottom) {
            if placement == .content {
                Rectangle()
                    .fill(themeStore.editorHairlineColor)
                    .frame(height: 1)
            }
        }
        .frame(height: EditorDesignSystem.Chrome.tabStripHeight)
        .offset(y: EditorDesignSystem.Chrome.tabStripVerticalOffset)
    }
}

private struct DocumentTabItemView: View {
    let document: DocumentTab

    @EnvironmentObject private var documentStore: DocumentStore
    @EnvironmentObject private var themeStore: ThemeStore

    private var isActive: Bool {
        document.id == documentStore.activeDocumentID
    }

    private var showsSavedFeedback: Bool {
        documentStore.recentlySavedDocumentID == document.id && !document.hasUnsavedChanges
    }

    private var tabBackgroundColor: Color {
        isActive ? themeStore.editorActiveTabFillColor : themeStore.editorInactiveTabFillColor
    }

    private var tabStrokeColor: Color {
        isActive ? themeStore.editorActiveTabStrokeColor : themeStore.editorInactiveTabStrokeColor
    }

    private var titleColor: Color {
        isActive ? themeStore.editorActiveTabTitleColor : themeStore.editorSecondaryTextColor
    }

    private var closeColor: Color {
        if isActive {
            return themeStore.isDarkMode ? Color.white.opacity(0.72) : Color.black.opacity(0.62)
        }
        return themeStore.editorSecondaryTextColor.opacity(0.92)
    }

    var body: some View {
        HStack(spacing: 6) {
            tabStateGlyph

            Button {
                documentStore.activateDocument(id: document.id)
            } label: {
                Text(document.displayName)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .font(.system(size: 11.5, weight: isActive ? .semibold : .regular))
                    .frame(maxWidth: EditorDesignSystem.Chrome.tabLabelMaxWidth, alignment: .leading)
            }
            .buttonStyle(.plain)
            .foregroundStyle(titleColor)

            Button {
                documentStore.closeDocument(id: document.id)
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 8.5, weight: .medium))
                    .frame(
                        width: EditorDesignSystem.Chrome.tabAccessoryButtonSize,
                        height: EditorDesignSystem.Chrome.tabAccessoryButtonSize
                    )
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(closeColor)
            .help("Close Tab")
        }
        .padding(.horizontal, EditorDesignSystem.Chrome.tabHorizontalPadding)
        .frame(height: EditorDesignSystem.Chrome.tabHeight)
        .background(
            RoundedRectangle(
                cornerRadius: EditorDesignSystem.Chrome.tabCornerRadius,
                style: .continuous
            )
            .fill(tabBackgroundColor)
        )
        .overlay {
            RoundedRectangle(
                cornerRadius: EditorDesignSystem.Chrome.tabCornerRadius,
                style: .continuous
            )
            .strokeBorder(tabStrokeColor)
        }
    }

    @ViewBuilder
    private var tabStateGlyph: some View {
        if showsSavedFeedback {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 9.5, weight: .semibold))
                .foregroundStyle(Color.green.opacity(0.9))
                .frame(width: 9, height: 9)
        } else {
            Circle()
                .fill(document.hasUnsavedChanges ? Color.accentColor.opacity(0.85) : themeStore.editorSecondaryTextColor.opacity(0.32))
                .frame(width: 4, height: 4)
        }
    }
}
