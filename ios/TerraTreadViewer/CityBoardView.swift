import SwiftUI

private enum CityHUDSheet: String, Identifiable {
    case overview
    case selection

    var id: String { rawValue }
}

private let hudSurfaceFill = Color(red: 0.08, green: 0.11, blue: 0.10).opacity(0.84)
private let hudControlFill = Color(red: 0.06, green: 0.09, blue: 0.08).opacity(0.78)
private let hudStrokeColor = Color.white.opacity(0.10)
private let lightCardFill = Color(red: 0.96, green: 0.95, blue: 0.91)
private let lightCardTrack = Color.black.opacity(0.10)
private let boardTileSpacing: CGFloat = 1
private let boardBaseTileSize: CGFloat = 34
private let boardMinZoom: CGFloat = 0.35
private let boardMaxZoom: CGFloat = 2.2
private let boardCameraPaddingTiles = 8
private let boardTileOverscan = 3
private let boardInitialFocusPadding = 4

private func plotCoordinateLabel(row: Int, col: Int) -> String {
    "Plot \(row), \(col)"
}

private struct BoardRect {
    let minRow: Int
    let maxRow: Int
    let minCol: Int
    let maxCol: Int

    var width: Int { maxCol - minCol + 1 }
    var height: Int { maxRow - minRow + 1 }
    var midX: CGFloat { (CGFloat(minCol) + CGFloat(maxCol) + 1) / 2 }
    var midY: CGFloat { (CGFloat(minRow) + CGFloat(maxRow) + 1) / 2 }

    func expanded(by padding: Int) -> BoardRect {
        BoardRect(
            minRow: minRow - padding,
            maxRow: maxRow + padding,
            minCol: minCol - padding,
            maxCol: maxCol + padding
        )
    }

    func clamped(to bounds: BoardRect) -> BoardRect {
        BoardRect(
            minRow: max(bounds.minRow, minRow),
            maxRow: min(bounds.maxRow, maxRow),
            minCol: max(bounds.minCol, minCol),
            maxCol: min(bounds.maxCol, maxCol)
        )
    }

    static let buildable = BoardRect(
        minRow: TerraTreadRules.worldMinCoordinate,
        maxRow: TerraTreadRules.worldMaxCoordinate,
        minCol: TerraTreadRules.worldMinCoordinate,
        maxCol: TerraTreadRules.worldMaxCoordinate
    )

    static let camera = BoardRect(
        minRow: TerraTreadRules.worldMinCoordinate - boardCameraPaddingTiles,
        maxRow: TerraTreadRules.worldMaxCoordinate + boardCameraPaddingTiles,
        minCol: TerraTreadRules.worldMinCoordinate - boardCameraPaddingTiles,
        maxCol: TerraTreadRules.worldMaxCoordinate + boardCameraPaddingTiles
    )
}

struct CitySceneView: View {
    let store: GameStore

    @State private var showingResetConfirmation = false
    @State private var showingDemolishConfirmation = false
    @State private var activeSheet: CityHUDSheet?

    var body: some View {
        ZStack {
            BoardStageView(store: store)
                .ignoresSafeArea()

            VStack(spacing: 8) {
                CityTopHUD(
                    store: store,
                    openOverview: { activeSheet = .overview },
                    showResetConfirmation: { showingResetConfirmation = true }
                )

                if let pendingPlacement = store.pendingPlacement {
                    PlacementHUD(
                        pendingPlacement: pendingPlacement,
                        cancel: { store.cancelPlacementMode() },
                        confirm: { store.confirmPendingPlacement() }
                    )
                }

                Spacer(minLength: 0)

                CityBottomHUD(
                    store: store,
                    openOverview: { activeSheet = .overview },
                    openSelectionDetails: { activeSheet = .selection },
                    showResetConfirmation: { showingResetConfirmation = true },
                    showDemolishConfirmation: { showingDemolishConfirmation = true }
                )
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 12)
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .overview:
                CityOverviewSheet(store: store)
            case .selection:
                CitySelectionSheet(store: store)
            }
        }
        .confirmationDialog(
            "Reset your city?",
            isPresented: $showingResetConfirmation,
            titleVisibility: .visible
        ) {
            Button("Reset City", role: .destructive) {
                store.resetCity()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("All placed districts will be removed and their full investment will be refunded.")
        }
        .confirmationDialog(
            "Demolish this district?",
            isPresented: $showingDemolishConfirmation,
            titleVisibility: .visible
        ) {
            Button("Demolish", role: .destructive) {
                store.demolishSelectedBuilding()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("You will receive a partial step refund for the selected district.")
        }
    }
}

private struct BoardStageView: View {
    let store: GameStore

    @State private var cameraCenter = CGPoint.zero
    @State private var zoomScale: CGFloat = 0.75
    @State private var dragStartCenter: CGPoint?
    @State private var zoomStartScale: CGFloat?
    @State private var didConfigureInitialViewport = false

