// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentChat",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "AgentChat",
            path: "AgentChat"
        ),
    ]
)
