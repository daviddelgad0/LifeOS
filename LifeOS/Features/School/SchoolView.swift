import SwiftUI
import SwiftData

// MARK: - School tab — course list

struct SchoolView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppTheme.self)  private var theme
    @Query(sort: \Course.createdAt, order: .forward) private var courses: [Course]
    @Query(sort: \Task.createdAt,   order: .reverse) private var allTasks: [Task]

    @State private var showingAddCourse = false

    // MARK: Computed

    private var assignmentsDueSoon: Int {
        let limit = Calendar.current.date(byAdding: .day, value: 7, to: Date())!
        return allTasks.filter {
            $0.category == .school &&
            !$0.isCompleted &&
            ($0.dueDate.map { $0 <= limit } == true)
        }.count
    }

    // MARK: Body

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                if courses.isEmpty {
                    emptyState
                } else {
                    List {
                        statsRow
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)

                        ForEach(courses) { course in
                            NavigationLink(destination: CourseDetailView(course: course)) {
                                CourseCard(course: course)
                            }
                            .listRowBackground(Color.appSurface)
                            .listRowSeparatorTint(Color.appSeparator)
                        }
                        .onDelete(perform: deleteCourses)
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("School")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    let gcal = GoogleCalendarService.shared
                    if gcal.isConnected {
                        Button {
                            _Concurrency.Task {
                                do {
                                    try await gcal.syncAll(allTasks)
                                } catch {
                                    // errors visible in Settings
                                }
                            }
                        } label: {
                            if gcal.isSyncing {
                                ProgressView()
                                    .progressViewStyle(.circular)
                                    .tint(theme.schoolAccent)
                                    .scaleEffect(0.8)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundColor(theme.schoolAccent)
                            }
                        }
                        .disabled(gcal.isSyncing)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddCourse = true
                    } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 17, weight: .semibold))
                            .foregroundColor(theme.schoolAccent)
                    }
                }
            }
            .sheet(isPresented: $showingAddCourse) {
                AddCourseView()
            }
        }
    }

    // MARK: Stats row

    private var statsRow: some View {
        HStack(spacing: AppSpacing.md) {
            statCard("\(courses.count)", label: courses.count == 1 ? "CLASS" : "CLASSES")
            statCard("\(assignmentsDueSoon)", label: "DUE THIS WEEK")
        }
        .padding(.vertical, AppSpacing.xs)
    }

    private func statCard(_ value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(label)
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1)
            Text(value)
                .font(.appMono)
                .foregroundColor(theme.schoolAccent)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
    }

    // MARK: Empty state

    private var emptyState: some View {
        VStack(spacing: AppSpacing.md) {
            Text("No classes yet")
                .font(.appHeadline)
                .foregroundColor(.appTextSecondary)
            Button("Add your first class") { showingAddCourse = true }
                .font(.appBody)
                .foregroundColor(theme.schoolAccent)
        }
    }

    // MARK: Actions

    private func deleteCourses(at offsets: IndexSet) {
        for i in offsets { context.delete(courses[i]) }
    }
}

// MARK: - Course card row

struct CourseCard: View {
    let course: Course

    var body: some View {
        HStack(spacing: AppSpacing.md) {
            // Colored left-edge bar
            RoundedRectangle(cornerRadius: 2)
                .fill(course.color)
                .frame(width: 4)
                .padding(.vertical, AppSpacing.xs)

            VStack(alignment: .leading, spacing: AppSpacing.xs) {
                // Course name + code
                HStack(spacing: AppSpacing.sm) {
                    if !course.code.isEmpty {
                        Text(course.code.uppercased())
                            .font(.appCaption)
                            .foregroundColor(course.color)
                            .tracking(1)
                    }
                }
                Text(course.name)
                    .font(.appHeadline)
                    .foregroundColor(.appTextPrimary)

                // Professor / room
                if !course.professor.isEmpty || !course.room.isEmpty {
                    HStack(spacing: AppSpacing.xs) {
                        if !course.professor.isEmpty {
                            Text(course.professor)
                        }
                        if !course.professor.isEmpty && !course.room.isEmpty {
                            Text("·")
                        }
                        if !course.room.isEmpty {
                            Text(course.room)
                        }
                    }
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
                }

                // Schedule
                if !course.schedule.isEmpty {
                    Text(course.schedule)
                        .font(.appCaption)
                        .foregroundColor(.appTextSecondary)
                }

                // Assignment count
                let upcoming = course.upcomingAssignments.count
                if upcoming > 0 {
                    Text("\(upcoming) assignment\(upcoming == 1 ? "" : "s") upcoming")
                        .font(.appCaption)
                        .foregroundColor(course.color)
                }
            }

            Spacer()
        }
        .padding(.vertical, AppSpacing.sm)
    }
}
