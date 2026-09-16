import SwiftUI
import PhotosUI

struct SettingsView: View {
    @Environment(AppStore.self) private var store
    @AppStorage("appearance") private var appearance = "system"
    @AppStorage("language") private var language = "en"
    @State private var error: String?
    @State private var working = false
    @State private var deleteConfirmation = false
    @State private var deletionRequested = false
    var body: some View {
        @Bindable var store = store
        Form {
            if let error { FailureNotice(message: error) }
            Section("Account") {
                if let account = store.account { Text(account.displayName); LabeledContent("Access") { Text(LocalizedStringKey(account.role.rawValue.capitalized)) } }
                Button("Sign out", role: .destructive) { Task { await perform { try await store.signOut() } } }
            }
            Section("Preferences") {
                Picker("Language", selection: $language) { Text("English").tag("en"); Text("Українська").tag("uk") }
                Picker("Appearance", selection: $appearance) { Text("System").tag("system"); Text("Light").tag("light"); Text("Dark").tag("dark") }
                Button("Enable notifications") { Task { await perform { try await store.requestNotifications() } } }
                Toggle("Visit notifications", isOn: $store.visitsEnabled)
                Toggle("Birthday reminders", isOn: $store.birthdaysEnabled)
                Toggle("Personal reminder notifications", isOn: $store.remindersEnabled)
                Button("Save preferences") { Task { await perform { try await store.saveNotificationPreferences() } } }
                Text("Save to sync these preferences to your account. You can change notification permissions in iPhone Settings. Delivery also requires the church notification service.").font(.caption).foregroundStyle(.secondary)
            }
            if store.canManage { Section("Church administration") { NavigationLink("Manage church records") { ManagementView() } } }
            Section("Help and privacy") { NavigationLink("Help, corrections and privacy") { HelpView() }; Button("Delete account", role: .destructive) { deleteConfirmation = true } }
            if store.isDemo {
                Section("Preview only") {
                    Text("Fictional data. Changes are held in memory and reset when the app restarts.").foregroundStyle(.secondary)
                    Button("Preview member") { store.setDemoRole(role: .member, designation: .none) }
                    Button("Preview deacon") { store.setDemoRole(role: .member, designation: .deacon) }
                    Button("Preview pastor and administrator") { store.setDemoRole(role: .admin, designation: .pastor) }
                }
            }
        }.navigationTitle("Settings").disabled(working)
        .confirmationDialog("Delete your account?", isPresented: $deleteConfirmation, titleVisibility: .visible) {
            Button("Request account deletion", role: .destructive) { Task { await perform { try await store.requestAccountDeletion(); deletionRequested = true } } }
            Button("Cancel", role: .cancel) { }
        } message: { Text("Deletion removes your login and private preferences. The church must explain any directory records it retains before this service can be enabled.") }
        .alert("Deletion request received", isPresented: $deletionRequested) { Button("OK", role: .cancel) { } } message: { Text("Your request has been recorded. Your account has not been deleted yet; the church must process the request and confirm completion.") }
    }
    private func perform(_ operation: () async throws -> Void) async {
        working = true; defer { working = false }
        do { try await operation(); error = nil } catch { self.error = error.localizedDescription }
    }
}

struct HelpView: View {
    var body: some View {
        List {
            Section("Access and corrections") { Text("Ask the church office for account approval, a directory correction, or removal of your information. Never send a password or login code.") }
            Section("Your private information") { Text("Favorites and personal reminders belong to your account. Visit details are restricted to the participating ministry team. Calendar exports remain in your calendar until you remove them.") }
            Section("Support and privacy policy") {
                if let address = Bundle.main.object(forInfoDictionaryKey: "SupportEmail") as? String, address.contains("@"), !address.contains("$("), let url = URL(string: "mailto:\(address)") { Link("Contact support", destination: url) }
                else { Text("The church support address has not been configured for this build.").foregroundStyle(.secondary) }
                if let address = Bundle.main.object(forInfoDictionaryKey: "PrivacyURL") as? String, !address.contains("$("), let url = URL(string: address), url.scheme == "https", let host = url.host, !host.isEmpty { Link("Privacy policy", destination: url) }
                else { Text("The published privacy policy must be configured before release.").foregroundStyle(.secondary) }
            }
        }.navigationTitle("Help and privacy").navigationBarTitleDisplayMode(.inline)
    }
}

