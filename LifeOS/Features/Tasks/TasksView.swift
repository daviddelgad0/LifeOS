import SwiftUI
import SwiftData

// MARK: - Tasks screen

struct TasksView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppTheme.self)  private var theme

    @Query(sort: \Task.createdAt, order: .reverse) private var allTasks: [Task]
    @State private var viewModel         = TasksViewModel()
    @State private var selectedCategory: TaskCategory? = nil

    // MARK: Stats

    private var streak: Int {
        let cal = Calendar.current
        var count = 0
        var day = cal.startOfDay(for: Date())
        while true {
            let hadTask = allTasks.contains {
                $0.isCompleted &&
                ($0.completedAt.map { cal.isDate($0, inSameDayAs: day) } == true)
            }
            guard hadTask else { break }
            count += 1
            day = cal.date(byAdding: .day, value: -1, to: day)!
        }
        return count
    }

    private var completionRate: Double {
        guard !allTasks.isEmpty else { return 0 }
        return Double(allTasks.filter(\.isCompleted).count) / Double(allTasks.count)
    }

    // MARK: Category-filtered buckets

    private func filtered(_ tasks: [Task]) -> [Task] {
        guard let cat = selectedCategory else { return tasks }
        return tasks.filter { $0.category == cat }
    }

    private func prioritized(_ tasks: [Task]) -> [Task] {
        guard let ids = viewModel.aiSortedIDs else { return tasks }
        let indexed = Dictionary(uniqueKeysWithValues: ids.enumerated().map { ($1, $0) })
        return tasks.sorted { a, b in
            let ia = indexed[a.id] ?? Int.max
            let ib = indexed[b.id] ?? Int.max
            return ia < ib
        }
    }

    private var todayTasks:    [Task] { prioritized(filtered(allTasks.filter { $0.bucket == .today })) }
    private var upcomingTasks: [Task] {
        prioritized(filtered(allTasks.filter { $0.bucket == .upcoming }))
            .sorted { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    }
    private var somedayTasks:  [Task] { prioritized(filtered(allTasks.filter { $0.bucket == .someday })) }
    private var completedTasks: [Task] { filtered(allTasks.filter { $0.bucket == .completed }) }

    private var hasAnyFiltered: Bool {
        !todayTasks.isEmpty || !upcomingTasks.isEmpty ||
        !somedayTasks.isEmpty || !completedTasks.isEmpty
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                if allTasks.isEmpty {
                    emptyState
                } else {
                    List {
                        // AI sorted badge
                        if viewModel.showAISortedBadge {
                            aiSortedBanner
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        }

                        statsSection
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)

                        filterPills
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)

                        if !hasAnyFiltered {
                            emptyFilterState
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                        }

                        if !todayTasks.isEmpty {
                            taskSection("TODAY", tasks: todayTasks)
                        }
                        if !upcomingTasks.isEmpty {
                            taskSection("UPCOMING", tasks: upcomingTasks)
                        }
                        if !somedayTasks.isEmpty {
                            taskSection("SOMEDAY", tasks: somedayTasks)
                        }
                        if !completedTasks.isEmpty {
                            completedToggleRow
                            if viewModel.showingCompleted {
                                taskSection("COMPLETED", tasks: completedTasks)
                            }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("Tasks")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if viewModel.isPrioritizing {
                        ProgressView()
                            .progressViewStyle(.circular)
                            .scaleEffect(0.8)
                            .tint(theme.tasksAccent)
                    } else {
                        Button {
                            let tasks = Array(allTasks)
                            _Concurrency.Task {
                                await viewModel.prioritize(tasks: tasks)
                            }
                        } label: {
                            Label("AI Sort", systemImage: "wand.and.stars")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(theme.tasksAccent)
                        }
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        viewModel.showingAddTask = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(theme.tasksAccent)
                    }
                }
            }
            .sheet(isPresented: $viewModel.showingAddTask) {
                AddTaskView()
            }
            .sheet(isPresented: $viewModel.showDealSheet) {
                if let task = viewModel.dealWithItTask, let result = viewModel.dealResult {
                    DealWithItSheet(
                        task:    task,
                        action:  result.action,
                        reason:  result.reason,
                        accent:  theme.tasksAccent
                    ) { chosenAction in
                        executeDeal(task: task, action: chosenAction)
                        viewModel.showDealSheet = false
                    }
                    .presentationDetents([.height(300)])
                }
            }
        }
    }

    // MARK: AI sorted banner

    private var aiSortedBanner: some View {
        HStack(spacing: AppSpacing.sm) {
            Image(systemName: "wand.and.stars")
                .font(.system(size: 12))
                .foregroundColor(theme.tasksAccent)
            Text("AI sorted")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(theme.tasksAccent)
            Spacer()
            Button {
                withAnimation { viewModel.aiSortedIDs = nil; viewModel.showAISortedBadge = false }
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11))
                    .foregroundColor(.appTextSecondary)
            }
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, AppSpacing.sm)
        .background(theme.tasksAccent.opacity(0.12))
        .cornerRadius(AppRadius.sm)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: Stats row

    private var statsSection: some View {
        HStack(spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("STREAK")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(1.5)
                Text("\(streak) \(streak == 1 ? "day" : "days")")
                    .font(.appHeadline)
                    .foregroundColor(streak > 0 ? theme.tasksAccent : .appTextPrimary)
                progressBar(value: min(Double(streak) / 7.0, 1.0))
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(AppSpacing.md)
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)

            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text("COMPLETION")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(1.5)
                Text("\(Int(completionRate * 100))%")
                    .font(.appHeadline)
                    .foregroundColor(.appTextPrimary)
                progressBar(value: completionRate)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(AppSpacing.md)
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)
        }
        .padding(.vertical, AppSpacing.xs)
    }

    private func progressBar(value: Double) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.appSurface2)
                    .frame(height: 3)
                RoundedRectangle(cornerRadius: 2)
                    .fill(theme.tasksAccent)
                    .frame(width: geo.size.width * max(0, min(1, value)), height: 3)
            }
        }
        .frame(height: 3)
    }

    // MARK: Category filter pills

    private var filterPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.sm) {
                pill(label: "ALL", isSelected: selectedCategory == nil) {
                    selectedCategory = nil
                }
                ForEach(TaskCategory.allCases, id: \.self) { cat in
                    pill(label: cat.rawValue.uppercased(), isSelected: selectedCategory == cat) {
                        selectedCategory = selectedCategory == cat ? nil : cat
                    }
                }
            }
            .padding(.vertical, AppSpacing.xs)
        }
    }

    private func pill(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .semibold))
                .tracking(0.5)
                .foregroundColor(isSelected ? .black : .appTextSecondary)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.sm)
                .background(isSelected ? theme.tasksAccent : Color.appSurface)
                .cornerRadius(AppRadius.sm)
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isSelected)
    }

    // MARK: Section builder

    @ViewBuilder
    private func taskSection(_ title: String, tasks: [Task]) -> some View {
        Section {
            ForEach(tasks) { task in
                VStack(spacing: 0) {
                    TaskRowView(task: task, accent: theme.tasksAccent, onToggle: { toggleComplete(task) })
                    // "Deal with it" chip for tasks overdue 3+ days
                    if task.isOverdue, let due = task.dueDate {
                        let days = Calendar.current.dateComponents([.day], from: due, to: Date()).day ?? 0
                        if days >= 3 {
                            dealChip(for: task)
                                .padding(.horizontal, AppSpacing.xs)
                                .padding(.bottom, AppSpacing.xs)
                        }
                    }
                }
                .swipeActions(edge: .leading, allowsFullSwipe: true) {
                    Button { toggleComplete(task) } label: {
                        Label(task.isCompleted ? "Undo" : "Done",
                              systemImage: task.isCompleted ? "arrow.uturn.backward" : "checkmark")
                    }
                    .tint(theme.tasksAccent)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                    Button(role: .destructive) { delete(task) } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
                .listRowBackground(Color.appSurface)
                .listRowSeparatorTint(Color.appSeparator)
            }
        } header: {
            Text(title)
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)
        }
    }

    private func dealChip(for task: Task) -> some View {
        Button {
            let t = task
            _Concurrency.Task { await viewModel.dealWithIt(task: t) }
        } label: {
            HStack(spacing: 4) {
                if viewModel.isDealingWithIt && viewModel.dealWithItTask?.id == task.id {
                    ProgressView().progressViewStyle(.circular).scaleEffect(0.55).tint(theme.tasksAccent)
                } else {
                    Text("Deal with it →")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(theme.tasksAccent)
                }
            }
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, 4)
            .background(theme.tasksAccent.opacity(0.12))
            .cornerRadius(AppRadius.sm)
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: Completed toggle

    private var completedToggleRow: some View {
        Button {
            withAnimation { viewModel.showingCompleted.toggle() }
        } label: {
            HStack {
                Text(viewModel.showingCompleted
                     ? "Hide Completed"
                     : "Show Completed (\(completedTasks.count))")
                    .font(.appBody)
                    .foregroundColor(theme.tasksAccent)
                Spacer()
                Image(systemName: viewModel.showingCompleted ? "chevron.up" : "chevron.down")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
            }
            .padding(.vertical, AppSpacing.xs)
        }
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    // MARK: Empty states

    private var emptyFilterState: some View {
        Text("No \(selectedCategory?.rawValue ?? "") tasks")
            .font(.appBody)
            .foregroundColor(.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.top, AppSpacing.xxl)
    }

    private var emptyState: some View {
        VStack(spacing: AppSpacing.md) {
            Text("No tasks")
                .font(.appHeadline)
                .foregroundColor(.appTextSecondary)
            Text("Tap + to add your first task.")
                .font(.appBody)
                .foregroundColor(.appTextSecondary)
                .opacity(0.6)
        }
    }

    // MARK: Actions

    private func toggleComplete(_ task: Task) {
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

    private func delete(_ task: Task) {
        NotificationService.shared.cancel(for: task)
        context.delete(task)
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
    }

    private func executeDeal(task: Task, action: String) {
        switch action {
        case "complete":
            task.isCompleted = true
            task.completedAt = Date()
            NotificationService.shared.cancel(for: task)
        case "delete":
            NotificationService.shared.cancel(for: task)
            context.delete(task)
        case "reschedule":
            task.dueDate = Calendar.current.date(byAdding: .day, value: 1, to: Date())
        default:
            break
        }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }
}

// MARK: - Task row

struct TaskRowView: View {
    let task: Task
    let accent: Color
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            Button(action: onToggle) {
                Image(systemName: task.isCompleted ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22))
                    .foregroundColor(task.isCompleted ? accent : .appTextSecondary)
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                Text(task.title)
                    .font(.appHeadline)
                    .foregroundColor(task.isCompleted ? .appTextSecondary : .appTextPrimary)
                    .strikethrough(task.isCompleted, color: .appTextSecondary)

                if let dueDate = task.dueDate {
                    Text(dueDateLabel(dueDate))
                        .font(.appCaption)
                        .foregroundColor(dueDateColor(dueDate))
                }
            }

            Spacer()

            Circle()
                .fill(priorityColor)
                .frame(width: 7, height: 7)
                .opacity(task.isCompleted ? 0.3 : 1)
        }
        .padding(.vertical, AppSpacing.xs)
        .contentShape(Rectangle())
    }

    private var priorityColor: Color {
        switch task.priority {
        case .high:   return .appPriorityHigh
        case .medium: return .appPriorityMedium
        case .low:    return .appPriorityLow
        }
    }

    private func dueDateLabel(_ date: Date) -> String {
        if task.isOverdue    { return "Overdue · " + date.formatted(date: .abbreviated, time: .omitted) }
        if task.isDueToday   { return "Today" }
        if Calendar.current.isDateInTomorrow(date) { return "Tomorrow" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    private func dueDateColor(_ date: Date) -> Color {
        if task.isOverdue  { return .appPriorityHigh }
        if task.isDueToday { return accent }
        return .appTextSecondary
    }
}

// MARK: - Deal With It sheet

struct DealWithItSheet: View {
    @Environment(AppTheme.self) private var theme

    let task:   Task
    let action: String
    let reason: String
    let accent: Color
    let onConfirm: (String) -> Void

    private var actionLabel: String {
        switch action {
        case "complete":   return "Mark Complete"
        case "delete":     return "Delete Task"
        case "reschedule": return "Reschedule to Tomorrow"
        default:           return "Dismiss"
        }
    }

    private var actionIcon: String {
        switch action {
        case "complete":   return "checkmark.circle.fill"
        case "delete":     return "trash.fill"
        case "reschedule": return "calendar"
        default:           return "xmark"
        }
    }

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.appSurface2)
                .frame(width: 36, height: 4)
                .padding(.top, AppSpacing.sm)

            VStack(alignment: .leading, spacing: AppSpacing.sm) {
                Text("DEAL WITH IT")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(2)

                Text(task.title)
                    .font(.appHeadline)
                    .foregroundColor(.appTextPrimary)

                Text(reason)
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, AppSpacing.lg)

            Button {
                UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                onConfirm(action)
            } label: {
                Label(actionLabel, systemImage: actionIcon)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.black)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, AppSpacing.md)
                    .background(action == "delete" ? Color.appDestructive : accent)
                    .cornerRadius(AppRadius.md)
                    .padding(.horizontal, AppSpacing.lg)
            }
            .buttonStyle(.plain)

            Button("Dismiss") { onConfirm("dismiss") }
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)

            Spacer()
        }
        .background(Color.appBackground)
    }
}
