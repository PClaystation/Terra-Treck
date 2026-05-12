import Observation
import SwiftUI

private enum GameTab: Hashable {
    case city
    case missions
    case profile
}

struct RootView: View {
    let configuration: AppConfiguration

    @Environment(\.scenePhase) private var scenePhase
    @State private var store: GameStore
    @State private var selectedTab: GameTab = .city

    init(configuration: AppConfiguration) {
        self.configuration = configuration
        _store = State(initialValue: GameStore(configuration: configuration))
    }

    var body: some View {
        @Bindable var bindableStore = store

        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.10, green: 0.19, blue: 0.18),
                    Color(red: 0.18, green: 0.33, blue: 0.29),
                    Color(red: 0.74, green: 0.84, blue: 0.73),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            VStack(spacing: selectedTab == .city ? 0 : 14) {
                if selectedTab != .city {
                    GameHeaderView(store: store)
                        .padding(.top, 12)
                }

                TabView(selection: $selectedTab) {
                    CitySceneView(store: store)
                        .tag(GameTab.city)
                        .tabItem {
                            Label("City", systemImage: "square.grid.3x3.fill")
                        }

                    MissionSceneView(store: store)
                        .tag(GameTab.missions)
                        .tabItem {
                            Label("Trek", systemImage: "figure.walk.motion")
                        }

                    ProfileSceneView(
                        store: store,
                        showSignIn: { bindableStore.isShowingLoginSheet = true }
                    )
                    .tag(GameTab.profile)
                    .tabItem {
                        Label("Profile", systemImage: "person.crop.circle.fill")
                    }
                }
                .tint(Color(red: 0.95, green: 0.78, blue: 0.33))
            }
        }
        .task {
            store.start()
        }
        .onChange(of: scenePhase) { _, newValue in
            if newValue == .active {
                store.refreshForForeground()
            }
        }
        .sheet(isPresented: $bindableStore.isShowingBuildCatalog) {
            BuildCatalogSheet(store: store)
        }
        .sheet(isPresented: $bindableStore.isShowingLoginSheet) {
            AuthWebSheet(
                configuration: configuration,
                onCancel: { bindableStore.isShowingLoginSheet = false },
                onSuccess: { user in
                    bindableStore.isShowingLoginSheet = false
                    store.completeSignIn(with: user)
                }
            )
        }
        .alert(
            store.notice?.title ?? "",
            isPresented: Binding(
                get: { store.notice != nil },
                set: { isPresented in
                    if !isPresented {
                        store.dismissNotice()
                    }
                }
            ),
            actions: {
                Button("OK", role: .cancel) {
                    store.dismissNotice()
                }
            },
            message: {
                Text(store.notice?.message ?? "")
            }
        )
    }
}

private struct GameHeaderView: View {
    let store: GameStore

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Terra Tread")
                        .font(.system(size: 28, weight: .black, design: .rounded))
                        .foregroundStyle(.white)
                        .shadow(color: Color.black.opacity(0.30), radius: 10, x: 0, y: 4)

                    Text("Build a district from your daily steps.")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.78))
                        .shadow(color: Color.black.opacity(0.24), radius: 8, x: 0, y: 3)
                }

                Spacer(minLength: 8)

                VStack(alignment: .trailing, spacing: 8) {
                    HStack(spacing: 8) {
                        Label("\(store.citySummary.level)", systemImage: "sparkles.rectangle.stack.fill")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(Color.black.opacity(0.30), in: Capsule())
                            .overlay(
                                Capsule()
                                    .strokeBorder(Color.white.opacity(0.10))
                            )
                            .foregroundStyle(.white)

                        Label(store.state.availableSteps.formatted(), systemImage: "shoeprints.fill")
                            .font(.caption.weight(.bold))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 7)
                            .background(Color(red: 0.96, green: 0.79, blue: 0.33), in: Capsule())
                            .foregroundStyle(Color(red: 0.17, green: 0.20, blue: 0.18))
                    }

                    Text("Prosperity \(store.citySummary.prosperity)")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.white.opacity(0.75))
                        .shadow(color: Color.black.opacity(0.24), radius: 8, x: 0, y: 3)
                }
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    StatusChip(
                        text: store.playerStatusText,
                        tone: .muted,
                        symbol: "person.fill"
                    )
                    StatusChip(
                        text: store.connectionStatusText,
                        tone: store.connectionStatusTone,
                        symbol: "antenna.radiowaves.left.and.right"
                    )
                    StatusChip(
                        text: store.cloudStatusText,
                        tone: store.cloudStatusTone,
                        symbol: "icloud.fill"
                    )
                }
                .padding(.horizontal, 1)
            }
        }
        .padding(.horizontal, 16)
    }
}

