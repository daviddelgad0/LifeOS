import SwiftUI

// MARK: - Typography tokens
// All font styles in one place. SF Pro is the iOS system font — no import needed.

extension Font {
    // Big bold numbers: weights, PRs, stats
    static let appBigStat  = Font.system(size: 48, weight: .bold)

    // Screen titles ("Tasks", "Workouts")
    static let appTitle    = Font.system(size: 28, weight: .bold)

    // Section headers, row titles
    static let appHeadline = Font.system(size: 17, weight: .semibold)

    // Body copy, form fields
    static let appBody     = Font.system(size: 15, weight: .regular)

    // Labels, timestamps, section headers in all-caps
    static let appCaption  = Font.system(size: 12, weight: .regular)

    // Rest timer, stopwatch (monospaced so digits don't shift)
    static let appMono     = Font.system(size: 24, weight: .semibold, design: .monospaced)
    static let appMonoSm   = Font.system(size: 15, weight: .medium,   design: .monospaced)
}