struct ManagementView: View {
    @Environment(AppStore.self) private var store
    var body: some View {
        List {
            NavigationLink("Members") { MemberManagementView() }
            NavigationLink("Groups") { GroupManagementView() }
            if store.canAdminister { NavigationLink("Account access") { AccountManagementView() } }
        }.navigationTitle("Manage").navigationBarTitleDisplayMode(.inline)
    }
}

struct MemberManagementView: View {
    @Environment(AppStore.self) private var store
    @State private var query = ""
    @State private var selected: Member?
    var body: some View {
        List {
            ForEach(store.members.filter { query.isEmpty || $0.displayName.localizedCaseInsensitiveContains(query) }) { member in
                Button { selected = member } label: {
                    HStack { MemberRow(member: member); if member.isArchived { Text("Archived").font(.caption).foregroundStyle(.secondary) } }.foregroundStyle(.primary)
                }
            }
        }.navigationTitle("Members").searchable(text: $query)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { selected = Member(firstName: "", lastName: "") } label: { Label("Add member", systemImage: "plus") } } }
        .sheet(item: $selected) { MemberEditor(member: $0) }
    }
}

struct MemberEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Member
    @State private var photo: PhotosPickerItem?
    @State private var pendingPhoto: Data?
    @State private var removePhoto = false
    @State private var working = false
    @State private var error: String?
    @State private var confirmSave = false
    private let original: Member
    init(member: Member) { original = member; _draft = State(initialValue: member) }
    var body: some View {
        NavigationStack {
            Form {
                if let error { FailureNotice(message: error) }
                Section("Name") { TextField("First name", text: $draft.firstName); TextField("Last name", text: $draft.lastName) }
                Section("Contact") {
                    TextField("Phone", text: optional(\.phone)).keyboardType(.phonePad)
                    TextField("Address", text: optional(\.address), axis: .vertical)
                }
                Section("Church") {
                    Picker("Group", selection: $draft.groupID) { Text("None").tag(UUID?.none); ForEach(store.groups) { Text($0.name).tag(Optional($0.id)) } }
                    TextField("Birthday (YYYY-MM-DD)", text: optional(\.birthDate)).keyboardType(.numbersAndPunctuation)
                    TextField("Membership date (YYYY-MM-DD)", text: optional(\.membershipDate)).keyboardType(.numbersAndPunctuation)
                    Picker("Marital status", selection: $draft.maritalStatus) {
                        Text("Not specified").tag(MaritalStatus?.none)
                        ForEach(MaritalStatus.allCases, id: \.self) { Text(LocalizedStringKey($0.rawValue.capitalized)).tag(Optional($0)) }
                    }
                    Toggle("Orphan", isOn: $draft.isOrphan)
                    Toggle("Archived", isOn: $draft.isArchived)
                }
                Section("Photo") {
                    MemberPortrait(member: draft)
                    PhotosPicker(selection: $photo, matching: .images) { Label("Choose photo", systemImage: "photo") }
                    if pendingPhoto != nil { Text("New photo ready to save").foregroundStyle(.secondary) }
                    if draft.photoPath != nil { Toggle("Remove existing photo", isOn: $removePhoto) }
                }
            }.navigationTitle("Edit member").navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(working) }
                ToolbarItem(placement: .confirmationAction) { Button("Save") {
                    if original.groupID != draft.groupID || original.isArchived != draft.isArchived { confirmSave = true }
                    else { Task { await save() } }
                }.disabled(working || draft.firstName.isEmpty || draft.lastName.isEmpty) }
            }.interactiveDismissDisabled(working)
            .confirmationDialog("Save membership changes?", isPresented: $confirmSave, titleVisibility: .visible) {
                Button("Save changes") { Task { await save() } }
            } message: { Text("This changes the member’s group or archive status and affects their visibility in church lists.") }
            .onChange(of: photo) { _, item in Task {
                do { pendingPhoto = try await item?.loadTransferable(type: Data.self); removePhoto = false }
                catch { self.error = error.localizedDescription }
            } }
        }
    }
    private func optional(_ path: WritableKeyPath<Member, String?>) -> Binding<String> {
        Binding(get: { draft[keyPath: path] ?? "" }, set: { draft[keyPath: path] = $0.isEmpty ? nil : $0 })
    }
    private func save() async {
        working = true; defer { working = false }
        do {
            try await store.saveMember(draft)
            guard let saved = store.members.first(where: { $0.id == draft.id }) else { throw AppFailure.stale }
            draft = saved
            if let pendingPhoto { try await store.uploadPhoto(pendingPhoto, for: saved) }
            else if removePhoto { try await store.removePhoto(saved) }
            dismiss()
        } catch { self.error = error.localizedDescription }
    }
}

