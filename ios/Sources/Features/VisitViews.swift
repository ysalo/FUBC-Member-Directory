import SwiftUI

struct VisitsView: View {
    @Environment(AppStore.self) private var store
    @State private var archive = false
    @State private var showNew = false
    @State private var linkedVisit: Visit?
    @State private var confirmArchive = false
    @State private var working = false
    @State private var operationError: String?
    var body: some View {
        List {
            Picker("Visit list", selection: $archive) { Text("Current").tag(false); Text("Archive").tag(true) }.pickerStyle(.segmented)
            if let error = store.errorMessage { FailureNotice(message: error) }
            if let operationError { FailureNotice(message: operationError) }
            ForEach(store.visits.filter { ($0.archivedAt != nil) == archive }.sorted { $0.scheduledAt < $1.scheduledAt }) { visit in
                NavigationLink { VisitDetailView(visitID: visit.id) } label: {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(store.members.first { $0.id == visit.memberID }?.displayName ?? visit.memberName).font(.headline)
                        Text(visit.scheduledAt, format: .dateTime.weekday().month().day().hour().minute()).font(.subheadline)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(LocalizedStringKey(visit.status.rawValue.capitalized))
                            if let response = visit.participants.first(where: { $0.accountID == store.account?.id }) {
                                if response.status == .pending { Label("Response needed", systemImage: "envelope.badge") }
                                else if response.seenRevision < visit.revision { Label("Updated", systemImage: "circle.badge") }
                            }
                        }.font(.caption).foregroundStyle(.secondary)
                    }.padding(.vertical, 4)
                }
            }
            if store.visits.filter({ ($0.archivedAt != nil) == archive }).isEmpty {
                ContentUnavailableView(LocalizedStringKey(archive ? "No archived visits" : "No visits yet"), systemImage: "calendar", description: Text(LocalizedStringKey(store.canPlanVisits ? "Plan a visit and invite one or two deacons." : "Your invitations will appear here.")))
            }
        }.navigationTitle("Visits").environment(\.timeZone, DomainRules.churchTimeZone)
        .refreshable { await store.refresh() }
        .toolbar { if store.canPlanVisits {
            ToolbarItem(placement: .topBarTrailing) { Menu {
                Button { showNew = true } label: { Label("Plan visit", systemImage: "plus") }
                Button("Archive completed visits") { confirmArchive = true }
                    .disabled(!store.visits.contains { $0.pastorID == store.account?.id && $0.status == .completed && $0.archivedAt == nil })
            } label: { Label("Visit actions", systemImage: "ellipsis.circle") } }
        } }.disabled(working)
        .confirmationDialog("Archive completed visits?", isPresented: $confirmArchive, titleVisibility: .visible) {
            Button("Archive completed visits") { Task {
                working = true; defer { working = false }
                let candidates = store.visits.filter { $0.pastorID == store.account?.id && $0.status == .completed && $0.archivedAt == nil }
                do { for visit in candidates { try await store.archiveVisit(visit) }; operationError = nil }
                catch { operationError = error.localizedDescription; await store.refresh() }
            } }
        } message: { Text("Your completed visits will move to Archive. If an item changes during the operation, refresh to review what remains.") }
        .sheet(isPresented: $showNew) { VisitEditor() }
        .sheet(item: $linkedVisit) { visit in NavigationStack { VisitDetailView(visitID: visit.id).toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { linkedVisit = nil } } } } }
        .onChange(of: store.selectedVisitID) { _, id in
            if let id, let visit = store.visits.first(where: { $0.id == id }) { linkedVisit = visit; store.selectedVisitID = nil }
        }
        .task { if let id = store.selectedVisitID, let visit = store.visits.first(where: { $0.id == id }) { linkedVisit = visit; store.selectedVisitID = nil } }
    }
}

