// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "FocusPill",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(name: "FocusPill", path: "Sources/FocusPill")
    ]
)
