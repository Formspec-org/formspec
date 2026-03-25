// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FormspecSwift",
    platforms: [
        .iOS(.v17),
        .macOS(.v14),
        .visionOS(.v1)
    ],
    products: [
        .library(name: "FormspecSwift", targets: ["FormspecSwift"]),
        .executable(name: "FormspecDemo", targets: ["FormspecDemo"]),
    ],
    targets: [
        .target(
            name: "FormspecSwift",
            resources: [.copy("Resources/formspec-engine.html")]
        ),
        .executableTarget(
            name: "FormspecDemo",
            dependencies: ["FormspecSwift"],
            path: "Sources/FormspecDemo"
        ),
        .testTarget(
            name: "FormspecSwiftTests",
            dependencies: ["FormspecSwift"],
            resources: [.copy("Fixtures")]
        ),
    ]
)
