import Foundation

enum BuildingType: String, CaseIterable, Codable, Identifiable {
    case house
    case park
    case shop
    case plaza
    case orchard
    case school
    case market
    case library
    case workshop

    var id: String { rawValue }
}

enum ContractSlot: String, Codable, CaseIterable, Identifiable {
    case daily
    case weekly

    var id: String { rawValue }

    var label: String {
        switch self {
        case .daily: "Daily"
        case .weekly: "Weekly"
        }
    }
}

enum ContractMetric: String, Codable {
    case built
    case upgraded
    case moved
    case demolished
    case prosperity
    case commerce
    case happiness
    case ecology
    case population
    case cityLevel

    var label: String {
        switch self {
        case .built: "buildings"
        case .upgraded: "upgrades"
        case .moved: "moves"
        case .demolished: "demolitions"
        case .prosperity: "prosperity"
        case .commerce: "trade"
        case .happiness: "joy"
        case .ecology: "green"
        case .population: "population"
        case .cityLevel: "levels"
        }
    }
}

enum StatusTone: String {
    case online
    case offline
    case syncing
    case muted
}

struct GridPoint: Hashable, Codable {
    let row: Int
    let col: Int
}

struct EffectTotals: Codable, Equatable {
    var population: Int = 0
    var commerce: Int = 0
    var happiness: Int = 0
    var ecology: Int = 0

    static let zero = EffectTotals()

    var prosperity: Int {
        population + (commerce * 2) + happiness + ecology
    }

    mutating func add(_ other: EffectTotals, times: Int = 1) {
        guard times > 0 else { return }
        population += other.population * times
        commerce += other.commerce * times
        happiness += other.happiness * times
        ecology += other.ecology * times
    }

    func adding(_ other: EffectTotals, times: Int = 1) -> EffectTotals {
        var copy = self
        copy.add(other, times: times)
        return copy
    }

    func scaled(multiplier: Double) -> EffectTotals {
        func scaledValue(_ value: Int) -> Int {
            guard value > 0 else { return 0 }
            return max(1, Int((Double(value) * multiplier).rounded()))
        }

        return EffectTotals(
            population: scaledValue(population),
            commerce: scaledValue(commerce),
            happiness: scaledValue(happiness),
            ecology: scaledValue(ecology)
        )
    }

    func value(for metric: ContractMetric) -> Int {
        switch metric {
        case .population: population
        case .commerce: commerce
        case .happiness: happiness
        case .ecology: ecology
        case .prosperity: prosperity
        default: 0
        }
    }

    func formatted(short: Bool = false) -> String {
        let fragments: [String] = [
            population > 0 ? "+\(population) \(short ? "Pop" : "Population")" : nil,
            commerce > 0 ? "+\(commerce) \(short ? "Trade" : "Commerce")" : nil,
            happiness > 0 ? "+\(happiness) \(short ? "Joy" : "Happiness")" : nil,
            ecology > 0 ? "+\(ecology) \(short ? "Green" : "Ecology")" : nil,
        ].compactMap { $0 }

        return fragments.joined(separator: " • ")
    }
}

struct BuildingSynergyRule {
    let with: BuildingType
    let effects: EffectTotals
    let label: String
}

struct BuildingDefinition: Identifiable {
    let type: BuildingType
    let label: String
    let icon: String
    let width: Int
    let height: Int
    let cost: Int
    let unlockLevel: Int
    let baseEffects: EffectTotals
    let synergies: [BuildingSynergyRule]

    var id: BuildingType { type }
}

struct StatDefinition: Identifiable {
    let key: ContractMetric
    let label: String
    let shortLabel: String
    let icon: String

    var id: ContractMetric { key }
}

struct PlacedBuilding: Codable, Equatable, Identifiable {
    var id: String
    var type: BuildingType
    var row: Int
    var col: Int
    var level: Int = 1
}

struct TreeTile: Codable, Equatable, Hashable, Identifiable {
    var row: Int
    var col: Int
    var imageIndex: Int

    var id: String { "\(row)-\(col)-\(imageIndex)" }
}

struct LifetimeStats: Codable, Equatable {
    var built: Int = 0
    var upgraded: Int = 0
    var moved: Int = 0
    var demolished: Int = 0

