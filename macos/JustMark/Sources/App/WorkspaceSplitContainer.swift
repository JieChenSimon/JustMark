import AppKit
import SwiftUI

struct WorkspaceSplitContainer: NSViewRepresentable {
    let sidebar: AnyView
    let editor: AnyView
    let preview: AnyView
    let isSidebarVisible: Bool
    let isPreviewVisible: Bool
    @Binding var sidebarWidth: CGFloat
    @Binding var previewWidth: CGFloat
    let minSidebarWidth: CGFloat
    let maxSidebarWidth: CGFloat
    let minEditorWidth: CGFloat
    let minPreviewWidth: CGFloat
    let maxPreviewWidth: CGFloat
    let dividerWidth: CGFloat
    let prefersInstantSidebarTransitions: Bool
    let isDark: Bool
    let workspaceBackgroundColor: NSColor
    let dividerColor: NSColor

    func makeNSView(context: Context) -> WorkspaceSplitHostView {
        WorkspaceSplitHostView()
    }

    func updateNSView(_ nsView: WorkspaceSplitHostView, context: Context) {
        nsView.update(
            sidebar: sidebar,
            editor: editor,
            preview: preview,
            configuration: .init(
                isSidebarVisible: isSidebarVisible,
                isPreviewVisible: isPreviewVisible,
                sidebarWidth: sidebarWidth,
                previewWidth: previewWidth,
                minSidebarWidth: minSidebarWidth,
                maxSidebarWidth: maxSidebarWidth,
                minEditorWidth: minEditorWidth,
                minPreviewWidth: minPreviewWidth,
                maxPreviewWidth: maxPreviewWidth,
                dividerWidth: dividerWidth,
                prefersInstantSidebarTransitions: prefersInstantSidebarTransitions
            ),
            isDark: isDark,
            workspaceBackgroundColor: workspaceBackgroundColor,
            dividerColor: dividerColor,
            onSidebarWidthChanged: { width in
                if abs(sidebarWidth - width) > 0.5 {
                    DispatchQueue.main.async {
                        sidebarWidth = width
                    }
                }
            },
            onPreviewWidthChanged: { width in
                if abs(previewWidth - width) > 0.5 {
                    DispatchQueue.main.async {
                        previewWidth = width
                    }
                }
            }
        )
    }
}

struct WorkspaceSplitConfiguration: Equatable {
    let isSidebarVisible: Bool
    let isPreviewVisible: Bool
    let sidebarWidth: CGFloat
    let previewWidth: CGFloat
    let minSidebarWidth: CGFloat
    let maxSidebarWidth: CGFloat
    let minEditorWidth: CGFloat
    let minPreviewWidth: CGFloat
    let maxPreviewWidth: CGFloat
    let dividerWidth: CGFloat
    let prefersInstantSidebarTransitions: Bool
}

final class WorkspaceSplitHostView: NSView, NSSplitViewDelegate {
    private let paneVisibilityAnimationDuration: TimeInterval = 0.18
    private let outerSplitView = TrackingSplitView()
    private let innerSplitView = TrackingSplitView()
    private lazy var sidebarHostingView = NSHostingView(rootView: AnyView(EmptyView()))
    private lazy var editorHostingView = EdgeToEdgeHostingView(rootView: AnyView(EmptyView()))
    private lazy var previewHostingView = EdgeToEdgeHostingView(rootView: AnyView(EmptyView()))
    private let contentContainerView = NSView()

