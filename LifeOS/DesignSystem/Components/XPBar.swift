import SwiftUI

// Horizontal XP progress bar with level label.
// Usage: XPBar(current: 340, total: 500, level: 7)

struct XPBar: View {
    let current: Int
    let total: Int
    let level: Int

    private var progress: Double {
        guard total > 0 else { return 0 }
        return max(0, min(1, Double(current) / Double(total)))
    }

    var body: some View {
        VStack(spacing: AppSpacing.xs) {
            HStack {
                Text("LVL \(level)")
                    .font(.appCaption)
                    .foregroundColor(.appAccent)
                    .tracking(1.2)
                Spacer()
                Text("\(current) / \(total) XP")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
            }

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Color.appSurface2).frame(height: 4)
                    Capsule()
                        .fill(Color.appAccent)
                        .frame(width: geo.size.width * progress, height: 4)
                        .animation(.spring(response: 0.6, dampingFraction: 0.8), value: progress)
                }
            }
            .frame(height: 4)
        }
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        VStack(spacing: AppSpacing.lg) {
            XPBar(current: 340, total: 500, level: 7)
            XPBar(current: 0,   total: 500, level: 1)
            XPBar(current: 500, total: 500, level: 12)
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
