import SafariServices
import UIKit
import WebKit

@MainActor
final class WebContainerViewController: UIViewController {
    private enum ContentSource {
        case remote
        case bundled
    }

    private static let bridgeHandlerName = "terraTread"

    private var configurationModel: AppConfiguration
    private let stepService = StepSyncService()
    private let loadingIndicator = UIActivityIndicatorView(style: .large)
    private let errorCard = UIView()
    private let errorTitleLabel = UILabel()
    private let errorMessageLabel = UILabel()
    private let retryButton = UIButton(type: .system)

    private var webView: WKWebView?
    private var popupHostView: UIView?
    private var popupWebView: WKWebView?
    private var currentSource: ContentSource?
    private var initialLoadHasFailed = false
    private var didShowMotionAccessAlert = false
    init(configuration: AppConfiguration) {
        configurationModel = configuration
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.93, green: 0.97, blue: 1.0, alpha: 1.0)
        setupLoadingIndicator()
        setupErrorCard()
        bindStepService()
        installObservers()
        stepService.start()
        loadPreferredSource()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    func updateConfiguration(_ configuration: AppConfiguration) {
        configurationModel = configuration
    }

    private func bindStepService() {
        stepService.onSnapshot = { [weak self] snapshot in
            self?.postStepSnapshot(snapshot)
        }

        stepService.onAuthorizationDenied = { [weak self] in
            self?.showMotionAccessAlertIfNeeded()
        }
    }

    private func installObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    @objc
    private func handleWillEnterForeground() {
        stepService.refresh()
    }

