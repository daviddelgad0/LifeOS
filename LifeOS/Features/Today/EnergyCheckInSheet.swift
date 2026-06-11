import SwiftUI

// MARK: - Energy check-in bottom sheet

struct EnergyCheckInSheet: View {
    @Environment(AppTheme.self) private var theme

    private let levels: [(emoji: String, label: String, value: Int)] = [
        ("😴", "Drained", 1),
        ("😐", "Low",     2),
        ("🙂", "Okay",    3),
        ("😤", "Pumped",  4),
        ("⚡", "Peak",   5)
    ]

    var body: some View {
        VStack(spacing: AppSpacing.xl) {
            // Handle
            RoundedRectangle(cornerRadius: 2)
                .fill(Color.appSurface2)
                .frame(width: 36, height: 4)
                .padding(.top, AppSpacing.sm)

            VStack(spacing: AppSpacing.xs) {
                Text("ENERGY CHECK-IN")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(2)
                Text("How are you feeling right now?")
                    .font(.appTitle)
                    .foregroundColor(.appTextPrimary)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: AppSpacing.sm) {
                ForEach(levels, id: \.value) { item in
                    Button {
                        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                        EnergyCheckInService.shared.log(level: item.value)
                    } label: {
                        VStack(spacing: AppSpacing.xs) {
                            Text(item.emoji)
                                .font(.system(size: 30))
                            Text(item.label)
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundColor(.appTextSecondary)
                                .tracking(0.3)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.md)
                        .background(Color.appSurface)
                        .cornerRadius(AppRadius.md)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, AppSpacing.lg)

            Button("Skip") {
                EnergyCheckInService.shared.showingCheckIn = false
            }
            .font(.appCaption)
            .foregroundColor(.appTextSecondary)
            .padding(.bottom, AppSpacing.md)

            Spacer()
        }
        .background(Color.appBackground)
    }
}

// MARK: - Last 4 check-ins row

struct EnergyCheckInHistoryRow: View {
    let checkIns: [EnergyCheckIn]
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            HStack {
                Text("ENERGY LOG")
                    .font(.appCaption)
                    .foregroundColor(.appTextSecondary)
                    .tracking(1.5)
                Spacer()
                Button {
                    EnergyCheckInService.shared.showingCheckIn = true
                } label: {
                    Text("CHECK IN")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(accent)
                        .tracking(0.5)
                }
            }

            if checkIns.isEmpty {
                Text("No check-ins yet today.")
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
            } else {
                HStack(spacing: AppSpacing.sm) {
                    ForEach(checkIns) { c in
                        VStack(spacing: 3) {
                            Text(c.emoji)
                                .font(.system(size: 22))
                            Text(timeLabel(c.date))
                                .font(.system(size: 9))
                                .foregroundColor(.appTextSecondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, AppSpacing.sm)
                        .background(Color.appSurface)
                        .cornerRadius(AppRadius.sm)
                    }
                }
            }
        }
    }

    private func timeLabel(_ date: Date) -> String {
        let h = Calendar.current.component(.hour, from: date)
        let m = Calendar.current.component(.minute, from: date)
        let period = h < 12 ? "am" : "pm"
        let h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
        return String(format: "%d:%02d%@", h12, m, period)
    }
}
