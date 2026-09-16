import Foundation
import Observation
import AuthenticationServices
import CryptoKit
import Security
import UIKit
import UserNotifications

@MainActor @Observable final class AppStore {
    var account: Account?
    var members: [Member] = []
    var groups: [DirectoryGroup] = []
    var visits: [Visit] = []
    var reminders: [PersonalReminder] = []
    var accounts: [Account] = []
    var favoriteIDs: Set<UUID> = []
    var isLoading = false
    var errorMessage: String?
    var selectedVisitID: UUID?
    var selectedMemberID: UUID?
    var selectedReminderID: UUID?
    var visitsEnabled = false
    var birthdaysEnabled = false
    var remindersEnabled = false
    let isDemo: Bool
    var repository: LiveRepository?
    private var nonce: String?
    private var generation = 0
    private var authTask: Task<Void, Never>?
    var canManage: Bool { account?.status == .active && account?.role != .member }
    var canAdminister: Bool { account?.status == .active && account?.role == .admin }
    var canPlanVisits: Bool { account?.status == .active && account?.designation == .pastor }
    init(demo: Bool? = nil) {
        isDemo = demo ?? Self.configuredDemoMode
        if isDemo { seedDemo() } else {
            do { repository = try LiveRepository() } catch { errorMessage = error.localizedDescription }
        }
    }
    static var configuredDemoMode: Bool {
        Bundle.main.object(forInfoDictionaryKey: "AppMode") as? String == "demo"
    }
    func start() async {
        guard !isDemo, let repository, authTask == nil else { return }
        authTask = Task { [weak self] in
            for await (_, session) in repository.client.auth.authStateChanges {
                guard !Task.isCancelled else { return }
                if session == nil { self?.clearProtected(); self?.account = nil }
                else { await self?.refresh() }
            }
        }
    }
    func refresh() async {
        guard !isDemo, let repository else { return }
        guard !isLoading else { return }
        isLoading = true
        let ticket = generation
        defer { isLoading = false }
        do {
            let session = try await repository.client.auth.session
            let profiles: [ProfileRow] = try await repository.rows("profiles?id=eq.\(session.user.id)&select=*")
            guard ticket == generation else { return }
            account = profiles.first?.model
            guard account?.status == .active else { clearProtected(); return }
            let people: [PersonRow] = try await repository.rows("people?select=*&order=last_name,first_name")
            let groupRows: [GroupRow] = try await repository.rows("deacon_groups?select=*")
            let memberships: [GroupMembershipRow] = try await repository.rows("deacon_group_members?select=person_id,group_id")
            let groupDeacons: [GroupDeaconRow] = try await repository.rows("rpc/list_group_deacons")
            let ministries: [MinistryRow] = try await repository.rows("rpc/list_member_ministries")
            let favorites: [FavoriteRow] = try await repository.rows("favorites?select=person_id")
            let reminders: [ReminderRow] = try await repository.rows("personal_reminders?select=*&order=due_at")
            let visitRows: [VisitRow] = try await repository.rows("visit_requests?select=*&order=scheduled_at")
            let recipients: [RecipientRow] = try await repository.rows("visit_recipients?select=*")
            let preferences: [PreferenceRow] = try await repository.rows("account_preferences?select=*")
            var accountRows: [Account] = []
            if canAdminister { let rows: [ProfileRow] = try await repository.rows("profiles?select=*"); accountRows = rows.map(\.model) }
            else if canManage { let rows: [EligibleDeaconRow] = try await repository.rows("rpc/list_eligible_deacons"); accountRows = rows.map { Account(id: $0.id,displayName: $0.display_name,status: .active,designation: .deacon) } }
            else if canPlanVisits { let rows: [DeaconRow] = try await repository.rows("rpc/list_visit_deacons"); accountRows = rows.map { Account(id: $0.id, displayName: $0.name, status: .active, designation: .deacon) } }
            guard ticket == generation else { return }
            self.members = people.map { row in
                var member = row.model
                member.groupID = memberships.first { $0.person_id == row.id }?.group_id
                member.originalGroupID = member.groupID
                let roles = ministries.first { $0.person_id == row.id }?.ministry_roles ?? []
                member.designation = roles.contains("pastor") ? .pastor : roles.contains("deacon") ? .deacon : .none
                return member
            }
            self.groups = groupRows.map { row in let deacons = groupDeacons.filter { $0.group_id == row.id }.map(\.profile_id); return DirectoryGroup(id: row.id, name: row.name, responsibleDeaconID: deacons.first, deaconIDs: deacons) }
            self.favoriteIDs = Set(favorites.map(\.person_id)); self.reminders = reminders.map(\.model)
            self.visits = visitRows.map { row in var visit = row.model; visit.participants = recipients.filter { $0.request_id == row.id }.map(\.model); return visit }
            for row in groupDeacons where !accountRows.contains(where: { $0.id == row.profile_id }) {
                accountRows.append(Account(id: row.profile_id,displayName: row.display_name,role: .member,status: row.status,designation: .deacon,memberID: row.person_id))
            }
            self.accounts = accountRows
            if let prefs = preferences.first {
                visitsEnabled = prefs.visit_notifications; birthdaysEnabled = prefs.birthday_notifications; remindersEnabled = prefs.reminder_notifications
                UserDefaults.standard.set(prefs.language,forKey: "language"); UserDefaults.standard.set(prefs.appearance,forKey: "appearance")
            } else { visitsEnabled = false; birthdaysEnabled = false; remindersEnabled = false }
            errorMessage = nil
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            if ticket == generation, settings.authorizationStatus == .authorized { UIApplication.shared.registerForRemoteNotifications() }
        } catch {
            guard ticket == generation else { return }
            clearProtected() // Fail closed, including after revocation or a failed foreground check.
            account = nil
            errorMessage = error.localizedDescription
        }
    }
    func clearProtected() {
        generation += 1
        members = []; groups = []; visits = []; reminders = []; accounts = []; favoriteIDs = []; selectedVisitID = nil
        selectedMemberID = nil; selectedReminderID = nil
        visitsEnabled = false; birthdaysEnabled = false; remindersEnabled = false
        URLCache.shared.removeAllCachedResponses()
    }
    func live() throws -> LiveRepository { guard let repository else { throw AppFailure.configuration }; return repository }
    func requireActive() throws { guard account?.status == .active else { throw AppFailure.access } }
    func mutate(_ name: String, _ params: [String: Any]) async throws {
        try requireActive()
        try await live().rpc(name, params)
        await refresh()
        if let errorMessage { throw AppFailure.unavailable(errorMessage) }
    }
    func signInWithGoogle() async throws { _ = try await live().client.auth.signInWithOAuth(provider: .google, redirectTo: URL(string: "churchdirectory://auth/callback")!); await refresh() }
    func prepareAppleSignIn(_ request: ASAuthorizationAppleIDRequest) {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { errorMessage = "Could not start secure sign-in."; return }
        let value = bytes.map { String(format: "%02x", $0) }.joined()
        nonce = value
        request.requestedScopes = [.fullName, .email]
        request.nonce = SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }
    func handleAppleSignIn(_ result: Result<ASAuthorization, Error>) async throws {
        defer { nonce = nil }
        let auth = try result.get()
        guard let credential = auth.credential as? ASAuthorizationAppleIDCredential, let token = credential.identityToken, let text = String(data: token, encoding: .utf8), let nonce else { throw AppFailure.validation("Apple did not return a valid sign-in credential.") }
        let repository = try live()
        let session = try await repository.client.auth.signInWithIdToken(credentials: .init(provider: .apple, idToken: text, nonce: nonce))
        if let components = credential.fullName {
            let name = PersonNameComponentsFormatter().string(from: components).trimmingCharacters(in: .whitespacesAndNewlines)
            if !name.isEmpty {
                if session.user.userMetadata["full_name"] == nil { _ = try await repository.client.auth.update(user: .init(data: ["full_name": .string(name)])) }
                try await repository.rpc("set_initial_display_name", ["display_name": name])
            }
        }
        await refresh()
    }
    func signOut() async throws {
        if isDemo { clearProtected(); account = nil; return }
        let repository = try live()
        // Unregister first. A failed network request is surfaced; no false claim of remote token removal.
        clearProtected(); account = nil
        var failure: Error?
        do { try await repository.rpc("unregister_push_device", ["installation": Self.installationID]) } catch { failure = error }
        do { try await repository.client.auth.signOut(scope: .local) } catch { failure = error }
        if let failure { throw AppFailure.unavailable("Signed out on this device. Remote notification registration could not be cleared: \(failure.localizedDescription)") }
    }
    func toggleFavorite(_ member: Member) async throws {
        try requireActive()
        let selected = !favoriteIDs.contains(member.id)
        if isDemo { if selected { favoriteIDs.insert(member.id) } else { favoriteIDs.remove(member.id) }; return }
        try await mutate("set_favorite", ["target_person": member.id.uuidString, "is_favorite": selected])
    }
    func saveReminder(_ reminder: PersonalReminder) async throws {
        try requireActive()
        guard !reminder.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw AppFailure.validation("Enter a title.") }
        let original = reminders.first { $0.id == reminder.id }
        if let original, original.revision != reminder.revision { throw AppFailure.stale }
        let detailsChanged = original == nil || original?.title != reminder.title || original?.dueAt != reminder.dueAt || original?.memberID != reminder.memberID
        if detailsChanged, reminder.dueAt <= .now { throw AppFailure.validation("Choose a future reminder time.") }
        if isDemo { var updated = reminder; updated.revision += 1; reminders.removeAll { $0.id == reminder.id }; reminders.append(updated); return }
        var savedID = reminder.id
        var revision = reminder.revision
        if detailsChanged {
            let data = try await live().request("rpc/save_reminder",method: "POST",body: ["target": reminder.revision == 0 ? NSNull() : reminder.id.uuidString as Any,"expected_revision": reminder.revision,"target_person": reminder.memberID?.uuidString as Any? ?? NSNull(),"reminder_title": reminder.title,"reminder_due_at": reminder.dueAt.ISO8601Format()])
            savedID = try JSONDecoder().decode(UUID.self,from: data)
            await refresh()
            guard reminders.contains(where: { $0.id == savedID }) else { throw AppFailure.unavailable(errorMessage ?? "The saved reminder could not be reloaded.") }
            revision = reminder.revision == 0 ? 1 : reminder.revision + 1
        }
        if (original?.completedAt != nil) != (reminder.completedAt != nil) {
            try await mutate("complete_reminder", ["target": savedID.uuidString,"expected_revision": revision,"is_completed": reminder.completedAt != nil])
        }
    }
    func deleteReminder(_ id: UUID) async throws {
        try requireActive()
        guard let reminder = reminders.first(where: { $0.id == id }) else { return }
        if isDemo { reminders.removeAll { $0.id == id }; return }
        try await mutate("delete_reminder", ["target": id.uuidString,"expected_revision": reminder.revision])
    }
    func saveVisit(_ visit: Visit) async throws {
        guard canPlanVisits else { throw AppFailure.access }
        try DomainRules.validate(visit)
        if isDemo {
            if visits.contains(where: { $0.submissionKey == visit.submissionKey && visit.revision == 0 }) { return }
            if let old = visits.first(where: { $0.id == visit.id }), old.revision != visit.revision { throw AppFailure.stale }
            var updated = visit; updated.revision += 1; visits.removeAll { $0.id == visit.id }; visits.append(updated); return
        }
        try await mutate("save_visit", ["target": visit.revision == 0 ? NSNull() : visit.id.uuidString as Any,"expected_revision": visit.revision,"target_person": visit.memberID.uuidString,"visit_location": visit.location,"visit_time": visit.scheduledAt.ISO8601Format(),"visit_notes": visit.notes,"deacon_ids": visit.participants.map { $0.accountID.uuidString },"submission": visit.submissionKey.uuidString])
    }
    func respond(to visit: Visit, accept: Bool, reason: String) async throws {
        try requireActive()
        if isDemo {
            guard account?.designation == .deacon, let index = visits.firstIndex(where: { $0.id == visit.id }), visits[index].status == .open, visits[index].revision == visit.revision, let person = visits[index].participants.firstIndex(where: { $0.accountID == account?.id }) else { throw AppFailure.access }
            visits[index].participants[person].status = accept ? .accepted : .declined; visits[index].participants[person].reason = accept ? "" : reason; return
        }
        try await mutate("respond_visit", ["target": visit.id.uuidString,"decision": accept ? "accepted" : "declined","reason": reason,"expected_revision": visit.revision])
    }
    func closeVisit(_ visit: Visit, cancel: Bool) async throws {
        guard canPlanVisits, visit.pastorID == account?.id else { throw AppFailure.access }
        if isDemo { guard let index = visits.firstIndex(where: { $0.id == visit.id }), visits[index].revision == visit.revision else { throw AppFailure.stale }; visits[index].status = cancel ? .cancelled : .completed; return }
        try await mutate("close_visit", ["target": visit.id.uuidString,"decision": cancel ? "cancelled" : "completed","expected_revision": visit.revision])
    }
    func archiveVisit(_ visit: Visit) async throws {
        guard canPlanVisits, visit.pastorID == account?.id else { throw AppFailure.access }
        if isDemo { guard let index = visits.firstIndex(where: { $0.id == visit.id }), visits[index].revision == visit.revision else { throw AppFailure.stale }; visits[index].archivedAt = .now; visits[index].status = .completed; return }
        try await mutate("archive_visit", ["target": visit.id.uuidString,"expected_revision": visit.revision])
    }
    func markViewed(_ visit: Visit) async throws {
        guard account?.designation == .deacon, visit.participants.contains(where: { $0.accountID == account?.id }) else { return }
        if !isDemo { try await mutate("view_visit", ["target": visit.id.uuidString,"seen_revision": visit.revision]) }
        else if let index = visits.firstIndex(where: { $0.id == visit.id }), let recipient = visits[index].participants.firstIndex(where: { $0.accountID == account?.id }) { visits[index].participants[recipient].seenRevision = visit.revision }
    }
    func requestAccountDeletion() async throws {
        guard !isDemo else { throw AppFailure.unavailable("Account deletion requests require a configured account.") }
        try await live().rpc("request_account_deletion", [:])
    }
    func requestNotifications() async throws {
        guard !isDemo else { throw AppFailure.unavailable("Push delivery is tested in the configured app on a provisioned device.") }
        try requireActive()
        guard try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert,.badge,.sound]) else { throw AppFailure.unavailable("Notifications are disabled. You can enable them in iPhone Settings.") }
        UIApplication.shared.registerForRemoteNotifications()
    }
    static var installationID: String {
        if let value = UserDefaults.standard.string(forKey: "installationID") { return value }
        let value = UUID().uuidString; UserDefaults.standard.set(value, forKey: "installationID"); return value
    }
    func registerPushToken(_ token: Data) async throws {
        guard !isDemo, account?.status == .active else { return }
        let environment = Bundle.main.object(forInfoDictionaryKey: "APNSEnvironment") as? String ?? "sandbox"
        try await live().rpc("register_push_device", ["installation": Self.installationID,"device_token": token.map { String(format:"%02x",$0) }.joined(),"apns_environment": environment])
    }
    func openVisit(_ id: UUID) async { await refresh(); guard account?.status == .active, visits.contains(where: { $0.id == id }) else { return }; selectedVisitID = id }
    func openNotification(kind: String, id: UUID) async {
        await refresh()
        guard account?.status == .active else { return }
        switch kind {
        case "visit": if visits.contains(where: { $0.id == id }) { selectedVisitID = id }
        case "reminder": if reminders.contains(where: { $0.id == id }) { selectedReminderID = id }
        case "birthday": if members.contains(where: { $0.id == id && !$0.isArchived }) { selectedMemberID = id }
        default: break
        }
    }
    func saveNotificationPreferences() async throws {
        try requireActive()
        if isDemo { return }
        guard let account else { throw AppFailure.access }
        _ = try await live().request("account_preferences",method: "POST",body: ["owner_id":account.id.uuidString,"visit_notifications":visitsEnabled,"birthday_notifications":birthdaysEnabled,"reminder_notifications":remindersEnabled,"language":UserDefaults.standard.string(forKey: "language") ?? "en","appearance":UserDefaults.standard.string(forKey: "appearance") ?? "system"])
    }
}