    var body: some View {
        GeometryReader { proxy in
            let viewportSize = proxy.size
            let tileSize = tileSide(for: zoomScale)
            let tilePitch = tileSize + boardTileSpacing
            let visibleRows = visibleRange(
                center: cameraCenter.y,
                span: viewportSize.height / tilePitch,
                lowerBound: BoardRect.camera.minRow,
                upperBound: BoardRect.camera.maxRow
            )
            let visibleColumns = visibleRange(
                center: cameraCenter.x,
                span: viewportSize.width / tilePitch,
                lowerBound: BoardRect.camera.minCol,
                upperBound: BoardRect.camera.maxCol
            )

            let selectedTiles = Set(store.selectedBuilding.map { GameEngine.footprint(for: $0) } ?? [])
            let movingOriginTiles = Set(
                store.relocationBuildingID
                    .flatMap { GameEngine.building(id: $0, buildings: store.state.buildings) }
                    .map { GameEngine.footprint(for: $0) } ?? []
            )
            let pendingTiles = Set(store.pendingPlacement?.tiles ?? [])
            let buildingAnchors = Dictionary(
                uniqueKeysWithValues: store.state.buildings.map { (GridPoint(row: $0.row, col: $0.col), $0) }
            )
            let treeLookup = Dictionary(
                uniqueKeysWithValues: store.state.trees.map { (GridPoint(row: $0.row, col: $0.col), $0) }
            )
            let buildingLookup: [GridPoint: PlacedBuilding] = store.state.buildings.reduce(into: [:]) { partialResult, building in
                for tile in GameEngine.footprint(for: building) {
                    partialResult[tile] = building
                }
            }

            ZStack {
                BoardBackdrop()
                buildLimitOverlay(in: viewportSize, tilePitch: tilePitch)

                ForEach(visibleRows, id: \.self) { row in
                    ForEach(visibleColumns, id: \.self) { col in
                        let point = GridPoint(row: row, col: col)

                        BoardTileView(
                            point: point,
                            tileSize: tileSize,
                            building: buildingLookup[point],
                            isAnchor: buildingAnchors[point] != nil,
                            tree: treeLookup[point],
                            isSelected: selectedTiles.contains(point),
                            isPending: pendingTiles.contains(point),
                            pendingValid: store.pendingPlacement?.isValid ?? false,
                            isMovingOrigin: movingOriginTiles.contains(point),
                            isBuildable: GameEngine.isBuildableTile(row: row, col: col)
                        )
                        .position(tilePosition(for: point, in: viewportSize, tilePitch: tilePitch))
                        .contentShape(Rectangle())
                        .onTapGesture {
                            store.handleTileTap(row: row, col: col)
                        }
                    }
                }
            }
            .clipped()
            .contentShape(Rectangle())
            .simultaneousGesture(dragGesture(viewportSize: viewportSize, tilePitch: tilePitch))
            .simultaneousGesture(magnificationGesture(viewportSize: viewportSize))
            .onAppear {
                configureInitialViewportIfNeeded(in: viewportSize)
            }
            .onChange(of: viewportSize) { _, newSize in
                guard newSize != .zero else { return }

                if didConfigureInitialViewport {
                    cameraCenter = clampedCameraCenter(
                        cameraCenter,
                        viewportSize: newSize,
                        tilePitch: tilePitchForZoom(zoomScale)
                    )
                } else {
                    configureInitialViewportIfNeeded(in: newSize)
                }
            }
        }
    }

    private static func initialFocusRect(for state: GameState) -> BoardRect {
        let buildingTiles = GameEngine.sanitizedBuildings(state.buildings).flatMap(GameEngine.footprint(for:))
        let treeTiles = GameEngine.sanitizedTrees(state.trees).map { GridPoint(row: $0.row, col: $0.col) }
        let occupiedTiles = buildingTiles + treeTiles

        guard let first = occupiedTiles.first else {
            let defaultRect = BoardRect(
                minRow: TerraTreadRules.startingTerrainOrigin,
                maxRow: TerraTreadRules.startingTerrainOrigin + TerraTreadRules.gridSize - 1,
                minCol: TerraTreadRules.startingTerrainOrigin,
                maxCol: TerraTreadRules.startingTerrainOrigin + TerraTreadRules.gridSize - 1
            )
            return defaultRect.expanded(by: boardInitialFocusPadding).clamped(to: .buildable)
        }

        var minRow = first.row
        var maxRow = first.row
        var minCol = first.col
        var maxCol = first.col

        for point in occupiedTiles.dropFirst() {
            minRow = min(minRow, point.row)
            maxRow = max(maxRow, point.row)
            minCol = min(minCol, point.col)
            maxCol = max(maxCol, point.col)
        }

        return BoardRect(minRow: minRow, maxRow: maxRow, minCol: minCol, maxCol: maxCol)
            .expanded(by: boardInitialFocusPadding)
            .clamped(to: .buildable)
    }