    private var configuration = WorkspaceSplitConfiguration(
        isSidebarVisible: true,
        isPreviewVisible: true,
        sidebarWidth: 200,
        previewWidth: 510,
        minSidebarWidth: 80,
        maxSidebarWidth: 220,
        minEditorWidth: 260,
        minPreviewWidth: 360,
        maxPreviewWidth: 760,
        dividerWidth: 1,
        prefersInstantSidebarTransitions: false
    )
    private var lastAppliedConfiguration: WorkspaceSplitConfiguration?
    private var isApplyingProgrammaticLayout = false
    private var isDraggingSidebarDivider = false
    private var isDraggingPreviewDivider = false
    private var isAnimatingSidebarVisibility = false
    private var isAnimatingPreviewVisibility = false
    private var lastKnownBoundsSize: CGSize = .zero
    private var onSidebarWidthChanged: ((CGFloat) -> Void)?
    private var onPreviewWidthChanged: ((CGFloat) -> Void)?

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        configureViewHierarchy()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func layout() {
        super.layout()
        if bounds.size != lastKnownBoundsSize {
            lastKnownBoundsSize = bounds.size
            guard !isAnimatingSidebarVisibility, !isAnimatingPreviewVisibility else { return }
            applyDesiredPaneWidths(force: true)
        }
    }

    func update(
        sidebar: AnyView,
        editor: AnyView,
        preview: AnyView,
        configuration: WorkspaceSplitConfiguration,
        isDark: Bool,
        workspaceBackgroundColor: NSColor,
        dividerColor: NSColor,
        onSidebarWidthChanged: @escaping (CGFloat) -> Void,
        onPreviewWidthChanged: @escaping (CGFloat) -> Void
    ) {
        let previousConfiguration = lastAppliedConfiguration

        sidebarHostingView.rootView = sidebar
        editorHostingView.rootView = editor
        previewHostingView.rootView = preview

        self.configuration = configuration
        self.onSidebarWidthChanged = onSidebarWidthChanged
        self.onPreviewWidthChanged = onPreviewWidthChanged

        outerSplitView.customDividerThickness = max(configuration.dividerWidth, 1)
        innerSplitView.customDividerThickness = max(configuration.dividerWidth, 1)
        outerSplitView.visualDividerThickness = configuration.dividerWidth
        innerSplitView.visualDividerThickness = configuration.dividerWidth
        outerSplitView.interactionThickness = 8
        innerSplitView.interactionThickness = 8
        applyAppearance(isDark: isDark, backgroundColor: workspaceBackgroundColor, dividerColor: dividerColor)

        if let previousConfiguration,
           previousConfiguration != configuration,
           (previousConfiguration.isSidebarVisible != configuration.isSidebarVisible ||
            previousConfiguration.isPreviewVisible != configuration.isPreviewVisible) {
            animatePaneVisibilityTransition(from: previousConfiguration, to: configuration)
            lastAppliedConfiguration = configuration
            return
        }

        synchronizeVisiblePanes()

        if previousConfiguration != configuration {
            needsLayout = true
            layoutSubtreeIfNeeded()
            if !isDraggingSidebarDivider && !isDraggingPreviewDivider {
                applyDesiredPaneWidths(force: true)
            }
            lastAppliedConfiguration = configuration
        }

    }

    private func configureViewHierarchy() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor

        outerSplitView.wantsLayer = true
        innerSplitView.wantsLayer = true
        contentContainerView.wantsLayer = true
        outerSplitView.isVertical = true
        outerSplitView.delegate = self
        outerSplitView.dividerStyle = .thin
        outerSplitView.translatesAutoresizingMaskIntoConstraints = false
        outerSplitView.dragStateChanged = { [weak self] isDragging in
            self?.isDraggingSidebarDivider = isDragging
        }

        innerSplitView.isVertical = true
        innerSplitView.delegate = self
        innerSplitView.dividerStyle = .thin
        innerSplitView.translatesAutoresizingMaskIntoConstraints = false
        innerSplitView.dragStateChanged = { [weak self] isDragging in
            self?.isDraggingPreviewDivider = isDragging
        }

        contentContainerView.translatesAutoresizingMaskIntoConstraints = false
        contentContainerView.addSubview(innerSplitView)

        addSubview(outerSplitView)
        NSLayoutConstraint.activate([
            outerSplitView.leadingAnchor.constraint(equalTo: leadingAnchor),
            outerSplitView.trailingAnchor.constraint(equalTo: trailingAnchor),
            outerSplitView.topAnchor.constraint(equalTo: topAnchor),
            outerSplitView.bottomAnchor.constraint(equalTo: bottomAnchor),

            innerSplitView.leadingAnchor.constraint(equalTo: contentContainerView.leadingAnchor),
            innerSplitView.trailingAnchor.constraint(equalTo: contentContainerView.trailingAnchor),
            innerSplitView.topAnchor.constraint(equalTo: contentContainerView.topAnchor),
            innerSplitView.bottomAnchor.constraint(equalTo: contentContainerView.bottomAnchor)
        ])

