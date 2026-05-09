import SwiftUI

@main
struct TerraTreadViewerApp: App {
    private let configuration = AppConfiguration.current

    var body: some Scene {
        WindowGroup {
            RootView(configuration: configuration)
        }
    }
}
