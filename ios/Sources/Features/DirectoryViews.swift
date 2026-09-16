import SwiftUI

struct FeatureTabsView: View {
    @Environment(AppStore.self) private var store
    @AppStorage("appearance") private var appearance = "system"
    @AppStorage("language") private var language = "en"
    @State private var tab = 0
    @State private var linkedMember: Member?
    @State private var linkedReminder: PersonalReminder?
    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { DirectoryView() }.tabItem { Label("Directory", systemImage: "person.2") }.tag(0)
            NavigationStack { GroupsView() }.tabItem { Label("Groups", systemImage: "person.3") }.tag(1)
            if let ministry = store.account?.designation, ministry != .none {
                NavigationStack { VisitsView() }.tabItem { Label("Visits", systemImage: "calendar") }.tag(2)
            }
            NavigationStack { SettingsView() }.tabItem { Label("Settings", systemImage: "gearshape") }.tag(3)
        }
        .preferredColorScheme(appearance == "system" ? nil : appearance == "dark" ? .dark : .light)
        .environment(\.locale, Locale(identifier: language))
        .tint(.blue)
        .task { await store.refresh() }
        .onChange(of: store.selectedVisitID) { _, id in if id != nil { tab = 2 } }
        .onChange(of: store.selectedMemberID) { _, id in
            if let id { linkedMember = store.members.first { $0.id == id }; store.selectedMemberID = nil }
        }
        .onChange(of: store.selectedReminderID) { _, id in
            if let id { linkedReminder = store.reminders.first { $0.id == id }; store.selectedReminderID = nil }
        }
        .sheet(item: $linkedMember) { member in
            NavigationStack { MemberDetailView(memberID: member.id).toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { linkedMember = nil } } } }
        }
        .sheet(item: $linkedReminder) { reminder in ReminderEditor(reminder: reminder) }
    }
}

struct FailureNotice: View {
    let message: String
    var body: some View {
        Label { Text(LocalizedStringKey(message)).font(.callout).fixedSize(horizontal: false, vertical: true) }
        icon: { Image(systemName: "exclamationmark.triangle") }
        .foregroundStyle(.red).accessibilityElement(children: .combine)
    }
}

struct MemberRow: View {
    let member: Member
    var body: some View {
        HStack(spacing: 12) {
            MemberPortrait(member: member, size: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text(member.displayName).font(.body)
                if let phone = member.phone, !phone.isEmpty { Text(phone).font(.subheadline).foregroundStyle(.secondary) }
            }
        }.padding(.vertical, 4).accessibilityElement(children: .combine)
    }
}

struct MemberPortrait: View {
    @Environment(AppStore.self) private var store
    let member: Member
    var size: CGFloat = 80
    @State private var signedURL: URL?
    var body: some View {
        AsyncImage(url: signedURL ?? member.photoURL) { image in image.resizable().scaledToFill() }
        placeholder: {
            Image(systemName: "person.crop.circle.fill").resizable().scaledToFit().foregroundStyle(.tertiary)
        }
        .frame(width: size, height: size).clipShape(Circle()).accessibilityHidden(true)
        .task(id: member.photoPath) { signedURL = try? await store.photoURL(for: member) }
    }
}

struct DirectoryView: View {
    @Environment(AppStore.self) private var store
    @State private var query = ""
    @State private var favoritesOnly = false
    @State private var careFilter = "all"
    private let ukrainian = Locale(identifier: "uk_UA")
    private var visible: [Member] {
        store.members.filter { member in
            let searchable = [member.displayName, member.phone ?? "", member.address ?? "", member.birthDate ?? "", member.membershipDate ?? ""].joined(separator: " ")
            return !member.isArchived && (!favoritesOnly || store.favoriteIDs.contains(member.id)) && (careFilter == "all" || careFilter == "widowed" && member.isWidowed || careFilter == "orphan" && member.isOrphan) && (query.isEmpty || searchable.range(of: query, options: [.caseInsensitive, .diacriticInsensitive], locale: ukrainian) != nil)
        }.sorted { $0.lastName.compare($1.lastName, options: [.caseInsensitive], locale: ukrainian) == .orderedAscending }
    }
    private var initials: [String] { Array(Set(visible.map { String($0.lastName.prefix(1)).uppercased(with: ukrainian) })).sorted { $0.compare($1, locale: ukrainian) == .orderedAscending } }
    var body: some View {
        List {
            Picker("Directory filter", selection: $favoritesOnly) { Text("All").tag(false); Text("Favorites").tag(true) }.pickerStyle(.segmented)
            if store.canManage {
                Picker("Care filter", selection: $careFilter) { Text("All").tag("all"); Text("Widowed").tag("widowed"); Text("Orphan").tag("orphan") }
            }
            LabeledContent("Members shown", value: visible.count.formatted())
            if let error = store.errorMessage { FailureNotice(message: error); Button("Try again") { Task { await store.refresh() } } }
            if store.isLoading && store.members.isEmpty { ProgressView("Loading directory") }
            ForEach(initials, id: \.self) { initial in
                Section(initial) {
                    ForEach(visible.filter { String($0.lastName.prefix(1)).uppercased(with: ukrainian) == initial }) { member in
                        NavigationLink { MemberDetailView(memberID: member.id) } label: { MemberRow(member: member) }
                    }
                }
            }
            if !store.isLoading && visible.isEmpty {
                ContentUnavailableView(LocalizedStringKey(query.isEmpty ? (favoritesOnly ? "No favorites yet" : "No members yet") : "No matching members"), systemImage: "person.crop.circle.badge.questionmark", description: Text(LocalizedStringKey(favoritesOnly ? "Open a member and add them to Favorites." : "Try a different name or refresh the directory.")))
            }
        }
        .navigationTitle("Directory").searchable(text: $query, prompt: "Search people")
        .refreshable { await store.refresh() }
        .toolbar { ToolbarItem(placement: .topBarTrailing) { NavigationLink { RemindersView() } label: { Label("Reminders", systemImage: "checklist") } } }
    }
}