    private func configureInitialViewportIfNeeded(in viewportSize: CGSize) {
        guard !didConfigureInitialViewport, viewportSize != .zero else { return }

        let focusRect = Self.initialFocusRect(for: store.state)
        let fittedZoom = fittedZoomScale(for: focusRect, in: viewportSize)

        zoomScale = fittedZoom
        cameraCenter = clampedCameraCenter(
            CGPoint(x: focusRect.midX, y: focusRect.midY),
            viewportSize: viewportSize,
            tilePitch: tilePitchForZoom(fittedZoom)
        )
        didConfigureInitialViewport = true
    }

    private func tileSide(for zoomScale: CGFloat) -> CGFloat {
        boardBaseTileSize * clampedZoom(zoomScale)
    }

    private func tilePitchForZoom(_ zoomScale: CGFloat) -> CGFloat {
        tileSide(for: zoomScale) + boardTileSpacing
    }

    private func clampedZoom(_ value: CGFloat) -> CGFloat {
        min(boardMaxZoom, max(boardMinZoom, value))
    }

    private func fittedZoomScale(for focusRect: BoardRect, in viewportSize: CGSize) -> CGFloat {
        let basePitch = boardBaseTileSize + boardTileSpacing
        let widthScale = viewportSize.width / (CGFloat(max(1, focusRect.width)) * basePitch)
        let heightScale = viewportSize.height / (CGFloat(max(1, focusRect.height)) * basePitch)
        return clampedZoom(min(widthScale, heightScale) * 0.92)
    }

    private func visibleRange(center: CGFloat, span: CGFloat, lowerBound: Int, upperBound: Int) -> ClosedRange<Int> {
        let halfSpan = span / 2
        let lower = max(lowerBound, Int(floor(center - halfSpan)) - boardTileOverscan)
        let upper = min(upperBound, Int(ceil(center + halfSpan)) + boardTileOverscan - 1)
        return lower...max(lower, upper)
    }

    private func tilePosition(for point: GridPoint, in viewportSize: CGSize, tilePitch: CGFloat) -> CGPoint {
        CGPoint(
            x: viewportSize.width / 2 + ((CGFloat(point.col) + 0.5 - cameraCenter.x) * tilePitch),
            y: viewportSize.height / 2 + ((CGFloat(point.row) + 0.5 - cameraCenter.y) * tilePitch)
        )
    }

    private func clampedCameraCenter(_ proposed: CGPoint, viewportSize: CGSize, tilePitch: CGFloat) -> CGPoint {
        let halfWidth = viewportSize.width / (2 * tilePitch)
        let halfHeight = viewportSize.height / (2 * tilePitch)

        let minX = CGFloat(BoardRect.camera.minCol) + halfWidth
        let maxX = CGFloat(BoardRect.camera.maxCol + 1) - halfWidth
        let minY = CGFloat(BoardRect.camera.minRow) + halfHeight
        let maxY = CGFloat(BoardRect.camera.maxRow + 1) - halfHeight

        return CGPoint(
            x: clampedCoordinate(proposed.x, min: minX, max: maxX, fallback: BoardRect.buildable.midX),
            y: clampedCoordinate(proposed.y, min: minY, max: maxY, fallback: BoardRect.buildable.midY)
        )
    }

    private func clampedCoordinate(_ value: CGFloat, min lower: CGFloat, max upper: CGFloat, fallback: CGFloat) -> CGFloat {
        guard lower <= upper else { return fallback }
        return Swift.min(Swift.max(value, lower), upper)
    }

    private func buildLimitOverlay(in viewportSize: CGSize, tilePitch: CGFloat) -> some View {
        let width = CGFloat(BoardRect.buildable.width) * tilePitch - boardTileSpacing
        let height = CGFloat(BoardRect.buildable.height) * tilePitch - boardTileSpacing

        return RoundedRectangle(cornerRadius: max(18, tilePitch * 0.8), style: .continuous)
            .strokeBorder(
                Color.white.opacity(0.22),
                style: StrokeStyle(
                    lineWidth: max(1.5, tilePitch * 0.05),
                    dash: [max(6, tilePitch * 0.55), max(4, tilePitch * 0.28)]
                )
            )
            .frame(width: width, height: height)
            .position(
                x: viewportSize.width / 2 + ((BoardRect.buildable.midX - cameraCenter.x) * tilePitch),
                y: viewportSize.height / 2 + ((BoardRect.buildable.midY - cameraCenter.y) * tilePitch)
            )
            .blendMode(.screen)
    }

