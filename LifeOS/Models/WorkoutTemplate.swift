import SwiftData
import Foundation

// MARK: - Workout template
//
// A saved workout blueprint — name + ordered exercises with last-used weight/reps.
// Users save templates from WorkoutDetailView and start from them in WorkoutsView.

@Model
final class WorkoutTemplate {
    var name:      String
    var createdAt: Date
    @Relationship(deleteRule: .cascade, inverse: \TemplateExercise.template)
    var exercises: [TemplateExercise] = []

    init(name: String) {
        self.name      = name
        self.createdAt = Date()
    }

    var orderedExercises: [TemplateExercise] {
        exercises.sorted { $0.orderIndex < $1.orderIndex }
    }

    /// First 3 exercise names joined by · with a + indicator if more.
    var exerciseSummary: String {
        let names = orderedExercises.prefix(3).map(\.name)
        guard !names.isEmpty else { return "No exercises" }
        let joined = names.joined(separator: " · ")
        return exercises.count > 3 ? joined + " +" : joined
    }
}
