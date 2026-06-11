import SwiftUI

// Dark card with a big number and label — used for workout stats, recovery scores, etc.
// Usage: StatCard(label: "Bench PR", value: "225", unit: "lb")

struct StatCard: View {
    let label: String
    let value: String
    var unit: String? = nil
    var valueColor: Color = .appTextPrimary

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.xs) {
            Text(label.uppercased())
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.2)

            HStack(alignment: .lastTextBaseline, spacing: AppSpacing.xs) {
                Text(value)
                    .font(.appBigStat)
                    .foregroundColor(valueColor)
                if let unit {
                    Text(unit)
                        .font(.appBody)
                        .foregroundColor(.appTextSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .clipShape(RoundedRectangle(cornerRadius: AppRadius.md))
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        VStack(spacing: AppSpacing.sm) {
            StatCard(label: "Bench Press PR", value: "225", unit: "lb", valueColor: .appAccent)
            StatCard(label: "Workouts This Week", value: "4")
            StatCard(label: "Recovery", value: "82", unit: "%", valueColor: .appPriorityLow)
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