    private func dragGesture(viewportSize: CGSize, tilePitch: CGFloat) -> some Gesture {
        DragGesture(minimumDistance: 6)
            .onChanged { value in
                if dragStartCenter == nil {
                    dragStartCenter = cameraCenter
                }

                guard let dragStartCenter else { return }

                let proposed = CGPoint(
                    x: dragStartCenter.x - (value.translation.width / tilePitch),
                    y: dragStartCenter.y - (value.translation.height / tilePitch)
                )
                cameraCenter = clampedCameraCenter(proposed, viewportSize: viewportSize, tilePitch: tilePitch)
            }
            .onEnded { _ in
                dragStartCenter = nil
            }
    }

    private func magnificationGesture(viewportSize: CGSize) -> some Gesture {
        MagnificationGesture()
            .onChanged { value in
                if zoomStartScale == nil {
                    zoomStartScale = zoomScale
                }

                guard let zoomStartScale else { return }

                let nextZoom = clampedZoom(zoomStartScale * value)
                zoomScale = nextZoom
                cameraCenter = clampedCameraCenter(
                    cameraCenter,
                    viewportSize: viewportSize,
                    tilePitch: tilePitchForZoom(nextZoom)
                )
            }
            .onEnded { _ in
                zoomStartScale = nil
            }
    }
}

private struct BoardBackdrop: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.17, green: 0.30, blue: 0.27),
                    Color(red: 0.24, green: 0.44, blue: 0.36),
                    Color(red: 0.34, green: 0.53, blue: 0.33),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            RadialGradient(
                colors: [
                    Color.white.opacity(0.20),
                    Color.clear,
                ],
                center: .top,
                startRadius: 0,
                endRadius: 340
            )

            LinearGradient(
                colors: [
                    Color.black.opacity(0.30),
                    Color.clear,
                    Color.black.opacity(0.20),
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }
}

private struct BoardTileView: View {
    let point: GridPoint
    let tileSize: CGFloat
    let building: PlacedBuilding?
    let isAnchor: Bool
    let tree: TreeTile?
    let isSelected: Bool
    let isPending: Bool
    let pendingValid: Bool
    let isMovingOrigin: Bool
    let isBuildable: Bool

    var body: some View {
        ZStack {
            Rectangle()
                .fill(tileBackground)

            if let building {
                Rectangle()
                    .fill(buildingColor(for: building.type))
                    .opacity(isMovingOrigin ? 0.45 : 0.94)

                if isAnchor {
                    VStack(spacing: 1) {
                        Image(systemName: GameEngine.buildingDefinition(for: building.type).icon)
                            .font(.system(size: max(8, tileSize * 0.34), weight: .black))
                        Text("Lv\(building.level)")
                            .font(
                                .system(
                                    size: max(5, tileSize * 0.17),
                                    weight: .heavy,
                                    design: .rounded
                                )
                            )
                    }
                    .foregroundStyle(.white)
                    .shadow(color: Color.black.opacity(0.32), radius: 2, x: 0, y: 1)
                }
            } else if let tree {
                Image(systemName: tree.imageIndex % 2 == 0 ? "tree.fill" : "leaf.fill")
                    .font(.system(size: max(8, tileSize * 0.30), weight: .bold))
                    .foregroundStyle(Color(red: 0.10, green: 0.33, blue: 0.17))
            }

            if isSelected {
                Rectangle()
                    .strokeBorder(Color.white, lineWidth: 2)
            }

            if isPending {
                Rectangle()
                    .strokeBorder(pendingValid ? Color.yellow : Color.red, lineWidth: 2.5)
            }
        }
        .frame(width: tileSize, height: tileSize)
        .animation(.easeInOut(duration: 0.12), value: isSelected)
    }

    private var tileBackground: Color {
        guard isBuildable else {
            let variance = ((point.row * 13 + point.col * 9) % 7) - 3
            let brightness = 0.18 + (Double(variance) * 0.012)
            return Color(hue: 0.55, saturation: 0.18, brightness: brightness)
        }

        let variance = ((point.row * 17 + point.col * 11) % 9) - 4
        let brightness = 0.50 + (Double(variance) * 0.018)
        return Color(hue: 0.32, saturation: 0.42, brightness: brightness)
    }

    private func buildingColor(for type: BuildingType) -> Color {
        switch type {
        case .house:
            Color(red: 0.91, green: 0.54, blue: 0.40)
        case .park:
            Color(red: 0.20, green: 0.59, blue: 0.33)
        case .shop:
            Color(red: 0.22, green: 0.49, blue: 0.74)
        case .plaza:
            Color(red: 0.61, green: 0.43, blue: 0.74)
        case .orchard:
            Color(red: 0.88, green: 0.61, blue: 0.26)
        case .school:
            Color(red: 0.28, green: 0.54, blue: 0.51)
        case .market:
            Color(red: 0.84, green: 0.34, blue: 0.30)
        case .library:
            Color(red: 0.33, green: 0.39, blue: 0.65)
        case .workshop:
            Color(red: 0.36, green: 0.43, blue: 0.46)
        }
    }
}