struct GroupManagementView: View {
    @Environment(AppStore.self) private var store
    @State private var selected: DirectoryGroup?
    var body: some View {
        List(store.groups) { group in Button(group.name) { selected = group } }
        .navigationTitle("Groups")
        .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { selected = DirectoryGroup(name: "") } label: { Label("Add group", systemImage: "plus") } } }
        .sheet(item: $selected) { GroupEditor(group: $0) }
    }
}

struct GroupEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: DirectoryGroup
    @State private var working = false
    @State private var error: String?
    @State private var confirmDelete = false
    init(group: DirectoryGroup) { _draft = State(initialValue: group) }
    var body: some View {
        NavigationStack {
            Form {
                if let error { FailureNotice(message: error) }
                TextField("Group name", text: $draft.name)
                Section("Responsible deacons") {
                    ForEach(store.accounts.filter { $0.designation == .deacon && $0.status == .active }) { account in
                        let id = account.id
                            Toggle(account.displayName, isOn: Binding(get: { draft.deaconIDs.contains(id) }, set: { if $0 { draft.deaconIDs.append(id) } else { draft.deaconIDs.removeAll { $0 == id } }; draft.responsibleDeaconID = draft.deaconIDs.first }))
                    }
                }
                if store.groups.contains(where: { $0.id == draft.id }) { Button("Delete group", role: .destructive) { confirmDelete = true } }
            }.navigationTitle("Edit group").navigationBarTitleDisplayMode(.inline).disabled(working)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { Task { await save() } }.disabled(working || draft.name.isEmpty) }
            }.interactiveDismissDisabled(working)
            .confirmationDialog("Delete this group?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete group", role: .destructive) { Task { working = true; defer { working = false }; do { try await store.deleteGroup(draft); dismiss() } catch { self.error = error.localizedDescription } } }
            } message: { Text("Members will be removed from this group. Their directory records will remain.") }
        }
    }
    private func save() async { working = true; defer { working = false }; do { try await store.saveGroup(draft); dismiss() } catch { self.error = error.localizedDescription } }
}

struct AccountManagementView: View {
    @Environment(AppStore.self) private var store
    var body: some View {
        List(store.accounts) { account in
            NavigationLink { AccountEditor(account: account) } label: { VStack(alignment: .leading, spacing: 4) { Text(account.displayName); Text(LocalizedStringKey(account.status.rawValue.capitalized)).font(.subheadline).foregroundStyle(.secondary) } }
        }.navigationTitle("Account access")
    }
}

struct AccountEditor: View {
    @Environment(AppStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var draft: Account
    @State private var working = false
    @State private var error: String?
    @State private var confirm = false
    init(account: Account) { _draft = State(initialValue: account) }
    var body: some View {
        Form {
            Text(draft.displayName).font(.headline)
            if let error { FailureNotice(message: error) }
            Picker("Access status", selection: $draft.status) { ForEach(AccessStatus.allCases, id: \.self) { Text(LocalizedStringKey($0.rawValue.capitalized)).tag($0) } }
            Picker("Role", selection: $draft.role) { ForEach(AccessRole.allCases, id: \.self) { Text(LocalizedStringKey($0.rawValue.capitalized)).tag($0) } }
            Picker("Ministry", selection: $draft.designation) { ForEach(Ministry.allCases, id: \.self) { Text(LocalizedStringKey($0.rawValue.capitalized)).tag($0) } }
            Picker("Linked member", selection: $draft.memberID) { Text("None").tag(UUID?.none); ForEach(store.members) { Text($0.displayName).tag(Optional($0.id)) } }
            Text("Changing access affects what this person can view and edit. The server protects the last active administrator.").font(.caption).foregroundStyle(.secondary)
            Button("Save access changes") { confirm = true }.disabled(working)
        }.navigationTitle("Account access").navigationBarTitleDisplayMode(.inline)
        .confirmationDialog("Apply these access changes?", isPresented: $confirm, titleVisibility: .visible) {
            Button("Apply changes") { Task { working = true; defer { working = false }; do { try await store.reviewAccount(draft); dismiss() } catch { self.error = error.localizedDescription } } }
        }
    }
}
