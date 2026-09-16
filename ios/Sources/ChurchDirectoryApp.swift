import SwiftUI
import AuthenticationServices

@main struct ChurchDirectoryApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @State private var store = AppStore()
    @AppStorage("language") private var language = "en"
    @AppStorage("appearance") private var appearance = "system"
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            AccessGate().environment(store)
                .environment(\.locale, Locale(identifier: language))
                .preferredColorScheme(appearance == "system" ? nil : appearance == "dark" ? .dark : .light)
                .overlay { if scenePhase != .active { Color(uiColor: .systemBackground).ignoresSafeArea().overlay { Image(systemName: "person.2.circle").font(.largeTitle).foregroundStyle(.secondary) } } }
                .task { delegate.store = store; await store.start() }
                .onChange(of: scenePhase) { _, phase in if phase == .active { Task { await store.refresh() } } }
                .onOpenURL { url in
                    guard url.scheme == "churchdirectory", url.host == "visit", let id = UUID(uuidString: url.lastPathComponent) else { return }
                    Task { await store.openVisit(id) }
                }
        }
    }
}

struct AccessGate: View {
    @Environment(AppStore.self) private var store
    @State private var requestSent = false
    @State private var deletionConfirmation = false
    var body: some View {
        Group {
            if let account = store.account, account.status == .active { FeatureTabsView() }
            else if let account = store.account {
                NavigationStack { ScrollView { VStack { ContentUnavailableView {
                    Label(account.status == .pending ? "Waiting for approval" : "Access unavailable", systemImage: "person.badge.clock")
                } description: { Text("The church manages access to the directory. Contact your administrator for help.") }
                actions: {
                    Button("Check again") { Task { await store.refresh() } }
                    Button("Sign out") { Task { do { try await store.signOut() } catch { store.errorMessage = error.localizedDescription } } }
                    Button("Request account deletion",role: .destructive) { deletionConfirmation = true }
                    if requestSent { Text("Deletion request received. Your account has not yet been deleted.").font(.footnote) }
                    if let error = store.errorMessage { Text(error).font(.footnote).foregroundStyle(.red) }
                }
                NavigationLink("Help and privacy") { HelpView() }.padding()
                } } }
            } else {
                NavigationStack {
                    ScrollView { VStack(spacing: 24) {
                        Image(systemName: "person.2.circle").font(.system(size: 72)).foregroundStyle(.tint).accessibilityHidden(true)
                        Text("Our church, connected.").font(.largeTitle.bold()).multilineTextAlignment(.center)
                        Text("Find your community and make time to care.").foregroundStyle(.secondary).multilineTextAlignment(.center)
                        if store.isDemo { Button("Explore fictional preview") { store.seedDemo() }.buttonStyle(.borderedProminent) }
                        else {
                            SignInWithAppleButton(.continue, onRequest: store.prepareAppleSignIn) { result in Task { do { try await store.handleAppleSignIn(result) } catch { store.errorMessage = error.localizedDescription } } }.frame(height: 50).clipShape(.rect(cornerRadius: 12))
                            Button("Continue with Google") { Task { do { try await store.signInWithGoogle() } catch { store.errorMessage = error.localizedDescription } } }.buttonStyle(.bordered).controlSize(.large)
                        }
                        if store.isLoading { ProgressView() }
                        if let error = store.errorMessage { Text(error).font(.footnote).foregroundStyle(.red).accessibilityIdentifier("authentication-error") }
                        Text("This is a private directory. New accounts require church approval.").font(.footnote).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        NavigationLink("Help and privacy") { HelpView() }
                    }.padding(28).frame(maxWidth: 440).frame(maxWidth: .infinity) }
                }
            }
        }.confirmationDialog("Request account deletion?",isPresented: $deletionConfirmation,titleVisibility: .visible) {
            Button("Submit request",role: .destructive) { Task { do { try await store.requestAccountDeletion(); requestSent = true } catch { store.errorMessage = error.localizedDescription } } }
        }
    }
}
