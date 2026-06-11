import SwiftUI

// MARK: - 4 donut charts summarising key Whoop metrics

struct WhoopDonutsView: View {
    let recovery: WhoopRecovery
    let sleep:    WhoopSleep?
    let strain:   Double?
    let accent:   Color

    var body: some View {
        HStack(spacing: 0) {
            DonutChartCell(
                value:   Double(recovery.score) / 100,
                label:   "RECOVERY",
                display: "\(recovery.score)",
                color:   recoveryColor(recovery.score)
            )
            DonutChartCell(
                value:   min(recovery.hrv / 200, 1.0),
                label:   "HRV",
                display: "\(Int(recovery.hrv))ms",
                color:   accent
            )
            if let s = sleep {
                DonutChartCell(
                    value:   s.performancePercent / 100,
                    label:   "SLEEP",
                    display: "\(Int(s.performancePercent))%",
                    color:   accent
                )
            }
            if let st = strain {
                DonutChartCell(
                    value:   st / 21,
                    label:   "STRAIN",
                    display: String(format: "%.1f", st),
                    color:   .appPriorityMedium
                )
            }
        }
        .padding(.top, AppSpacing.sm)
    }

    private func recoveryColor(_ score: Int) -> Color {
        switch score {
        case 67...100: return .appPriorityLow
        case 34...66:  return .appPriorityMedium
        default:       return .appPriorityHigh
        }
    }
}

// MARK: - Single donut cell

struct DonutChartCell: View {
    let value:   Double   // 0.0–1.0
    let label:   String
    let display: String
    let color:   Color

    var body: some View {
        VStack(spacing: 5) {
            ZStack {
                Circle()
                    .stroke(color.opacity(0.18), lineWidth: 5)
                Circle()
                    .trim(from: 0, to: max(0, min(1, value)))
                    .stroke(color, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.easeOut(duration: 0.8), value: value)
                Text(display)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundColor(.appTextPrimary)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
            }
            .frame(width: 52, height: 52)
            Text(label)
                .font(.system(size: 8, weight: .semibold))
                .foregroundColor(.appTextSecondary)
                .tracking(0.5)
        }
        .frame(maxWidth: .infinity)
    }
}