        outerSplitView.addArrangedSubview(sidebarHostingView)
        outerSplitView.addArrangedSubview(contentContainerView)
        innerSplitView.addArrangedSubview(editorHostingView)
        innerSplitView.addArrangedSubview(previewHostingView)

        // Keep sidebar/preview widths stable while the editor absorbs container resize.
        outerSplitView.setHoldingPriority(.defaultHigh, forSubviewAt: 0)
        outerSplitView.setHoldingPriority(.defaultLow, forSubviewAt: 1)
        innerSplitView.setHoldingPriority(.defaultLow, forSubviewAt: 0)
        innerSplitView.setHoldingPriority(.defaultHigh, forSubviewAt: 1)
    }

    private func applyAppearance(isDark: Bool, backgroundColor: NSColor, dividerColor: NSColor) {
        let appearanceName: NSAppearance.Name = isDark ? .darkAqua : .aqua
        let appearance = NSAppearance(named: appearanceName)
        self.appearance = appearance
        outerSplitView.appearance = appearance
        innerSplitView.appearance = appearance
        contentContainerView.appearance = appearance
        outerSplitView.dividerFillColor = dividerColor
        innerSplitView.dividerFillColor = dividerColor
        layer?.backgroundColor = backgroundColor.cgColor
    }

    private func synchronizeVisiblePanes() {
        ensureArrangedSubview(sidebarHostingView, in: outerSplitView, at: 0)
        ensureArrangedSubview(contentContainerView, in: outerSplitView, at: 1)
        ensureArrangedSubview(editorHostingView, in: innerSplitView, at: 0)
        ensureArrangedSubview(previewHostingView, in: innerSplitView, at: 1)
    }

    private func animatePaneVisibilityTransition(from previousConfiguration: WorkspaceSplitConfiguration, to configuration: WorkspaceSplitConfiguration) {
        let sidebarVisibilityChanged = previousConfiguration.isSidebarVisible != configuration.isSidebarVisible
        let previewVisibilityChanged = previousConfiguration.isPreviewVisible != configuration.isPreviewVisible
        let shouldAnimateSidebar = sidebarVisibilityChanged && !configuration.prefersInstantSidebarTransitions
        let shouldAnimatePreview = previewVisibilityChanged

        ensureArrangedSubview(contentContainerView, in: outerSplitView, at: outerSplitView.arrangedSubviews.count)
        ensureArrangedSubview(editorHostingView, in: innerSplitView, at: 0)

        isApplyingProgrammaticLayout = true
        isAnimatingSidebarVisibility = shouldAnimateSidebar
        isAnimatingPreviewVisibility = shouldAnimatePreview

        needsLayout = true
        layoutSubtreeIfNeeded()

        if !shouldAnimateSidebar && !shouldAnimatePreview {
            if sidebarVisibilityChanged, outerSplitView.arrangedSubviews.count > 1 {
                let targetSidebarWidth = configuration.isSidebarVisible
                    ? clamp(configuration.sidebarWidth, min: configuration.minSidebarWidth, max: effectiveMaxSidebarWidth())
                    : 0
                outerSplitView.setPosition(targetSidebarWidth, ofDividerAt: 0)
                layoutSubtreeIfNeeded()
                if configuration.isPreviewVisible {
                    applyDesiredPreviewWidth(force: true)
                }
            }

            if previewVisibilityChanged, innerSplitView.arrangedSubviews.count > 1 {
                let targetPreviewPosition = configuration.isPreviewVisible
                    ? innerSplitView.bounds.width - innerSplitView.dividerThickness - clamp(configuration.previewWidth, min: configuration.minPreviewWidth, max: effectiveMaxPreviewWidth())
                    : collapsedPreviewDividerCoordinate()
                innerSplitView.setPosition(targetPreviewPosition, ofDividerAt: 0)
            }

            isAnimatingSidebarVisibility = false
            isAnimatingPreviewVisibility = false
            isApplyingProgrammaticLayout = false
            needsLayout = true
            layoutSubtreeIfNeeded()
            return
        }

        if configuration.isSidebarVisible, shouldAnimateSidebar, outerSplitView.arrangedSubviews.count > 1 {
            outerSplitView.setPosition(0, ofDividerAt: 0)
            layoutSubtreeIfNeeded()
        }

        if configuration.isPreviewVisible, shouldAnimatePreview, innerSplitView.arrangedSubviews.count > 1 {
            innerSplitView.setPosition(collapsedPreviewDividerCoordinate(), ofDividerAt: 0)
            layoutSubtreeIfNeeded()
        }

        NSAnimationContext.runAnimationGroup { context in
            context.duration = paneVisibilityAnimationDuration
            context.allowsImplicitAnimation = false

            if sidebarVisibilityChanged, outerSplitView.arrangedSubviews.count > 1 {
                let targetSidebarWidth = configuration.isSidebarVisible
                    ? clamp(configuration.sidebarWidth, min: configuration.minSidebarWidth, max: effectiveMaxSidebarWidth())
                    : 0
                if shouldAnimateSidebar {
                    outerSplitView.animator().setPosition(targetSidebarWidth, ofDividerAt: 0)
                } else {
                    outerSplitView.setPosition(targetSidebarWidth, ofDividerAt: 0)
                }
            }

            if previewVisibilityChanged, innerSplitView.arrangedSubviews.count > 1 {
                let targetPreviewPosition = configuration.isPreviewVisible
                    ? innerSplitView.bounds.width - innerSplitView.dividerThickness - clamp(configuration.previewWidth, min: configuration.minPreviewWidth, max: effectiveMaxPreviewWidth())
                    : collapsedPreviewDividerCoordinate()
                if shouldAnimatePreview {
                    innerSplitView.animator().setPosition(targetPreviewPosition, ofDividerAt: 0)
                } else {
                    innerSplitView.setPosition(targetPreviewPosition, ofDividerAt: 0)
                }
            }
        } completionHandler: { [weak self] in
            guard let self else { return }
            self.isAnimatingSidebarVisibility = false
            self.isAnimatingPreviewVisibility = false
            self.isApplyingProgrammaticLayout = false

            self.needsLayout = true
            self.layoutSubtreeIfNeeded()
            self.applyDesiredPaneWidths(force: true)
        }
    }

    private func ensureArrangedSubview(_ subview: NSView, in splitView: NSSplitView, at index: Int) {
        if splitView.arrangedSubviews.contains(subview) {
            return
        }
        let insertionIndex = min(index, splitView.arrangedSubviews.count)
        splitView.insertArrangedSubview(subview, at: insertionIndex)
    }

    private func removeArrangedSubview(_ subview: NSView, from splitView: NSSplitView) {
        guard splitView.arrangedSubviews.contains(subview) else {
            return
        }
        splitView.removeArrangedSubview(subview)
        subview.removeFromSuperview()
    }

    private func applyDesiredPaneWidths(force: Bool) {
        guard bounds.width > 0 else {
            return
        }

        isApplyingProgrammaticLayout = true
        defer {
            isApplyingProgrammaticLayout = false
        }

        if outerSplitView.arrangedSubviews.contains(sidebarHostingView),
           outerSplitView.arrangedSubviews.count > 1 {
            let desiredSidebarWidth = configuration.isSidebarVisible
                ? clamp(
                    configuration.sidebarWidth,
                    min: configuration.minSidebarWidth,
                    max: effectiveMaxSidebarWidth()
                )
                : 0
            if force || abs(sidebarHostingView.frame.width - desiredSidebarWidth) > 0.5 {
                outerSplitView.setPosition(desiredSidebarWidth, ofDividerAt: 0)
            }
        }

        if innerSplitView.arrangedSubviews.contains(previewHostingView),
           innerSplitView.arrangedSubviews.count > 1 {
            applyDesiredPreviewWidth(force: force)
        }
    }

    private func applyDesiredPreviewWidth(force: Bool) {
        guard innerSplitView.arrangedSubviews.contains(previewHostingView),
              innerSplitView.arrangedSubviews.count > 1 else {
            return
        }

        let desiredPreviewWidth = configuration.isPreviewVisible
            ? clamp(
                configuration.previewWidth,
                min: configuration.minPreviewWidth,
                max: effectiveMaxPreviewWidth()
            )
            : 0
        let leftWidth = clamp(
            innerSplitView.bounds.width - innerSplitView.dividerThickness - desiredPreviewWidth,
            min: innerMinDividerCoordinate(),
            max: innerMaxDividerCoordinate()
        )
        if force || abs(previewHostingView.frame.width - desiredPreviewWidth) > 0.5 {
            innerSplitView.setPosition(leftWidth, ofDividerAt: 0)
        }
    }

    private func effectiveMaxSidebarWidth() -> CGFloat {
        let outerAvailableWidth = outerSplitView.bounds.width
        let outerDividerWidth = outerSplitView.arrangedSubviews.count > 1 ? outerSplitView.dividerThickness : 0
        let previewRequirement = configuration.isPreviewVisible
            ? configuration.minPreviewWidth + innerSplitView.dividerThickness
            : 0
        let requiredRightWidth = configuration.minEditorWidth + previewRequirement
        let maxWidthByContainer = max(configuration.minSidebarWidth, outerAvailableWidth - outerDividerWidth - requiredRightWidth)
        return min(configuration.maxSidebarWidth, maxWidthByContainer)
    }

    private func effectiveMaxPreviewWidth() -> CGFloat {
        let innerAvailableWidth = innerSplitView.bounds.width
        let dividerWidth = innerSplitView.arrangedSubviews.count > 1 ? innerSplitView.dividerThickness : 0
        let maxWidthByContainer = max(configuration.minPreviewWidth, innerAvailableWidth - dividerWidth - configuration.minEditorWidth)
        return min(configuration.maxPreviewWidth, maxWidthByContainer)
    }

    private func currentSidebarWidth() -> CGFloat {
        clamp(sidebarHostingView.frame.width, min: configuration.minSidebarWidth, max: effectiveMaxSidebarWidth())
    }

    private func currentPreviewWidth() -> CGFloat {
        clamp(previewHostingView.frame.width, min: configuration.minPreviewWidth, max: effectiveMaxPreviewWidth())
    }

    private func clamp(_ value: CGFloat, min minValue: CGFloat, max maxValue: CGFloat) -> CGFloat {
        Swift.min(Swift.max(value, minValue), maxValue)
    }

    private func innerMinDividerCoordinate() -> CGFloat {
        let minCoordinateForEditor = configuration.minEditorWidth
        let minCoordinateForPreviewMaxWidth = innerSplitView.bounds.width - innerSplitView.dividerThickness - effectiveMaxPreviewWidth()
        return max(minCoordinateForEditor, minCoordinateForPreviewMaxWidth)
    }

    private func innerMaxDividerCoordinate() -> CGFloat {
        let previewMinimumWidth = configuration.isPreviewVisible ? configuration.minPreviewWidth : 0
        let maxCoordinateForPreviewMinWidth = innerSplitView.bounds.width - innerSplitView.dividerThickness - previewMinimumWidth
        return max(innerMinDividerCoordinate(), maxCoordinateForPreviewMinWidth)
    }

    private func collapsedPreviewDividerCoordinate() -> CGFloat {
        max(configuration.minEditorWidth, innerSplitView.bounds.width - innerSplitView.dividerThickness)
    }

    func splitViewDidResizeSubviews(_ notification: Notification) {
        guard !isApplyingProgrammaticLayout else {
            return
        }

        if notification.object as AnyObject? === outerSplitView, isDraggingSidebarDivider {
            onSidebarWidthChanged?(currentSidebarWidth())
        } else if notification.object as AnyObject? === innerSplitView, isDraggingPreviewDivider {
            onPreviewWidthChanged?(currentPreviewWidth())
        }
    }

    func splitView(
        _ splitView: NSSplitView,
        constrainMinCoordinate proposedMinimumPosition: CGFloat,
        ofSubviewAt dividerIndex: Int
    ) -> CGFloat {
        if splitView === outerSplitView {
            if !configuration.isSidebarVisible || isAnimatingSidebarVisibility {
                return 0
            }
            return configuration.minSidebarWidth
        }
        return innerMinDividerCoordinate()
    }

    func splitView(
        _ splitView: NSSplitView,
        constrainMaxCoordinate proposedMaximumPosition: CGFloat,
        ofSubviewAt dividerIndex: Int
    ) -> CGFloat {
        if splitView === outerSplitView {
            return effectiveMaxSidebarWidth()
        }

        if !configuration.isPreviewVisible || isAnimatingPreviewVisibility {
            return collapsedPreviewDividerCoordinate()
        }

        return innerMaxDividerCoordinate()
    }

    func splitView(
        _ splitView: NSSplitView,
        constrainSplitPosition proposedPosition: CGFloat,
        ofSubviewAt dividerIndex: Int
    ) -> CGFloat {
        let minCoordinate = self.splitView(
            splitView,
            constrainMinCoordinate: proposedPosition,
            ofSubviewAt: dividerIndex
        )
        let maxCoordinate = self.splitView(
            splitView,
            constrainMaxCoordinate: proposedPosition,
            ofSubviewAt: dividerIndex
        )
        let clamped = min(max(proposedPosition, minCoordinate), maxCoordinate)
        return round(clamped)
    }

    func splitView(
        _ splitView: NSSplitView,
        effectiveRect proposedEffectiveRect: NSRect,
        forDrawnRect drawnRect: NSRect,
        ofDividerAt dividerIndex: Int
    ) -> NSRect {
        if let trackingSplitView = splitView as? TrackingSplitView {
            return trackingSplitView.interactionRect(forDividerAt: dividerIndex)
        }
        return proposedEffectiveRect
    }

    func splitView(_ splitView: NSSplitView, resizeSubviewsWithOldSize oldSize: NSSize) {
        guard splitView.subviews.count == 2 else {
            splitView.adjustSubviews()
            return
        }

        let bounds = splitView.bounds
        let dividerThickness = splitView.dividerThickness

        if splitView === outerSplitView {
            let sidebarWidth: CGFloat
            if configuration.isSidebarVisible {
                let requestedWidth = isDraggingSidebarDivider
                    ? sidebarHostingView.frame.width
                    : configuration.sidebarWidth
                sidebarWidth = clamp(
                    requestedWidth,
                    min: configuration.minSidebarWidth,
                    max: effectiveMaxSidebarWidth()
                )
            } else {
                sidebarWidth = 0
            }

            let contentOriginX = configuration.isSidebarVisible
                ? min(bounds.width, sidebarWidth + dividerThickness)
                : 0
            let contentWidth = max(0, bounds.width - contentOriginX)
            sidebarHostingView.frame = NSRect(x: 0, y: 0, width: sidebarWidth, height: bounds.height)
            contentContainerView.frame = NSRect(x: contentOriginX, y: 0, width: contentWidth, height: bounds.height)
            return
        }

        guard splitView === innerSplitView else {
            splitView.adjustSubviews()
            return
        }

        let requestedPreviewWidth = configuration.isPreviewVisible
            ? (isDraggingPreviewDivider ? previewHostingView.frame.width : configuration.previewWidth)
            : 0
        let clampedPreviewWidth = configuration.isPreviewVisible
            ? clamp(
                requestedPreviewWidth,
                min: configuration.minPreviewWidth,
                max: effectiveMaxPreviewWidth()
            )
            : 0
        let dividerPosition = clamp(
            bounds.width - dividerThickness - clampedPreviewWidth,
            min: innerMinDividerCoordinate(),
            max: innerMaxDividerCoordinate()
        )
        let previewOriginX = min(bounds.width, dividerPosition + dividerThickness)
        let previewWidth = max(0, bounds.width - previewOriginX)
        editorHostingView.frame = NSRect(x: 0, y: 0, width: dividerPosition, height: bounds.height)
        previewHostingView.frame = NSRect(x: previewOriginX, y: 0, width: previewWidth, height: bounds.height)
    }
}

