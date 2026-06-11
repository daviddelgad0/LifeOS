import SwiftUI
import SwiftData

// MARK: - Add assignment form
//
// Creates a Task with category .school linked to the given Course.
// Due date is required for assignments (unlike general tasks where it's optional).

struct AddAssignmentView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss)      private var dismiss

    let course: Course

    @State private var title    = ""
    @State private var notes    = ""
    @State private var dueDate  = Calendar.current.date(byAdding: .day, value: 7, to: Date()) ?? Date()
    @State private var priority = TaskPriority.medium

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                Form {
                    // Title
                    Section {
                        TextField("Assignment title", text: $title)
                            .font(.appHeadline)
                        TextField("Notes (optional)", text: $notes, axis: .vertical)
                            .font(.appBody)
                            .lineLimit(2...4)
                    } header: {
                        sectionHeader("ASSIGNMENT")
                    }
                    .listRowBackground(Color.appSurface)

                    // Due date — always required for school assignments
                    Section {
                        DatePicker("Due date", selection: $dueDate, displayedComponents: .date)
                            .tint(course.color)
                    } header: {
                        sectionHeader("DUE DATE")
                    }
                    .listRowBackground(Color.appSurface)

                    // Priority
                    Section {
                        Picker("Priority", selection: $priority) {
                            ForEach(TaskPriority.allCases, id: \.self) { p in
                                Text(p.rawValue).tag(p)
                            }
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        sectionHeader("PRIORITY")
                    }
                    .listRowBackground(Color.appSurface)

                    // Course (read-only display)
                    Section {
                        HStack {
                            Circle()
                                .fill(course.color)
                                .frame(width: 10, height: 10)
                            Text(course.name)
                                .font(.appBody)
                                .foregroundColor(.appTextPrimary)
                            if !course.code.isEmpty {
                                Text("·  \(course.code)")
                                    .font(.appBody)
                                    .foregroundColor(.appTextSecondary)
                            }
                        }
                    } header: {
                        sectionHeader("COURSE")
                    }
                    .listRowBackground(Color.appSurface)
                }
                .scrollContentBackground(.hidden)
                .tint(course.color)
            }
            .navigationTitle("New Assignment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(canSave ? course.color : .appTextSecondary)
                        .disabled(!canSave)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func sectionHeader(_ text: String) -> some View {
        Text(text)
            .font(.appCaption)
            .foregroundColor(.appTextSecondary)
            .tracking(1.5)
    }

    private func save() {
        let task = Task(
            title:    title.trimmingCharacters(in: .whitespaces),
            notes:    notes.trimmingCharacters(in: .whitespaces),
            dueDate:  dueDate,
            priority: priority,
            category: .school
        )
        task.course = course
        context.insert(task)
        course.assignments.append(task)
        NotificationService.shared.schedule(for: task)
        // Silently sync to Google Calendar if connected
        _Concurrency.Task { try? await GoogleCalendarService.shared.syncAssignment(task) }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        dismiss()
    }
}
