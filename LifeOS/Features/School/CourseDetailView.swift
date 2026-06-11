import SwiftUI
import SwiftData

// MARK: - Course detail view
//
// Shows full course info + all assignments (upcoming then completed).
// Tapping "Add Assignment" creates a Task with category .school linked to this course.

struct CourseDetailView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppTheme.self)  private var theme
    let course: Course

    @State private var showingAddAssignment   = false
    @State private var showCompleted          = false
    @State private var showingSyllabusUpload  = false

    private var upcoming: [Task]  { course.upcomingAssignments }
    private var completed: [Task] {
        course.assignments
            .filter(\.isCompleted)
            .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
    }

    // MARK: Body

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            List {
                // Course info header
                courseInfoSection
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                // Syllabus upload button
                syllabusButton
                    .listRowBackground(Color.appSurface)
                    .listRowSeparator(.hidden)

                // Upcoming assignments
                if !upcoming.isEmpty {
                    Section {
                        ForEach(upcoming) { task in
                            AssignmentRow(task: task, accent: course.color) {
                                toggleTask(task)
                            }
                            .swipeActions(edge: .leading, allowsFullSwipe: true) {
                                Button { toggleTask(task) } label: {
                                    Label("Done", systemImage: "checkmark")
                                }
                                .tint(course.color)
                            }
                            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                Button(role: .destructive) { deleteTask(task) } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .listRowBackground(Color.appSurface)
                            .listRowSeparatorTint(Color.appSeparator)
                        }
                    } header: {
                        sectionHeader("UPCOMING")
                    }
                }

                // Add assignment button
                addAssignmentButton
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                // Completed assignments (collapsed by default)
                if !completed.isEmpty {
                    Button {
                        withAnimation { showCompleted.toggle() }
                    } label: {
                        HStack {
                            Text(showCompleted ? "Hide Completed" : "Show Completed (\(completed.count))")
                                .font(.appBody)
                                .foregroundColor(course.color)
                            Spacer()
                            Image(systemName: showCompleted ? "chevron.up" : "chevron.down")
                                .font(.appCaption)
                                .foregroundColor(.appTextSecondary)
                        }
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                    if showCompleted {
                        Section {
                            ForEach(completed) { task in
                                AssignmentRow(task: task, accent: course.color) {
                                    toggleTask(task)
                                }
                                .listRowBackground(Color.appSurface)
                                .listRowSeparatorTint(Color.appSeparator)
                            }
                        } header: {
                            sectionHeader("COMPLETED")
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(course.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showingAddAssignment) {
            AddAssignmentView(course: course)
        }
        .sheet(isPresented: $showingSyllabusUpload) {
            SyllabusUploadView(course: course)
        }
    }

    // MARK: Course info section

    private var courseInfoSection: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            // Colored accent bar + code
            HStack(spacing: AppSpacing.sm) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(course.color)
                    .frame(width: 4, height: 20)
                if !course.code.isEmpty {
                    Text(course.code.uppercased())
                        .font(.appCaption)
                        .foregroundColor(course.color)
                        .tracking(1.5)
                }
            }

            // Info pills
            HStack(spacing: AppSpacing.lg) {
                if !course.professor.isEmpty {
                    infoItem(course.professor, icon: "person")
                }
                if !course.building.isEmpty || !course.room.isEmpty {
                    let loc = [course.building, course.room].filter { !$0.isEmpty }.joined(separator: " ")
                    infoItem(loc, icon: "mappin")
                }
                if !course.schedule.isEmpty {
                    infoItem(course.schedule, icon: "clock")
                }
            }
        }
        .padding(.vertical, AppSpacing.sm)
    }

    private func infoItem(_ text: String, icon: String) -> some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.appCaption)
            Text(text)
                .font(.appCaption)
        }
        .foregroundColor(.appTextSecondary)
    }

    // MARK: Syllabus button

    private var syllabusButton: some View {
        Button {
            showingSyllabusUpload = true
        } label: {
            HStack(spacing: AppSpacing.md) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(course.color.opacity(0.15))
                        .frame(width: 36, height: 36)
                    Image(systemName: "doc.text.magnifyingglass")
                        .font(.system(size: 16))
                        .foregroundColor(course.color)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text("Upload Syllabus")
                        .font(.appBody)
                        .foregroundColor(.appTextPrimary)
                    Text("AI extracts all assignments and due dates")
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
            }
            .padding(AppSpacing.md)
        }
        .buttonStyle(.plain)
    }

    // MARK: Add assignment button

    private var addAssignmentButton: some View {
        Button {
            showingAddAssignment = true
        } label: {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: "plus")
                Text("Add Assignment")
            }
            .font(.system(size: 15, weight: .semibold))
            .foregroundColor(course.color)
            .frame(maxWidth: .infinity)
            .padding(AppSpacing.md)
            .background(Color.appSurface)
            .cornerRadius(AppRadius.md)
        }
        .padding(.vertical, AppSpacing.xs)
    }

    // MARK: Helpers

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.appCaption)
            .foregroundColor(.appTextSecondary)
            .tracking(1.5)
    }

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

    private func deleteTask(_ task: Task) {
        NotificationService.shared.cancel(for: task)
        _Concurrency.Task { try? await GoogleCalendarService.shared.deleteEvent(for: task) }
        context.delete(task)
    }
}

// MARK: - Assignment row

struct AssignmentRow: View {
    let task:     Task
    let accent:   Color
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

                if let due = task.dueDate {
                    Text(dueLabel(due))
                        .font(.appCaption)
                        .foregroundColor(dueLabelColor(due))
                }
            }

            Spacer()

            Circle()
                .fill(priorityColor)
                .frame(width: 6, height: 6)
                .opacity(task.isCompleted ? 0.3 : 1)
        }
        .padding(.vertical, AppSpacing.xs)
    }

    private var priorityColor: Color {
        switch task.priority {
        case .high:   return .appPriorityHigh
        case .medium: return .appPriorityMedium
        case .low:    return .appPriorityLow
        }
    }

    private func dueLabel(_ date: Date) -> String {
        if task.isOverdue    { return "Overdue · " + date.formatted(date: .abbreviated, time: .omitted) }
        if task.isDueToday   { return "Due today" }
        if Calendar.current.isDateInTomorrow(date) { return "Due tomorrow" }
        return "Due " + date.formatted(date: .abbreviated, time: .omitted)
    }

    private func dueLabelColor(_ date: Date) -> Color {
        if task.isOverdue  { return .appPriorityHigh }
        if task.isDueToday { return accent }
        return .appTextSecondary
    }
}
