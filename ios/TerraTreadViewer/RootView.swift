import SwiftUI

struct RootView: View {
    let configuration: AppConfiguration

    var body: some View {
        TerraTreadWebView(configuration: configuration)
            .ignoresSafeArea()
    }
}

#Preview {
    RootView(configuration: .current)
}
