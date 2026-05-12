import SwiftUI
import UIKit
import WebKit

struct AuthWebSheet: View {
    let configuration: AppConfiguration
    let onCancel: () -> Void
    let onSuccess: (AuthenticatedUser) -> Void

    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var controller: AuthWebController
    @State private var errorMessage = ""
    @State private var isCompleting = false

    init(
        configuration: AppConfiguration,
        onCancel: @escaping () -> Void,
        onSuccess: @escaping (AuthenticatedUser) -> Void
    ) {
        self.configuration = configuration
        self.onCancel = onCancel
        self.onSuccess = onSuccess
        _controller = StateObject(
            wrappedValue: AuthWebController(
                startURL: configuration.effectiveNativeLoginURL,
                authBaseURL: configuration.effectiveAuthAPIBaseURL
            )
        )
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 10) {
                    Label("Continental ID Sign-In", systemImage: "person.crop.circle.badge.checkmark")
                        .font(.headline)
                        .foregroundStyle(Color(red: 0.16, green: 0.23, blue: 0.22))

                    Text("Complete the provider login in the embedded browser. Terra Tread will detect the finished session here before it imports your profile.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let detectedUser = controller.detectedUser {
                        Text("Authenticated as \(detectedUser.label).")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(Color(red: 0.09, green: 0.47, blue: 0.31))
                    } else if !controller.navigationStatusMessage.isEmpty {
                        Text(controller.navigationStatusMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    if !errorMessage.isEmpty {
                        Text(errorMessage)
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.red)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(20)
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(.thinMaterial)
                )
                .padding(.horizontal, 16)
                .padding(.top, 12)

                AuthWebView(controller: controller)
                    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 28, style: .continuous)
                            .strokeBorder(.white.opacity(0.18))
                    )
                    .overlay {
                        if controller.isLoading {
                            ProgressView("Loading Continental ID…")
                                .padding(.horizontal, 20)
                                .padding(.vertical, 14)
                                .background(.ultraThinMaterial, in: Capsule())
                        }
                    }
                    .padding(16)
            }
            .background(
                LinearGradient(
                    colors: [
                        Color(red: 0.87, green: 0.94, blue: 0.93),
                        Color(red: 0.79, green: 0.88, blue: 0.84),
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
            )
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close", action: onCancel)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Reload") {
                        errorMessage = ""
                        controller.reload()
                    }
                    .disabled(controller.isLoading)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task {
                            await finishSignIn()
                        }
                    } label: {
                        if isCompleting {
                            ProgressView()
                                .controlSize(.small)
                        } else {
                            Text(controller.detectedUser == nil ? "Finish Sign-In" : "Continue")
                        }
                    }
                    .disabled(isCompleting || !controller.canAttemptSignIn)
                }
            }
        }
        .onChange(of: scenePhase) { _, newValue in
            guard newValue == .active else {
                return
            }

            Task {
                await controller.refreshAuthenticationStatus(silent: true)
            }
        }
    }

    private func finishSignIn() async {
        isCompleting = true
        defer { isCompleting = false }

        do {
            let user = try await controller.completeAuthentication()
            errorMessage = ""
            onSuccess(user)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct AuthWebView: UIViewRepresentable {
    @ObservedObject var controller: AuthWebController

    func makeUIView(context: Context) -> WKWebView {
        controller.webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

@MainActor
final class AuthWebController: NSObject, ObservableObject, WKNavigationDelegate {
    let webView: WKWebView

    @Published private(set) var isLoading = false
    @Published private(set) var canAttemptSignIn = false
    @Published private(set) var detectedUser: AuthenticatedUser?
    @Published private(set) var navigationStatusMessage = ""

    private let authBaseURL: URL?
    private let startURL: URL?
    private var sessionRefreshTask: Task<Void, Never>?

    init(startURL: URL?, authBaseURL: URL?) {
        self.startURL = startURL
        self.authBaseURL = authBaseURL

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.applicationNameForUserAgent = "TerraTreadNative/1.0"

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true
        self.webView = webView

        super.init()

        webView.navigationDelegate = self
        webView.uiDelegate = self

        if let startURL {
            webView.load(URLRequest(url: startURL))
        }

        updateNavigationState()
    }

    func completeAuthentication() async throws -> AuthenticatedUser {
        if let detectedUser {
            return detectedUser
        }

        guard let authBaseURL else {
            throw BackendClientError.missingBaseURL
        }

        let script = makeAuthenticationScript(authBaseURL: authBaseURL)
        let jsonString = try await webView.evaluateJavaScriptString(script)
        guard let data = jsonString.data(using: .utf8) else {
            throw BackendClientError.invalidResponse
        }

        struct Payload: Decodable {
            let ok: Bool
            let error: String?
            let user: AuthenticatedUser?
        }

        let payload = try JSONDecoder().decode(Payload.self, from: data)
        guard payload.ok, let user = payload.user, !user.userId.isEmpty else {
            throw BackendClientError.requestFailed(payload.error ?? "Sign-in did not produce a usable player profile.")
        }

        detectedUser = user
        return user
    }

    func reload() {
        if webView.url == nil, let startURL {
            webView.load(URLRequest(url: startURL))
        } else {
            webView.reload()
        }
    }

    func refreshAuthenticationStatus(silent: Bool) async {
        guard authBaseURL != nil else {
            return
        }

        guard shouldAllowSessionCheck(for: webView.url) else {
            updateNavigationState()
            return
        }

        do {
            let user = try await completeAuthentication()
            detectedUser = user
            navigationStatusMessage = "Continental ID is ready to import."
        } catch {
            detectedUser = nil
            if !silent {
                navigationStatusMessage = error.localizedDescription
            } else if shouldExplainCurrentPage(webView.url) {
                navigationStatusMessage = "Finish the provider sign-in flow, then continue here."
            } else {
                navigationStatusMessage = ""
            }
        }

        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        isLoading = true
        detectedUser = nil
        navigationStatusMessage = ""
        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isLoading = false
        updateNavigationState()
        queueSilentSessionRefresh()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        isLoading = false
        navigationStatusMessage = error.localizedDescription
        updateNavigationState()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        isLoading = false
        navigationStatusMessage = error.localizedDescription
        updateNavigationState()
    }

    private func queueSilentSessionRefresh() {
        sessionRefreshTask?.cancel()
        sessionRefreshTask = Task { [weak self] in
            guard let self else {
                return
            }

            try? await Task.sleep(for: .milliseconds(350))
            guard !Task.isCancelled else {
                return
            }

            await self.refreshAuthenticationStatus(silent: true)
        }
    }

    private func updateNavigationState() {
        canAttemptSignIn = !isLoading && authBaseURL != nil && shouldAllowSessionCheck(for: webView.url)
    }

    private func shouldAllowSessionCheck(for url: URL?) -> Bool {
        guard let host = url?.host?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() else {
            return false
        }

        return ContinentalAuthSessionStore.trustedHosts.contains(where: { host == $0 || host.hasSuffix(".\($0)") })
    }

    private func shouldExplainCurrentPage(_ url: URL?) -> Bool {
        guard let host = url?.host?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !host.isEmpty else {
            return false
        }

        return !shouldAllowSessionCheck(for: url)
    }

    private func makeAuthenticationScript(authBaseURL: URL) -> String {
        let baseURL = authBaseURL.absoluteString.jsQuoted()
        return """
        (async () => {
          const authBase = \(baseURL);
          try {
            const refreshResponse = await fetch(`${authBase}/api/auth/refresh_token`, {
              method: "POST",
              credentials: "include"
            });
            const refreshPayload = await refreshResponse.json().catch(() => ({}));
            const token = String(refreshPayload.accessToken || refreshPayload.token || "").trim();

            if (!refreshResponse.ok && refreshPayload.authenticated === false) {
              return JSON.stringify({
                ok: false,
                error: String(refreshPayload.message || `HTTP ${refreshResponse.status}`)
              });
            }

            if (!token) {
              return JSON.stringify({
                ok: false,
                error: String(refreshPayload.message || "No active Continental ID session was found.")
              });
            }

            const meResponse = await fetch(`${authBase}/api/auth/me`, {
              credentials: "include",
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });
            const mePayload = await meResponse.json().catch(() => ({}));

            if (!meResponse.ok) {
              return JSON.stringify({
                ok: false,
                error: String(mePayload.message || `HTTP ${meResponse.status}`)
              });
            }

            const user = mePayload.user || mePayload || {};
            return JSON.stringify({
              ok: true,
              user: {
                userId: String(user.userId || user.continentalId || "").trim(),
                continentalId: String(user.continentalId || user.userId || "").trim(),
                username: String(user.username || "").trim(),
                displayName: String(user.displayName || "").trim(),
                email: String(user.email || "").trim()
              }
            });
          } catch (error) {
            return JSON.stringify({
              ok: false,
              error: String(error && error.message ? error.message : error)
            });
          }
        })();
        """
    }
}

extension AuthWebController: WKUIDelegate {
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
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url,
              let scheme = url.scheme?.lowercased() else {
            decisionHandler(.allow)
            return
        }

        if scheme == "http" || scheme == "https" {
            decisionHandler(.allow)
            return
        }

        UIApplication.shared.open(url)
        decisionHandler(.cancel)
    }
}

private extension String {
    func jsQuoted() -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: [self]),
              let string = String(data: data, encoding: .utf8) else {
            return "\"\""
        }

        return String(string.dropFirst().dropLast())
    }
}

private extension WKWebView {
    func evaluateJavaScriptString(_ script: String) async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            evaluateJavaScript(script) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let string = result as? String {
                    continuation.resume(returning: string)
                } else {
                    continuation.resume(throwing: BackendClientError.invalidResponse)
                }
            }
        }
    }
}

