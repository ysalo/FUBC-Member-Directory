import SwiftUI

struct GroupsView: View {
    @Environment(AppStore.self) private var store
    @State private var query = ""
    var body: some View {
        List {
            if let account = store.account {
                let led = store.groups.filter { $0.responsibleDeaconID == account.id || $0.deaconIDs.contains(account.id) }
                if !led.isEmpty {
                    Section("Groups I lead") {
                        ForEach(led) { group in NavigationLink(group.name) { GroupDetailView(groupID: group.id) } }
                        NavigationLink { BirthdaysView(groupIDs: Set(led.map(\.id))) } label: { Label("Upcoming birthdays", systemImage: "birthday.cake") }
                    }
                }
            }
            Section("All groups") {
                ForEach(store.groups.filter { query.isEmpty || $0.name.localizedCaseInsensitiveContains(query) }) { group in
                    NavigationLink { GroupDetailView(groupID: group.id) } label: {
                        HStack { Text(group.name); Spacer(); Text(store.members.filter { $0.groupID == group.id && !$0.isArchived }.count, format: .number).foregroundStyle(.secondary) }
                    }
                }
                if store.groups.isEmpty { ContentUnavailableView("No groups yet", systemImage: "person.3", description: Text("Groups appear here when the church assigns them.")) }
            }
        }.navigationTitle("Groups").searchable(text: $query, prompt: "Search groups").refreshable { await store.refresh() }
    }
}

struct GroupDetailView: View {
    @Environment(AppStore.self) private var store
    let groupID: UUID
    var body: some View {
        List {
            if let group = store.groups.first(where: { $0.id == groupID }) {
                let deaconIDs = Set(group.deaconIDs + [group.responsibleDeaconID].compactMap { $0 })
                Section("Responsible deacons") {
                    ForEach(store.accounts.filter { deaconIDs.contains($0.id) }) { account in
                        if let memberID = account.memberID { NavigationLink(account.displayName) { MemberDetailView(memberID: memberID) } }
                        else { Text(account.displayName) }
                    }
                    if !deaconIDs.isEmpty && !store.accounts.contains(where: { deaconIDs.contains($0.id) }) { Text("Deacon details are unavailable for this account.").foregroundStyle(.secondary) }
                    if deaconIDs.isEmpty { Text("No deacon assigned").foregroundStyle(.secondary) }
                }
                Section("Members") {
                    ForEach(store.members.filter { $0.groupID == group.id && !$0.isArchived }.sorted { $0.lastName.localizedStandardCompare($1.lastName) == .orderedAscending }) { member in
                        NavigationLink { MemberDetailView(memberID: member.id) } label: { MemberRow(member: member) }
                    }
                }
            } else { ContentUnavailableView("Group unavailable", systemImage: "person.3") }
        }.navigationTitle(store.groups.first { $0.id == groupID }?.name ?? String(localized: "Group")).navigationBarTitleDisplayMode(.inline)
    }
}

struct BirthdaysView: View {
    @Environment(AppStore.self) private var store
    let groupIDs: Set<UUID>
    private var upcoming: [(Member, Date)] {
        store.members.compactMap { member -> (Member, Date)? in
            guard !member.isArchived, let groupID = member.groupID, groupIDs.contains(groupID), let birth = member.birthDate, let next = DomainRules.nextBirthday(birth, after: .now) else { return nil }
            return (member, next)
        }.sorted { $0.1 < $1.1 }
    }
    var body: some View {
        List {
            Section { Text("Birthdays in your responsibility groups. Dates follow church time.").foregroundStyle(.secondary) }
            ForEach(upcoming, id: \.0.id) { member, date in
                NavigationLink { MemberDetailView(memberID: member.id) } label: {
                    VStack(alignment: .leading, spacing: 4) { Text(member.displayName); Text(date, format: .dateTime.month(.wide).day()).font(.subheadline).foregroundStyle(.secondary) }
                }
            }
            if upcoming.isEmpty { ContentUnavailableView("No birthdays available", systemImage: "birthday.cake") }
        }.navigationTitle("Upcoming birthdays").navigationBarTitleDisplayMode(.inline)
    }
}

struct RemindersView: View {
    @Environment(AppStore.self) private var store
    @State private var showNew = false
    @State private var editing: PersonalReminder?
    @State private var error: String?
    var body: some View {
        List {
            Section { Text("Only you can see these reminders.").foregroundStyle(.secondary) }
            if let error { FailureNotice(message: error) }
            ForEach(store.reminders.sorted { $0.dueAt < $1.dueAt }) { reminder in
                Button { editing = reminder } label: {
                    HStack(spacing: 12) {
                        Image(systemName: reminder.completedAt == nil ? "circle" : "checkmark.circle.fill").foregroundStyle(reminder.completedAt == nil ? Color.secondary : Color.green)
                        VStack(alignment: .leading, spacing: 4) {
                            Text(reminder.title).foregroundStyle(.primary)
                            Text(reminder.dueAt, format: .dateTime.month().day().hour().minute()).font(.subheadline).foregroundStyle(.secondary)
                            if let member = store.members.first(where: { $0.id == reminder.memberID }) { Text(member.displayName).font(.caption).foregroundStyle(.secondary) }
                        }
                    }.padding(.vertical, 4)
                }.swipeActions {
                    Button(role: .destructive) { Task { do { try await store.deleteReminder(reminder.id) } catch { self.error = error.localizedDescription } } } label: { Label("Delete", systemImage: "trash") }
                }
            }
            if store.reminders.isEmpty { ContentUnavailableView("Remember to reach out", systemImage: "checklist", description: Text("Add a private reminder to call or check in with someone.")) }
        }.navigationTitle("Reminders")
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { showNew = true } label: { Label("Add reminder", systemImage: "plus") } } }
        .sheet(isPresented: $showNew) { ReminderEditor() }
        .sheet(item: $editing) { ReminderEditor(reminder: $0) }
    }
}

struct ReminderEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: PersonalReminder
    @State private var working = false
    @State private var error: String?
    init(memberID: UUID? = nil, reminder: PersonalReminder? = nil) {
        _draft = State(initialValue: reminder ?? PersonalReminder(memberID: memberID, title: "", dueAt: .now.addingTimeInterval(3600)))
    }
    var body: some View {
        NavigationStack {
            Form {
                if let error { FailureNotice(message: error) }
                Section("Reminder") {
                    TextField("What would you like to do?", text: $draft.title, axis: .vertical)
                    DatePicker("When", selection: $draft.dueAt)
                    Picker("Member", selection: $draft.memberID) {
                        Text("None").tag(UUID?.none)
                        ForEach(store.members.filter { !$0.isArchived }) { Text($0.displayName).tag(Optional($0.id)) }
                    }
                    Toggle("Completed", isOn: Binding(get: { draft.completedAt != nil }, set: { draft.completedAt = $0 ? .now : nil }))
                }
                Section { Text("Reminder delivery requires notifications to be enabled and the church notification service to be configured.").foregroundStyle(.secondary) }
            }.navigationTitle("Personal reminder").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(working) }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } }.disabled(working || draft.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) }
            }.interactiveDismissDisabled(working)
        }
    }
    private func save() async {
        working = true; defer { working = false }
        do { try await store.saveReminder(draft); dismiss() } catch { self.error = error.localizedDescription }
    }
}
