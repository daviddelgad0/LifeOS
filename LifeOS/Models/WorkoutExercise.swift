import SwiftData
import Foundation

@Model
final class WorkoutExercise {
    @Attribute(.unique) var id: UUID
    var name: String
    var createdAt: Date
    var notes: String
    var suggestedWeight: Double = 0   // pre-filled from template / repeat last
    var suggestedReps:   Int    = 8   // pre-filled from template / repeat last
    var workout: Workout?
    @Relationship(deleteRule: .cascade) var sets: [WorkoutSet]

    init(name: String) {
        self.id = UUID()
        self.name = name
        self.createdAt = Date()
        self.notes = ""
        self.sets = []
    }

    var orderedSets: [WorkoutSet] {
        sets.sorted { $0.createdAt < $1.createdAt }
    }

    var lastSet: WorkoutSet? {
        orderedSets.last
    }
}
