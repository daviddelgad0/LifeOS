import SwiftUI
import SwiftData

// MARK: - Today tab

struct TodayView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppTheme.self)  private var theme

    @Query(sort: \Task.createdAt,   order: .reverse) private var allTasks:    [Task]
    @Query(sort: \Workout.date,     order: .reverse) private var allWorkouts: [Workout]

    @State private var showingAddTask        = false
    @State private var showingActiveWorkout  = false
    @State private var showingNameSheet      = false
    @State private var activeWorkout: Workout?
    @State private var workoutName           = "Workout"
    @State private var recentPRs: [(exerciseName: String, date: Date, isWeightPR: Bool, isVolumePR: Bool)] = []

    // MARK: Computed data

    private var pendingToday: [Task] {
        allTasks
            .filter { $0.isDueToday && !$0.isCompleted }
            .sorted { priorityRank($0) < priorityRank($1) }
    }

    private var completedToday: [Task] {
        allTasks.filter { $0.isDueToday && $0.isCompleted }
    }

    private var todayWorkout: Workout? {
        allWorkouts.first { Calendar.current.isDateInToday($0.date) && !$0.isActive }
    }

    private var progressValue: Double {
        let totalTasks = pendingToday.count + completedToday.count
        let workoutPoint = todayWorkout != nil ? 1 : 0
        let denominator = totalTasks + 1
        guard denominator > 0 else { return 0 }
        return Double(completedToday.count + workoutPoint) / Double(denominator)
    }

    private var streak: Int {
        let cal = Calendar.current
        var count = 0
        var day = cal.startOfDay(for: Date())
        while true {
            let hadTask = allTasks.contains {
                $0.isCompleted &&
                ($0.completedAt.map { cal.isDate($0, inSameDayAs: day) } == true)
            }
            let hadWorkout = allWorkouts.contains {
                !$0.isActive && cal.isDate($0.date, inSameDayAs: day)
            }
            guard hadTask || hadWorkout else { break }
            count += 1
            day = cal.date(byAdding: .day, value: -1, to: day)!
        }
        return count
    }

    private func priorityRank(_ task: Task) -> Int {
        switch task.priority { case .high: return 0; case .medium: return 1; case .low: return 2 }
    }

    private var greeting: String {
        switch Calendar.current.component(.hour, from: Date()) {
        case 5..<12:  return "Good morning,"
        case 12..<17: return "Good afternoon,"
        case 17..<21: return "Good evening,"
        default:      return "Good night,"
        }
    }

    private var dateString: String {
        Date().formatted(.dateTime.weekday(.wide).month(.wide).day()).uppercased()
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottomTrailing) {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: AppSpacing.md) {
                        greetingHeader

                        if WhoopService.shared.isConnected {
                            whoopCard
                            DailyBriefingCard()
                        } else {
                            whoopConnectBanner
                        }

                        EnergyCurveCard()
                        EnergyCheckInHistoryRow(
                            checkIns: EnergyCheckInService.shared.last4,
                            accent:   theme.todayAccent
                        )

                        HStack(spacing: AppSpacing.md) {
                            progressCard
                            streakCard
                        }

                        if !recentPRs.isEmpty {
                            prHighlightCard
                        }

                        if !pendingToday.isEmpty || !completedToday.isEmpty {
                            todayTasksSection
                        }
                        workoutCard
                    }
                    .padding(AppSpacing.md)
                    .padding(.bottom, 100)
                }

                fab.padding(AppSpacing.lg)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gearshape")
                            .foregroundColor(.appTextSecondary)
                    }
                }
            }
            .sheet(isPresented: $showingAddTask)   { AddTaskView() }
            .sheet(isPresented: $showingNameSheet) { nameWorkoutSheet }
            .sheet(isPresented: Binding(
                get: { EnergyCheckInService.shared.showingCheckIn },
                set: { EnergyCheckInService.shared.showingCheckIn = $0 }
            )) {
                EnergyCheckInSheet()
                    .presentationDetents([.height(320)])
                    .presentationDragIndicator(.hidden)
            }
            .fullScreenCover(isPresented: $showingActiveWorkout) {
                if let w = activeWorkout {
                    ActiveWorkoutView(workout: w) {
                        showingActiveWorkout = false
                        activeWorkout = nil
                        recentPRs = PRService.recentPRs(withinDays: 7, context: context)
                    }
                }
            }
            .onAppear {
                recentPRs = PRService.recentPRs(withinDays: 7, context: context)
                if WhoopService.shared.recovery == nil {
                    _Concurrency.Task { await WhoopService.shared.fetchLatestData() }
                }
            }
        }
    }

    // MARK: Greeting header

    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(dateString)
                .font(.appCaption)
                .foregroundColor(theme.todayAccent)
                .tracking(1.5)
            Text(greeting)
                .font(.appHeadline)
                .foregroundColor(.appTextSecondary)
            Text(theme.userName)
                .font(.appTitle)
                .foregroundColor(.appTextPrimary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, AppSpacing.sm)
    }

    // MARK: Whoop — connected card (includes donut charts)

    private var whoopCard: some View {
        let whoop = WhoopService.shared
        return VStack(alignment: .leading, spacing: AppSpacing.sm) {

            HStack {
                Text("WHOOP")
                    .font(.appCaption)
                    .foregroundColor(theme.todayAccent)
                    .tracking(2)
                Spacer()
                if whoop.isSyncing {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .scaleEffect(0.7)
                        .tint(.appTextSecondary)
                } else {
                    Button {
                        _Concurrency.Task { await whoop.fetchLatestData() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 13))
                            .foregroundColor(.appTextSecondary)
                    }
                }
            }

            if let r = whoop.recovery {
                HStack(alignment: .center, spacing: AppSpacing.lg) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(r.score)")
                            .font(.system(size: 42, weight: .bold, design: .rounded))
                            .foregroundColor(recoveryColor(r.score))
                        Text(r.scoreLabel.uppercased())
                            .font(.appCaption)
                            .foregroundColor(recoveryColor(r.score))
                            .tracking(1)
                    }
                    Spacer()
                    whoopMetric("HRV", value: "\(Int(r.hrv))ms")
                    if let s = whoop.sleep {
                        whoopMetric("SLEEP", value: "\(Int(s.performancePercent))%")
                    }
                    if let st = whoop.strain {
                        whoopMetric("STRAIN", value: String(format: "%.1f", st))
                    }
                }

                // Donut charts
                WhoopDonutsView(
                    recovery: r,
                    sleep:    whoop.sleep,
                    strain:   whoop.strain,
                    accent:   theme.todayAccent
                )

            } else {
                Text("Waiting for data — appears after your first sleep cycle.")
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
            }
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

    private func whoopMetric(_ label: String, value: String) -> some View {
        VStack(spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(.appTextSecondary)
                .tracking(1)
            Text(value)
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundColor(.appTextPrimary)
        }
    }

    // MARK: Whoop — not connected banner

    private var whoopConnectBanner: some View {
        NavigationLink(destination: SettingsView()) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("WHOOP")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                        .tracking(2)
                    Text("Connect for recovery insights")
                        .font(.appBody)
                        .foregroundColor(.appTextSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
            }
            .padding(AppSpacing.md)
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)
            .opacity(0.6)
        }
        .buttonStyle(.plain)
    }

    // MARK: PR highlight card

    private var prHighlightCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("RECENT PR\(recentPRs.count > 1 ? "s" : "")")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)

            VStack(spacing: 0) {
                ForEach(Array(recentPRs.prefix(3).enumerated()), id: \.offset) { i, pr in
                    if i > 0 { Divider().background(Color.appSeparator).padding(.horizontal, AppSpacing.md) }
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(pr.exerciseName)
                                .font(.appHeadline)
                                .foregroundColor(.appTextPrimary)
                            Text(pr.date.formatted(date: .abbreviated, time: .omitted))
                                .font(.appCaption)
                                .foregroundColor(.appTextSecondary)
                        }
                        Spacer()
                        HStack(spacing: AppSpacing.xs) {
                            if pr.isWeightPR {
                                prBadge("WEIGHT PR")
                            }
                            if pr.isVolumePR {
                                prBadge("VOL PR")
                            }
                        }
                    }
                    .padding(AppSpacing.md)
                }
            }
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)
        }
    }

    private func prBadge(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 10, weight: .black))
            .foregroundColor(.black)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(theme.todayAccent)
            .cornerRadius(4)
    }

    // MARK: Progress ring card

    private var progressCard: some View {
        let total = pendingToday.count + completedToday.count
        return VStack(spacing: AppSpacing.sm) {
            Text("TODAY")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)

            ZStack {
                Ring(progress: progressValue, lineWidth: 6, color: theme.todayAccent)
                    .frame(width: 64, height: 64)
                Text("\(Int(progressValue * 100))%")
                    .font(.appMonoSm)
                    .foregroundColor(.appTextPrimary)
            }

            Text("\(completedToday.count)/\(total) tasks")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
    }

    // MARK: Streak card

    private var streakCard: some View {
        VStack(spacing: AppSpacing.sm) {
            Text("STREAK")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)

            Text("\(streak)")
                .font(.appBigStat)
                .foregroundColor(streak > 0 ? theme.todayAccent : .appTextSecondary)

            Text(streak == 1 ? "day" : "days")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
    }

    // MARK: Today's tasks

    private var todayTasksSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text("TODAY'S TASKS")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(1.5)
                Spacer()
                if !pendingToday.isEmpty {
                    Text("\(pendingToday.count) remaining")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }
            }

            VStack(spacing: 0) {
                let allRows = pendingToday + completedToday
                ForEach(Array(allRows.enumerated()), id: \.element.id) { i, task in
                    if i > 0 {
                        Divider()
                            .background(Color.appSeparator)
                            .padding(.horizontal, AppSpacing.md)
                    }
                    TodayTaskRow(task: task, accent: theme.todayAccent) {
                        toggleTask(task)
                    }
                }
            }
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)
        }
    }

    // MARK: Workout card

    private var workoutCard: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("WORKOUT")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)

            if let workout = todayWorkout {
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    HStack {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text(workout.name)
                                .font(.appHeadline)
                                .foregroundColor(.appTextPrimary)
                            if let dur = workout.formattedDuration {
                                Text("\(dur) · \(workout.totalSets) sets · \(Int(workout.totalVolume)) lb")
                                    .font(.appBody)
                                    .foregroundColor(.appTextSecondary)
                            }
                        }
                        Spacer()
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(theme.todayAccent)
                    }
                    if let recap = workout.aiRecap {
                        Text(recap)
                            .font(.appCaption)
                            .foregroundColor(.appTextSecondary)
                            .italic()
                            .padding(.top, 2)
                    }
                }
                .padding(AppSpacing.md)
                .background(Color.appSurface)
                .cornerRadius(AppRadius.md)

            } else {
                Button {
                    workoutName = "Workout"
                    showingNameSheet = true
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: AppSpacing.xs) {
                            Text("No workout logged")
                                .font(.appHeadline)
                                .foregroundColor(.appTextPrimary)
                            Text("Tap to start a session")
                                .font(.appBody)
                                .foregroundColor(.appTextSecondary)
                        }
                        Spacer()
                        Text("START")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.black)
                            .padding(.horizontal, AppSpacing.md)
                            .padding(.vertical, AppSpacing.sm)
                            .background(theme.todayAccent)
                            .cornerRadius(AppRadius.sm)
                    }
                    .padding(AppSpacing.md)
                    .background(Color.appSurface)
                    .cornerRadius(AppRadius.md)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: FAB

    private var fab: some View {
        Menu {
            Button { showingAddTask = true } label: {
                Label("Add Task", systemImage: "checkmark.circle")
            }
            Button {
                workoutName = "Workout"
                showingNameSheet = true
            } label: {
                Label("Start Workout", systemImage: "figure.strengthtraining.traditional")
            }
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .bold))
                .foregroundColor(.black)
                .frame(width: 56, height: 56)
                .background(theme.todayAccent)
                .clipShape(Circle())
                .shadow(color: theme.todayAccent.opacity(0.4), radius: 12, y: 4)
        }
    }

    // MARK: Name workout sheet

    private var nameWorkoutSheet: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                VStack(spacing: AppSpacing.xl) {

                    // Readiness card (when Whoop recovery is available)
                    if let r = WhoopService.shared.recovery {
                        readinessCard(r)
                            .padding(.horizontal, AppSpacing.lg)
                    }

                    TextField("Workout name", text: $workoutName)
                        .font(.appTitle)
                        .foregroundColor(.appTextPrimary)
                        .multilineTextAlignment(.center)
                        .padding(AppSpacing.md)
                        .background(Color.appSurface)
                        .cornerRadius(AppRadius.md)
                        .padding(.horizontal, AppSpacing.lg)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: AppSpacing.sm) {
                            ForEach(["Push Day", "Pull Day", "Leg Day", "Upper", "Lower", "Full Body"], id: \.self) { name in
                                Button(name) { workoutName = name }
                                    .font(.appBody)
                                    .foregroundColor(workoutName == name ? .black : .appTextPrimary)
                                    .padding(.horizontal, AppSpacing.md)
                                    .padding(.vertical, AppSpacing.sm)
                                    .background(workoutName == name ? theme.todayAccent : Color.appSurface)
                                    .cornerRadius(AppRadius.sm)
                            }
                        }
                        .padding(.horizontal, AppSpacing.lg)
                    }
                    Spacer()
                }
                .padding(.top, AppSpacing.xl)
            }
            .navigationTitle("Name Your Workout")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showingNameSheet = false }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Begin") { showingNameSheet = false; startWorkout() }
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(workoutName.trimmingCharacters(in: .whitespaces).isEmpty ? .appTextSecondary : theme.todayAccent)
                        .disabled(workoutName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .preferredColorScheme(.dark)
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

    // MARK: Actions

    private func toggleTask(_ task: Task) {
        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
            task.isCompleted.toggle()
            task.completedAt = task.isCompleted ? Date() : nil
        }
        if task.isCompleted {
            NotificationService.shared.cancel(for: task)
        } else {
            NotificationService.shared.schedule(for: task)
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    private func startWorkout() {
        let workout = Workout(name: workoutName.trimmingCharacters(in: .whitespaces))
        context.insert(workout)
        activeWorkout = workout
        showingActiveWorkout = true
    }
}

// MARK: - Today task row

struct TodayTaskRow: View {
    let task: Task
    let accent: Color
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Button(action: onToggle) {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundColor(task.isCompleted ? accent : .appTextSecondary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .font(.appBody)
                    .foregroundColor(task.isCompleted ? .appTextSecondary : .appTextPrimary)
                    .strikethrough(task.isCompleted, color: .appTextSecondary)

                HStack(spacing: AppSpacing.xs) {
                    Text(task.category.rawValue.uppercased())
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                        .tracking(1)
                    if task.isOverdue {
                        Text("· OVERDUE")
                            .font(.appCaption)
                            .foregroundColor(.appDestructive)
                    }
                }
            }

            Spacer()

            Circle()
                .fill(priorityColor)
                .frame(width: 6, height: 6)
                .opacity(task.isCompleted ? 0.3 : 1)
        }
        .padding(AppSpacing.md)
    }

    private var priorityColor: Color {
        switch task.priority {
        case .high:   return .appPriorityHigh
        case .medium: return .appPriorityMedium
        case .low:    return .appPriorityLow
        }
    }
}
