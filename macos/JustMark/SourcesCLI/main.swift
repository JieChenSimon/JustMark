import AppKit
import Foundation
import JustMarkCore

@main
struct JustMarkCLI {
    static func main() async {
        let exitCode = await run(arguments: Array(CommandLine.arguments.dropFirst()))
        Foundation.exit(exitCode)
    }

    private static func run(arguments: [String]) async -> Int32 {
        guard let command = arguments.first else {
            return await launchApp(command: nil, appOverride: nil)
        }

        switch command {
        case "open":
            return await runOpen(arguments: Array(arguments.dropFirst()))
        case "new":
            return await runNew(arguments: Array(arguments.dropFirst()))
        case "render-html":
            return await runRenderHTML(arguments: Array(arguments.dropFirst()))
        case "render-pdf":
            return await runRenderPDF(arguments: Array(arguments.dropFirst()))
        case "--help", "-h", "help":
            printUsage()
            return 0
        case "--version", "-v", "version":
            return runVersion(arguments: Array(arguments.dropFirst()))
        default:
            return await runOpen(arguments: arguments)
        }
    }

    private static func runOpen(arguments: [String]) async -> Int32 {
        do {
            let parsed = try parseOpenInvocation(arguments)
            let command = JustMarkCLICommand.open(paths: parsed.paths, preview: parsed.preview)
            return await launchApp(command: command, appOverride: parsed.appURL)
        } catch CLIError.helpRequested {
            printOpenUsage()
            return 0
        } catch let error as CLIError {
            fputs("\(error.localizedDescription)\n", stderr)
            printOpenUsage()
            return 2
        } catch {
            fputs("Open failed: \(error.localizedDescription)\n", stderr)
            return 1
        }
    }

    private static func runNew(arguments: [String]) async -> Int32 {
        do {
            let parsed = try parseCommonOptions(arguments)
            let command = JustMarkCLICommand.new(preview: parsed.preview)
            return await launchApp(command: command, appOverride: parsed.appURL)
        } catch CLIError.helpRequested {
            printNewUsage()
            return 0
        } catch let error as CLIError {
            fputs("\(error.localizedDescription)\n", stderr)
            printNewUsage()
            return 2
        } catch {
            fputs("New failed: \(error.localizedDescription)\n", stderr)
            return 1
        }
    }

    private static func runRenderHTML(arguments: [String]) async -> Int32 {
        guard !arguments.isEmpty else {
            fputs("Missing input markdown file.\n", stderr)
            printRenderHTMLUsage()
            return 2
        }

        var inputPath: String?
        var outputPath: String?
        var index = 0

        while index < arguments.count {
            let argument = arguments[index]
            switch argument {
            case "--output", "-o":
                let valueIndex = index + 1
                guard valueIndex < arguments.count else {
                    fputs("Missing value for \(argument).\n", stderr)
                    return 2
                }
                outputPath = arguments[valueIndex]
                index += 2
            case "--help", "-h":
                printRenderHTMLUsage()
                return 0
            default:
                if inputPath == nil {
                    inputPath = argument
                    index += 1
                } else {
                    fputs("Unexpected argument: \(argument)\n", stderr)
                    printRenderHTMLUsage()
                    return 2
                }
            }
        }

        guard let inputPath else {
            fputs("Missing input markdown file.\n", stderr)
            printRenderHTMLUsage()
            return 2
        }

        do {
            let inputURL = URL(fileURLWithPath: inputPath)
            let markdown = try String(contentsOf: inputURL, encoding: .utf8)
            let html = try await PreviewEngine().renderHTML(markdown: markdown)

            if let outputPath {
                let outputURL = URL(fileURLWithPath: outputPath)
                try FileManager.default.createDirectory(
                    at: outputURL.deletingLastPathComponent(),
                    withIntermediateDirectories: true
                )
                try html.write(to: outputURL, atomically: true, encoding: .utf8)
            } else {
                FileHandle.standardOutput.write(Data(html.utf8))
            }

            return 0
        } catch {
            fputs("render-html failed: \(error.localizedDescription)\n", stderr)
            return 1
        }
    }