struct VisitDetailView: View {
    @Environment(AppStore.self) private var store
    let visitID: UUID
    @State private var error: String?
    @State private var working = false
    @State private var editing = false
    @State private var showCalendar = false
    @State private var responseReason = ""
    @State private var confirmation: VisitAction?
    enum VisitAction: String, Identifiable { case cancel, complete, archive; var id: String { rawValue } }
    private var visit: Visit? { store.visits.first { $0.id == visitID } }
    var body: some View {
        Group {
            if let visit {
                List {
                    if let error { FailureNotice(message: error); Button("Refresh") { Task { await store.refresh() } } }
                    Section("Visit") {
                        NavigationLink { MemberDetailView(memberID: visit.memberID) } label: { Text(store.members.first { $0.id == visit.memberID }?.displayName ?? visit.memberName).font(.headline) }
                        LabeledContent("When") { Text(visit.scheduledAt, format: .dateTime.weekday().month().day().hour().minute()) }
                        LabeledContent("Location", value: visit.location)
                        LabeledContent("Status") { Text(LocalizedStringKey(visit.status.rawValue.capitalized)) }
                        Text("Times are shown in church time (UTC−07:00).").font(.caption).foregroundStyle(.secondary)
                        if !visit.notes.isEmpty { Text(visit.notes).textSelection(.enabled) }
                    }
                    Section("Deacon responses") {
                        ForEach(visit.participants) { participant in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(participant.name)
                                Text(LocalizedStringKey(participant.status.rawValue.capitalized)).font(.subheadline).foregroundStyle(.secondary)
                                if !participant.reason.isEmpty { Text(participant.reason).font(.subheadline) }
                            }.accessibilityElement(children: .combine)
                        }
                    }
                    if visit.status == .open && visit.participants.contains(where: { $0.accountID == store.account?.id }) {
                        Section("Your response") {
                            TextField("Reason (optional)", text: $responseReason, axis: .vertical)
                            Button("Accept invitation") { Task { await perform { try await store.respond(to: visit, accept: true, reason: responseReason) } } }
                            Button("Decline invitation", role: .destructive) { Task { await perform { try await store.respond(to: visit, accept: false, reason: responseReason) } } }
                        }
                    }
                    Section {
                        Button { showCalendar = true } label: { Label("Add to Calendar", systemImage: "calendar.badge.plus") }
                        Text("Calendar entries are copies. Update or remove them yourself if this visit changes.").font(.caption).foregroundStyle(.secondary)
                    }
                    if store.account?.id == visit.pastorID {
                        Section("Manage visit") {
                            if visit.status == .open {
                                Button("Edit visit") { editing = true }
                                Button("Mark completed") { confirmation = .complete }
                                Button("Cancel visit", role: .destructive) { confirmation = .cancel }
                            }
                            if visit.archivedAt == nil { Button("Archive visit") { confirmation = .archive } }
                        }
                    }
                }.disabled(working)
                .sheet(isPresented: $editing) { VisitEditor(visit: visit) }
                .task(id: visit.revision) { do { try await store.markViewed(visit) } catch { self.error = error.localizedDescription } }
                .sheet(isPresented: $showCalendar) { CalendarEventSheet(visit: visit) }
                .confirmationDialog("Update this visit?", isPresented: Binding(get: { confirmation != nil }, set: { if !$0 { confirmation = nil } }), titleVisibility: .visible) {
                    if let action = confirmation {
                        Button(LocalizedStringKey(action == .cancel ? "Cancel visit" : action == .complete ? "Mark completed" : "Archive visit"), role: action == .cancel ? .destructive : nil) {
                            Task { await perform {
                                if action == .archive { try await store.archiveVisit(visit) }
                                else { try await store.closeVisit(visit, cancel: action == .cancel) }
                            } }
                        }
                    }
                    Button("Keep visit", role: .cancel) { confirmation = nil }
                } message: { Text(LocalizedStringKey(confirmation == .archive ? "Archiving also marks this visit completed under the current church workflow." : "Participants will see the updated visit status.")) }
            } else { ContentUnavailableView("Visit unavailable", systemImage: "calendar.badge.exclamationmark", description: Text("Refresh your visits. Your access may have changed.")) }
        }.navigationTitle("Visit details").navigationBarTitleDisplayMode(.inline).environment(\.timeZone, DomainRules.churchTimeZone)
    }
    private func perform(_ operation: () async throws -> Void) async {
        working = true; defer { working = false }
        do { try await operation(); error = nil } catch { self.error = error.localizedDescription }
    }
}

