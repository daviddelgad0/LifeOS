import SwiftData
import Foundation

@Model
final class Workout {
    @Attribute(.unique) var id: UUID
    var name: String
    var date: Date
    var endDate: Date?
    var notes: String
    @Relationship(deleteRule: .cascade) var exercises: [WorkoutExercise]

    init(name: String) {
        self.id = UUID()
        self.name = name
        self.date = Date()
        self.endDate = nil
        self.notes = ""
        self.exercises = []
    }

    var aiRecap: String?

    var isActive: Bool { endDate == nil }

    var duration: TimeInterval? {
        guard let endDate else { return nil }
        return endDate.timeIntervalSince(date)
    }

    var formattedDuration: String? {
        guard let duration else { return nil }
        let minutes = Int(duration) / 60
        return minutes < 60 ? "\(minutes) min" : "\(minutes / 60)h \(minutes % 60)m"
    }

    var totalSets: Int {
        exercises.flatMap(\.sets).count
    }

    var totalVolume: Double {
        exercises.flatMap(\.sets).reduce(0) { $0 + $1.volume }
    }
}
