import Foundation

@MainActor
final class WindowLayoutStore: ObservableObject {
    @Published var sidebarWidth: CGFloat = 260
    @Published var editorWidthRatio: Double = 0.58
}