final class TrackingSplitView: NSSplitView {
    var customDividerThickness: CGFloat = 1 {
        didSet {
            guard oldValue != customDividerThickness else { return }
            invalidateDividerCursorRects()
        }
    }
    var visualDividerThickness: CGFloat = 1
    var interactionThickness: CGFloat = 8 {
        didSet {
            guard oldValue != interactionThickness else { return }
            invalidateDividerCursorRects()
        }
    }
    var dragStateChanged: ((Bool) -> Void)?
    var dividerFillColor: NSColor = .separatorColor {
        didSet { needsDisplay = true }
    }

    override var dividerThickness: CGFloat {
        customDividerThickness
    }

    override func layout() {
        super.layout()
        invalidateDividerCursorRects()
    }

    override func resetCursorRects() {
        super.resetCursorRects()
        discardCursorRects()

        for dividerIndex in 0..<max(subviews.count - 1, 0) {
            addCursorRect(
                interactionRect(for: dividerIndex),
                cursor: isVertical ? .resizeLeftRight : .resizeUpDown
            )
        }
    }

    override func mouseDown(with event: NSEvent) {
        let isDividerDrag = dividerIndex(at: convert(event.locationInWindow, from: nil)) != nil
        if isDividerDrag {
            dragStateChanged?(true)
        }
        super.mouseDown(with: event)
        if isDividerDrag {
            dragStateChanged?(false)
        }
    }