private struct MissionSceneView: View {
    let store: GameStore

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                GameSurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Daily Trek")
                            .font(.headline.weight(.bold))

                        HStack(alignment: .firstTextBaseline) {
                            Text("\(store.streakSummary.streak.current)")
                                .font(.system(size: 42, weight: .black, design: .rounded))
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Current streak")
                                    .font(.headline)
                                Text("Best run \(store.streakSummary.streak.longest) days")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                        }

                        ProgressMeter(
                            title: "Today",
                            current: store.streakSummary.dailyGoal.currentSteps,
                            target: store.streakSummary.dailyGoal.targetSteps
                        )

                        Text(goalStatusText)
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(Color(red: 0.21, green: 0.30, blue: 0.26))
                    }
                }

                GameSurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Contracts")
                            .font(.headline.weight(.bold))

                        ContractCard(
                            evaluation: store.dailyContractEvaluation,
                            claim: { store.claimContract(.daily) }
                        )

                        ContractCard(
                            evaluation: store.weeklyContractEvaluation,
                            claim: { store.claimContract(.weekly) }
                        )
                    }
                }

                if !store.streakSummary.recentDailyTotals.isEmpty {
                    GameSurfaceCard {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recent Runs")
                                .font(.headline.weight(.bold))

                            ForEach(store.streakSummary.recentDailyTotals) { total in
                                HStack {
                                    Text(total.dayKey)
                                        .font(.subheadline.weight(.semibold))
                                    Spacer()
                                    Text("\(total.totalSteps.formatted()) steps")
                                        .font(.subheadline.weight(.bold))
                                        .foregroundStyle(total.totalSteps >= TerraTreadRules.dailyGoal ? .green : .secondary)
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
    }

    private var goalStatusText: String {
        let goal = store.streakSummary.dailyGoal
        if goal.rewardClaimed {
            return "Today's bonus is already claimed. Keep your streak alive tomorrow."
        }
        if let reward = store.streakSummary.rewards.claimable.first(where: { $0.type == "daily-goal" }) {
            return "Daily reward ready: +\(reward.steps) steps."
        }
        if let reward = store.streakSummary.rewards.claimable.first(where: { $0.type == "streak-milestone" }) {
            return "\(reward.streakLength ?? 0)-day streak bonus unlocked: +\(reward.steps) steps."
        }
        if goal.completed {
            return "Goal reached. Syncing your reward."
        }
        return "Need \(goal.remainingSteps.formatted()) more steps for +\(goal.rewardSteps) steps."
    }
}

private struct ProfileSceneView: View {
    let store: GameStore
    let showSignIn: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                GameSurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Account")
                            .font(.headline.weight(.bold))

                        if let currentUser = store.currentUser {
                            Text(currentUser.label)
                                .font(.title3.weight(.bold))
                            Text("Cloud sync and streak tracking are active for this player.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            Button("Sign Out", role: .destructive) {
                                store.signOut()
                            }
                            .buttonStyle(.bordered)
                        } else {
                            Text("Guest Mode")
                                .font(.title3.weight(.bold))
                            Text("Sign in with Continental ID to sync your city, keep streaks across devices, and upload native step totals to the backend.")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            Button(store.canAuthenticateInApp ? "Sign In" : "Sign-In Unavailable") {
                                showSignIn()
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(Color(red: 0.18, green: 0.45, blue: 0.40))
                            .disabled(!store.canAuthenticateInApp)
                        }
                    }
                }

                GameSurfaceCard {
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Sync")
                            .font(.headline.weight(.bold))

                        InfoRow(title: "Connection", value: store.connectionStatusText)
                        InfoRow(title: "Cloud Save", value: store.cloudStatusText)
                        InfoRow(title: "Native Steps", value: store.nativeSyncSummary)

                        Button("Refresh Backend State") {
                            store.manualSync()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color(red: 0.95, green: 0.78, blue: 0.33))
                        .disabled(store.currentUser == nil)
                    }
                }

                GameSurfaceCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("District Snapshot")
                            .font(.headline.weight(.bold))

                        InfoRow(title: "Buildings", value: "\(store.citySummary.buildingCount)")
                        InfoRow(title: "Prosperity", value: "\(store.citySummary.prosperity)")
                        InfoRow(title: "Trees", value: "\(store.state.trees.count)")
                        InfoRow(title: "Undo Buffer", value: store.canUndo ? "Available" : "Empty")
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 28)
        }
        .scrollIndicators(.hidden)
    }
}

