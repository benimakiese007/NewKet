import Foundation
import CallKit
import AVFoundation

// ─────────────────────────────────────────────────────────────────────────────
// NewKetCallProvider
// Singleton that manages the CallKit CXProvider + CXCallController.
// Called by NewKetPushKitHandler when a VoIP push arrives.
// ─────────────────────────────────────────────────────────────────────────────

@objc class NewKetCallProvider: NSObject, CXProviderDelegate {

    // MARK: - Singleton

    @objc static let shared = NewKetCallProvider()

    // MARK: - CallKit objects

    private let provider: CXProvider
    private let callController = CXCallController()

    // MARK: - Active call state

    /// UUID of the currently ringing / active call
    private(set) var currentCallUUID: UUID?
    private var currentOrderId: String?
    private var currentCallerName: String?

    // MARK: - Init

    private override init() {
        let config = CXProviderConfiguration(localizedName: "NewKet")
        config.supportsVideo          = false
        config.maximumCallsPerCallGroup = 1
        config.maximumCallGroups      = 1
        config.supportedHandleTypes   = [.generic]
        // Ring tone — use system default (nil) so iOS plays its ring sound
        config.ringtoneSound          = nil
        // Icon shown in CallKit UI (32×32 @1x mask-able template image)
        // We skip a custom icon for now; works without it.

        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    // MARK: - Public API

    /// Report an incoming call to iOS CallKit.
    /// Must be called synchronously from PKPushRegistryDelegate (Apple requires it).
    ///
    /// - Parameters:
    ///   - callerName: Display name shown in the system call UI
    ///   - orderId:    NewKet order ID (stored to pass to WebView on answer)
    @objc func reportIncomingCall(callerName: String, orderId: String) {
        // If a call is already ringing, end it first
        if let existing = currentCallUUID {
            provider.reportCall(with: existing, endedAt: Date(), reason: .answeredElsewhere)
        }

        let uuid = UUID()
        currentCallUUID   = uuid
        currentOrderId    = orderId
        currentCallerName = callerName

        let handle = CXHandle(type: .generic, value: callerName)
        let update = CXCallUpdate()
        update.remoteHandle         = handle
        update.hasVideo             = false
        update.localizedCallerName  = callerName
        update.supportsHolding      = false
        update.supportsGrouping     = false
        update.supportsUngrouping   = false

        provider.reportNewIncomingCall(with: uuid, update: update) { error in
            if let error = error {
                print("[NewKetCallProvider] reportNewIncomingCall error: \(error)")
                self.currentCallUUID = nil
            }
        }

        // Auto-dismiss after 45 seconds if not answered
        DispatchQueue.main.asyncAfter(deadline: .now() + 45) { [weak self] in
            guard let self = self, self.currentCallUUID == uuid else { return }
            self.provider.reportCall(with: uuid, endedAt: Date(), reason: .unanswered)
            self.currentCallUUID = nil
        }
    }

    /// End the current call programmatically (e.g. caller hung up)
    @objc func endCurrentCall() {
        guard let uuid = currentCallUUID else { return }
        let action = CXEndCallAction(call: uuid)
        let tx = CXTransaction(action: action)
        callController.request(tx) { _ in }
        currentCallUUID = nil
    }

    // MARK: - CXProviderDelegate

    func providerDidReset(_ provider: CXProvider) {
        currentCallUUID = nil
    }

    /// User pressed "Answer" in the native CallKit UI
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // Notify the WebView to auto-answer the WebRTC call
        let orderId    = currentOrderId ?? ""
        let callerName = currentCallerName ?? ""
        DispatchQueue.main.async {
            NewKetCallBridge.shared.notifyCallAnswered(orderId: orderId, callerName: callerName)
        }
        action.fulfill()
    }

    /// User pressed "Decline" in the native CallKit UI
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        currentCallUUID   = nil
        currentOrderId    = nil
        currentCallerName = nil
        action.fulfill()
    }

    /// Audio session activation — required by CallKit
    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        // Let WebRTC / AVAudioSession manage itself; nothing extra needed here.
    }

    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {}
}