    private func setupLoadingIndicator() {
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.hidesWhenStopped = true
        view.addSubview(loadingIndicator)

        NSLayoutConstraint.activate([
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    private func setupErrorCard() {
        errorCard.translatesAutoresizingMaskIntoConstraints = false
        errorCard.backgroundColor = UIColor(white: 1.0, alpha: 0.92)
        errorCard.layer.cornerRadius = 24
        errorCard.layer.shadowColor = UIColor.black.cgColor
        errorCard.layer.shadowOpacity = 0.15
        errorCard.layer.shadowRadius = 24
        errorCard.layer.shadowOffset = CGSize(width: 0, height: 10)
        errorCard.isHidden = true

        errorTitleLabel.translatesAutoresizingMaskIntoConstraints = false
        errorTitleLabel.text = "Couldn’t Open Terra Tread"
        errorTitleLabel.font = .systemFont(ofSize: 24, weight: .bold)
        errorTitleLabel.textAlignment = .center
        errorTitleLabel.numberOfLines = 0

        errorMessageLabel.translatesAutoresizingMaskIntoConstraints = false
        errorMessageLabel.font = .systemFont(ofSize: 16, weight: .medium)
        errorMessageLabel.textColor = UIColor(white: 0.32, alpha: 1.0)
        errorMessageLabel.textAlignment = .center
        errorMessageLabel.numberOfLines = 0

        retryButton.translatesAutoresizingMaskIntoConstraints = false
        retryButton.configuration = .filled()
        retryButton.configuration?.title = "Retry"
        retryButton.configuration?.cornerStyle = .capsule
        retryButton.addTarget(self, action: #selector(handleRetryTapped), for: .touchUpInside)

        errorCard.addSubview(errorTitleLabel)
        errorCard.addSubview(errorMessageLabel)
        errorCard.addSubview(retryButton)
        view.addSubview(errorCard)

        NSLayoutConstraint.activate([
            errorCard.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            errorCard.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            errorCard.centerYAnchor.constraint(equalTo: view.centerYAnchor),

            errorTitleLabel.topAnchor.constraint(equalTo: errorCard.topAnchor, constant: 28),
            errorTitleLabel.leadingAnchor.constraint(equalTo: errorCard.leadingAnchor, constant: 20),
            errorTitleLabel.trailingAnchor.constraint(equalTo: errorCard.trailingAnchor, constant: -20),

            errorMessageLabel.topAnchor.constraint(equalTo: errorTitleLabel.bottomAnchor, constant: 12),
            errorMessageLabel.leadingAnchor.constraint(equalTo: errorCard.leadingAnchor, constant: 20),
            errorMessageLabel.trailingAnchor.constraint(equalTo: errorCard.trailingAnchor, constant: -20),

            retryButton.topAnchor.constraint(equalTo: errorMessageLabel.bottomAnchor, constant: 20),
            retryButton.bottomAnchor.constraint(equalTo: errorCard.bottomAnchor, constant: -24),
            retryButton.centerXAnchor.constraint(equalTo: errorCard.centerXAnchor),
        ])
    }

    @objc
    private func handleRetryTapped() {
        initialLoadHasFailed = false
        hideErrorCard()
        loadPreferredSource()
    }

    private func loadPreferredSource() {
        if configurationModel.remoteWebURL != nil {
            load(source: .remote)
        } else {
            load(source: .bundled)
        }
    }

    private func load(source: ContentSource) {
        currentSource = source
        let activeWebView = installMainWebView(for: source)
        hideErrorCard()
        loadingIndicator.startAnimating()

        switch source {
        case .remote:
            guard let remoteURL = configurationModel.remoteWebURL else {
                loadBundledFallback(reason: nil)
                return
            }

            var request = URLRequest(url: remoteURL)
            request.cachePolicy = .reloadIgnoringLocalCacheData
            request.timeoutInterval = 20
            activeWebView.load(request)
        case .bundled:
            guard let indexURL = Bundle.main.url(forResource: "index", withExtension: "html") else {
                presentError("The bundled web app assets are missing from the iOS target.")
                return
            }

            activeWebView.loadFileURL(indexURL, allowingReadAccessTo: Bundle.main.bundleURL)
        }
    }

    private func loadBundledFallback(reason: Error?) {
        guard Bundle.main.url(forResource: "index", withExtension: "html") != nil else {
            presentError(reason?.localizedDescription ?? "The hosted app could not be loaded.")
            return
        }

        load(source: .bundled)
    }

    private func installMainWebView(for source: ContentSource) -> WKWebView {
        webView?.removeFromSuperview()
        popupHostView?.removeFromSuperview()
        popupHostView = nil
        popupWebView = nil

        let webView = makeWebView(allowsWebAuth: source == .remote ? configurationModel.allowsWebAuth : false)
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.insertSubview(webView, belowSubview: loadingIndicator)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(self, action: #selector(handleRefreshControl(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl
        webView.scrollView.contentInsetAdjustmentBehavior = .never

        self.webView = webView
        return webView
    }

    @objc
    private func handleRefreshControl(_ sender: UIRefreshControl) {
        stepService.refresh()

        if currentSource == .bundled, configurationModel.remoteWebURL != nil {
            load(source: .remote)
            sender.endRefreshing()
            return
        }

        webView?.reload()
        sender.endRefreshing()
    }

    private func makeWebView(allowsWebAuth: Bool) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true

        let userContentController = WKUserContentController()
        let bridgeScript = WKUserScript(
            source: makeBridgeBootstrapScript(allowsWebAuth: allowsWebAuth),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        userContentController.addUserScript(bridgeScript)
        userContentController.add(BridgeHandler(owner: self), name: Self.bridgeHandlerName)
        configuration.userContentController = userContentController

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.backgroundColor = .clear
        webView.isOpaque = false
        webView.scrollView.alwaysBounceVertical = true
        webView.customUserAgent = "TerraTreadiOS/1.0"
        webView.navigationDelegate = self
        webView.uiDelegate = self
        return webView
    }

    private func makeBridgeBootstrapScript(allowsWebAuth: Bool) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.withoutEscapingSlashes]
        let contentMode = currentSource == .remote ? "remote" : "bundled"

        guard let data = try? encoder.encode(
            configurationModel.bridgeContext(allowsWebAuth: allowsWebAuth, contentMode: contentMode)
        ),
              let json = String(data: data, encoding: .utf8) else {
            return """
            window.__TERRA_TREAD_CONTEXT__ = {
              platform: "ios-app",
              allowsWebAuth: false,
              contentMode: "bundled"
            };
            """
        }

        return """
        window.__TERRA_TREAD_CONTEXT__ = \(json);
        """
    }

    private func postStepSnapshot(_ snapshot: StepSnapshot) {
        guard let webView else {
            return
        }

        let script = """
        window.dispatchEvent(new CustomEvent("terra-tread-native", {
          detail: {
            type: "stepSync",
            todaySteps: \(snapshot.todaySteps),
            dayKey: "\(snapshot.dayKey)"
          }
        }));
        """

        webView.evaluateJavaScript(script)
    }

    private func showMotionAccessAlertIfNeeded() {
        guard !didShowMotionAccessAlert else {
            return
        }

        didShowMotionAccessAlert = true
        let alert = UIAlertController(
            title: "Motion Access Needed",
            message: "Enable Motion & Fitness access for Terra Tread so your daily steps can power the city.",
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "Open Settings", style: .default) { _ in
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                return
            }
            UIApplication.shared.open(url)
        })
        alert.addAction(UIAlertAction(title: "Not Now", style: .cancel))
        present(alert, animated: true)
    }

    private func presentError(_ message: String) {
        errorMessageLabel.text = message
        errorCard.isHidden = false
        loadingIndicator.stopAnimating()
    }

    private func hideErrorCard() {
        errorCard.isHidden = true
    }

    private func openExternally(_ url: URL) {
        if url.scheme?.lowercased() == "http" || url.scheme?.lowercased() == "https" {
            let safari = SFSafariViewController(url: url)
            present(safari, animated: true)
            return
        }

        UIApplication.shared.open(url)
    }

    private func shouldOpenInApp(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased() else {
            return false
        }

        if scheme == "about" || scheme == "file" {
            return true
        }

        guard scheme == "http" || scheme == "https" else {
            return false
        }

        guard let host = url.host?.lowercased() else {
            return false
        }

        if configurationModel.trustedHosts.contains(host) {
            return true
        }

        return host.hasSuffix(".continental-hub.com")
    }

    private func makePopupWebView(using configuration: WKWebViewConfiguration) -> WKWebView {
        configuration.websiteDataStore = .default()

        let popupWebView = WKWebView(frame: .zero, configuration: configuration)
        popupWebView.translatesAutoresizingMaskIntoConstraints = false
        popupWebView.navigationDelegate = self
        popupWebView.uiDelegate = self
        popupWebView.customUserAgent = "TerraTreadiOS/1.0"
        popupWebView.backgroundColor = UIColor(red: 0.07, green: 0.13, blue: 0.13, alpha: 1.0)
        popupWebView.isOpaque = false
        return popupWebView
    }

    private func presentPopup(_ popupWebView: WKWebView) {
        popupHostView?.removeFromSuperview()

        let blurView = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterialDark))
        blurView.translatesAutoresizingMaskIntoConstraints = false