@MainActor
enum ContinentalAuthSessionStore {
    static let trustedHosts = [
        "continental-hub.com",
        "auth.continental-hub.com",
        "dashboard.continental-hub.com",
        "login.continental-hub.com",
        "api.continental-hub.com",
        "id.continental-hub.com",
    ]

    static func clearSession() async {
        let dataStore = WKWebsiteDataStore.default()
        let recordTypes = WKWebsiteDataStore.allWebsiteDataTypes()

        let records = await withCheckedContinuation { continuation in
            dataStore.fetchDataRecords(ofTypes: recordTypes) { records in
                continuation.resume(returning: records)
            }
        }

        let matchingRecords = records.filter { record in
            let displayName = record.displayName.lowercased()
            return trustedHosts.contains(where: { displayName == $0 || displayName.hasSuffix(".\($0)") || $0.hasSuffix(".\(displayName)") })
        }

        if !matchingRecords.isEmpty {
            await withCheckedContinuation { continuation in
                dataStore.removeData(ofTypes: recordTypes, for: matchingRecords) {
                    continuation.resume()
                }
            }
        }

        let cookies = await withCheckedContinuation { continuation in
            dataStore.httpCookieStore.getAllCookies { cookies in
                continuation.resume(returning: cookies)
            }
        }

        for cookie in cookies where trustedHosts.contains(where: { cookie.domain.lowercased().contains($0) }) {
            await withCheckedContinuation { continuation in
                dataStore.httpCookieStore.delete(cookie) {
                    continuation.resume()
                }
            }
        }
    }
}
