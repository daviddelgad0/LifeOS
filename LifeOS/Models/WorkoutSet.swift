import SwiftData
import Foundation

// One logged set — reps × weight. RPE (Rate of Perceived Exertion) is optional,
// a 1–10 scale that tells you how hard a set felt. 10 = max effort.

@Model
final class WorkoutSet {
    @Attribute(.unique) var id: UUID
    var reps: Int
    var weight: Double      // lbs
    var rpe: Double?        // 6.0–10.0, optional
    var notes: String
    var createdAt: Date
    var exercise: WorkoutExercise?

    init(reps: Int, weight: Double, rpe: Double? = nil, notes: String = "") {
        self.id = UUID()
        self.reps = reps
        self.weight = weight
        self.rpe = rpe
        self.notes = notes
        self.createdAt = Date()
    }

    // Total load moved in this set (used for weekly volume calculations)
    var volume: Double { Double(reps) * weight }

    // Display weight without unnecessary decimals: 225.0 → "225", 112.5 → "112.5"
    var weightDisplay: String {
        weight.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(weight))
            : String(format: "%.1f", weight)
    }
}