        let closeButton = UIButton(type: .system)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.configuration = .filled()
        closeButton.configuration?.title = "Done"
        closeButton.configuration?.cornerStyle = .capsule
        closeButton.addTarget(self, action: #selector(closePopup), for: .touchUpInside)

        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        container.backgroundColor = UIColor(red: 0.06, green: 0.11, blue: 0.11, alpha: 0.94)
        container.layer.cornerRadius = 26
        container.layer.masksToBounds = true

        let hostView = UIView()
        hostView.translatesAutoresizingMaskIntoConstraints = false
        hostView.addSubview(blurView)
        hostView.addSubview(container)
        hostView.addSubview(closeButton)
        container.addSubview(popupWebView)
        view.addSubview(hostView)

        NSLayoutConstraint.activate([
            hostView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            hostView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            hostView.topAnchor.constraint(equalTo: view.topAnchor),
            hostView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            blurView.leadingAnchor.constraint(equalTo: hostView.leadingAnchor),
            blurView.trailingAnchor.constraint(equalTo: hostView.trailingAnchor),
            blurView.topAnchor.constraint(equalTo: hostView.topAnchor),
            blurView.bottomAnchor.constraint(equalTo: hostView.bottomAnchor),

            closeButton.topAnchor.constraint(equalTo: hostView.safeAreaLayoutGuide.topAnchor, constant: 16),
            closeButton.trailingAnchor.constraint(equalTo: hostView.safeAreaLayoutGuide.trailingAnchor, constant: -20),

            container.leadingAnchor.constraint(equalTo: hostView.leadingAnchor, constant: 16),
            container.trailingAnchor.constraint(equalTo: hostView.trailingAnchor, constant: -16),
            container.topAnchor.constraint(equalTo: closeButton.bottomAnchor, constant: 16),
            container.bottomAnchor.constraint(equalTo: hostView.safeAreaLayoutGuide.bottomAnchor, constant: -16),

            popupWebView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            popupWebView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            popupWebView.topAnchor.constraint(equalTo: container.topAnchor),
            popupWebView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        popupHostView = hostView
        self.popupWebView = popupWebView
    }

    @objc
    private func closePopup() {
        popupWebView?.stopLoading()
        popupWebView?.removeFromSuperview()
        popupWebView = nil
        popupHostView?.removeFromSuperview()
        popupHostView = nil
    }

    private final class BridgeHandler: NSObject, WKScriptMessageHandler {
        weak var owner: WebContainerViewController?

        init(owner: WebContainerViewController) {
            self.owner = owner
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == WebContainerViewController.bridgeHandlerName,
                  let body = message.body as? [String: Any],
                  let type = body["type"] as? String else {
                return
            }

            switch type {
            case "ready", "requestSteps":
                Task { @MainActor [weak owner] in
                    owner?.stepService.refresh()
                    if let snapshot = owner?.stepService.latestSnapshot {
                        owner?.postStepSnapshot(snapshot)
                    }
                }
            default:
                break
            }
        }
    }
}

extension WebContainerViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        loadingIndicator.startAnimating()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if self.webView === webView {
            initialLoadHasFailed = false
        }
        loadingIndicator.stopAnimating()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleLoadFailure(for: webView, error: error)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleLoadFailure(for: webView, error: error)
    }

    private func handleLoadFailure(for webView: WKWebView, error: Error) {
        loadingIndicator.stopAnimating()

        if self.webView === webView, currentSource == .remote, !initialLoadHasFailed {
            initialLoadHasFailed = true
            loadBundledFallback(reason: error)
            return
        }

        if self.webView === webView {
            presentError(error.localizedDescription)
        } else if popupWebView === webView {
            closePopup()
            openExternally(webView.url ?? configurationModel.loginPopupURL ?? URL(string: "https://login.continental-hub.com")!)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if shouldOpenInApp(url) {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.cancel)
        openExternally(url)
    }
}

extension WebContainerViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard navigationAction.targetFrame == nil else {
            return nil
        }

        let popupWebView = makePopupWebView(using: configuration)
        presentPopup(popupWebView)
        return popupWebView
    }

    func webViewDidClose(_ webView: WKWebView) {
        if popupWebView === webView {
            closePopup()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable () -> Void) {
        let alert = UIAlertController(title: "Terra Tread", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler()
        })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor @Sendable (Bool) -> Void) {
        let alert = UIAlertController(title: "Terra Tread", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            completionHandler(false)
        })
        alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
            completionHandler(true)
        })
        present(alert, animated: true)
    }
}
