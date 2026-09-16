import XCTest
@testable import ChurchDirectory

final class DomainTests: XCTestCase {
    func testDuplicateRecipientsRejected() {
        let deacon = UUID()
        let visit = Visit(memberID: UUID(),pastorID: UUID(),scheduledAt: .now.addingTimeInterval(3600),location: "Meeting room",participants: [VisitParticipant(accountID: deacon,name: "A"),VisitParticipant(accountID: deacon,name: "A")])
        XCTAssertThrowsError(try DomainRules.validate(visit))
    }
    func testPastVisitRejected() {
        let visit = Visit(memberID: UUID(),pastorID: UUID(),scheduledAt: .distantPast,location: "Meeting room",participants: [VisitParticipant(accountID: UUID(),name: "A")])
        XCTAssertThrowsError(try DomainRules.validate(visit))
    }
    func testLeapBirthdayObservedFebruary28() throws {
        let now = try XCTUnwrap(ISO8601DateFormatter().date(from: "2027-02-01T12:00:00Z"))
        let next = try XCTUnwrap(DomainRules.nextBirthday("1988-02-29",after: now))
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "America/Los_Angeles")!
        XCTAssertEqual(calendar.component(.day,from: next),28)
        XCTAssertEqual(calendar.component(.month,from: next),2)
    }
    func testVisitOffsetDoesNotChangeInWinter() { XCTAssertEqual(DomainRules.churchTimeZone.secondsFromGMT(for: .distantPast),-25200) }
    func testInvalidBirthdayIsRejected() { XCTAssertNil(DomainRules.nextBirthday("1980-13-09",after: .now)) }
}

@MainActor final class AppStoreTests: XCTestCase {
    func testAdminDoesNotGrantPastorCapabilities() {
        let store = AppStore(demo: true)
        store.setDemoRole(role: .admin,designation: .none)
        XCTAssertTrue(store.canManage)
        XCTAssertFalse(store.canPlanVisits)
    }
    func testSignoutClearsEveryProtectedCollection() async throws {
        let store = AppStore(demo: true)
        try await store.signOut()
        XCTAssertNil(store.account)
        XCTAssertTrue(store.members.isEmpty && store.visits.isEmpty && store.groups.isEmpty && store.reminders.isEmpty && store.favoriteIDs.isEmpty && store.accounts.isEmpty)
    }
    func testRetriedDraftHasOneVisit() async throws {
        let store = AppStore(demo: true)
        let actor = try XCTUnwrap(store.account)
        let recipient = try XCTUnwrap(store.accounts.first(where: { $0.designation == .deacon }))
        let draft = Visit(memberID: try XCTUnwrap(store.members.first).id,pastorID: actor.id,scheduledAt: .now.addingTimeInterval(7200),location: "Church",participants: [VisitParticipant(accountID: recipient.id,name: recipient.displayName)])
        try await store.saveVisit(draft); try await store.saveVisit(draft)
        XCTAssertEqual(store.visits.filter { $0.submissionKey == draft.submissionKey }.count,1)
    }
    func testStaleRevisionCannotOverwrite() async throws {
        let store = AppStore(demo: true)
        let original = try XCTUnwrap(store.visits.first)
        var edit = original; edit.location = "New location"
        try await store.saveVisit(edit)
        do { try await store.saveVisit(original); XCTFail("Stale update accepted") } catch AppFailure.stale {} catch { XCTFail("Unexpected error: \(error)") }
    }
    func testFavoriteToggleIsPrivateState() async throws {
        let store = AppStore(demo: true)
        let member = try XCTUnwrap(store.members.first)
        try await store.toggleFavorite(member)
        XCTAssertFalse(store.favoriteIDs.contains(member.id))
        try await store.toggleFavorite(member)
        XCTAssertTrue(store.favoriteIDs.contains(member.id))
    }
    func testOverdueReminderCanBeCompleted() async throws {
        let store = AppStore(demo: true)
        var reminder = PersonalReminder(title: "Call",dueAt: .distantPast,revision: 1)
        store.reminders = [reminder]
        reminder.completedAt = .now
        try await store.saveReminder(reminder)
        XCTAssertNotNil(store.reminders.first?.completedAt)
    }
}
