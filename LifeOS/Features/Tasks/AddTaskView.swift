import SwiftUI
import SwiftData

struct AddTaskView: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss)      private var dismiss
    @Environment(AppTheme.self)  private var theme

    @State private var title      = ""
    @State private var notes      = ""
    @State private var hasDueDate = false
    @State private var dueDate    = Date()
    @State private var priority   = TaskPriority.medium
    @State private var category   = TaskCategory.general

    private var canSave: Bool {
        !title.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                Form {
                    Section {
                        TextField("Task name", text: $title)
                            .font(.appHeadline)
                        TextField("Notes (optional)", text: $notes, axis: .vertical)
                            .font(.appBody)
                            .lineLimit(2...5)
                    }
                    .listRowBackground(Color.appSurface)

                    Section {
                        Toggle(isOn: $hasDueDate) {
                            Text("Due date").font(.appBody)
                        }
                        .tint(theme.tasksAccent)

                        if hasDueDate {
                            DatePicker("", selection: $dueDate, displayedComponents: .date)
                                .datePickerStyle(.compact)
                                .tint(theme.tasksAccent)
                        }
                    }
                    .listRowBackground(Color.appSurface)

                    Section {
                        Picker("Priority", selection: $priority) {
                            ForEach(TaskPriority.allCases, id: \.self) { p in
                                Text(p.rawValue).tag(p)
                            }
                        }
                        .pickerStyle(.segmented)
                    } header: {
                        Text("PRIORITY")
                            .font(.appCaption)
                            .foregroundColor(.appTextSecondary)
                            .tracking(1.2)
                    }
                    .listRowBackground(Color.appSurface)

                    Section {
                        Picker("Category", selection: $category) {
                            ForEach(TaskCategory.allCases, id: \.self) { c in
                                Text(c.rawValue).tag(c)
                            }
                        }
                        .tint(theme.tasksAccent)
                    } header: {
                        Text("CATEGORY")
                            .font(.appCaption)
                            .foregroundColor(.appTextSecondary)
                            .tracking(1.2)
                    }
                    .listRowBackground(Color.appSurface)
                }
                .scrollContentBackground(.hidden)
                .tint(theme.tasksAccent)
            }
            .navigationTitle("New Task")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(.appTextSecondary)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") { save() }
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundColor(canSave ? theme.tasksAccent : .appTextSecondary)
                        .disabled(!canSave)
                }
            }
        }
        .preferredColorScheme(.dark)
    }

    private func save() {
        let task = Task(
            title:    title.trimmingCharacters(in: .whitespaces),
            notes:    notes.trimmingCharacters(in: .whitespaces),
            dueDate:  hasDueDate ? dueDate : nil,
            priority: priority,
            category: category
        )
        context.insert(task)
        NotificationService.shared.schedule(for: task)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        dismiss()
    }
}
