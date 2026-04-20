// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "JustMarkNative",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .library(name: "JustMarkCore", targets: ["JustMarkCore"]),
        .executable(name: "JustMarkNative", targets: ["JustMarkNative"]),
        .executable(name: "justmark", targets: ["JustMarkCLI"])
    ],
    dependencies: [
        .package(url: "https://github.com/stackotter/Down-gfm", from: "0.12.0")
    ],
    targets: [
        .target(
            name: "JustMarkCore",
            dependencies: [
                .product(name: "Down", package: "Down-gfm")
            ],
            path: "Sources",
            sources: [
                "Core/JustMarkCLIProtocol.swift",
                "Preview/PreviewEngine.swift",
                "SystemIntegration/ExportService.swift"
            ]
        ),
        .executableTarget(
            name: "JustMarkNative",
            dependencies: ["JustMarkCore"],
            path: "Sources",
            exclude: [
                "Core/JustMarkCLIProtocol.swift",
                "Preview/PreviewEngine.swift",
                "SystemIntegration/ExportService.swift"
            ],
            resources: [
                .process("../Resources/Assets.xcassets"),
                .process("../Resources/JustMark.icns")
            ]
        ),
        .executableTarget(
            name: "JustMarkCLI",
            dependencies: ["JustMarkCore"],
            path: "SourcesCLI"
        )
    ]
)
