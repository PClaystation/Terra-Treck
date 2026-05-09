import CoreMotion
import Foundation

struct StepSnapshot: Equatable {
    let todaySteps: Int
    let dayKey: String
}

@MainActor
final class StepSyncService {
    var onSnapshot: ((StepSnapshot) -> Void)?
    var onAuthorizationDenied: (() -> Void)?

    private let pedometer = CMPedometer()
    private let calendar = Calendar.current
    private(set) var latestSnapshot: StepSnapshot?
    private var started = false

    func start() {
        guard !started else {
            return
        }

        started = true
        refresh()

        guard CMPedometer.isStepCountingAvailable() else {
            return
        }

        pedometer.startUpdates(from: startOfDay(), withHandler: Self.makePedometerHandler(for: self))
    }

    func stop() {
        guard started else {
            return
        }

        pedometer.stopUpdates()
        started = false
    }

    func refresh() {
        guard CMPedometer.isStepCountingAvailable() else {
            return
        }

        let startDate = startOfDay()
        pedometer.queryPedometerData(from: startDate, to: Date(), withHandler: Self.makePedometerHandler(for: self))
    }

    private func startOfDay() -> Date {
        calendar.startOfDay(for: Date())
    }

    private func handle(data: CMPedometerData?, error: Error?) {
        if let nsError = error as NSError? {
            if nsError.domain == CMErrorDomain, nsError.code == Int(CMErrorMotionActivityNotAuthorized.rawValue) {
                onAuthorizationDenied?()
            }
            return
        }

        guard let data else {
            return
        }

        let snapshot = StepSnapshot(
            todaySteps: max(0, data.numberOfSteps.intValue),
            dayKey: Self.dayKey(for: data.endDate)
        )

        guard snapshot != latestSnapshot else {
            return
        }

        latestSnapshot = snapshot
        onSnapshot?(snapshot)
    }

    private static func dayKey(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func makePedometerHandler(for service: StepSyncService) -> CMPedometerHandler {
        { [weak service] data, error in
            Task { @MainActor [weak service] in
                service?.handle(data: data, error: error)
            }
        }
    }
}
