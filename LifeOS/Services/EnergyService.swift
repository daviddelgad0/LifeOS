import Foundation

// MARK: - Circadian energy model
//
// Produces a 0.0–1.0 energy level for each 30-minute slot across the day.
// Based on a simplified circadian model with four phases:
//   1. Post-wake grogginess → rise  (0–1.5h awake)
//   2. Rising energy        → peak  (1.5–6h awake)
//   3. Afternoon dip              (6–8h awake)
//   4. Second wind + decline      (8–end)

enum EnergyService {

    struct DataPoint {
        let hour:   Double   // 0–24 (e.g. 13.5 = 1:30 PM)
        let energy: Double   // 0.0–1.0
    }

    // MARK: - Curve

    static func curve(wakeHour: Double = 7, bedHour: Double = 23) -> [DataPoint] {
        stride(from: wakeHour, through: bedHour, by: 0.5).map { h in
            DataPoint(hour: h, energy: energyAt(hour: h, wake: wakeHour, bed: bedHour))
        }
    }

    // MARK: - Marker hours

    static func peakHour(wake: Double) -> Double { wake + 4.5 }
    static func dipHour(wake: Double)  -> Double { wake + 7.0 }

    // MARK: - Private

    private static func energyAt(hour: Double, wake: Double, bed: Double) -> Double {
        let awake = hour - wake
        guard awake >= 0, hour < bed else { return 0.1 }
        switch awake {
        case 0..<1.5:  return 0.30 + (awake / 1.5) * 0.30
        case 1.5..<4:  return 0.60 + ((awake - 1.5) / 2.5) * 0.40
        case 4..<6:    return 1.00
        case 6..<8:    return 1.00 - ((awake - 6) / 2.0) * 0.35
        case 8..<10:   return 0.65 + ((awake - 8) / 2.0) * 0.25
        case 10..<12:  return 0.90 - ((awake - 10) / 2.0) * 0.40
        default:       return max(0.1, 0.50 - ((awake - 12) / 4.0) * 0.40)
        }
    }
}
