import SwiftUI

#Preview("Directory · English") {
    NavigationStack { DirectoryView() }.environment(AppStore(demo: true))
}
#Preview("Directory · Ukrainian · dark") {
    NavigationStack { DirectoryView() }.environment(AppStore(demo: true))
        .environment(\.locale, Locale(identifier: "uk")).preferredColorScheme(.dark)
}
#Preview("Directory · accessibility text") {
    NavigationStack { DirectoryView() }.environment(AppStore(demo: true))
        .environment(\.dynamicTypeSize, .accessibility3)
}
#Preview("Groups") {
    NavigationStack { GroupsView() }.environment(AppStore(demo: true))
}
#Preview("Visits") {
    NavigationStack { VisitsView() }.environment(AppStore(demo: true))
}
#Preview("Reminders") {
    NavigationStack { RemindersView() }.environment(AppStore(demo: true))
}
#Preview("Settings") {
    NavigationStack { SettingsView() }.environment(AppStore(demo: true))
}
