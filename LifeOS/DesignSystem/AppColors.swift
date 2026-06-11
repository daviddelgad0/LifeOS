import SwiftUI

// MARK: - Color tokens
// Every color in the app comes from here. Never hardcode hex values in views.

extension Color {
    static let appBackground    = Color(hex: "0A0A0A")  // near-black canvas
    static let appSurface       = Color(hex: "141414")  // cards, list rows
    static let appSurface2      = Color(hex: "1E1E1E")  // elevated surfaces, track fills
    static let appAccent        = Color(hex: "00D4FF")  // neon cyan — use sparingly
    static let appTextPrimary   = Color.white
    static let appTextSecondary = Color(hex: "8E8E93")  // muted labels
    static let appSeparator     = Color(hex: "2C2C2E")
    static let appDestructive   = Color(hex: "FF453A")

    static let appPriorityHigh   = Color(hex: "FF453A")
    static let appPriorityMedium = Color(hex: "FFD60A")
    static let appPriorityLow    = Color(hex: "32D74B")
}

// MARK: - Hex initializer
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        default:
            (r, g, b) = (255, 255, 255)
        }
        self.init(.sRGB, red: Double(r) / 255, green: Double(g) / 255, blue: Double(b) / 255)
    }
}
