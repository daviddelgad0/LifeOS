import SwiftData
import Foundation

// MARK: - Template exercise
//
// One exercise slot inside a WorkoutTemplate.
// Stores last-used weight and reps so the ExerciseCard pre-fills them
// when starting from a template or repeating a workout.

@Model
final class TemplateExercise {
    var name:            String
    var orderIndex:      Int
    var suggestedWeight: Double
    var suggestedReps:   Int
    var template:        WorkoutTemplate?

    init(name: String, orderIndex: Int, weight: Double = 0, reps: Int = 8) {
        self.name            = name
        self.orderIndex      = orderIndex
        self.suggestedWeight = weight
        self.suggestedReps   = reps
    }
}
