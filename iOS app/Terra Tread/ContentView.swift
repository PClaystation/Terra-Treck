//
//  ContentView.swift
//  Terra Tread
//
//  Created by Charlie Arnerstål on 2025-06-11.
//

import SwiftUI
import UIKit
import WebKit

struct EmbeddedStepPayload: Encodable {
    let type = "stepSync"
    let todaySteps: Int
    let dayKey: String
    let platform = "ios-app"
}

private struct EmbeddedWebContext: Encodable {
    let platform = "ios-app"
    let embedded = true
    let syncMode = "native-step-total"
    let allowsWebAuth: Bool
    let authApiBaseUrl: String
    let gameApiBaseUrl: String
    let loginPopupUrl: String
    let websiteBaseUrl: String
}

private struct EmbeddedWebConfiguration {
    let websiteBaseURL: URL?
    let authApiBaseURL: String
    let gameApiBaseURL: String
    let loginPopupURL: String

    var allowsWebAuth: Bool {
        websiteBaseURL != nil
    }

    static let current = EmbeddedWebConfiguration(bundle: .main)

    init(bundle: Bundle) {
        let fallbackWebsiteURL = URL(string: "https://mpmc.ddns.net:3000/index.html")
        let fallbackAuthAPIBaseURL = "https://auth.continental-hub.com"
        let fallbackGameAPIBaseURL = "https://mpmc.ddns.net:3000"
        let fallbackLoginPopupURL = "https://login.continental-hub.com/popup.html"

        websiteBaseURL = Self.urlValue(forKey: "TerraTreadWebsiteBaseURL", bundle: bundle) ?? fallbackWebsiteURL
        authApiBaseURL = Self.stringValue(forKey: "TerraTreadAuthAPIBaseURL", bundle: bundle) ?? fallbackAuthAPIBaseURL
        gameApiBaseURL = Self.stringValue(forKey: "TerraTreadGameAPIBaseURL", bundle: bundle) ?? fallbackGameAPIBaseURL
        loginPopupURL = Self.stringValue(forKey: "TerraTreadLoginPopupURL", bundle: bundle) ?? fallbackLoginPopupURL
    }

    var bootstrapScript: String {
        let context = EmbeddedWebContext(
            allowsWebAuth: allowsWebAuth,
            authApiBaseUrl: authApiBaseURL,
            gameApiBaseUrl: gameApiBaseURL,
            loginPopupUrl: loginPopupURL,
            websiteBaseUrl: websiteBaseURL?.absoluteString ?? ""
        )
        let contextJSON = (try? encodeJSON(context)) ?? "{}"
        let authJSON = encodeJSONString(authApiBaseURL)
        let gameJSON = encodeJSONString(gameApiBaseURL)
        let popupJSON = encodeJSONString(loginPopupURL)

        return """
        window.__TERRA_TREAD_CONTEXT__ = Object.freeze(\(contextJSON));
        window.__API_BASE_URL__ = \(authJSON);
        window.__GAME_API_BASE_URL__ = \(gameJSON);
        window.__LOGIN_POPUP_URL__ = \(popupJSON);
        window.terraTreadNative = window.terraTreadNative || {
          receive: function(payload) {
            window.dispatchEvent(new CustomEvent("terra-tread-native", { detail: payload }));
          }
        };
        """
    }

    private static func stringValue(forKey key: String, bundle: Bundle) -> String? {
        guard let value = bundle.object(forInfoDictionaryKey: key) as? String else {
            return nil
        }

        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private static func urlValue(forKey key: String, bundle: Bundle) -> URL? {
        guard let stringValue = stringValue(forKey: key, bundle: bundle) else {
            return nil
        }

        return URL(string: stringValue)
    }

    private func encodeJSON<T: Encodable>(_ value: T) throws -> String {
        let data = try JSONEncoder().encode(value)
        return String(decoding: data, as: UTF8.self)
    }

    private func encodeJSONString(_ value: String) -> String {
        (try? encodeJSON(value)) ?? "\"\""
    }
}

struct WebView: UIViewRepresentable {
    let todaySteps: Int
    let dayKey: String
    private let embeddedConfig = EmbeddedWebConfiguration.current

    func makeCoordinator() -> Coordinator {
        Coordinator(config: embeddedConfig)
    }