struct VisitEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Visit
    @State private var working = false
    @State private var error: String?
    private let isNew: Bool
    init(visit: Visit? = nil, member: Member? = nil) {
        isNew = visit == nil
        _draft = State(initialValue: visit ?? Visit(memberID: member?.id ?? UUID(), pastorID: UUID(), scheduledAt: .now.addingTimeInterval(86400), location: member?.address ?? ""))
    }
    var body: some View {
        NavigationStack {
            Form {
                if let error { FailureNotice(message: error) }
                Section("Visit") {
                    Picker("Member", selection: $draft.memberID) {
                        if !store.members.contains(where: { $0.id == draft.memberID }) { Text("Choose member").tag(draft.memberID) }
                        ForEach(store.members.filter { !$0.isArchived }) { Text($0.displayName).tag($0.id) }
                    }.disabled(!isNew).onChange(of: draft.memberID) { _, id in
                        if let member = store.members.first(where: { $0.id == id }) {
                            draft.location = member.address ?? ""
                            draft.participants = []
                            if let group = store.groups.first(where: { $0.id == member.groupID }) {
                                draft.participants = store.accounts.filter { group.deaconIDs.contains($0.id) && $0.status == .active && $0.designation == .deacon }.prefix(2).map { VisitParticipant(accountID: $0.id, name: $0.displayName) }
                            }
                        }
                    }
                    DatePicker("When", selection: $draft.scheduledAt, in: Date.now...)
                    TextField("Location", text: $draft.location, axis: .vertical)
                    TextField("Private visit notes", text: $draft.notes, axis: .vertical).lineLimit(3...8)
                    Text("Times are shown in church time (UTC−07:00).").font(.caption).foregroundStyle(.secondary)
                }
                Section {
                    ForEach(store.accounts.filter { $0.designation == .deacon && $0.status == .active }) { account in
                        Toggle(account.displayName, isOn: Binding(get: { draft.participants.contains { $0.accountID == account.id } }, set: { selected in
                            if selected { draft.participants.append(VisitParticipant(accountID: account.id, name: account.displayName)) }
                            else { draft.participants.removeAll { $0.accountID == account.id } }
                        })).disabled(!isNew || draft.participants.count >= 2 && !draft.participants.contains { $0.accountID == account.id })
                    }
                } header: { Text("Invite deacons") } footer: {
                    if isNew { Text("Choose one or two. Each deacon responds independently.") }
                    else { Text("The member and invited deacons cannot be changed. Cancel this visit and create another if participants need to change.") }
                }
            }.navigationTitle(LocalizedStringKey(isNew ? "Plan visit" : "Edit visit")).navigationBarTitleDisplayMode(.inline)
            .environment(\.timeZone, DomainRules.churchTimeZone)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(working) }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } }.disabled(working || draft.participants.isEmpty || draft.location.isEmpty) }
            }.interactiveDismissDisabled(working)
            .task {
                if isNew && draft.participants.isEmpty, let member = store.members.first(where: { $0.id == draft.memberID }), let group = store.groups.first(where: { $0.id == member.groupID }) {
                    draft.participants = store.accounts.filter { group.deaconIDs.contains($0.id) && $0.status == .active && $0.designation == .deacon }.prefix(2).map { VisitParticipant(accountID: $0.id, name: $0.displayName) }
                }
            }
        }
    }
    private func save() async {
        working = true; defer { working = false }
        if isNew, let id = store.account?.id { draft.pastorID = id }
        do { try await store.saveVisit(draft); dismiss() } catch { self.error = error.localizedDescription }
    }
}