    func value(for metric: ContractMetric) -> Int {
        switch metric {
        case .built: built
        case .upgraded: upgraded
        case .moved: moved
        case .demolished: demolished
        default: 0
        }
    }
}

struct ContractRecord: Codable, Equatable {
    var slot: ContractSlot
    var cycleKey: String = ""
    var templateId: String = ""
    var title: String = ""
    var description: String = ""
    var metricKey: ContractMetric = .built
    var rewardSteps: Int = 0
    var startValue: Int = 0
    var targetDelta: Int = 0
    var targetValue: Int = 0
    var claimed: Bool = false
}

struct ContractsState: Codable, Equatable {
    var daily: ContractRecord = ContractRecord(slot: .daily)
    var weekly: ContractRecord = ContractRecord(slot: .weekly)
}

struct GameState: Codable, Equatable {
    var schemaVersion: Int
    var availableSteps: Int
    var lastStepTimestamp: String?
    var lastNativeStepDate: String?
    var lastNativeStepTotal: Int
    var lastUploadedNativeUserId: String?
    var lastUploadedNativeDayKey: String?
    var lastUploadedNativeStepTotal: Int
    var buildings: [PlacedBuilding]
    var nextBuildingId: Int
    var trees: [TreeTile]
    var lifetimeStats: LifetimeStats
    var contracts: ContractsState
    var updatedAt: String?
    var cloudOwnerUserId: String?
}

struct BuildingSynergyDetail: Equatable {
    let with: BuildingType
    let count: Int
    let effects: EffectTotals
    let label: String
}

struct BuildingBreakdown: Equatable, Identifiable {
    let id: String
    let type: BuildingType
    let row: Int
    let col: Int
    let level: Int
    let totalEffects: EffectTotals
    let synergyDetails: [BuildingSynergyDetail]
}

struct CitySummary: Equatable {
    var level: Int
    var prosperity: Int
    var currentLevelThreshold: Int
    var nextLevelThreshold: Int?
    var progressPercent: Double
    var stats: EffectTotals
    var baseTotals: EffectTotals
    var synergyTotals: EffectTotals
    var prosperityBonus: Int
    var unlockedBuildings: [BuildingType]
    var nextUnlock: BuildingType?
    var buildingCount: Int
    var triggeredSynergies: Int
    var breakdown: [BuildingBreakdown]
}

struct ContractEvaluation: Equatable {
    let contract: ContractRecord
    let currentValue: Int
    let targetDelta: Int
    let progressValue: Int
    let completed: Bool
    let progressPercent: Double
    let remaining: Int
}

struct RewardSummary: Codable, Equatable {
    var type: String
    var dayKey: String
    var steps: Int
    var streakLength: Int?
    var label: String?
}

struct DailyGoalSummary: Codable, Equatable {
    var dayKey: String = ""
    var targetSteps: Int = 4_000
    var currentSteps: Int = 0
    var remainingSteps: Int = 4_000
    var completed: Bool = false
    var rewardSteps: Int = 150
    var rewardClaimed: Bool = false
}

struct StreakRunSummary: Codable, Equatable {
    var current: Int = 0
    var longest: Int = 0
    var milestoneInterval: Int = 3
    var nextMilestone: Int = 3
}

struct StreakRewardSummary: Codable, Equatable {
    var claimable: [RewardSummary] = []
    var dailyGoalRewardSteps: Int = 150
    var streakMilestoneRewardSteps: Int = 250
}

struct RecentDailyTotal: Codable, Equatable, Identifiable {
    var dayKey: String
    var totalSteps: Int

    var id: String { dayKey }

    enum CodingKeys: String, CodingKey {
        case dayKey
        case totalSteps = "steps"
    }
}

struct StreakSummary: Codable, Equatable {
    var dailyGoal: DailyGoalSummary = DailyGoalSummary()
    var streak: StreakRunSummary = StreakRunSummary()
    var rewards: StreakRewardSummary = StreakRewardSummary()
    var recentDailyTotals: [RecentDailyTotal] = []
}

struct BackendStepEntry: Codable, Equatable, Identifiable {
    var userId: String?
    var steps: Int
    var source: String?
    var syncKey: String?
    var deviceDayKey: String?
    var timestamp: String

    var id: String { "\(timestamp)-\(steps)-\(syncKey ?? "")" }

