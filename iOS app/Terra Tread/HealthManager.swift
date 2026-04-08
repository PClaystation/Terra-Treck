//
//  HealthManager.swift
//  Terra Tread
//
//  Created by Charlie Arnerstål on 2025-06-12.
//
import HealthKit

class HealthManager {
    let healthStore = HKHealthStore()

    func requestAuthorization(completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            print("Health data not available")
            completion(false)
            return
        }

        guard let stepCountType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            print("Step count type not available")
            completion(false)
            return
        }

        healthStore.requestAuthorization(toShare: [], read: [stepCountType]) { success, error in
            if let error = error {
                print("HealthKit auth error: \(error.localizedDescription)")
            }
            completion(success)
        }
    }

    func getTodayStepCount(completion: @escaping (Double) -> Void) {
        guard let stepCountType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            print("Step count type not available")
            completion(0)
            return
        }

        let startOfDay = Calendar.current.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: Date(), options: .strictStartDate)

        let query = HKStatisticsQuery(quantityType: stepCountType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
            var steps = 0.0
            if let sum = result?.sumQuantity() {
                steps = sum.doubleValue(for: HKUnit.count())
            } else if let error = error {
                print("Error getting steps: \(error.localizedDescription)")
            }
            completion(steps)
        }
        healthStore.execute(query)
    }

    // New method to get step count for any specific date
    func getStepCount(for date: Date, completion: @escaping (Double) -> Void) {
        guard let stepCountType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            print("Step count type not available")
            completion(0)
            return
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: date)
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else {
            print("Failed to calculate end of day")
            completion(0)
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: startOfDay, end: endOfDay, options: .strictStartDate)

        let query = HKStatisticsQuery(quantityType: stepCountType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, result, error in
            var steps = 0.0
            if let sum = result?.sumQuantity() {
                steps = sum.doubleValue(for: HKUnit.count())
            } else if let error = error {
                print("Error getting steps for \(date): \(error.localizedDescription)")
            }
            completion(steps)
        }
        healthStore.execute(query)
    }
}
