import Foundation

// MARK: - AI Coach view model

@Observable
final class CoachViewModel {

    var messages:  [ChatMessage] = []
    var inputText  = ""
    var isLoading  = false
    var isDigesting = false

    // MARK: Send

    func send(userName: String, workouts: [Workout], tasks: [Task], streak: Int) async {
        let text = inputText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isLoading else { return }

        inputText = ""
        messages.append(ChatMessage(role: "user", content: text))
        isLoading = true

        do {
            let system = buildSystemPrompt(userName: userName, workouts: workouts, tasks: tasks, streak: streak)
            let reply  = try await AnthropicService.shared.chat(
                messages: messages,
                systemPrompt: system
            )
            messages.append(ChatMessage(role: "assistant", content: reply))
        } catch {
            messages.append(ChatMessage(
                role: "assistant",
                content: "Sorry, something went wrong — \(error.localizedDescription)"
            ))
        }

        isLoading = false
    }

    // MARK: Daily Digest

    func dailyDigest(userName: String, workouts: [Workout], tasks: [Task], streak: Int) async {
        guard !isDigesting, !isLoading else { return }
        isDigesting = true

        let prompt = buildDigestPrompt(userName: userName, workouts: workouts, tasks: tasks, streak: streak)
        messages.append(ChatMessage(role: "user", content: "Give me my daily digest"))
        isLoading = true

        do {
            let reply = try await AnthropicService.shared.complete(
                prompt:       prompt,
                systemPrompt: "You are a high-performance AI coach giving a brief daily digest. Be direct and actionable.",
                maxTokens:    600
            )
            messages.append(ChatMessage(role: "assistant", content: reply))
        } catch {
            messages.append(ChatMessage(
                role: "assistant",
                content: "Couldn't generate digest — \(error.localizedDescription)"
            ))
        }

        isLoading   = false
        isDigesting = false
    }

    // MARK: System prompt

    private func buildSystemPrompt(userName: String, workouts: [Workout], tasks: [Task], streak: Int) -> String {
        let recent = Array(workouts.prefix(7))
        let workoutLines = recent.map { w -> String in
            let date      = w.date.formatted(date: .abbreviated, time: .omitted)
            let exercises = w.exercises
                .sorted { $0.createdAt < $1.createdAt }
                .prefix(4)
                .map(\.name)
                .joined(separator: ", ")
            let vol = w.totalVolume >= 1000
                ? String(format: "%.1fk lb", w.totalVolume / 1000)
                : "\(Int(w.totalVolume)) lb"
            return "  • \(date): \(w.name) — \(exercises.isEmpty ? "No exercises" : exercises) (\(vol))"
        }.joined(separator: "\n")

        let recencyLine: String
        if let last = recent.first {
            let days = Calendar.current.dateComponents([.day], from: last.date, to: Date()).day ?? 0
            switch days {
            case 0:  recencyLine = "Trained today"
            case 1:  recencyLine = "Last trained yesterday"
            default: recencyLine = "Last trained \(days) days ago"
            }
        } else {
            recencyLine = "No workouts logged yet"
        }

        // Tasks block
        let pendingTasks = tasks.filter { !$0.isCompleted }
        let taskLines = pendingTasks.prefix(10).map { t -> String in
            let due = t.dueDate.map { " (due \($0.formatted(date: .abbreviated, time: .omitted)))" } ?? ""
            let overdue = t.isOverdue ? " [OVERDUE]" : ""
            return "  • [\(t.priority.rawValue)] \(t.title)\(due)\(overdue)"
        }.joined(separator: "\n")

        // Whoop block
        let whoop = WhoopService.shared
        var whoopBlock = ""
        if whoop.isConnected, let r = whoop.recovery {
            whoopBlock = """

            ── WHOOP ───────────────────────────────────
            Recovery: \(r.score)/100 (\(r.scoreLabel))
            HRV: \(Int(r.hrv))ms  |  Resting HR: \(r.restingHR)bpm
            """
            if let s = whoop.sleep {
                whoopBlock += "\nSleep: \(Int(s.performancePercent))% performance (\(String(format: "%.1f", s.hoursOfSleep))h)"
            }
            if let st = whoop.strain {
                whoopBlock += "\nCycle strain: \(String(format: "%.1f", st))/21"
            }
            whoopBlock += "\n────────────────────────────────────────────"
        }

        // Daily briefing block
        var briefingBlock = ""
        if let b = DailyBriefingService.shared.briefing {
            briefingBlock = """

            ── TODAY'S BRIEFING ────────────────────────
            Power word: \(b.powerWord)
            \(b.headline)
            Attack plan: \(b.attackPlan)
            ────────────────────────────────────────────
            """
        }

        // Low-energy warning
        var energyWarning = ""
        if EnergyCheckInService.shared.hasAfternoonEnergyWarning {
            energyWarning = "\n⚠️ NOTE: User has logged consistently low energy (≤2/5) in the afternoon over the past week. Factor in fatigue when advising on training intensity and scheduling."
        }

        return """
        You are \(userName)'s personal AI coach inside LifeOS — fitness, productivity, and wellbeing. \
        You are direct, knowledgeable, and motivating.

        ── USER DATA ──────────────────────────────────
        Name: \(userName)  |  Streak: \(streak) day\(streak == 1 ? "" : "s")
        \(recencyLine)
        Recent workouts (newest first):
        \(workoutLines.isEmpty ? "  None yet" : workoutLines)

        Pending tasks (\(pendingTasks.count) total):
        \(taskLines.isEmpty ? "  None" : taskLines)
        ──────────────────────────────────────────────\(whoopBlock)\(briefingBlock)\(energyWarning)

        GUIDELINES
        • Be concise. 2–4 sentences for casual questions. Use clean lists for programs.
        • Reference actual workout history and tasks when giving advice.
        • For Whoop: Green (≥67) = train hard, Yellow (34–66) = moderate, Red (<34) = rest.
        • Format workout splits: Day → exercise list → sets × reps.
        • Never give medical advice. Mention a professional for injury signals.
        • No disclaimer on every message — treat this like an ongoing coaching relationship.
        """
    }

    private func buildDigestPrompt(userName: String, workouts: [Workout], tasks: [Task], streak: Int) -> String {
        let recent = Array(workouts.prefix(7))
        let pendingTasks = tasks.filter { !$0.isCompleted }
        let whoop = WhoopService.shared

        var lines = ["Daily digest for \(userName), streak \(streak) days."]
        if let r = whoop.recovery {
            lines.append("Recovery \(r.score)/100 (\(r.scoreLabel)), HRV \(Int(r.hrv))ms.")
        }
        if let last = recent.first {
            let days = Calendar.current.dateComponents([.day], from: last.date, to: Date()).day ?? 0
            lines.append("Last workout \(days == 0 ? "today" : "\(days) days ago"): \(last.name).")
        }
        lines.append("\(pendingTasks.count) pending tasks.")
        let overdueTasks = pendingTasks.filter(\.isOverdue)
        if !overdueTasks.isEmpty {
            lines.append("\(overdueTasks.count) overdue: \(overdueTasks.prefix(3).map(\.title).joined(separator: ", ")).")
        }
        if let b = DailyBriefingService.shared.briefing {
            lines.append("Today's word: \(b.powerWord). \(b.headline)")
        }

        return lines.joined(separator: " ") + "\n\nGive a tight 4–6 sentence daily digest covering: training readiness, priority tasks, and one actionable focus for today."
    }
}
