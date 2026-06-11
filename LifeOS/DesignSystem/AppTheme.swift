import SwiftUI

// MARK: - App Theme
//
// Single source of truth for user settings.
// Each tab has its own accent color so the UI feels distinct per section.
// The tab bar tint switches live as you change tabs (see ContentView).
//
// Persistence: every property writes to UserDefaults on set.

@Observable
final class AppTheme {

    // MARK: - Per-tab accent colors

    var todayAccentHex: String {
        didSet { UserDefaults.standard.set(todayAccentHex, forKey: "lifeos.todayAccent") }
    }
    var tasksAccentHex: String {
        didSet { UserDefaults.standard.set(tasksAccentHex, forKey: "lifeos.tasksAccent") }
    }
    var workoutsAccentHex: String {
        didSet { UserDefaults.standard.set(workoutsAccentHex, forKey: "lifeos.workoutsAccent") }
    }
    var schoolAccentHex: String {
        didSet { UserDefaults.standard.set(schoolAccentHex, forKey: "lifeos.schoolAccent") }
    }
    var coachAccentHex: String {
        didSet { UserDefaults.standard.set(coachAccentHex, forKey: "lifeos.coachAccent") }
    }

    // MARK: - Other settings

    var userName: String {
        didSet { UserDefaults.standard.set(userName, forKey: "lifeos.userName") }
    }
    var defaultRestSeconds: Int {
        didSet { UserDefaults.standard.set(defaultRestSeconds, forKey: "lifeos.restSeconds") }
    }

    /// Anthropic API key — used by AnthropicService for syllabus parsing (Phase 1)
    /// and AI Coach (Phase 3). Stored in UserDefaults (plain text for now; migrate
    /// to Keychain in a future pass if needed).
    var anthropicKey: String {
        didSet { UserDefaults.standard.set(anthropicKey, forKey: "lifeos.anthropicKey") }
    }

    // MARK: - Navigation

    var selectedTab: Int = 0

    // MARK: - Computed accent colors

    var todayAccent:    Color { Color(hex: todayAccentHex) }
    var tasksAccent:    Color { Color(hex: tasksAccentHex) }
    var workoutsAccent: Color { Color(hex: workoutsAccentHex) }
    var schoolAccent:   Color { Color(hex: schoolAccentHex) }
    var coachAccent:    Color { Color(hex: coachAccentHex) }

    /// The accent of whichever tab is currently selected — used for tab bar tint.
    var activeAccent: Color {
        switch selectedTab {
        case 0:  return todayAccent
        case 1:  return tasksAccent
        case 2:  return workoutsAccent
        case 3:  return schoolAccent
        case 4:  return coachAccent
        default: return todayAccent
        }
    }

    // MARK: - 12-color palette (shown in Settings per-tab pickers)

    struct ColorPreset: Identifiable {
        let id   = UUID()
        let name: String
        let hex:  String
        var color: Color { Color(hex: hex) }
    }

    static let colorPalette: [ColorPreset] = [
        // Cool / neon
        .init(name: "Cyan",    hex: "00D4FF"),   // Today default
        .init(name: "Blue",    hex: "0A84FF"),
        .init(name: "Indigo",  hex: "5E5CE6"),
        .init(name: "Purple",  hex: "BF5AF2"),   // Tasks default
        // Warm
        .init(name: "Pink",    hex: "FF375F"),
        .init(name: "Rose",    hex: "FF2D55"),
        .init(name: "Coral",   hex: "FF6B6B"),
        .init(name: "Orange",  hex: "FF9F0A"),   // Workouts default
        .init(name: "Amber",   hex: "FFB800"),
        .init(name: "Yellow",  hex: "FFD60A"),
        // Nature
        .init(name: "Green",   hex: "32D74B"),   // School default
        .init(name: "Mint",    hex: "00C7BE"),
    ]

    // MARK: - Init

    init() {
        let ud = UserDefaults.standard
        self.todayAccentHex    = ud.string(forKey: "lifeos.todayAccent")    ?? "00D4FF"
        self.tasksAccentHex    = ud.string(forKey: "lifeos.tasksAccent")    ?? "BF5AF2"
        self.workoutsAccentHex = ud.string(forKey: "lifeos.workoutsAccent") ?? "FF9F0A"
        self.schoolAccentHex   = ud.string(forKey: "lifeos.schoolAccent")   ?? "32D74B"
        self.userName           = ud.string(forKey: "lifeos.userName")       ?? "David"
        self.anthropicKey       = ud.string(forKey: "lifeos.anthropicKey")  ?? ""
        self.coachAccentHex     = ud.string(forKey: "lifeos.coachAccent")   ?? "5E5CE6"
        let saved = ud.integer(forKey: "lifeos.restSeconds")
        self.defaultRestSeconds = saved > 0 ? saved : 90
    }
}
