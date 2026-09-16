import SwiftUI
import EventKit
import EventKitUI
import UserNotifications

struct CalendarEventSheet: UIViewControllerRepresentable {
    let visit: Visit
    @Environment(\.dismiss) private var dismiss
    func makeCoordinator() -> Coordinator { Coordinator { dismiss() } }
    func makeUIViewController(context: Context) -> EKEventEditViewController {
        let controller = EKEventEditViewController()
        let store = EKEventStore()
        controller.eventStore = store
        let event = EKEvent(eventStore: store)
        event.title = String(localized: "Church visit")
        event.startDate = visit.scheduledAt
        event.endDate = visit.scheduledAt.addingTimeInterval(3600)
        event.timeZone = DomainRules.churchTimeZone
        // No private names, addresses or notes exported. This is a user-confirmed snapshot.
        event.notes = String(localized: "Added from Church Directory. Check the app for changes or cancellations.")
        controller.event = event
        controller.editViewDelegate = context.coordinator
        return controller
    }
    func updateUIViewController(_ controller: EKEventEditViewController, context: Context) {}
    final class Coordinator: NSObject, EKEventEditViewDelegate {
        let dismiss: () -> Void
        init(dismiss: @escaping () -> Void) { self.dismiss = dismiss }
        func eventEditViewController(_ controller: EKEventEditViewController, didCompleteWith action: EKEventEditViewAction) { dismiss() }
    }
}

@MainActor final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    weak var store: AppStore?
    func application(_ application: UIApplication,didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }
    func application(_ application: UIApplication,didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Task { do { try await store?.registerPushToken(deviceToken) } catch { store?.errorMessage = error.localizedDescription } }
    }
    func application(_ application: UIApplication,didFailToRegisterForRemoteNotificationsWithError error: Error) { store?.errorMessage = "Notifications could not be registered: \(error.localizedDescription)" }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        await store?.refresh()
        return [.banner,.badge,.sound]
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter,didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        guard let kind = info["kind"] as? String else { return }
        let key = kind == "visit" ? "visit_id" : kind == "reminder" ? "reminder_id" : "member_id"
        guard let value = info[key] as? String, let id = UUID(uuidString: value) else { return }
        await store?.openNotification(kind: kind,id: id)
    }
}
