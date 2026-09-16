import Foundation
import Supabase

@MainActor final class LiveRepository {
    let client: SupabaseClient
    let baseURL: URL
    let key: String
    let session: URLSession
    init() throws {
        guard let host = Bundle.main.object(forInfoDictionaryKey: "SupabaseHost") as? String,
              !host.isEmpty, !host.contains("$("), host.hasSuffix(".supabase.co"),
              let url = URL(string: "https://\(host)"),
              let key = Bundle.main.object(forInfoDictionaryKey: "SupabasePublishableKey") as? String,
              !key.isEmpty, !key.contains("$(") else { throw AppFailure.configuration }
        self.baseURL = url; self.key = key
        client = SupabaseClient(supabaseURL: url, supabaseKey: key,
            options: SupabaseClientOptions(auth: .init(storage: KeychainLocalStorage(service: (Bundle.main.bundleIdentifier ?? "church") + ".session"))))
        let configuration = URLSessionConfiguration.ephemeral
        configuration.urlCache = nil
        configuration.timeoutIntervalForRequest = 15
        session = URLSession(configuration: configuration)
    }
    func request(_ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> Data {
        let auth = try await client.auth.session
        guard let url = URL(string: "\(baseURL.absoluteString)/rest/v1/\(path)") else { throw AppFailure.configuration }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(key, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(auth.accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(path == "account_preferences" ? "return=representation,resolution=merge-duplicates" : "return=representation", forHTTPHeaderField: "Prefer")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body) }
        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else { throw AppFailure.unavailable("The server did not respond.") }
        guard (200..<300).contains(response.statusCode) else {
            if response.statusCode == 401 || response.statusCode == 403 { throw AppFailure.access }
            let message = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])?["message"] as? String ?? "The request failed. Refresh and try again."
            if message.contains("refresh") || message.contains("changed") { throw AppFailure.stale }
            throw AppFailure.unavailable(message)
        }
        return data
    }
    func rows<T: Decodable>(_ table: String, as: T.Type = T.self) async throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: text) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: text) else { throw AppFailure.validation("Invalid server timestamp.") }
            return date
        }
        return try decoder.decode(T.self, from: await request(table))
    }
    func rpc(_ name: String, _ params: [String: Any]) async throws { _ = try await request("rpc/\(name)", method: "POST", body: params) }
}

struct ProfileRow: Decodable {
    let id: UUID; let display_name: String?; let email: String; let role: AccessRole; let status: AccessStatus; let ministry_roles: [String]; let person_id: UUID?
    var model: Account { Account(id: id, displayName: display_name ?? email, role: role, status: status, designation: ministry_roles.contains("pastor") ? .pastor : ministry_roles.contains("deacon") ? .deacon : .none, memberID: person_id) }
}
struct PersonRow: Decodable {
    let id: UUID; let first_name: String; let last_name: String; let date_of_birth: String?; let membership_joined_at: String?; let phone: String?; let address_line_1: String?; let address_line_2: String?; let city: String?; let state: String?; let postal_code: String?; let photo_path: String?; let archived_at: Date?; let marital_status: String?; let is_orphan: Bool; let updated_at: String
    var model: Member { Member(id: id, firstName: first_name, lastName: last_name, phone: phone, address: [address_line_1,address_line_2,city,state,postal_code].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", "), birthDate: date_of_birth, isArchived: archived_at != nil, photoPath: photo_path, membershipDate: membership_joined_at, maritalStatus: marital_status.flatMap(MaritalStatus.init(rawValue:)), isOrphan: is_orphan, updatedAt: updated_at) }
}
struct GroupRow: Decodable { let id: UUID; let name: String }
struct GroupMemberRow: Decodable { let person_id: UUID; let group_name: String }
struct GroupMembershipRow: Decodable { let person_id: UUID; let group_id: UUID }
struct PreferenceRow: Decodable { let visit_notifications: Bool; let birthday_notifications: Bool; let reminder_notifications: Bool; let language: String; let appearance: String }
struct GroupDeaconRow: Decodable { let profile_id: UUID; let group_id: UUID; let display_name: String; let person_id: UUID?; let status: AccessStatus }
struct FavoriteRow: Decodable { let person_id: UUID }
struct DeaconRow: Decodable { let id: UUID; let name: String }
struct EligibleDeaconRow: Decodable { let id: UUID; let display_name: String }
struct MinistryRow: Decodable { let person_id: UUID; let ministry_roles: [String] }
struct ReminderRow: Decodable {
    let id: UUID; let person_id: UUID?; let title: String; let due_at: Date; let completed_at: Date?; let revision: Int
    var model: PersonalReminder { PersonalReminder(id: id, memberID: person_id, title: title, dueAt: due_at, completedAt: completed_at, revision: revision) }
}
struct RecipientRow: Decodable {
    let request_id: UUID; let deacon_id: UUID; let deacon_name: String; let response: ResponseStatus; let decline_reason: String; let last_viewed_revision: Int
    var model: VisitParticipant { VisitParticipant(accountID: deacon_id, name: deacon_name, status: response, reason: decline_reason, seenRevision: last_viewed_revision) }
}
struct VisitRow: Decodable {
    let id: UUID; let person_id: UUID; let pastor_id: UUID; let member_name: String; let scheduled_at: Date; let location: String; let notes: String; let status: VisitStatus; let revision: Int; let archived_at: Date?; let submission_key: UUID
    var model: Visit { Visit(id: id, memberID: person_id, pastorID: pastor_id, scheduledAt: scheduled_at, location: location, notes: notes, status: status, revision: revision, archivedAt: archived_at, submissionKey: submission_key, memberName: member_name) }
}