    override func drawDivider(in rect: NSRect) {
        let visibleThickness = max(1, min(visualDividerThickness, dividerThickness))
        let lineRect: NSRect
        if isVertical {
            lineRect = NSRect(
                x: rect.midX - (visibleThickness / 2),
                y: rect.minY,
                width: visibleThickness,
                height: rect.height
            )
        } else {
            lineRect = NSRect(
                x: rect.minX,
                y: rect.midY - (visibleThickness / 2),
                width: rect.width,
                height: visibleThickness
            )
        }
        dividerFillColor.setFill()
        lineRect.fill()
    }

    private func dividerRect(for dividerIndex: Int) -> NSRect {
        guard dividerIndex >= 0, dividerIndex < subviews.count - 1 else {
            return .zero
        }

        let leadingSubview = subviews[dividerIndex]
        if isVertical {
            return NSRect(
                x: leadingSubview.frame.maxX,
                y: 0,
                width: dividerThickness,
                height: bounds.height
            )
        }

        return NSRect(
            x: 0,
            y: leadingSubview.frame.maxY,
            width: bounds.width,
            height: dividerThickness
        )
    }

    private func dividerIndex(at point: NSPoint) -> Int? {
        for dividerIndex in 0..<max(subviews.count - 1, 0) {
            if interactionRect(for: dividerIndex).contains(point) {
                return dividerIndex
            }
        }
        return nil
    }

    private func interactionRect(for dividerIndex: Int) -> NSRect {
        let rect = dividerRect(for: dividerIndex)
        let expansion = max(0, (interactionThickness - dividerThickness) / 2)
        if isVertical {
            return rect.insetBy(dx: -expansion, dy: 0)
        }
        return rect.insetBy(dx: 0, dy: -expansion)
    }

    private func invalidateDividerCursorRects() {
        window?.invalidateCursorRects(for: self)
    }

    func interactionRect(forDividerAt dividerIndex: Int) -> NSRect {
        interactionRect(for: dividerIndex)
    }
}

final class EdgeToEdgeHostingView<Content: View>: NSHostingView<Content> {
    override var safeAreaInsets: NSEdgeInsets {
        .init()
    }
}
