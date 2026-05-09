import Foundation

struct AppConfiguration {
    static let current = AppConfiguration(bundle: .main)

    let remoteWebURL: URL?
    let gameAPIBaseURL: URL?
    let authAPIBaseURL: URL?
    let loginPopupURL: URL?
    let allowsWebAuth: Bool

    init(bundle: Bundle) {
        remoteWebURL = Self.makeURL(from: bundle.string(for: "TERRA_TREAD_WEB_URL"))
        gameAPIBaseURL = Self.makeURL(from: bundle.string(for: "TERRA_TREAD_GAME_API_BASE_URL"))
        authAPIBaseURL = Self.makeURL(from: bundle.string(for: "TERRA_TREAD_AUTH_API_BASE_URL"))
        loginPopupURL = Self.makeURL(from: bundle.string(for: "TERRA_TREAD_LOGIN_POPUP_URL"))
        allowsWebAuth = Self.makeBool(from: bundle.string(for: "TERRA_TREAD_ALLOW_WEB_AUTH"), defaultValue: true)
    }

    func bridgeContext(allowsWebAuth: Bool, contentMode: String) -> WebBridgeContext {
        WebBridgeContext(
            platform: "ios-app",
            allowsWebAuth: allowsWebAuth,
            contentMode: contentMode,
            authAPIBaseURL: authAPIBaseURL?.absoluteString,
            gameAPIBaseURL: gameAPIBaseURL?.absoluteString,
            loginPopupURL: loginPopupURL?.absoluteString,
            appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String,
            buildNumber: Bundle.main.object(forInfoDictionaryKey: kCFBundleVersionKey as String) as? String
        )
    }

    var trustedHosts: Set<String> {
        [
            remoteWebURL?.host,
            gameAPIBaseURL?.host,
            authAPIBaseURL?.host,
            loginPopupURL?.host,
            "continental-hub.com",
            "auth.continental-hub.com",
            "login.continental-hub.com",
            "dashboard.continental-hub.com",
            "grimoire.continental-hub.com",
            "api.continental-hub.com",
            "id.continental-hub.com",
            "backend.continental-hub.com",
            "mpmc.ddns.net",
            "localhost",
            "127.0.0.1",
        ]
        .compactMap { value in
            guard let value else { return nil }
            let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            return normalized.isEmpty ? nil : normalized
        }
        .reduce(into: Set<String>()) { partialResult, host in
            partialResult.insert(host)
        }
    }

    private static func makeURL(from value: String?) -> URL? {
        let normalized = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return nil
        }
        return URL(string: normalized)
    }

    private static func makeBool(from value: String?, defaultValue: Bool) -> Bool {
        guard let normalized = value?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased(),
              !normalized.isEmpty else {
            return defaultValue
        }

        switch normalized {
        case "1", "true", "yes":
            return true
        case "0", "false", "no":
            return false
        default:
            return defaultValue
        }
    }
}

private extension Bundle {
    func string(for key: String) -> String? {
        object(forInfoDictionaryKey: key) as? String
    }
}

struct WebBridgeContext: Encodable {
    let platform: String
    let allowsWebAuth: Bool
    let contentMode: String
    let authAPIBaseURL: String?
    let gameAPIBaseURL: String?
    let loginPopupURL: String?
    let appVersion: String?
    let buildNumber: String?

    enum CodingKeys: String, CodingKey {
        case platform
        case allowsWebAuth
        case contentMode
        case authAPIBaseURL = "authApiBaseUrl"
        case gameAPIBaseURL = "gameApiBaseUrl"
        case loginPopupURL = "loginPopupUrl"
        case appVersion
        case buildNumber
    }
}
