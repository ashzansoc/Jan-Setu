// swift-tools-version: 5.9
import PackageDescription

// Local copy of a Google Sign-In bridge for JANSETU. The published plugins
// (@codetrix-studio/capacitor-google-auth, @capgo/capacitor-social-login) ship
// only a CocoaPods podspec, which the SPM-based Capacitor 8 project cannot link,
// and both drag in the Facebook SDK. This one depends on GoogleSignIn-iOS only
// and returns the ID token so the web layer can exchange it with Firebase.
let package = Package(
    name: "JansetuGoogleSignIn",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "JansetuGoogleSignIn",
            targets: ["GoogleSignInPlugin"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "8.6.2"),
        .package(url: "https://github.com/google/GoogleSignIn-iOS.git", .upToNextMajor(from: "9.0.0"))
    ],
    targets: [
        .target(
            name: "GoogleSignInPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS")
            ],
            path: "ios/Plugin"
        )
    ]
)