private struct ContractCard: View {
    let evaluation: ContractEvaluation
    let claim: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(evaluation.contract.title)
                    .font(.headline)
                Spacer()
                Text(evaluation.contract.slot.label)
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color(red: 0.20, green: 0.49, blue: 0.42).opacity(0.14), in: Capsule())
                    .foregroundStyle(Color(red: 0.20, green: 0.49, blue: 0.42))
            }

            Text(evaluation.contract.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            ProgressMeter(
                title: evaluation.contract.metricKey.label.capitalized,
                current: min(evaluation.progressValue, evaluation.targetDelta),
                target: max(1, evaluation.targetDelta)
            )

            HStack {
                Text(statusText)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.secondary)
                Spacer()
                Button(buttonTitle, action: claim)
                    .buttonStyle(.borderedProminent)
                    .disabled(!evaluation.completed || evaluation.contract.claimed)
                    .tint(Color(red: 0.21, green: 0.45, blue: 0.38))
            }
        }
        .padding(16)
        .background(Color.black.opacity(0.03), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
    }

    private var buttonTitle: String {
        if evaluation.contract.claimed {
            return "Claimed"
        }
        if evaluation.completed {
            return "Claim +\(evaluation.contract.rewardSteps)"
        }
        return "In Progress"
    }

    private var statusText: String {
        if evaluation.contract.claimed {
            return "Reward claimed."
        }
        if evaluation.completed {
            return "Objective complete."
        }
        return "\(evaluation.remaining) \(evaluation.contract.metricKey.label) remaining."
    }
}

struct ProgressMeter: View {
    let title: String
    let current: Int
    let target: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(current.formatted()) / \(target.formatted())")
                    .font(.caption.weight(.bold))
            }

            GeometryReader { proxy in
                let progress = max(0, min(1, Double(current) / Double(max(1, target))))

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.black.opacity(0.08))
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.95, green: 0.78, blue: 0.33),
                                    Color(red: 0.18, green: 0.46, blue: 0.40),
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .frame(width: proxy.size.width * progress)
                }
            }
            .frame(height: 12)
        }
    }
}

private struct InfoRow: View {
    let title: String
    let value: String

    var body: some View {
        HStack(alignment: .top) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline.weight(.bold))
                .multilineTextAlignment(.trailing)
        }
    }
}

private struct StatusChip: View {
    let text: String
    let tone: StatusTone
    let symbol: String

    var body: some View {
        Label(text, systemImage: symbol)
            .font(.caption.weight(.bold))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(backgroundColor, in: Capsule())
            .foregroundStyle(foregroundColor)
            .overlay(
                Capsule()
                    .strokeBorder(borderColor)
            )
            .shadow(color: Color.black.opacity(0.18), radius: 8, x: 0, y: 4)
    }

    private var backgroundColor: Color {
        switch tone {
        case .online:
            Color(red: 0.81, green: 0.93, blue: 0.83)
        case .offline:
            Color(red: 0.96, green: 0.80, blue: 0.79)
        case .syncing:
            Color(red: 0.97, green: 0.86, blue: 0.66)
        case .muted:
            Color.black.opacity(0.30)
        }
    }

    private var foregroundColor: Color {
        switch tone {
        case .muted:
            .white
        default:
            Color(red: 0.14, green: 0.18, blue: 0.17)
        }
    }

    private var borderColor: Color {
        switch tone {
        case .muted:
            Color.white.opacity(0.10)
        default:
            Color.black.opacity(0.08)
        }
    }
}

struct GameSurfaceCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(Color(red: 0.97, green: 0.96, blue: 0.92).opacity(0.97))
                .shadow(color: Color.black.opacity(0.16), radius: 20, x: 0, y: 12)
        )
    }
}

#Preview {
    RootView(configuration: .current)
}
