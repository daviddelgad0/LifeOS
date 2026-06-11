import SwiftUI

// Circular progress ring — like Apple Fitness rings.
// Usage: Ring(progress: 0.72) — pass a value from 0.0 to 1.0.

struct Ring: View {
    let progress: Double
    var lineWidth: CGFloat = 8
    var color: Color = .appAccent
    var trackColor: Color = .appSurface2

    private var clamped: Double { max(0, min(1, progress)) }

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: clamped)
                .stroke(color, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.spring(response: 0.6, dampingFraction: 0.8), value: clamped)
        }
    }
}

#Preview {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        HStack(spacing: AppSpacing.xl) {
            Ring(progress: 0.72, lineWidth: 12)
                .frame(width: 120, height: 120)
            Ring(progress: 0.45, lineWidth: 6, color: .appPriorityHigh)
                .frame(width: 60, height: 60)
            Ring(progress: 1.0, lineWidth: 8, color: .appPriorityLow)
                .frame(width: 80, height: 80)
        }
    }
    .preferredColorScheme(.dark)
}