    enum CodingKeys: String, CodingKey {
        case userId
        case steps
        case source
        case syncKey
        case deviceDayKey
        case timestamp
    }
}

struct AuthenticatedUser: Codable, Equatable, Identifiable {
    var userId: String
    var continentalId: String?
    var username: String?
    var displayName: String?
    var email: String?

    var id: String { userId }

    var label: String {
        if let displayName, !displayName.isEmpty {
            if let username, !username.isEmpty {
                return "\(displayName) (@\(username))"
            }
            return displayName
        }

        if let username, !username.isEmpty {
            return "@\(username)"
        }

        if let email, !email.isEmpty {
            return email
        }

        return userId
    }
}

struct PendingPlacement: Equatable {
    enum Mode: Equatable {
        case build(BuildingType)
        case move(buildingID: String, buildingType: BuildingType)
    }

    var mode: Mode
    var row: Int
    var col: Int
    var tiles: [GridPoint]
    var isValid: Bool
    var blockedReason: String?
}

struct AppNotice: Identifiable, Equatable {
    let id = UUID()
    let title: String
    let message: String
}

enum TerraTreadRules {
    static let gridSize = 20
    static let startingTerrainOrigin = -(gridSize / 2)
    static let worldBuildRadius = 220
    static let worldMinCoordinate = -worldBuildRadius
    static let worldMaxCoordinate = worldBuildRadius
    static let defaultSteps = 1_000
    static let cloudStateSchemaVersion = 2
    static let maxBuildingLevel = 3
    static let buildingLevelStep = 0.5
    static let demolishRefundRatio = 0.7
    static let treeVariantCount = 3
    static let treeSpawnChance = 0.1
    static let dailyGoal = 4_000
    static let dailyGoalReward = 150
    static let streakMilestoneInterval = 3
    static let streakMilestoneReward = 250
    static let maxUndoEntries = 25
    static let levelThresholds = [0, 18, 42, 74, 114, 162, 218, 282, 354]

    static let statDefinitions: [StatDefinition] = [
        StatDefinition(key: .population, label: "Population", shortLabel: "Pop", icon: "person.3.fill"),
        StatDefinition(key: .commerce, label: "Commerce", shortLabel: "Trade", icon: "bitcoinsign.bank.building.fill"),
        StatDefinition(key: .happiness, label: "Happiness", shortLabel: "Joy", icon: "face.smiling.fill"),
        StatDefinition(key: .ecology, label: "Ecology", shortLabel: "Green", icon: "leaf.fill"),
    ]

