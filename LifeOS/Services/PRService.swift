import SwiftData
import Foundation

// MARK: - Personal Record service
//
// A "PR" (Personal Record) is the best performance ever logged for an exercise.
// We track two kinds:
//   • Weight PR  — heaviest single weight, any rep count (e.g. 275 lb Bench)
//   • Volume PR  — highest reps × weight in one set (225 × 10 = 2,250 lb)
//
// Why separate? You might bench 275 for 1 rep (weight PR) but your best volume
// set was 225 × 10. Both matter.
//
// SwiftData's #Predicate macro has limited expression support (e.g. no .lowercased()),
// so we fetch all WorkoutExercise rows and filter in-memory.

struct PRResult {
    let isWeightPR: Bool
    let isVolumePR: Bool
    var isPR: Bool { isWeightPR || isVolumePR }
}

enum PRService {

    /// Checks whether `newSet` beats any previous best for `exerciseName`.
    /// Pass `currentWorkoutID` so we skip sets from the workout in progress —
    /// otherwise the set we just logged would always look like its own PR.
    static func check(
        newSet: WorkoutSet,
        exerciseName: String,
        currentWorkoutID: UUID,
        context: ModelContext
    ) -> PRResult {
        let historicalSets = fetchSets(
            exerciseName: exerciseName,
            excludingWorkoutID: currentWorkoutID,
            context: context
        )

        if historicalSets.isEmpty {
            // First ever set for this exercise → automatic PR
            return PRResult(isWeightPR: true, isVolumePR: true)
        }

        let prevBestWeight = historicalSets.map(\.weight).max() ?? 0
        let prevBestVolume = historicalSets.map(\.volume).max() ?? 0

        return PRResult(
            isWeightPR: newSet.weight > prevBestWeight,
            isVolumePR: newSet.volume > prevBestVolume
        )
    }

    /// Returns the all-time best weight set and best volume set for an exercise.
    /// Used by WorkoutDetailView to highlight PR rows in history.
    static func allTimeBests(
        exerciseName: String,
        context: ModelContext
    ) -> (bestWeight: WorkoutSet?, bestVolume: WorkoutSet?) {
        let allSets = fetchSets(
            exerciseName: exerciseName,
            excludingWorkoutID: nil,
            context: context
        )
        let bestWeight = allSets.max { $0.weight < $1.weight }
        let bestVolume = allSets.max { $0.volume < $1.volume }
        return (bestWeight, bestVolume)
    }

    /// Returns exercises that achieved a weight or volume PR within the last `withinDays` days.
    static func recentPRs(
        withinDays days: Int,
        context: ModelContext
    ) -> [(exerciseName: String, date: Date, isWeightPR: Bool, isVolumePR: Bool)] {
        let cutoff = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        let descriptor = FetchDescriptor<WorkoutExercise>()
        guard let exercises = try? context.fetch(descriptor) else { return [] }

        var results: [(exerciseName: String, date: Date, isWeightPR: Bool, isVolumePR: Bool)] = []
        var seen = Set<String>()

        for exercise in exercises {
            guard let workout = exercise.workout,
                  !workout.isActive,
                  workout.date > cutoff else { continue }

            let name = exercise.name.trimmingCharacters(in: .whitespaces)
            let key  = name.lowercased()
            guard !seen.contains(key) else { continue }

            let allSets     = fetchSets(exerciseName: name, excludingWorkoutID: nil, context: context)
            let recentSets  = exercise.sets
            guard !allSets.isEmpty, !recentSets.isEmpty else { continue }

            let bestWeight  = allSets.map(\.weight).max() ?? 0
            let bestVolume  = allSets.map(\.volume).max() ?? 0
            let isWeightPR  = recentSets.contains { $0.weight >= bestWeight }
            let isVolumePR  = recentSets.contains { $0.volume >= bestVolume }

            if isWeightPR || isVolumePR {
                seen.insert(key)
                results.append((name, workout.date, isWeightPR, isVolumePR))
            }
        }
        return results.sorted { $0.date > $1.date }
    }

    // MARK: - Private helpers

    private static func fetchSets(
        exerciseName: String,
        excludingWorkoutID: UUID?,
        context: ModelContext
    ) -> [WorkoutSet] {
        // Fetch all exercises, filter by name in memory (predicate macro limitation)
        let descriptor = FetchDescriptor<WorkoutExercise>()
        guard let exercises = try? context.fetch(descriptor) else { return [] }

        let normalised = exerciseName.trimmingCharacters(in: .whitespaces).lowercased()
        let matching = exercises.filter {
            $0.name.trimmingCharacters(in: .whitespaces).lowercased() == normalised
        }

        // Collect sets, optionally skipping those from the current workout
        return matching.flatMap { exercise -> [WorkoutSet] in
            if let excluded = excludingWorkoutID,
               exercise.workout?.id == excluded {
                return []
            }
            return exercise.sets
        }
    }
}
