import SwiftData
import Foundation

// MARK: - Supporting enums
// Defined outside the class to avoid issues with SwiftData's macro system.

enum TaskPriority: String, Codable, CaseIterable {
    case low    = "Low"
    case medium = "Medium"
    case high   = "High"
}

enum TaskCategory: String, Codable, CaseIterable {
    case general   = "General"
    case school    = "School"
    case fitness   = "Fitness"
    case personal  = "Personal"
    case jobSearch = "Job Search"
}

// MARK: - Task model
// @Model tells SwiftData to persist this class to disk automatically.
// Every property marked here is saved between app launches.

@Model
final class Task {
    @Attribute(.unique) var id: UUID
    var title: String
    var notes: String
    var dueDate: Date?
    var priority: TaskPriority
    var category: TaskCategory
    var isCompleted: Bool
    var completedAt: Date?
    var createdAt: Date
    // Optional link to a Course — set when the task is an assignment.
    // Lightweight migration: existing tasks get nil (no data loss).
    var course: Course?
    // Google Calendar event ID — set after a successful sync, used to update/delete.
    var gcalEventID: String?

    init(
        title: String,
        notes: String = "",
        dueDate: Date? = nil,
        priority: TaskPriority = .medium,
        category: TaskCategory = .general
    ) {
        self.id          = UUID()
        self.title       = title
        self.notes       = notes
        self.dueDate     = dueDate
        self.priority    = priority
        self.category    = category
        self.isCompleted = false
        self.completedAt = nil
        self.createdAt   = Date()
    }
}

// MARK: - Computed helpers (UI-agnostic)
extension Task {
    var isOverdue: Bool {
        guard let dueDate, !isCompleted else { return false }
        return dueDate < Calendar.current.startOfDay(for: Date())
    }

    var isDueToday: Bool {
        guard let dueDate else { return false }
        return Calendar.current.isDateInToday(dueDate)
    }

    // Grouped bucket: used to sort tasks into list sections
    var bucket: TaskBucket {
        if isCompleted          { return .completed }
        if isDueToday || isOverdue { return .today }
        if dueDate != nil       { return .upcoming }
        return .someday
    }
}

enum TaskBucket: Int, Comparable {
    case today = 0, upcoming, someday, completed

    static func < (lhs: TaskBucket, rhs: TaskBucket) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}