    private static func runRenderPDF(arguments: [String]) async -> Int32 {
        guard !arguments.isEmpty else {
            fputs("Missing input markdown file.\n", stderr)
            printRenderPDFUsage()
            return 2
        }

        var inputPath: String?
        var outputPath: String?
        var index = 0

        while index < arguments.count {
            let argument = arguments[index]
            switch argument {
            case "--output", "-o":
                let valueIndex = index + 1
                guard valueIndex < arguments.count else {
                    fputs("Missing value for \(argument).\n", stderr)
                    return 2
                }
                outputPath = arguments[valueIndex]
                index += 2
            case "--help", "-h":
                printRenderPDFUsage()
                return 0
            default:
                if inputPath == nil {
                    inputPath = argument
                    index += 1
                } else {
                    fputs("Unexpected argument: \(argument)\n", stderr)
                    printRenderPDFUsage()
                    return 2
                }
            }
        }

        guard let inputPath else {
            fputs("Missing input markdown file.\n", stderr)
            printRenderPDFUsage()
            return 2
        }

        guard let outputPath else {
            fputs("Missing output PDF path.\n", stderr)
            printRenderPDFUsage()
            return 2
        }

        do {
            let inputURL = URL(fileURLWithPath: inputPath)
            let outputURL = URL(fileURLWithPath: outputPath)
            let markdown = try String(contentsOf: inputURL, encoding: .utf8)
            let html = try await PreviewEngine().renderHTML(markdown: markdown)
            try FileManager.default.createDirectory(
                at: outputURL.deletingLastPathComponent(),
                withIntermediateDirectories: true
            )
            try await ExportService().exportPDF(
                html: html,
                baseURL: inputURL.deletingLastPathComponent(),
                destinationURL: outputURL
            )
            return 0
        } catch {
            fputs("render-pdf failed: \(error.localizedDescription)\n", stderr)
            return 1
        }
    }

    private static func runVersion(arguments: [String]) -> Int32 {
        guard arguments.isEmpty else {
            fputs("Unexpected argument: \(arguments.joined(separator: " "))\n", stderr)
            return 2
        }

        let appURL = try? locateAppBundle(appOverride: nil)
        let appBundle = appURL.flatMap(Bundle.init(url:))
        let appVersion = appBundle?.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String
        let appBuild = appBundle?.object(forInfoDictionaryKey: "CFBundleVersion") as? String

        print("justmark CLI")
        print("bundle id: \(JustMarkCLIConstants.bundleIdentifier)")
        if let appURL {
            print("app: \(appURL.path)")
        } else {
            print("app: not found")
        }
        if let appVersion {
            if let appBuild {
                print("app version: \(appVersion) (\(appBuild))")
            } else {
                print("app version: \(appVersion)")
            }
        }
        return 0
    }

    private static func parseOpenInvocation(_ arguments: [String]) throws -> OpenInvocation {
        let common = try parseCommonOptions(arguments)
        return OpenInvocation(
            paths: try common.rawPaths.map(resolveExistingPath),
            preview: common.preview,
            appURL: common.appURL
        )
    }

    private static func parseCommonOptions(_ arguments: [String]) throws -> ParsedOptions {
        var preview: JustMarkPreviewVisibility?
        var rawPaths: [String] = []
        var appPath: String?
        var index = 0

        while index < arguments.count {
            let argument = arguments[index]
            switch argument {
            case "--preview":
                preview = .show
                index += 1
            case "--no-preview":
                preview = .hide
                index += 1
            case "--app":
                let valueIndex = index + 1
                guard valueIndex < arguments.count else {
                    throw CLIError.missingValue(argument)
                }
                appPath = arguments[valueIndex]
                index += 2
            case "--help", "-h":
                throw CLIError.helpRequested
            default:
                if argument.hasPrefix("-") {
                    throw CLIError.unknownOption(argument)
                }
                rawPaths.append(argument)
                index += 1
            }
        }

        return ParsedOptions(
            rawPaths: rawPaths,
            preview: preview,
            appURL: try appPath.map(resolveAppPath)
        )
    }

    private static func resolveExistingPath(_ rawPath: String) throws -> URL {
        let expandedPath = (rawPath as NSString).expandingTildeInPath
        let path = URL(fileURLWithPath: expandedPath).standardizedFileURL
        guard FileManager.default.fileExists(atPath: path.path) else {
            throw CLIError.pathNotFound(rawPath)
        }
        return path
    }

    private static func resolveAppPath(_ rawPath: String) throws -> URL {
        var url = URL(fileURLWithPath: (rawPath as NSString).expandingTildeInPath).standardizedFileURL

        while url.path != "/" && url.pathExtension.caseInsensitiveCompare("app").rawValue != 0 {
            url.deleteLastPathComponent()
        }

        guard url.pathExtension.caseInsensitiveCompare("app").rawValue == 0 else {
            throw CLIError.invalidAppPath(rawPath)
        }

        guard FileManager.default.fileExists(atPath: url.path) else {
            throw CLIError.appNotFound(rawPath)
        }

        return url
    }