    static let buildingDefinitions: [BuildingType: BuildingDefinition] = [
        .house: BuildingDefinition(
            type: .house,
            label: "House",
            icon: "house.fill",
            width: 1,
            height: 1,
            cost: 100,
            unlockLevel: 1,
            baseEffects: EffectTotals(population: 6, happiness: 1),
            synergies: [
                BuildingSynergyRule(with: .park, effects: EffectTotals(happiness: 2), label: "+2 Joy next to Parks"),
                BuildingSynergyRule(with: .shop, effects: EffectTotals(commerce: 1), label: "+1 Trade next to Shops"),
            ]
        ),
        .park: BuildingDefinition(
            type: .park,
            label: "Park",
            icon: "tree.fill",
            width: 2,
            height: 2,
            cost: 150,
            unlockLevel: 2,
            baseEffects: EffectTotals(happiness: 5, ecology: 4),
            synergies: [
                BuildingSynergyRule(with: .house, effects: EffectTotals(happiness: 1, ecology: 1), label: "+1 Joy and +1 Green next to Houses"),
                BuildingSynergyRule(with: .plaza, effects: EffectTotals(commerce: 1), label: "+1 Trade next to Plazas"),
            ]
        ),
        .shop: BuildingDefinition(
            type: .shop,
            label: "Shop",
            icon: "storefront.fill",
            width: 2,
            height: 1,
            cost: 200,
            unlockLevel: 3,
            baseEffects: EffectTotals(population: 1, commerce: 6),
            synergies: [
                BuildingSynergyRule(with: .house, effects: EffectTotals(commerce: 2), label: "+2 Trade next to Houses"),
                BuildingSynergyRule(with: .plaza, effects: EffectTotals(commerce: 1, happiness: 1), label: "+1 Trade and +1 Joy next to Plazas"),
            ]
        ),
        .plaza: BuildingDefinition(
            type: .plaza,
            label: "Plaza",
            icon: "building.columns.fill",
            width: 1,
            height: 2,
            cost: 260,
            unlockLevel: 4,
            baseEffects: EffectTotals(commerce: 2, happiness: 4),
            synergies: [
                BuildingSynergyRule(with: .house, effects: EffectTotals(happiness: 2), label: "+2 Joy next to Houses"),
                BuildingSynergyRule(with: .park, effects: EffectTotals(happiness: 1, ecology: 1), label: "+1 Joy and +1 Green next to Parks"),
            ]
        ),
        .orchard: BuildingDefinition(
            type: .orchard,
            label: "Orchard",
            icon: "carrot.fill",
            width: 2,
            height: 2,
            cost: 240,
            unlockLevel: 5,
            baseEffects: EffectTotals(population: 1, happiness: 2, ecology: 6),
            synergies: [
                BuildingSynergyRule(with: .house, effects: EffectTotals(happiness: 1), label: "+1 Joy next to Houses"),
                BuildingSynergyRule(with: .market, effects: EffectTotals(commerce: 2), label: "+2 Trade next to Markets"),
                BuildingSynergyRule(with: .park, effects: EffectTotals(ecology: 1), label: "+1 Green next to Parks"),
            ]
        ),
        .school: BuildingDefinition(
            type: .school,
            label: "School",
            icon: "graduationcap.fill",
            width: 2,
            height: 2,
            cost: 300,
            unlockLevel: 5,
            baseEffects: EffectTotals(population: 4, happiness: 3),
            synergies: [
                BuildingSynergyRule(with: .house, effects: EffectTotals(population: 1, happiness: 1), label: "+1 Pop and +1 Joy next to Houses"),
                BuildingSynergyRule(with: .library, effects: EffectTotals(happiness: 2), label: "+2 Joy next to Libraries"),
                BuildingSynergyRule(with: .plaza, effects: EffectTotals(commerce: 1), label: "+1 Trade next to Plazas"),
            ]
        ),
        .market: BuildingDefinition(
            type: .market,
            label: "Market",
            icon: "basket.fill",
            width: 3,
            height: 1,
            cost: 340,
            unlockLevel: 6,
            baseEffects: EffectTotals(commerce: 8, happiness: 2),
            synergies: [
                BuildingSynergyRule(with: .shop, effects: EffectTotals(commerce: 2), label: "+2 Trade next to Shops"),
                BuildingSynergyRule(with: .orchard, effects: EffectTotals(commerce: 2, happiness: 1), label: "+2 Trade and +1 Joy next to Orchards"),
                BuildingSynergyRule(with: .plaza, effects: EffectTotals(happiness: 1), label: "+1 Joy next to Plazas"),
            ]
        ),
        .library: BuildingDefinition(
            type: .library,
            label: "Library",
            icon: "books.vertical.fill",
            width: 1,
            height: 2,
            cost: 280,
            unlockLevel: 7,
            baseEffects: EffectTotals(population: 2, happiness: 5),
            synergies: [
                BuildingSynergyRule(with: .school, effects: EffectTotals(population: 2), label: "+2 Pop next to Schools"),
                BuildingSynergyRule(with: .house, effects: EffectTotals(happiness: 1), label: "+1 Joy next to Houses"),
                BuildingSynergyRule(with: .park, effects: EffectTotals(ecology: 1), label: "+1 Green next to Parks"),
            ]
        ),
        .workshop: BuildingDefinition(
            type: .workshop,
            label: "Workshop",
            icon: "gearshape.2.fill",
            width: 2,
            height: 1,
            cost: 380,
            unlockLevel: 8,
            baseEffects: EffectTotals(population: 3, commerce: 5),
            synergies: [
                BuildingSynergyRule(with: .shop, effects: EffectTotals(commerce: 2), label: "+2 Trade next to Shops"),
                BuildingSynergyRule(with: .market, effects: EffectTotals(commerce: 1), label: "+1 Trade next to Markets"),
                BuildingSynergyRule(with: .school, effects: EffectTotals(population: 1), label: "+1 Pop next to Schools"),
            ]
        ),
    ]
}
