import Foundation

extension AppStore {
    func seedDemo() {
        let group = DirectoryGroup(name: "Riverside")
        let first = Member(firstName: "Marta",lastName: "Koval",phone: "+15550102001",address: "120 Example Lane",birthDate: "1961-10-02",groupID: group.id)
        let second = Member(firstName: "Daniel",lastName: "Petrenko",phone: "+15550102002",birthDate: "1988-02-29",groupID: group.id)
        let third = Member(firstName: "Олена",lastName: "Левченко",birthDate: "1975-09-22",groupID: group.id,maritalStatus: .widowed)
        let pastor = Account(displayName: "Sam — Preview Pastor",role: .admin,status: .active,designation: .pastor)
        let deacon = Account(displayName: "Alex — Preview Deacon",status: .active,designation: .deacon,memberID: second.id)
        let pending = Account(displayName: "New member — Preview",status: .pending)
        members = [first,second,third]
        var assigned = group; assigned.responsibleDeaconID = deacon.id; assigned.deaconIDs = [deacon.id]; groups = [assigned]
        accounts = [pastor,deacon,pending]; account = pastor
        visits = [Visit(memberID: first.id,pastorID: pastor.id,scheduledAt: .now.addingTimeInterval(86400),location: "Church meeting room",notes: "Fictional preview appointment",revision: 1,participants: [VisitParticipant(accountID: deacon.id,name: deacon.displayName)],memberName: first.displayName)]
        reminders = [PersonalReminder(memberID: third.id,title: "Call to say hello",dueAt: .now.addingTimeInterval(172800),revision: 1)]
        favoriteIDs = [first.id]
    }
    func setDemoRole(role: AccessRole, designation: Ministry) {
        guard isDemo else { return }
        if let existing = accounts.first(where: { $0.designation == designation && $0.status == .active }) { account = existing; account?.role = role }
        else { account = Account(displayName: "Preview member",role: role,status: .active,designation: designation) }
    }
}
