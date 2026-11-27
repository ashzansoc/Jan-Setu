import Foundation
import Capacitor
import GoogleSignIn

/// Hands the web layer a Google ID token using the system account picker.
///
/// Google refuses to run OAuth inside an embedded WebView, so the JS Firebase
/// popup/redirect flow can never complete on a native build. This plugin runs
/// the real GoogleSignIn-iOS flow instead and the caller exchanges the returned
/// ID token with `signInWithCredential`.
@objc(JansetuGoogleSignIn)
public class JansetuGoogleSignIn: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "JansetuGoogleSignIn"
    public let jsName = "JansetuGoogleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signOut", returnType: CAPPluginReturnPromise)
    ]

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenting = self.bridge?.viewController else {
                call.reject("No view controller available to present Google sign-in.")
                return
            }

            // The client ID lives in the app's Info.plist (GIDClientID) so the
            // native config and the web config cannot drift apart silently.
            if GIDSignIn.sharedInstance.configuration == nil,
               let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String {
                GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            }

            GIDSignIn.sharedInstance.signIn(withPresenting: presenting) { result, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard let user = result?.user else {
                    call.reject("Google sign-in returned no user.")
                    return
                }
                guard let idToken = user.idToken?.tokenString else {
                    call.reject("Google sign-in returned no ID token.")
                    return
                }
                call.resolve([
                    "idToken": idToken,
                    "accessToken": user.accessToken.tokenString,
                    "userId": user.userID ?? "",
                    "email": user.profile?.email ?? "",
                    "name": user.profile?.name ?? ""
                ])
            }
        }
    }

    @objc func signOut(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            GIDSignIn.sharedInstance.signOut()
            call.resolve()
        }
    }
}