struct MemberDetailView: View {
    @Environment(AppStore.self) private var store
    let memberID: UUID
    @State private var error: String?
    @State private var showReminder = false
    @State private var showPhoto = false
    @State private var showVisit = false
    @State private var photoURL: URL?
    @State private var working = false
    private var member: Member? { store.members.first { $0.id == memberID } }
    var body: some View {
        Group {
            if let member {
                List {
                    Section {
                        VStack(spacing: 12) {
                            Button { showPhoto = true } label: { MemberPortrait(member: member, size: 112) }
                                .disabled(member.photoURL == nil && member.photoPath == nil).accessibilityLabel("View member photo")
                            Text(member.displayName).font(.title2.bold()).multilineTextAlignment(.center)
                        }.frame(maxWidth: .infinity).padding(.vertical, 16).listRowBackground(Color.clear)
                    }
                    if let error { FailureNotice(message: error) }
                    Section("Contact") {
                        if let phone = member.phone, let url = URL(string: "tel:" + phone.filter { $0.isNumber || $0 == "+" }) {
                            Link(destination: url) { Label(phone, systemImage: "phone") }
                        }
                        if let address = member.address, !address.isEmpty,
                           let encoded = address.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
                           let url = URL(string: "https://maps.apple.com/?q=\(encoded)") {
                            Link(destination: url) { Label(address, systemImage: "map") }
                        }
                        if member.phone == nil && member.address == nil { Text("No contact details available").foregroundStyle(.secondary) }
                    }
                    Section("Church") {
                        if let group = store.groups.first(where: { $0.id == member.groupID }) {
                            NavigationLink(group.name) { GroupDetailView(groupID: group.id) }
                        }
                        if let birthday = member.birthDate { LabeledContent("Birthday", value: birthday) }
                        if let birthday = member.birthDate, let age = age(birthday) { LabeledContent("Age", value: age.formatted()) }
                        if let joined = member.membershipDate { LabeledContent("Member since", value: joined) }
                        if member.designation != .none { Text(LocalizedStringKey(member.designation.rawValue.capitalized)) }
                        if store.canManage, let status = member.maritalStatus { LabeledContent("Marital status") { Text(LocalizedStringKey(status.rawValue.capitalized)) } }
                        if store.canManage && member.isOrphan { Label("Orphan", systemImage: "heart") }
                    }
                    Section {
                        Button { Task { await favorite(member) } } label: {
                            Label(LocalizedStringKey(store.favoriteIDs.contains(member.id) ? "Remove from Favorites" : "Add to Favorites"), systemImage: store.favoriteIDs.contains(member.id) ? "star.fill" : "star")
                        }.disabled(working)
                        Button { showReminder = true } label: { Label("Add personal reminder", systemImage: "bell.badge") }
                        if store.canPlanVisits { Button { showVisit = true } label: { Label("Plan visit", systemImage: "calendar.badge.plus") } }
                    }
                }
                .navigationTitle(member.displayName).navigationBarTitleDisplayMode(.inline)
                .sheet(isPresented: $showReminder) { ReminderEditor(memberID: member.id) }
                .sheet(isPresented: $showVisit) { VisitEditor(member: member) }
                .sheet(isPresented: $showPhoto) {
                    NavigationStack {
                        AsyncImage(url: photoURL ?? member.photoURL) { image in image.resizable().scaledToFit() }
                        placeholder: { ProgressView() }
                        .navigationTitle(member.displayName).navigationBarTitleDisplayMode(.inline)
                        .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { showPhoto = false } } }
                        .task { do { photoURL = try await store.photoURL(for: member) } catch { self.error = error.localizedDescription; showPhoto = false } }
                    }
                }
            } else { ContentUnavailableView("Member unavailable", systemImage: "person.slash", description: Text("This record may have changed. Refresh the directory.")) }
        }
    }
    private func favorite(_ member: Member) async {
        working = true; defer { working = false }
        do { try await store.toggleFavorite(member); error = nil } catch { self.error = error.localizedDescription }
    }
    private func age(_ birthDate: String) -> Int? {
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.dateFormat = "yyyy-MM-dd"; formatter.timeZone = DomainRules.churchTimeZone
        guard let birth = formatter.date(from: birthDate) else { return nil }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = DomainRules.churchTimeZone
        return calendar.dateComponents([.year], from: birth, to: .now).year
    }
}
