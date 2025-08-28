//
//  VolumeButton.swift
//  MobileDiagnostics
//
//  Created by Jamil Abram on 8/28/25.
//

import Foundation
import AVFoundation
import MediaPlayer

@objc(VolumeButton)
class VolumeButton: RCTEventEmitter {

  private let audioSession = AVAudioSession.sharedInstance()
  private var observation: NSKeyValueObservation?
  private var volumeView: MPVolumeView?
  private var lastVolume: Float = 0.5
  private var observing = false
  private var swallowChanges = false  // default: false (don’t reset system volume)

  // MARK: - RCTEventEmitter

  override static func requiresMainQueueSetup() -> Bool { true }

  override func supportedEvents() -> [String]! {
    return ["HardwareVolumeButton"]
  }

  override func startObserving() {
    // RN will call this when first JS listener is added
  }

  override func stopObserving() {
    // RN will call this when last JS listener is removed
  }

  // MARK: - Public API exposed to JS

  @objc func start() {
    if observing { return }
    observing = true

    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      do {
        try self.audioSession.setCategory(.ambient, mode: .default, options: [.mixWithOthers])
        try self.audioSession.setActive(true)
      } catch {
        NSLog("[VolumeButton] AVAudioSession error: \(error.localizedDescription)")
      }

      self.setupHiddenVolumeViewIfNeeded()
      self.lastVolume = self.audioSession.outputVolume

      self.observation = self.audioSession.observe(\.outputVolume, options: [.old, .new]) { [weak self] _, change in
        guard let self = self,
              let oldVal = change.oldValue,
              let newVal = change.newValue,
              oldVal != newVal else { return }

        let direction: String = (newVal > oldVal) ? "up" : "down"
        let payload: [String: Any] = [
          "direction": direction,
          "oldValue": oldVal,
          "newValue": newVal,
          "pressedAt": Int(Date().timeIntervalSince1970 * 1000)
        ]
        self.sendEvent(withName: "HardwareVolumeButton", body: payload)

        // Optionally “swallow” the volume change by restoring the previous value via MPVolumeView
        if self.swallowChanges {
          self.setSystemVolume(self.lastVolume)
        } else {
          self.lastVolume = newVal
        }
      }
    }
  }

  @objc func stop() {
    if !observing { return }
    observing = false
    observation?.invalidate()
    observation = nil
    removeHiddenVolumeView()
    do { try audioSession.setActive(false) } catch { /* ignore */ }
  }

  /// Enable/disable snapping volume back after a press.
  /// JS: VolumeButton.setSwallowVolumeChanges(true/false)
  @objc func setSwallowVolumeChanges(_ enable: NSNumber) {
    swallowChanges = enable.boolValue
  }

  /// Set the system volume to a specific level (0.0 - 1.0)
  /// JS: VolumeButton.setVolume(0.5)
  @objc func setVolume(_ level: NSNumber) {
    let volumeLevel = Float(truncating: level)
    let clampedLevel = min(max(volumeLevel, 0.0), 1.0)
    setSystemVolume(clampedLevel)
    lastVolume = clampedLevel
  }

  // MARK: - Helpers

  private func setupHiddenVolumeViewIfNeeded() {
    if volumeView != nil { return }
    let vv = MPVolumeView(frame: CGRect(x: -1000, y: -1000, width: 0, height: 0))
    vv.isHidden = true
    volumeView = vv
    // Attach to a window to ensure the slider is in the view hierarchy
    if let window = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .flatMap({ $0.windows })
        .first(where: { $0.isKeyWindow }) {
      window.addSubview(vv)
    } else {
      // Fallback for rare cases
      UIApplication.shared.windows.first?.addSubview(vv)
    }
  }

  private func removeHiddenVolumeView() {
    volumeView?.removeFromSuperview()
    volumeView = nil
  }

  private func setSystemVolume(_ value: Float) {
    guard let slider = volumeView?.subviews.compactMap({ $0 as? UISlider }).first else { return }
    DispatchQueue.main.async {
      slider.value = min(max(value, 0.0), 1.0)
      // Send the action to actually apply the change
      slider.sendActions(for: .touchUpInside)
    }
  }
}
