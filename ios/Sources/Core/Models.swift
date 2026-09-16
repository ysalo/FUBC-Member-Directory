import Foundation

enum AccessRole: String, Codable, CaseIterable { case member, editor, admin }
enum AccessStatus: String, Codable, CaseIterable { case pending, active, denied, revoked }
enum Ministry: String, Codable, CaseIterable { case none, pastor, deacon }
enum MaritalStatus: String, Codable, CaseIterable { case single, married, widowed }
struct Account: Identifiable, Equatable {
    var id = UUID()
    var displayName: String
    var role: AccessRole = .member
    var status: AccessStatus = .pending
    var designation: Ministry = .none
    var memberID: UUID? = nil
}
struct Member: Identifiable, Equatable {
    var id = UUID()
    var firstName: String
    var lastName: String
    var phone: String? = nil
    var address: String? = nil
    var birthDate: String? = nil // Date only: yyyy-MM-dd, never converted through UTC.
    var groupID: UUID? = nil
    var isArchived = false
    var photoURL: URL? = nil
    var photoPath: String? = nil
    var membershipDate: String? = nil
    var maritalStatus: MaritalStatus? = nil
    var isOrphan = false
    var updatedAt: String? = nil
    var designation: Ministry = .none
    var originalGroupID: UUID? = nil
    var isWidowed: Bool { maritalStatus == .widowed }
    var displayName: String { "\(firstName) \(lastName)" }
}
struct DirectoryGroup: Identifiable, Equatable {
    var id = UUID()
    var name: String
    var responsibleDeaconID: UUID? = nil
    var deaconIDs: [UUID] = []
}
enum VisitStatus: String, Codable, CaseIterable { case open, cancelled, completed }
enum ResponseStatus: String, Codable, CaseIterable { case pending, accepted, declined }
struct VisitParticipant: Identifiable, Equatable {
    var accountID: UUID
    var name: String
    var status: ResponseStatus = .pending
    var reason: String = ""
    var seenRevision: Int = 0
    var id: UUID { accountID }
}
struct Visit: Identifiable, Equatable {
    var id = UUID()
    var memberID: UUID
    var pastorID: UUID
    var scheduledAt: Date
    var location: String
    var notes: String = ""
    var status: VisitStatus = .open
    var revision: Int = 0 // Zero denotes a new draft; submissionKey survives retries.
    var participants: [VisitParticipant] = []
    var archivedAt: Date? = nil
    var submissionKey = UUID()
    var memberName: String = ""
}
struct PersonalReminder: Identifiable, Equatable {
    var id = UUID()
    var memberID: UUID? = nil
    var title: String
    var dueAt: Date
    var completedAt: Date? = nil
    var revision: Int = 0
}
enum AppFailure: LocalizedError {
    case configuration, access, validation(String), stale, unavailable(String)
    var errorDescription: String? {
        switch self {
        case .configuration: return "Configure the staging Supabase URL and publishable key in Configuration/Local.xcconfig."
        case .access: return "Your account does not have access. Refresh or contact the church."
        case .validation(let message), .unavailable(let message): return message
        case .stale: return "This item changed. Refresh before trying again."
        }
    }
}
enum DomainRules {
    static let churchTimeZone = TimeZone(secondsFromGMT: -7 * 3600)!
    static func validate(_ visit: Visit, now: Date = .now) throws {
        guard visit.scheduledAt > now else { throw AppFailure.validation("Choose a future visit time.") }
        guard (1...1000).contains(visit.location.trimmingCharacters(in: .whitespacesAndNewlines).count), visit.notes.count <= 5000 else { throw AppFailure.validation("Enter a location and shorten the notes if needed.") }
        let ids = visit.participants.map(\.accountID)
        guard (1...2).contains(ids.count), Set(ids).count == ids.count else { throw AppFailure.validation("Choose one or two different deacons.") }
    }
    static func nextBirthday(_ dateOnly: String, after today: Date, calendar: Calendar = .current) -> Date? {
        let parts = dateOnly.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3, (1...12).contains(parts[1]), (1...31).contains(parts[2]) else { return nil }
        var cal = calendar
        cal.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        let start = cal.startOfDay(for: today)
        let year = cal.component(.year, from: start)
        for candidateYear in year...(year + 8) {
            let leap = candidateYear % 4 == 0 && (candidateYear % 100 != 0 || candidateYear % 400 == 0)
            let day = parts[1] == 2 && parts[2] == 29 && !leap ? 28 : parts[2]
            guard let date = cal.date(from: DateComponents(year: candidateYear, month: parts[1], day: day)), cal.component(.month, from: date) == parts[1], cal.component(.day, from: date) == day else { continue }
            if date >= start { return date }
        }
        return nil
    }
}
