import SwiftUI

struct TerraTreadWebView: UIViewControllerRepresentable {
    let configuration: AppConfiguration

    func makeUIViewController(context: Context) -> WebContainerViewController {
        WebContainerViewController(configuration: configuration)
    }

    func updateUIViewController(_ uiViewController: WebContainerViewController, context: Context) {
        uiViewController.updateConfiguration(configuration)
    }
}