    private static func locateAppBundle(appOverride: URL?) throws -> URL {
        if let appOverride {
            return appOverride
        }

        if let configuredPath = ProcessInfo.processInfo.environment["JUSTMARK_APP_PATH"], !configuredPath.isEmpty {
            return try resolveAppPath(configuredPath)
        }

        if let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: JustMarkCLIConstants.bundleIdentifier) {
            return appURL
        }

        let installedURL = URL(fileURLWithPath: "/Applications/JustMark.app")
        if FileManager.default.fileExists(atPath: installedURL.path) {
            return installedURL
        }

        throw CLIError.appNotFound(JustMarkCLIConstants.bundleIdentifier)
    }

    private static func launchApp(command: JustMarkCLICommand?, appOverride: URL?) async -> Int32 {
        do {
            let appURL = try locateAppBundle(appOverride: appOverride)
            let configuration = NSWorkspace.OpenConfiguration()
            configuration.activates = true

            if let command {
                _ = try await open(urls: [command.url], withApplicationAt: appURL, configuration: configuration)
            } else {
                _ = try await openApplication(at: appURL, configuration: configuration)
            }
            return 0
        } catch {
            fputs("Launch failed: \(error.localizedDescription)\n", stderr)
            return 1
        }
    }

    private static func openApplication(
        at appURL: URL,
        configuration: NSWorkspace.OpenConfiguration
    ) async throws -> NSRunningApplication {
        try await withCheckedThrowingContinuation { continuation in
            NSWorkspace.shared.openApplication(at: appURL, configuration: configuration) { app, error in
                if let app {
                    continuation.resume(returning: app)
                } else {
                    continuation.resume(throwing: error ?? CLIError.launchFailed)
                }
            }
        }
    }

    private static func open(
        urls: [URL],
        withApplicationAt appURL: URL,
        configuration: NSWorkspace.OpenConfiguration
    ) async throws -> NSRunningApplication {
        try await withCheckedThrowingContinuation { continuation in
            NSWorkspace.shared.open(urls, withApplicationAt: appURL, configuration: configuration) { app, error in
                if let app {
                    continuation.resume(returning: app)
                } else {
                    continuation.resume(throwing: error ?? CLIError.launchFailed)
                }
            }
        }
    }

    private static func printUsage() {
        let usage = """
        Usage:
          justmark [path ...] [--preview | --no-preview] [--app <JustMark.app>]
          justmark open [path ...] [--preview | --no-preview] [--app <JustMark.app>]
          justmark new [--preview | --no-preview] [--app <JustMark.app>]
          justmark render-html <input.md> [--output <output.html>]
          justmark render-pdf <input.md> --output <output.pdf>
          justmark version
          justmark help
        """
        print(usage)
    }

    private static func printOpenUsage() {
        let usage = """
        Usage:
          justmark [path ...] [--preview | --no-preview] [--app <JustMark.app>]
          justmark open [path ...] [--preview | --no-preview] [--app <JustMark.app>]
        """
        print(usage)
    }

    private static func printNewUsage() {
        let usage = """
        Usage:
          justmark new [--preview | --no-preview] [--app <JustMark.app>]
        """
        print(usage)
    }

    private static func printRenderHTMLUsage() {
        let usage = """
        Usage:
          justmark render-html <input.md> [--output <output.html>]
        """
        print(usage)
    }

    private static func printRenderPDFUsage() {
        let usage = """
        Usage:
          justmark render-pdf <input.md> --output <output.pdf>
        """
        print(usage)
    }

    private struct ParsedOptions {
        let rawPaths: [String]
        let preview: JustMarkPreviewVisibility?
        let appURL: URL?
    }

    private struct OpenInvocation {
        let paths: [URL]
        let preview: JustMarkPreviewVisibility?
        let appURL: URL?
    }

    private enum CLIError: LocalizedError {
        case missingValue(String)
        case unknownOption(String)
        case pathNotFound(String)
        case invalidAppPath(String)
        case appNotFound(String)
        case launchFailed
        case helpRequested

        var errorDescription: String? {
            switch self {
            case let .missingValue(option):
                return "Missing value for \(option)."
            case let .unknownOption(option):
                return "Unknown option: \(option)"
            case let .pathNotFound(path):
                return "Path not found: \(path)"
            case let .invalidAppPath(path):
                return "Expected a .app bundle path, got: \(path)"
            case let .appNotFound(path):
                return "JustMark app not found: \(path)"
            case .launchFailed:
                return "The JustMark launch request did not return a running application."
            case .helpRequested:
                return "Help requested."
            }
        }
    }
}