private struct CityTopHUD: View {
    let store: GameStore
    let openOverview: () -> Void
    let showResetConfirmation: () -> Void

    var body: some View {
        HStack(spacing: 8) {
            HUDCompactSurface {
                HStack(spacing: 10) {
                    Label("Lv \(store.citySummary.level)", systemImage: "leaf.circle.fill")
                        .font(.caption.weight(.black))
                        .foregroundStyle(.white)

                    HUDProgressBar(progress: store.citySummary.progressPercent / 100)
                        .frame(width: 82, height: 6)

                    if let nextUnlock = store.citySummary.nextUnlock {
                        Image(systemName: GameEngine.buildingDefinition(for: nextUnlock).icon)
                            .font(.caption.weight(.black))
                            .foregroundStyle(Color(red: 0.98, green: 0.86, blue: 0.49))
                            .accessibilityLabel("Next unlock")
                    }
                }
            }

            Spacer(minLength: 0)

            StepBankChip(steps: store.state.availableSteps)

            Menu {
                Button {
                    openOverview()
                } label: {
                    Label("City Details", systemImage: "chart.bar.fill")
                }

                Button(role: .destructive) {
                    showResetConfirmation()
                } label: {
                    Label("Reset City", systemImage: "trash")
                }
            } label: {
                HUDIconButtonChrome(symbol: "ellipsis.circle.fill")
            }
        }
    }
}

private struct CityBottomHUD: View {
    let store: GameStore
    let openOverview: () -> Void
    let openSelectionDetails: () -> Void
    let showResetConfirmation: () -> Void
    let showDemolishConfirmation: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            if store.selectedBuildType != nil || store.selectedBuilding != nil {
                CompactInspectorHUD(
                    store: store,
                    openSelectionDetails: openSelectionDetails,
                    showDemolishConfirmation: showDemolishConfirmation
                )
            }

            ActionDock(
                store: store,
                openOverview: openOverview,
                openSelectionDetails: openSelectionDetails,
                showResetConfirmation: showResetConfirmation
            )
        }
        .frame(maxWidth: .infinity)
    }
}

private struct CompactInspectorHUD: View {
    let store: GameStore
    let openSelectionDetails: () -> Void
    let showDemolishConfirmation: () -> Void

    var body: some View {
        HUDCompactSurface {
            if let selectedBuildType = store.selectedBuildType {
                let definition = GameEngine.buildingDefinition(for: selectedBuildType)

                HStack(spacing: 10) {
                    Image(systemName: definition.icon)
                        .font(.headline.weight(.black))
                        .foregroundStyle(Color(red: 0.98, green: 0.86, blue: 0.49))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(definition.label)
                            .font(.subheadline.weight(.black))
                            .foregroundStyle(.white)

                        Text("\(definition.cost) steps • \(definition.width)×\(definition.height)")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white.opacity(0.72))
                    }

                    Spacer(minLength: 0)

                    Button {
                        openSelectionDetails()
                    } label: {
                        Image(systemName: "info.circle")
                    }
                    .buttonStyle(HUDIconButtonStyle(tone: .glass))
                    .accessibilityLabel("Selection details")

                    Button {
                        store.cancelPlacementMode()
                    } label: {
                        Image(systemName: "xmark")
                    }
                    .buttonStyle(HUDIconButtonStyle(tone: .glass))
                    .accessibilityLabel("Cancel placement")
                }
            } else if let building = store.selectedBuilding {
                let definition = GameEngine.buildingDefinition(for: building.type)
                let upgradeCost = GameEngine.buildingUpgradeCost(building)
                let effectText = (
                    store.selectedBuildingBreakdown?.totalEffects ??
                        definition.baseEffects.scaled(
                            multiplier: GameEngine.buildingLevelMultiplier(building.level)
                        )
                ).formatted(short: true)

                HStack(spacing: 10) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack(spacing: 6) {
                            Image(systemName: definition.icon)
                                .font(.caption.weight(.black))
                                .foregroundStyle(Color(red: 0.98, green: 0.86, blue: 0.49))

                            Text(definition.label)
                                .font(.subheadline.weight(.black))
                                .foregroundStyle(.white)

                            Text("Lv\(building.level)")
                                .font(.caption2.weight(.black))
                                .foregroundStyle(.white.opacity(0.72))
                        }

                        Text(effectText)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white.opacity(0.72))
                            .lineLimit(1)
                    }

                    Spacer(minLength: 0)

                    Button {
                        store.upgradeSelectedBuilding()
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.up.circle.fill")

                            if upgradeCost > 0 {
                                Text("\(upgradeCost)")
                            }
                        }
                    }
                    .buttonStyle(HUDPillButtonStyle(tone: .accent))
                    .disabled(upgradeCost == 0 || store.state.availableSteps < upgradeCost || store.pendingPlacement != nil)
                    .accessibilityLabel(upgradeCost > 0 ? "Upgrade for \(upgradeCost) steps" : "Upgrade unavailable")

                    Menu {
                        Button {
                            openSelectionDetails()
                        } label: {
                            Label("District Details", systemImage: "info.circle")
                        }

                        Button {
                            store.beginRelocationForSelectedBuilding()
                        } label: {
                            Label(
                                store.relocationBuildingID == building.id ? "Cancel Move" : "Move",
                                systemImage: "arrow.up.left.and.arrow.down.right"
                            )
                        }

                        Button(role: .destructive) {
                            showDemolishConfirmation()
                        } label: {
                            Label("Demolish", systemImage: "trash")
                        }
                    } label: {
                        HUDIconButtonChrome(symbol: "ellipsis")
                    }
                }
            }
        }
    }
}

