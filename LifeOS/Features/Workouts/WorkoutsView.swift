import SwiftUI
import SwiftData

// MARK: - Workouts history screen

struct WorkoutsView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppTheme.self)  private var theme
    @Query(sort: \Workout.date, order: .reverse) private var allWorkouts: [Workout]

    @Query(sort: \WorkoutTemplate.createdAt, order: .reverse) private var templates: [WorkoutTemplate]

    @State private var workoutName          = "Workout"
    @State private var showingNameSheet     = false
    @State private var activeWorkout: Workout?
    @State private var showingActiveWorkout = false

    // MARK: Filtered lists

    private var completedWorkouts: [Workout] {
        allWorkouts.filter { !$0.isActive }
    }

    // MARK: Monthly stats (current calendar month)

    private var monthlyVolume: Double {
        let cal = Calendar.current
        let now = Date()
        return completedWorkouts
            .filter { cal.isDate($0.date, equalTo: now, toGranularity: .month) }
            .reduce(0) { $0 + $1.totalVolume }
    }

    private var monthlySessions: Int {
        let cal = Calendar.current
        let now = Date()
        return completedWorkouts
            .filter { cal.isDate($0.date, equalTo: now, toGranularity: .month) }
            .count
    }

    private var monthlyVolumeDisplay: String {
        monthlyVolume >= 1000
            ? String(format: "%.1fK", monthlyVolume / 1000)
            : "\(Int(monthlyVolume))"
    }

    // Group by day label (Today / Yesterday / "Mon, May 5")
    private var groupedWorkouts: [(String, [Workout])] {
        var groups: [(String, [Workout])] = []
        var seen: [String: Bool] = [:]
        for workout in completedWorkouts {
            let key = dateKey(workout.date)
            if seen[key] == nil {
                seen[key] = true
                let batch = completedWorkouts.filter { dateKey($0.date) == key }
                groups.append((key, batch))
            }
        }
        return groups
    }

    private func dateKey(_ date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date)     { return "Today" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(.dateTime.weekday(.abbreviated).month(.abbreviated).day())
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                if completedWorkouts.isEmpty {
                    emptyState
                } else {
                    List {
                        // Monthly stats header — not a real list section, just floats at top
                        monthlyStatsRow
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)

                        ForEach(groupedWorkouts, id: \.0) { key, workouts in
                            Section {
                                ForEach(workouts) { workout in
                                    NavigationLink(destination: WorkoutDetailView(workout: workout)) {
                                        WorkoutHistoryRow(workout: workout, accent: theme.workoutsAccent)
                                    }
                                    .listRowBackground(Color.appSurface)
                                    .listRowSeparatorTint(Color.appSeparator)
                                }
                            } header: {
                                Text(key)
                                    .font(.appCaption)
                                    .foregroundColor(.appTextSecondary)
                                    .tracking(1.5)
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Workouts")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        workoutName = "Workout"
                        showingNameSheet = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(theme.workoutsAccent)
                    }
                }
            }
            .sheet(isPresented: $showingNameSheet) {
                nameWorkoutSheet
            }
            .fullScreenCover(isPresented: $showingActiveWorkout) {
                if let workout = activeWorkout {
                    ActiveWorkoutView(workout: workout) {
                        showingActiveWorkout = false
                        activeWorkout = nil
                    }
                }
            }
        }
    }

    // MARK: Monthly stats row

    private var monthlyStatsRow: some View {
        HStack(spacing: AppSpacing.md) {
            statCard(title: "MONTHLY VOLUME", value: monthlyVolumeDisplay, unit: "LBS")
            statCard(title: "COMPLETED",      value: "\(monthlySessions)",  unit: "SESSIONS")
        }
        .padding(.vertical, AppSpacing.xs)
    }

    private func statCard(title: String, value: String, unit: String) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(title)
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1)
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(value)
                    .font(.appMono)
                    .foregroundColor(theme.workoutsAccent)
                Text(unit)
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
    }

    // MARK: Empty state

    private var emptyState: some View {
        VStack(spacing: AppSpacing.md) {
            Text("No workouts yet")
                .font(.appHeadline)
                .foregroundColor(.appTextSecondary)
            Button("Start your first workout") {
                workoutName = "Workout"
                showingNameSheet = true
            }
            .font(.appBody)
            .foregroundColor(theme.workoutsAccent)
        }
    }

    // MARK: Name / start workout sheet

    private var nameWorkoutSheet: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: AppSpacing.lg) {

                        // ── Readiness card ───────────────────────────────
                        if let r = WhoopService.shared.recovery {
                            readinessCard(r)
                                .padding(.horizontal, AppSpacing.lg)
                        }

                        // ── Repeat last workout ──────────────────────────
                        if let last = completedWorkouts.first {
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                sectionLabel("REPEAT")
                                Button { repeatLast(last) } label: {
                                    HStack(spacing: AppSpacing.md) {
                                        Image(systemName: "arrow.counterclockwise")
                                            .font(.system(size: 15))
                                            .foregroundColor(theme.workoutsAccent)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(last.name)
                                                .font(.appHeadline)
                                                .foregroundColor(.appTextPrimary)
                                            Text("\(last.exercises.count) exercise\(last.exercises.count == 1 ? "" : "s") · \(last.date.formatted(date: .abbreviated, time: .omitted))")
                                                .font(.appCaption)
                                                .foregroundColor(.appTextSecondary)
                                        }
                                        Spacer()
                                        Text("Start")
                                            .font(.system(size: 13, weight: .bold))
                                            .foregroundColor(.black)
                                            .padding(.horizontal, AppSpacing.md)
                                            .padding(.vertical, 6)
                                            .background(theme.workoutsAccent)
                                            .cornerRadius(AppRadius.sm)
                                    }
                                    .padding(AppSpacing.md)
                                    .background(Color.appSurface)
                                    .cornerRadius(AppRadius.md)
                                }
                                .buttonStyle(.plain)
                            }
                            .padding(.horizontal, AppSpacing.lg)
                        }

                        // ── Saved templates ──────────────────────────────
                        if !templates.isEmpty {
                            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                                sectionLabel("MY TEMPLATES")
                                ForEach(templates) { template in
                                    HStack(spacing: AppSpacing.md) {
                                        Image(systemName: "bookmark.fill")
                                            .font(.system(size: 14))
                                            .foregroundColor(theme.workoutsAccent)
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(template.name)
                                                .font(.appHeadline)
                                                .foregroundColor(.appTextPrimary)
                                            Text(template.exerciseSummary)
                                                .font(.appCaption)
                                                .foregroundColor(.appTextSecondary)
                                                .lineLimit(1)
                                        }
                                        Spacer()
                                        Button {
                                            startFromTemplate(template)
                                        } label: {
                                            Text("Start")
                                                .font(.system(size: 13, weight: .bold))
                                                .foregroundColor(.black)
                                                .padding(.horizontal, AppSpacing.md)
                                                .padding(.vertical, 6)
                                                .background(theme.workoutsAccent)
                                                .cornerRadius(AppRadius.sm)
                                        }
                                        .buttonStyle(.plain)

                                        Button {
                                            context.delete(template)
                                        } label: {
                                            Image(systemName: "trash")
                                                .font(.system(size: 13))
                                                .foregroundColor(.appDestructive)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                    .padding(AppSpacing.md)
                                    .background(Color.appSurface)
                                    .cornerRadius(AppRadius.md)
                                }
                            }
                            .padding(.horizontal, AppSpacing.lg)
                        }

                        // ── Custom name ──────────────────────────────────
                        VStack(alignment: .leading, spacing: AppSpacing.sm) {
                            if !templates.isEmpty || completedWorkouts.first != nil {
                                sectionLabel("CUSTOM")
                            }
                            TextField("Workout name", text: $workoutName)
                                .font(.appTitle)
                                .foregroundColor(.appTextPrimary)
                                .multilineTextAlignment(.center)
                                .padding(AppSpacing.md)
                                .background(Color.appSurface)
                                .cornerRadius(AppRadius.md)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: AppSpacing.sm) {
                                    ForEach(
                                        ["Push Day", "Pull Day", "Leg Day",
                                         "Upper",    "Lower",    "Full Body"],
                                        id: \.self
                                    ) { preset in
                                        Button(preset) { workoutName = preset }
                                            .font(.appBody)
                                            .foregroundColor(workoutName == preset ? .black : .appTextPrimary)
                                            .padding(.horizontal, AppSpacing.md)
                                            .padding(.vertical, AppSpacing.sm)
                                            .background(workoutName == preset ? theme.workoutsAccent : Color.appSurface)
                                            .cornerRadius(AppRadius.sm)
                                    }
                                }
                            }
                        }
                        .padding(.horizontal, AppSpacing.lg)

                        Spacer(minLength: AppSpacing.xxl)
                    }
                    .padding(.top, AppSpacing.lg)
                }
            }
            .navigationTitle("Start Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingNameSheet = false }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    let trimmed = workoutName.trimmingCharacters(in: .whitespaces)
                    Button("Begin") {
                        showingNameSheet = false
                        startCustomWorkout()
                    }
                    .font(.system(size: 17, weight: .bold))
                    .foregroundColor(trimmed.isEmpty ? .appTextSecondary : theme.workoutsAccent)
                    .disabled(trimmed.isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text)
            .font(.appCaption)
            .foregroundColor(.appTextSecondary)
            .tracking(1.5)
    }

    private func readinessCard(_ r: WhoopRecovery) -> some View {
        HStack(spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text("READINESS")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(1.5)
                Text(r.scoreLabel)
                    .font(.appHeadline)
                    .foregroundColor(recoveryColor(r.score))
            }
            Spacer()
            Text("\(r.score)")
                .font(.system(size: 32, weight: .bold, design: .rounded))
                .foregroundColor(recoveryColor(r.score))
            Text("/ 100")
                .font(.appBody)
                .foregroundColor(.appTextSecondary)
                .padding(.bottom, 2)
        }
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
    }

    private func recoveryColor(_ score: Int) -> Color {
        switch score {
        case 67...100: return .appPriorityLow
        case 34...66:  return .appPriorityMedium
        default:       return .appPriorityHigh
        }
    }

    // MARK: Actions

    private func startCustomWorkout() {
        let workout = Workout(name: workoutName.trimmingCharacters(in: .whitespaces))
        context.insert(workout)
        activeWorkout         = workout
        showingActiveWorkout  = true
    }

    private func repeatLast(_ last: Workout) {
        showingNameSheet = false
        let workout = Workout(name: last.name)
        context.insert(workout)
        for ex in last.exercises.sorted(by: { $0.createdAt < $1.createdAt }) {
            let newEx = WorkoutExercise(name: ex.name)
            newEx.suggestedWeight = ex.lastSet?.weight ?? 0
            newEx.suggestedReps   = ex.lastSet?.reps   ?? 8
            context.insert(newEx)
            workout.exercises.append(newEx)
        }
        activeWorkout        = workout
        showingActiveWorkout = true
    }

    private func startFromTemplate(_ template: WorkoutTemplate) {
        showingNameSheet = false
        let workout = Workout(name: template.name)
        context.insert(workout)
        for te in template.orderedExercises {
            let ex = WorkoutExercise(name: te.name)
            ex.suggestedWeight = te.suggestedWeight
            ex.suggestedReps   = te.suggestedReps
            context.insert(ex)
            workout.exercises.append(ex)
        }
        activeWorkout        = workout
        showingActiveWorkout = true
    }
}

