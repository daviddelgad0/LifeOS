import Foundation

// MARK: - Data model

struct DailyBriefing: Codable {
    var powerWord:       String
    var headline:        String
    var attackPlan:      String
    var peakFocusWindow: String
    var caffeineAdvice:  String
    var strainBudget:    String
    var watchOut:        String
}

// MARK: - Service

@Observable
final class DailyBriefingService {

    static let shared = DailyBriefingService()
    private init() { loadCached() }

    private(set) var briefing:   DailyBriefing?
    private(set) var isLoading = false
    var error: String?

    // MARK: - Public API

    func fetchIfNeeded() async {
        guard briefing == nil, !isLoading else { return }
        await fetch()
    }

    func refresh() async {
        await fetch()
    }

    // MARK: - Private

    private func fetch() async {
        isLoading = true
        error     = nil
        defer { isLoading = false }

        let prompt = buildPrompt()
        do {
            let text   = try await AnthropicService.shared.complete(
                prompt:       prompt,
                systemPrompt: "You are a high-performance AI coach. Return ONLY valid JSON with no markdown fences or explanation.",
                maxTokens:    512
            )
            let parsed = try parseBriefing(from: text)
            briefing   = parsed
            cache(parsed)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func buildPrompt() -> String {
        let whoop = WhoopService.shared
        var ctx   = "Today: \(todayKey)\n"
        if let r = whoop.recovery {
            ctx += "Recovery \(r.score)/100 (\(r.scoreLabel)), HRV \(Int(r.hrv))ms, RHR \(r.restingHR)bpm\n"
        }
        if let s = whoop.sleep {
            ctx += "Sleep \(Int(s.performancePercent))% perf, \(String(format: "%.1f", s.hoursOfSleep))h\n"
        }
        if let st = whoop.strain {
            ctx += "Strain so far: \(String(format: "%.1f", st))/21\n"
        }

        return """
        \(ctx)
        Generate a daily performance briefing. Return ONLY a JSON object with exactly these keys:
        {
          "powerWord":       "One powerful word for today (e.g. EXECUTE, ADAPT, CONQUER)",
          "headline":        "One tone-setting sentence (max 12 words)",
          "attackPlan":      "1–2 sentences on how to tackle today given recovery",
          "peakFocusWindow": "Best 2-hour window for deep work (e.g. 10am–12pm)",
          "caffeineAdvice":  "Optimal caffeine timing today (1 sentence)",
          "strainBudget":    "Recommended training intensity (1 sentence)",
          "watchOut":        "One risk or trap to avoid today (1 sentence)"
        }
        """
    }

    private func parseBriefing(from text: String) throws -> DailyBriefing {
        var s = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if let start = s.firstIndex(of: "{"), let end = s.lastIndex(of: "}") {
            s = String(s[start...end])
        }
        guard let data = s.data(using: .utf8) else {
            throw AnthropicError.parseError("Could not encode briefing text.")
        }
        return try JSONDecoder().decode(DailyBriefing.self, from: data)
    }

    // MARK: - Persistence (keyed by calendar date)

    private var todayKey: String {
        let fmt = DateFormatter()
        fmt.dateFormat = "yyyy-MM-dd"
        return fmt.string(from: Date())
    }

    private func cache(_ b: DailyBriefing) {
        guard let data = try? JSONEncoder().encode(b) else { return }
        UserDefaults.standard.set(data, forKey: "lifeos.briefing.\(todayKey)")
    }

    private func loadCached() {
        guard
            let data = UserDefaults.standard.data(forKey: "lifeos.briefing.\(todayKey)"),
            let b    = try? JSONDecoder().decode(DailyBriefing.self, from: data)
        else { return }
        briefing = b
    }
}