private struct PlacementHUD: View {
    let pendingPlacement: PendingPlacement
    let cancel: () -> Void
    let confirm: () -> Void

    var body: some View {
        HUDCompactSurface {
            HStack(spacing: 10) {
                Label(placementText, systemImage: pendingPlacement.isValid ? "scope" : "xmark.octagon.fill")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.white)
                    .lineLimit(1)

                Spacer(minLength: 0)

                Button(action: cancel) {
                    Image(systemName: "xmark")
                }
                .buttonStyle(HUDIconButtonStyle(tone: .glass))
                .accessibilityLabel("Cancel")

                Button(action: confirm) {
                    Image(systemName: "checkmark")
                }
                .buttonStyle(HUDIconButtonStyle(tone: .accent))
                .disabled(!pendingPlacement.isValid)
                .accessibilityLabel("Confirm")
            }
        }
    }

    private var placementText: String {
        if pendingPlacement.isValid {
            switch pendingPlacement.mode {
            case .build(let type):
                return "\(GameEngine.buildingDefinition(for: type).label) • \(plotCoordinateLabel(row: pendingPlacement.row, col: pendingPlacement.col))"
            case .move:
                return "Move • \(plotCoordinateLabel(row: pendingPlacement.row, col: pendingPlacement.col))"
            }
        }

        switch pendingPlacement.blockedReason {
        case "occupied":
            return "Occupied"
        case "out-of-bounds":
            return "City limit"
        default:
            return "Blocked"
        }
    }
}

private struct ActionDock: View {
    let store: GameStore
    let openOverview: () -> Void
    let openSelectionDetails: () -> Void
    let showResetConfirmation: () -> Void

    var body: some View {
        HUDDockSurface {
            HStack(spacing: 8) {
                Button {
                    store.openBuildCatalog()
                } label: {
                    Image(systemName: "hammer.fill")
                }
                .buttonStyle(HUDIconButtonStyle(tone: .accent))
                .accessibilityLabel("Build")

                Button {
                    store.undo()
                } label: {
                    Image(systemName: "arrow.uturn.backward")
                }
                .buttonStyle(HUDIconButtonStyle(tone: .glass))
                .disabled(!store.canUndo)
                .accessibilityLabel("Undo")

                Menu {
                    Button {
                        openOverview()
                    } label: {
                        Label("City Details", systemImage: "chart.bar.fill")
                    }

                    if store.selectedBuildType != nil || store.selectedBuilding != nil {
                        Button {
                            openSelectionDetails()
                        } label: {
                            Label("Selection Details", systemImage: "info.circle")
                        }
                    }

                    Button(role: .destructive) {
                        showResetConfirmation()
                    } label: {
                        Label("Reset City", systemImage: "trash")
                    }
                } label: {
                    HUDIconButtonChrome(symbol: "ellipsis")
                }
            }
        }
    }
}

private struct StepBankChip: View {
    let steps: Int

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "shoeprints.fill")
                .font(.caption.weight(.black))
            Text(steps.formatted())
                .font(.caption.weight(.black))
        }
        .foregroundStyle(Color(red: 0.15, green: 0.18, blue: 0.16))
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(
            Capsule(style: .continuous)
                .fill(Color(red: 0.96, green: 0.79, blue: 0.33))
        )
    }
}

