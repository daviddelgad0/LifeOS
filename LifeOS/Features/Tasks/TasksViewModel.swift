import Foundation
import Observation

@Observable
final class TasksViewModel {
    var showingAddTask    = false
    var showingCompleted  = false

    // MARK: AI Prioritize
    var isPrioritizing    = false
    var aiSortedIDs: [UUID]?
    var showAISortedBadge = false

    // MARK: Deal With It
    var dealWithItTask: Task?
    var isDealingWithIt  = false
    var dealResult: (action: String, reason: String)?
    var showDealSheet    = false

    // MARK: - AI Prioritize

    func prioritize(tasks: [Task]) async {
        guard !isPrioritizing else { return }
        isPrioritizing = true
        defer { isPrioritizing = false }

        let pending = tasks.filter { !$0.isCompleted }
        guard !pending.isEmpty else { return }

        let taskList = pending.map { t -> String in
            let due = t.dueDate.map { ", due \($0.formatted(date: .abbreviated, time: .omitted))" } ?? ""
            let overdue = t.isOverdue ? " [OVERDUE]" : ""
            return "{\(t.id.uuidString)}: [\(t.priority.rawValue)] \(t.title)\(due)\(overdue)"
        }.joined(separator: "\n")

        let prompt = """
        Rank these tasks by urgency and importance. Return ONLY a JSON array of UUIDs in priority order (highest first):
        ["uuid1", "uuid2", ...]

        Tasks:
        \(taskList)
        """

        do {
            let text    = try await AnthropicService.shared.complete(prompt: prompt, maxTokens: 512)
            var s       = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if let start = s.firstIndex(of: "["), let end = s.lastIndex(of: "]") {
                s = String(s[start...end])
            }
            guard
                let data    = s.data(using: .utf8),
                let rawIDs  = try? JSONSerialization.jsonObject(with: data) as? [String]
            else { return }

            let sortedIDs = rawIDs.compactMap { UUID(uuidString: $0) }
            guard !sortedIDs.isEmpty else { return }

            aiSortedIDs      = sortedIDs
            showAISortedBadge = true

            // Clear badge after 10 seconds
            _Concurrency.Task { @MainActor in
                try? await _Concurrency.Task.sleep(nanoseconds: 10_000_000_000)
                showAISortedBadge = false
            }
        } catch { }
    }

    // MARK: - Deal With It

    func dealWithIt(task: Task) async {
        guard !isDealingWithIt else { return }
        isDealingWithIt = true
        defer { isDealingWithIt = false }

        let daysOverdue: Int = {
            guard let dueDate = task.dueDate else { return 0 }
            return Calendar.current.dateComponents([.day], from: dueDate, to: Date()).day ?? 0
        }()

        let prompt = """
        This task has been overdue for \(daysOverdue) days: "\(task.title)" [\(task.priority.rawValue) priority, \(task.category.rawValue)].

        Return ONLY a JSON object with exactly two keys:
        {
          "action": "complete" | "reschedule" | "delete",
          "reason": "One sentence explaining the recommendation"
        }
        """

        do {
            let text = try await AnthropicService.shared.complete(prompt: prompt, maxTokens: 150)
            var s    = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if let start = s.firstIndex(of: "{"), let end = s.lastIndex(of: "}") {
                s = String(s[start...end])
            }
            guard
                let data = s.data(using: .utf8),
                let json = try? JSONSerialization.jsonObject(with: data) as? [String: String],
                let action = json["action"],
                let reason = json["reason"]
            else { return }

            dealResult    = (action, reason)
            dealWithItTask = task
            showDealSheet  = true
        } catch { }
    }
}
