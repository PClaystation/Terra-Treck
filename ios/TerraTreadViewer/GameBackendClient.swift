import Foundation

struct CloudStateResponse: Decodable {
    let userId: String?
    let state: GameState?
    let updatedAt: String?
}

struct StepFeedResponse: Decodable {
    let userId: String?
    let entries: [BackendStepEntry]
    let summary: StreakSummary?
}

struct ClaimRewardResponse: Decodable {
    struct ClaimedReward: Decodable {
        let steps: Int
    }

    let success: Bool?
    let reward: ClaimedReward?
    let summary: StreakSummary?
}

struct StepUploadRequest: Encodable {
    struct Metadata: Encodable {
        let platform: String
        let totalSteps: Int
    }

    let userId: String
    let steps: Int
    let source: String
    let syncKey: String
    let deviceDayKey: String
    let metadata: Metadata
}

enum BackendClientError: LocalizedError {
    case missingBaseURL
    case invalidResponse
    case requestFailed(String)

    var errorDescription: String? {
        switch self {
        case .missingBaseURL:
            "No Terra Tread backend URL is configured."
        case .invalidResponse:
            "The Terra Tread backend returned an invalid response."
        case .requestFailed(let message):
            message
        }
    }
}

struct GameBackendClient {
    let configuration: AppConfiguration
    let session: URLSession = .shared

    func fetchCloudState(for userID: String) async throws -> CloudStateResponse {
        try await send(
            path: "api/game/state/\(encode(userID))",
            method: "GET",
            body: Optional<Data>.none
        )
    }

    func saveCloudState(_ state: GameState, for userID: String) async throws -> CloudStateResponse {
        struct Payload: Encodable {
            let state: GameState
        }

        let body = try JSONEncoder().encode(Payload(state: state))
        return try await send(
            path: "api/game/state/\(encode(userID))",
            method: "PUT",
            body: body
        )
    }

    func uploadSteps(_ payload: StepUploadRequest) async throws {
        _ = try await sendEmpty(
            path: "api/game/steps",
            method: "POST",
            body: JSONEncoder().encode(payload)
        )
    }

    func fetchSteps(for userID: String) async throws -> StepFeedResponse {
        try await send(
            path: "api/game/steps/\(encode(userID))",
            method: "GET",
            body: Optional<Data>.none
        )
    }

    func claimReward(userID: String, reward: RewardSummary) async throws -> ClaimRewardResponse {
        struct Payload: Encodable {
            let type: String
            let dayKey: String
        }

        let body = try JSONEncoder().encode(Payload(type: reward.type, dayKey: reward.dayKey))
        return try await send(
            path: "api/game/streaks/\(encode(userID))/claim",
            method: "POST",
            body: body
        )
    }

    private func send<Response: Decodable>(path: String, method: String, body: Data?) async throws -> Response {
        let data = try await sendEmpty(path: path, method: method, body: body)

        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw BackendClientError.invalidResponse
        }
    }

    private func sendEmpty(path: String, method: String, body: Data?) async throws -> Data {
        guard let baseURL = configuration.effectiveGameAPIBaseURL else {
            throw BackendClientError.missingBaseURL
        }

        let url = baseURL.appending(path: path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 15
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw BackendClientError.invalidResponse
        }

        guard 200..<300 ~= httpResponse.statusCode else {
            let message = String(data: data, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines)
            throw BackendClientError.requestFailed(message?.isEmpty == false ? message! : "HTTP \(httpResponse.statusCode)")
        }

        return data
    }

    private func encode(_ value: String) -> String {
        value.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? value
    }
}