private struct CityOverviewSheet: View {
    let store: GameStore

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    overviewCard
                    statsGrid
                    statusCard
                }
                .padding(16)
            }
            .background(Color(red: 0.84, green: 0.91, blue: 0.87).ignoresSafeArea())
            .navigationTitle("City")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var overviewCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Level \(store.citySummary.level)")
                    .font(.headline.weight(.black))

                Spacer()

                Text("\(Int(store.citySummary.progressPercent.rounded()))%")
                    .font(.caption.weight(.black))
            }

            HUDProgressBar(progress: store.citySummary.progressPercent / 100, trackColor: lightCardTrack)
                .frame(height: 10)

            HStack(spacing: 12) {
                OverviewMetric(symbol: "shoeprints.fill", title: "Steps", value: store.state.availableSteps.formatted())
                OverviewMetric(symbol: "sparkles", title: "Prosperity", value: store.citySummary.prosperity.formatted())
                OverviewMetric(symbol: "square.grid.3x3.fill", title: "Districts", value: store.citySummary.buildingCount.formatted())
            }

            Text(nextUnlockText)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(red: 0.18, green: 0.31, blue: 0.27))
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(lightCardFill)
        )
    }

    private var statsGrid: some View {
        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 10), count: 2), spacing: 10) {
            OverviewMetric(symbol: "person.3.fill", title: "Population", value: store.citySummary.stats.population.formatted())
            OverviewMetric(symbol: "bitcoinsign.bank.building.fill", title: "Trade", value: store.citySummary.stats.commerce.formatted())
            OverviewMetric(symbol: "face.smiling.fill", title: "Joy", value: store.citySummary.stats.happiness.formatted())
            OverviewMetric(symbol: "leaf.fill", title: "Green", value: store.citySummary.stats.ecology.formatted())
        }
    }

    private var statusCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            OverviewStatusRow(symbol: "person.fill", title: "Player", value: store.playerStatusText)
            OverviewStatusRow(symbol: "antenna.radiowaves.left.and.right", title: "Connection", value: store.connectionStatusText)
            OverviewStatusRow(symbol: "icloud.fill", title: "Cloud", value: store.cloudStatusText)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(lightCardFill)
        )
    }

    private var nextUnlockText: String {
        guard let nextUnlock = store.citySummary.nextUnlock else {
            return "All districts unlocked"
        }

        let definition = GameEngine.buildingDefinition(for: nextUnlock)
        return "Next unlock: \(definition.label) at level \(definition.unlockLevel)"
    }
}

private struct CitySelectionSheet: View {
    let store: GameStore

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let selectedBuildType = store.selectedBuildType {
                        let definition = GameEngine.buildingDefinition(for: selectedBuildType)

                        detailCard(
                            title: definition.label,
                            subtitle: "Placement",
                            body: [
                                "\(definition.cost) steps",
                                "\(definition.width)×\(definition.height) footprint",
                                definition.baseEffects.formatted(),
                                definition.synergies.map(\.label).joined(separator: " • "),
                            ]
                        )
                    } else if let building = store.selectedBuilding {
                        let definition = GameEngine.buildingDefinition(for: building.type)
                        let refundSteps = Int(
                            (
                                Double(GameEngine.buildingTotalInvestment(building)) *
                                    TerraTreadRules.demolishRefundRatio
                            ).rounded()
                        )
                        let effectText = (
                            store.selectedBuildingBreakdown?.totalEffects ??
                                definition.baseEffects.scaled(
                                    multiplier: GameEngine.buildingLevelMultiplier(building.level)
                                )
                        ).formatted()

                        detailCard(
                            title: definition.label,
                            subtitle: "Lv \(building.level)/\(GameEngine.buildingMaxLevel(for: building.type))",
                            body: [
                                plotCoordinateLabel(row: building.row, col: building.col),
                                "\(definition.width)×\(definition.height) footprint",
                                effectText,
                                "Refund \(refundSteps) steps",
                            ]
                        )
                    } else {
                        detailCard(
                            title: "No Selection",
                            subtitle: "Board Idle",
                            body: ["Tap a district to inspect it or place a new one from the dock."]
                        )
                    }
                }
                .padding(16)
            }
            .background(Color(red: 0.84, green: 0.91, blue: 0.87).ignoresSafeArea())
            .navigationTitle("Selection")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private func detailCard(title: String, subtitle: String, body: [String]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.headline.weight(.black))

                Spacer()

                Text(subtitle)
                    .font(.caption.weight(.black))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(Color.black.opacity(0.08), in: Capsule())
            }

            ForEach(body, id: \.self) { line in
                Text(line)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(red: 0.18, green: 0.31, blue: 0.27))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(lightCardFill)
        )
    }
}

private struct OverviewMetric: View {
    let symbol: String
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Image(systemName: symbol)
                .font(.headline.weight(.black))
                .foregroundStyle(Color(red: 0.18, green: 0.31, blue: 0.27))

            Text(value)
                .font(.headline.weight(.black))

            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(lightCardFill)
        )
    }
}

private struct OverviewStatusRow: View {
    let symbol: String
    let title: String
    let value: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .frame(width: 22)

            Text(title)
                .font(.subheadline.weight(.bold))

            Spacer()

            Text(value)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .foregroundStyle(Color(red: 0.18, green: 0.31, blue: 0.27))
    }
}

private struct HUDProgressBar: View {
    let progress: Double
    let trackColor: Color

    init(progress: Double, trackColor: Color = Color.white.opacity(0.16)) {
        self.progress = progress
        self.trackColor = trackColor
    }

