import SwiftData
import SwiftUI
import Foundation

// MARK: - Course model
//
// Represents one college class. Assignments are Tasks linked here
// via the course relationship — when you add an assignment from CourseDetailView,
// it creates a Task with category .school and sets task.course = this course.
//
// deleteRule .nullify: deleting a course sets task.course = nil on its assignments
// rather than deleting the tasks themselves (you keep the work you logged).

@Model
final class Course {
    @Attribute(.unique) var id: UUID
    var name:       String   // "Calculus II"
    var code:       String   // "MATH 202"  (optional, can be empty)
    var professor:  String   // "Dr. Smith"
    var building:   String   // "Science Hall"
    var room:       String   // "202"
    var schedule:   String   // "MWF 9:00–10:15 AM" (freeform for MVP)
    var colorHex:   String   // course accent color — picked per class
    var createdAt:  Date

    @Relationship(deleteRule: .nullify, inverse: \Task.course)
    var assignments: [Task]

    init(
        name:      String,
        code:      String = "",
        professor: String = "",
        building:  String = "",
        room:      String = "",
        schedule:  String = "",
        colorHex:  String = "00D4FF"
    ) {
        self.id        = UUID()
        self.name      = name
        self.code      = code
        self.professor = professor
        self.building  = building
        self.room      = room
        self.schedule  = schedule
        self.colorHex  = colorHex
        self.createdAt = Date()
        self.assignments = []
    }

    // Computed — not persisted
    var color: Color { Color(hex: colorHex) }

    var upcomingAssignments: [Task] {
        assignments
            .filter { !$0.isCompleted }
            .sorted { ($0.dueDate ?? .distantFuture) < ($1.dueDate ?? .distantFuture) }
    }

    var dueThisWeek: [Task] {
        let limit = Calendar.current.date(byAdding: .day, value: 7, to: Date())!
        return upcomingAssignments.filter { $0.dueDate.map { $0 <= limit } == true }
    }

    /// Short display label: "MATH 202" if code set, else just the name
    var displayCode: String { code.isEmpty ? name : code }
}
