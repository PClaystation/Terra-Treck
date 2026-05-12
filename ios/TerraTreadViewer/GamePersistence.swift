import Foundation

@MainActor
final class GamePersistence {
    static let shared = GamePersistence()

    private let stateKey = "terraTread.nativeState"
    private let userKey = "terraTread.authUser"
    private let defaults = UserDefaults.standard
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    func loadState() -> GameState {
        guard let data = defaults.data(forKey: stateKey) else {
            return GameEngine.createDefaultState()
        }

        do {
            let decoded = try decoder.decode(GameState.self, from: data)
            return GameEngine.normalizedState(decoded)
        } catch {
            return GameEngine.createDefaultState()
        }
    }

    func saveState(_ state: GameState) {
        guard let data = try? encoder.encode(GameEngine.normalizedState(state)) else {
            return
        }
        defaults.set(data, forKey: stateKey)
    }

    func loadUser() -> AuthenticatedUser? {
        guard let data = defaults.data(forKey: userKey) else {
            return nil
        }
        return try? decoder.decode(AuthenticatedUser.self, from: data)
    }

    func saveUser(_ user: AuthenticatedUser?) {
        guard let user else {
            defaults.removeObject(forKey: userKey)
            return
        }

        guard let data = try? encoder.encode(user) else {
            return
        }
        defaults.set(data, forKey: userKey)
    }
}