    var body: some View {
        GeometryReader { proxy in
            let clamped = max(0, min(1, progress))

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(trackColor)

                Capsule()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.97, green: 0.84, blue: 0.46),
                                Color(red: 0.43, green: 0.82, blue: 0.55),
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .frame(width: proxy.size.width * clamped)
            }
        }
        .frame(height: 10)
    }
}

private enum HUDButtonTone {
    case accent
    case glass
}

private struct HUDCompactSurface<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(hudSurfaceFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(hudStrokeColor)
            )
            .shadow(color: Color.black.opacity(0.24), radius: 16, x: 0, y: 8)
    }
}

private struct HUDDockSurface<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(6)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(hudSurfaceFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(hudStrokeColor)
            )
            .shadow(color: Color.black.opacity(0.26), radius: 18, x: 0, y: 10)
    }
}

private struct HUDIconButtonChrome: View {
    let symbol: String

    var body: some View {
        Image(systemName: symbol)
            .font(.headline.weight(.black))
            .frame(width: 42, height: 42)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(hudControlFill)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(hudStrokeColor)
            )
            .foregroundStyle(.white)
            .shadow(color: Color.black.opacity(0.20), radius: 8, x: 0, y: 4)
    }
}

private struct HUDIconButtonStyle: ButtonStyle {
    let tone: HUDButtonTone

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.black))
            .frame(width: 42, height: 42)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(borderColor)
            )
            .foregroundStyle(foregroundColor)
            .opacity(configuration.isPressed ? 0.84 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }

    private var backgroundColor: Color {
        switch tone {
        case .accent:
            Color(red: 0.96, green: 0.79, blue: 0.33)
        case .glass:
            hudControlFill
        }
    }

    private var foregroundColor: Color {
        switch tone {
        case .accent:
            Color(red: 0.15, green: 0.18, blue: 0.16)
        case .glass:
            .white
        }
    }

    private var borderColor: Color {
        switch tone {
        case .accent:
            Color.clear
        case .glass:
            hudStrokeColor
        }
    }
}

private struct HUDPillButtonStyle: ButtonStyle {
    let tone: HUDButtonTone

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.caption.weight(.black))
            .padding(.horizontal, 10)
            .frame(height: 42)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(backgroundColor)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(borderColor)
            )
            .foregroundStyle(foregroundColor)
            .opacity(configuration.isPressed ? 0.84 : 1)
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }

    private var backgroundColor: Color {
        switch tone {
        case .accent:
            Color(red: 0.96, green: 0.79, blue: 0.33)
        case .glass:
            hudControlFill
        }
    }

    private var foregroundColor: Color {
        switch tone {
        case .accent:
            Color(red: 0.15, green: 0.18, blue: 0.16)
        case .glass:
            .white
        }
    }

    private var borderColor: Color {
        switch tone {
        case .accent:
            Color.clear
        case .glass:
            hudStrokeColor
        }
    }
}

struct BuildCatalogSheet: View {
    let store: GameStore

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    ForEach(GameEngine.buildingEntries()) { definition in
                        let unlocked = GameEngine.isBuildingUnlocked(definition.type, level: store.citySummary.level)
                        let affordable = store.state.availableSteps >= definition.cost

                        Button {
                            store.startBuilding(definition.type)
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 10) {
                                HStack {
                                    Label(definition.label, systemImage: definition.icon)
                                        .font(.headline.weight(.bold))
                                    Spacer()
                                    Text("Lv \(definition.unlockLevel)")
                                        .font(.caption.weight(.bold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color.black.opacity(0.08), in: Capsule())
                                }

                                HStack {
                                    Text("\(definition.cost) steps")
                                        .font(.subheadline.weight(.bold))
                                    Spacer()
                                    Text(definition.baseEffects.formatted(short: true))
                                        .font(.caption.weight(.semibold))
                                }
                                .foregroundStyle(.secondary)

                                Text(definition.synergies.map(\.label).joined(separator: " • "))
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(Color(red: 0.18, green: 0.31, blue: 0.27))

                                Text(statusText(unlocked: unlocked, affordable: affordable, unlockLevel: definition.unlockLevel, cost: definition.cost))
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(unlocked && affordable ? .green : .secondary)
                            }
                            .padding(16)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(
                                RoundedRectangle(cornerRadius: 24, style: .continuous)
                                    .fill(lightCardFill)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(!unlocked)
                        .opacity(unlocked ? 1 : 0.65)
                    }
                }
                .padding(16)
            }
            .background(Color(red: 0.84, green: 0.91, blue: 0.87).ignoresSafeArea())
            .navigationTitle("Build Drawer")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private func statusText(unlocked: Bool, affordable: Bool, unlockLevel: Int, cost: Int) -> String {
        if !unlocked {
            return "Unlocks at city level \(unlockLevel)."
        }
        if affordable {
            return "Ready to place."
        }
        return "Need \(max(0, cost - store.state.availableSteps)) more steps."
    }
}
