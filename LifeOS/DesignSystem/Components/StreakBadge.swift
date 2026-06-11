import SwiftUI

// Shows a streak count with a label. Goes dim when streak is 0.
// Usage: StreakBadge(count: 14, label: "Day Streak")

struct StreakBadge: View {
    let count: Int
    let label: String
    var color: Color = .appAccent

    var body: some View {
        HStack(spacing: AppSpacing.xs) {
            Text("\(count)")
                .font(.appHeadline)
                .foregroundColor(count > 0 ? color : .appTextSecondary)

            Text(label.uppercased())
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.2)
        }
        .padding(.horizontal, AppSpacing.md)
        .padding(.vertical, AppSpacing.sm)
        .background(Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.sm))
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        HStack(spacing: AppSpacing.md) {
            StreakBadge(count: 14, label: "Day Streak")
            StreakBadge(count: 0,  label: "Day Streak")
        }
    }
    .preferredColorScheme(.dark)
}
