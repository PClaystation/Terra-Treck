import SwiftUI

@main
struct TerraTreadApp: App {
    private let configuration = AppConfiguration.current

    var body: some Scene {
        WindowGroup {
            RootView(configuration: configuration)
        }
    }
}
