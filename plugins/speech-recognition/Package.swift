// swift-tools-version: 5.9
import PackageDescription

// Local copy of @capacitor-community/speech-recognition. The published package
// ships only a CocoaPods podspec, which the SPM-based Capacitor 8 project cannot
// link, so the plugin is vendored here with a manifest.
let package = Package(
    name: "CapacitorCommunitySpeechRecognition",
    platforms: [.iOS(.v14)],
    products: [
        .library(
            name: "CapacitorCommunitySpeechRecognition",
            targets: ["SpeechRecognitionPlugin"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.2")
    ],
    targets: [
        .target(
            name: "SpeechRecognitionPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin"
        )
    ]
)