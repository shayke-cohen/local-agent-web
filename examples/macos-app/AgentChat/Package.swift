// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AgentChat",
    platforms: [.macOS(.v14)],
    targets: [
        .target(
            name: "AgentChatLib",
            path: "Sources/AgentChatLib"
        ),
        .executableTarget(
            name: "AgentChat",
            dependencies: ["AgentChatLib"],
            path: "AgentChat",
            exclude: ["Info.plist"]
        ),
        .testTarget(
            name: "AgentChatTests",
            dependencies: ["AgentChatLib"],
            path: "Tests"
        ),
    ]
)
