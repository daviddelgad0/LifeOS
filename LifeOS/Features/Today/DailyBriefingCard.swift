import SwiftUI

// MARK: - AI daily briefing card (shown on Today tab when Whoop is connected)

struct DailyBriefingCard: View {
    @Environment(AppTheme.self) private var theme

    private let service = DailyBriefingService.shared

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {

            // Header
            HStack {
                Text("DAILY BRIEFING")
                    .font(.appCaption)
                    .foregroundColor(theme.todayAccent)
                    .tracking(2)
                Spacer()
                if service.isLoading {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .scaleEffect(0.7)
                        .tint(.appTextSecondary)
                } else {
                    Button {
                        _Concurrency.Task { await service.refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                            .font(.system(size: 13))
                            .foregroundColor(.appTextSecondary)
                    }
                }
            }

            if let b = service.briefing {
                // Power word + headline
                VStack(alignment: .leading, spacing: AppSpacing.xs) {
                    Text(b.powerWord.uppercased())
                        .font(.system(size: 38, weight: .black, design: .rounded))
                        .foregroundColor(theme.todayAccent)
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                    Text(b.headline)
                        .font(.appHeadline)
                        .foregroundColor(.appTextPrimary)
                }

                Divider().background(Color.appSeparator)

                // Detail rows
                Group {
                    briefingRow("ATTACK PLAN",  b.attackPlan)
                    briefingRow("PEAK FOCUS",   b.peakFocusWindow)
                    briefingRow("CAFFEINE",      b.caffeineAdvice)
                    briefingRow("STRAIN BUDGET", b.strainBudget)
                    briefingRow("WATCH OUT",     b.watchOut)
                }

            } else if service.isLoading {
                Text("Generating your briefing…")
                    .font(.appBody)
                    .foregroundColor(.appTextSecondary)
                    .padding(.vertical, AppSpacing.sm)
            } else {
                HStack {
                    Text("Tap ↻ to generate today's briefing.")
                        .font(.appBody)
                        .foregroundColor(.appTextSecondary)
                    Spacer()
                }
                .padding(.vertical, AppSpacing.sm)
            }
        }
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
        .onAppear { _Concurrency.Task { await service.fetchIfNeeded() } }
    }

    private func briefingRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)
            Text(value)
                .font(.appBody)
                .foregroundColor(.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}
