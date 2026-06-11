import Observation
import UIKit

// Manages the two timers that run during an active workout:
//   1. Elapsed timer — counts up from 0:00 the moment the workout starts
//   2. Rest timer — counts down from defaultRestSeconds after each set is logged
//
// @Observable means SwiftUI views automatically re-render when any property changes —
// the timer display stays live without any extra wiring.

@Observable
final class WorkoutSessionViewModel {

    // MARK: Elapsed timer
    var elapsedSeconds = 0

    // MARK: Rest timer
    var restSecondsRemaining = 0
    var isRestActive = false
    var defaultRestSeconds = 90

    // MARK: Sheet state
    var showingAddExercise = false
    var newExerciseName = ""

    private var elapsedTimer: Timer?
    private var restTimer: Timer?

    // MARK: - Elapsed timer

    func startElapsedTimer() {
        elapsedTimer?.invalidate()
        elapsedSeconds = 0
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            self?.elapsedSeconds += 1
        }
    }

    func stopAll() {
        elapsedTimer?.invalidate()
        restTimer?.invalidate()
        elapsedTimer = nil
        restTimer = nil
        isRestActive = false
    }

    var elapsedFormatted: String {
        let h = elapsedSeconds / 3600
        let m = (elapsedSeconds % 3600) / 60
        let s = elapsedSeconds % 60
        return h > 0
            ? String(format: "%d:%02d:%02d", h, m, s)
            : String(format: "%d:%02d", m, s)
    }

    // MARK: - Rest timer

    func startRestTimer() {
        restTimer?.invalidate()
        restSecondsRemaining = defaultRestSeconds
        isRestActive = true
        restTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            if restSecondsRemaining > 0 {
                restSecondsRemaining -= 1
            } else {
                endRest()
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            }
        }
    }

    func skipRest() { endRest() }

    func addRestTime(_ seconds: Int) {
        restSecondsRemaining = min(restSecondsRemaining + seconds, 599)
    }

    private func endRest() {
        restTimer?.invalidate()
        restTimer = nil
        isRestActive = false
    }

    var restFormatted: String {
        String(format: "%d:%02d", restSecondsRemaining / 60, restSecondsRemaining % 60)
    }

    // 0.0 → 1.0 representing how much of the rest has elapsed (used to animate the ring)
    var restProgress: Double {
        guard defaultRestSeconds > 0 else { return 0 }
        return 1 - Double(restSecondsRemaining) / Double(defaultRestSeconds)
    }

    deinit {
        elapsedTimer?.invalidate()
        restTimer?.invalidate()
    }
}
