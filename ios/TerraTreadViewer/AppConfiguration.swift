import Foundation

struct AppConfiguration {
    static let current = AppConfiguration(bundle: .main)

    let gameAPIBaseURL: URL?
    let authAPIBaseURL: URL?
    let loginPopupURL: URL?
    let allowsWebAuth: Bool

    init(bundle: Bundle) {
        gameAPIBaseURL = Self.makeReachableURL(from: bundle.string(for: "TERRA_TREAD_GAME_API_BASE_URL"))
        authAPIBaseURL = Self.makeURL(from: bundle.string(for: "TERRA_TREAD_AUTH_API_BASE_URL"))
        loginPopupURL = Self.makeURL(from: bundle.string(for: "TERRA_TREAD_LOGIN_POPUP_URL"))
        allowsWebAuth = Self.makeBool(from: bundle.string(for: "TERRA_TREAD_ALLOW_WEB_AUTH"), defaultValue: true)
    }

    var effectiveGameAPIBaseURL: URL? {
        gameAPIBaseURL
    }

    var effectiveAuthAPIBaseURL: URL? {
        authAPIBaseURL ?? URL(string: "https://auth.continental-hub.com")
    }

    var effectiveLoginPopupURL: URL? {
        loginPopupURL ?? URL(string: "https://login.continental-hub.com/popup.html")
    }

    var effectiveNativeLoginURL: URL? {
        guard let popupURL = effectiveLoginPopupURL,
              var components = URLComponents(url: popupURL, resolvingAgainstBaseURL: false) else {
            return effectiveLoginPopupURL
        }

        let trustedOrigin = popupURL.originString ?? "https://login.continental-hub.com"
        let redirectTarget = popupURL.absoluteString
        var queryItems = components.queryItems ?? []

        upsertQueryItem(named: "origin", value: trustedOrigin, into: &queryItems)
        upsertQueryItem(named: "redirect", value: redirectTarget, into: &queryItems)

        if let authBaseURL = effectiveAuthAPIBaseURL?.absoluteString {
            upsertQueryItem(named: "apiBaseUrl", value: authBaseURL, into: &queryItems)
        }

        if let gameBaseURL = effectiveGameAPIBaseURL?.absoluteString {
            upsertQueryItem(named: "gameApiBaseUrl", value: gameBaseURL, into: &queryItems)
        }

        components.queryItems = queryItems
        return components.url
    }

    var canAuthenticateInApp: Bool {
        allowsWebAuth && effectiveAuthAPIBaseURL != nil && effectiveNativeLoginURL != nil
    }

    private static func makeURL(from value: String?) -> URL? {
        let normalized = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else {
            return nil
        }
        return URL(string: normalized)
    }

    private static func makeReachableURL(from value: String?) -> URL? {
        guard let url = makeURL(from: value) else {
            return nil
        }

        guard shouldAllowLoopbackURL(url) else {
            return nil
        }

        return url
    }

    private static func shouldAllowLoopbackURL(_ url: URL) -> Bool {
        guard let host = url.host?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() else {
            return true
        }

        guard host == "localhost" || host == "127.0.0.1" else {
            return true
        }

#if targetEnvironment(simulator)
        return true
#else
        return false
#endif
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

    private func upsertQueryItem(named name: String, value: String, into queryItems: inout [URLQueryItem]) {
        if let index = queryItems.firstIndex(where: { $0.name == name }) {
            queryItems[index] = URLQueryItem(name: name, value: value)
        } else {
            queryItems.append(URLQueryItem(name: name, value: value))
        }
    }
}

private extension Bundle {
    func string(for key: String) -> String? {
        object(forInfoDictionaryKey: key) as? String
    }
}

private extension URL {
    var originString: String? {
        guard let scheme, let host else {
            return nil
        }

        if let port {
            return "\(scheme)://\(host):\(port)"
        }

        return "\(scheme)://\(host)"
    }
}