    func makeUIView(context: Context) -> WKWebView {
        let contentController = WKUserContentController()
        contentController.addUserScript(
            WKUserScript(
                source: embeddedConfig.bootstrapScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        contentController.add(context.coordinator, name: "terraTread")

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = contentController
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = .clear

        context.coordinator.attach(to: webView)
        context.coordinator.loadEmbeddedSiteIfNeeded()
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.latestPayload = EmbeddedStepPayload(
            todaySteps: todaySteps,
            dayKey: dayKey
        )
        context.coordinator.pushLatestPayloadIfPossible()
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "terraTread")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        private let config: EmbeddedWebConfiguration

        weak var webView: WKWebView?
        var hasLoadedInitialPage = false
        var pageReady = false
        var latestPayload = EmbeddedStepPayload(todaySteps: 0, dayKey: "")
        var didAttemptHostedLoad = false
        var isUsingBundledFallback = false

        init(config: EmbeddedWebConfiguration) {
            self.config = config
        }

        func attach(to webView: WKWebView) {
            self.webView = webView
        }

        func loadEmbeddedSiteIfNeeded() {
            guard !hasLoadedInitialPage else {
                return
            }

            hasLoadedInitialPage = true
            loadPreferredSite()
        }

        func pushLatestPayloadIfPossible() {
            guard pageReady, let webView else {
                return
            }

            guard
                let data = try? JSONEncoder().encode(latestPayload),
                let json = String(data: data, encoding: .utf8)
            else {
                return
            }

            webView.evaluateJavaScript("window.terraTreadNative.receive(\(json));") { _, error in
                if let error {
                    print("Failed to push Terra Tread app state into the web view: \(error.localizedDescription)")
                }
            }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "terraTread" else {
                return
            }

            guard let body = message.body as? [String: Any] else {
                pageReady = true
                pushLatestPayloadIfPossible()
                return
            }

            let messageType = (body["type"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if messageType == "ready" || messageType == "requestSteps" {
                pageReady = true
                pushLatestPayloadIfPossible()
            }
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            pageReady = false
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            pageReady = true
            pushLatestPayloadIfPossible()
        }

        func webView(
            _ webView: WKWebView,
            didFail navigation: WKNavigation!,
            withError error: Error
        ) {
            fallbackToBundledSiteIfNeeded(failingURL: webView.url, error: error)
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            fallbackToBundledSiteIfNeeded(failingURL: webView.url, error: error)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            presentDialog(title: "Terra Tread", message: message) {
                completionHandler()
            } actions: { controller in
                controller.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                    completionHandler()
                })
            }
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            presentDialog(title: "Terra Tread", message: message) {
                completionHandler(false)
            } actions: { controller in
                controller.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
                    completionHandler(false)
                })
                controller.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                    completionHandler(true)
                })
            }
        }

        private func loadPreferredSite() {
            guard let webView else {
                return
            }

            if let websiteBaseURL = config.websiteBaseURL {
                didAttemptHostedLoad = true
                isUsingBundledFallback = false
                let request = URLRequest(
                    url: websiteBaseURL,
                    cachePolicy: .reloadIgnoringLocalCacheData,
                    timeoutInterval: 20
                )
                webView.load(request)
                return
            }

            loadBundledSite()
        }

        private func loadBundledSite() {
            guard let webView else {
                return
            }

            isUsingBundledFallback = true

            guard let indexURL = Bundle.main.url(
                forResource: "index",
                withExtension: "html",
                subdirectory: "WebApp"
            ) else {
                webView.loadHTMLString(
                    """
                    <!doctype html>
                    <html lang="en">
                    <body style="font-family:-apple-system; padding:24px;">
                      <h1>Terra Tread</h1>
                      <p>The bundled web app was not found in the app resources.</p>
                    </body>
                    </html>
                    """,
                    baseURL: nil
                )
                return
            }

            let webAppDirectory = indexURL.deletingLastPathComponent()
            webView.loadFileURL(indexURL, allowingReadAccessTo: webAppDirectory)
        }

        private func fallbackToBundledSiteIfNeeded(failingURL: URL?, error: Error) {
            guard let hostedURL = config.websiteBaseURL, didAttemptHostedLoad, !isUsingBundledFallback else {
                return
            }

            let failingHost = failingURL?.host
            if failingHost == nil || failingHost == hostedURL.host {
                print("Hosted Terra Tread site failed to load, falling back to the bundled site: \(error.localizedDescription)")
                loadBundledSite()
            }
        }

        private func presentDialog(
            title: String,
            message: String,
            fallback: @escaping () -> Void,
            actions: (UIAlertController) -> Void
        ) {
            DispatchQueue.main.async {
                guard let viewController = UIApplication.shared.topViewController() else {
                    fallback()
                    return
                }

                let controller = UIAlertController(title: title, message: message, preferredStyle: .alert)
                actions(controller)
                viewController.present(controller, animated: true)
            }
        }
    }
}

struct ContentView: View {
    @State private var steps = 0

    private let healthManager = HealthManager()
    private let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        WebView(todaySteps: steps, dayKey: formattedDate(Date()))
            .ignoresSafeArea()
            .onAppear {
                healthManager.requestAuthorization { authorized in
                    if authorized {
                        updateSteps()
                    }
                }
            }
            .onReceive(timer) { _ in
                updateSteps()
            }
    }

    private func updateSteps() {
        healthManager.getTodayStepCount { count in
            DispatchQueue.main.async {
                steps = Int(count.rounded())
            }
        }
    }

    private func formattedDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

private extension UIApplication {
    func topViewController(
        base: UIViewController? = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first(where: \.isKeyWindow)?
            .rootViewController
    ) -> UIViewController? {
        if let navigationController = base as? UINavigationController {
            return topViewController(base: navigationController.visibleViewController)
        }

        if let tabBarController = base as? UITabBarController, let selectedViewController = tabBarController.selectedViewController {
            return topViewController(base: selectedViewController)
        }

        if let presentedViewController = base?.presentedViewController {
            return topViewController(base: presentedViewController)
        }

        return base
    }
}