// MARK: - Workout history row

struct WorkoutHistoryRow: View {
    let workout: Workout
    let accent: Color

    private var exerciseSummary: String {
        let names = workout.exercises
            .sorted { $0.createdAt < $1.createdAt }
            .prefix(3)
            .map(\.name)
        guard !names.isEmpty else { return "No exercises logged" }
        let joined = names.joined(separator: " · ")
        return workout.exercises.count > 3 ? joined + " +" : joined
    }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text(workout.name)
                    .font(.appHeadline)
                    .foregroundColor(.appTextPrimary)
                Spacer()
            }

            Text(exerciseSummary)
                .font(.appBody)
                .foregroundColor(.appTextSecondary)
                .lineLimit(1)

            if let recap = workout.aiRecap {
                Text(recap)
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .italic()
                    .lineLimit(2)
            }

            HStack(spacing: AppSpacing.md) {
                if let dur = workout.formattedDuration {
                    statLabel(dur, icon: "clock")
                }
                if workout.totalSets > 0 {
                    statLabel("\(workout.totalSets) sets", icon: "repeat")
                }
                if workout.totalVolume > 0 {
                    statLabel(volumeDisplay, icon: "scalemass")
                }
            }
        }
        .padding(.vertical, AppSpacing.xs)
    }

    private var volumeDisplay: String {
        let v = workout.totalVolume
        return v >= 1000 ? String(format: "%.1fk lb", v / 1000) : "\(Int(v)) lb"
    }

    private func statLabel(_ text: String, icon: String) -> some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
            Text(text)
        }
        .font(.appCaption)
        .foregroundColor(.appTextSecondary)
    }
}
