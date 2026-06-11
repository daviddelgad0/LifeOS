import SwiftUI
import Charts

// MARK: - Energy curve card (circadian model visualisation)

struct EnergyCurveCard: View {
    @Environment(AppTheme.self) private var theme

    private var wakeHour: Double { 7.0 }
    private var bedHour:  Double { 23.0 }

    private var chartData: [EnergyService.DataPoint] {
        EnergyService.curve(wakeHour: wakeHour, bedHour: bedHour)
    }
    private var peakHour: Double { EnergyService.peakHour(wake: wakeHour) }
    private var dipHour:  Double { EnergyService.dipHour(wake: wakeHour) }

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Text("ENERGY CURVE")
                .font(.appCaption)
                .foregroundColor(.appTextSecondary)
                .tracking(1.5)

            Chart {
                ForEach(chartData, id: \.hour) { point in
                    AreaMark(
                        x: .value("Hour", point.hour),
                        y: .value("Energy", point.energy)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: [theme.todayAccent.opacity(0.55), theme.todayAccent.opacity(0.04)],
                            startPoint: .top,
                            endPoint:   .bottom
                        )
                    )
                    LineMark(
                        x: .value("Hour", point.hour),
                        y: .value("Energy", point.energy)
                    )
                    .foregroundStyle(theme.todayAccent)
                    .lineStyle(StrokeStyle(lineWidth: 2))
                }

                // PEAK rule
                RuleMark(x: .value("Hour", peakHour))
                    .foregroundStyle(theme.todayAccent.opacity(0.4))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .annotation(position: .top, alignment: .center) {
                        markerLabel("PEAK", color: theme.todayAccent)
                    }

                // DIP rule
                RuleMark(x: .value("Hour", dipHour))
                    .foregroundStyle(Color.appPriorityMedium.opacity(0.4))
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    .annotation(position: .top, alignment: .center) {
                        markerLabel("DIP", color: .appPriorityMedium)
                    }
            }
            .chartXAxis {
                AxisMarks(values: [7.0, 10.0, 13.0, 16.0, 19.0, 22.0]) { value in
                    AxisValueLabel {
                        if let h = value.as(Double.self) {
                            Text(hourLabel(h))
                                .font(.system(size: 9))
                                .foregroundColor(.appTextSecondary)
                        }
                    }
                }
            }
            .chartYAxis(.hidden)
            .chartYScale(domain: 0...1.05)
            .frame(height: 96)

            // Wake / Bed pills
            HStack {
                timePill("WAKE", time: hourLabel(wakeHour))
                Spacer()
                timePill("BED", time: hourLabel(bedHour))
            }
        }
        .padding(AppSpacing.md)
        .background(Color.appSurface)
        .cornerRadius(AppRadius.md)
    }

    private func markerLabel(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 9, weight: .black))
            .foregroundColor(color)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .background(Color.appSurface2)
            .cornerRadius(4)
    }

    private func timePill(_ label: String, time: String) -> some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(.appTextSecondary)
                .tracking(1)
            Text(time)
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .foregroundColor(.appTextPrimary)
        }
        .padding(.horizontal, AppSpacing.sm)
        .padding(.vertical, 3)
        .background(Color.appSurface2)
        .cornerRadius(AppRadius.sm)
    }

    private func hourLabel(_ h: Double) -> String {
        let i = Int(h)
        if i < 12  { return "\(i)am" }
        if i == 12 { return "12pm" }
        return "\(i - 12)pm"
    }
}
