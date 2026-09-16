import Foundation
import UIKit
import Supabase

extension AppStore {
    func saveMember(_ member: Member) async throws {
        guard canManage else { throw AppFailure.access }
        guard !member.firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !member.lastName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw AppFailure.validation("Enter the member's first and last name.") }
        if isDemo { members.removeAll { $0.id == member.id }; members.append(member); return }
        let existing = members.first { $0.id == member.id }
        // Address editing is one native field. Structured existing components remain intact unless changed.
        var payload: [String: Any] = ["first_name": member.firstName.trimmingCharacters(in: .whitespacesAndNewlines),"last_name": member.lastName.trimmingCharacters(in: .whitespacesAndNewlines),"phone": member.phone as Any? ?? NSNull(),"date_of_birth": member.birthDate as Any? ?? NSNull(),"membership_joined_at": member.membershipDate as Any? ?? NSNull(),"archived_at": member.isArchived ? Date.now.ISO8601Format() as Any : NSNull(),"is_orphan": member.isOrphan]
        payload["marital_status"] = member.maritalStatus?.rawValue as Any? ?? NSNull()
        if existing?.address != member.address { payload["address_line_1"] = member.address as Any? ?? NSNull(); ["address_line_2","city","state","postal_code"].forEach { payload[$0] = NSNull() } }
        let repository = try live()
        if let stamp = member.updatedAt {
            let filter = stamp.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "+"))) ?? stamp
            let data = try await repository.request("people?id=eq.\(member.id)&updated_at=eq.\(filter)",method: "PATCH",body: payload)
            guard let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]], !rows.isEmpty else { throw AppFailure.stale }
        } else {
            guard existing == nil else { throw AppFailure.stale }
            payload["id"] = member.id.uuidString
            _ = try await repository.request("people",method: "POST",body: payload)
        }
        if member.originalGroupID != member.groupID {
            do {
                try await repository.rpc("assign_deacon_group_member", ["target_person": member.id.uuidString,"target_group": member.groupID?.uuidString as Any? ?? NSNull(),"expected_group": member.originalGroupID?.uuidString as Any? ?? NSNull()])
            } catch {
                await refresh()
                throw AppFailure.unavailable("Member details were saved, but the group assignment failed. Close and reopen this member before retrying. \(error.localizedDescription)")
            }
        }
        await refresh()
    }
    func saveGroup(_ group: DirectoryGroup) async throws {
        guard canManage else { throw AppFailure.access }
        guard !group.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { throw AppFailure.validation("Enter a group name.") }
        if isDemo { groups.removeAll { $0.id == group.id }; groups.append(group); return }
        let exists = groups.contains { $0.id == group.id }
        let ids = group.deaconIDs.isEmpty ? [group.responsibleDeaconID].compactMap { $0 } : group.deaconIDs
        try await mutate("save_deacon_group", ["target_group": exists ? group.id.uuidString as Any : NSNull(),"group_name": group.name,"deacon_ids": ids.map(\.uuidString)])
    }
    func deleteGroup(_ group: DirectoryGroup) async throws {
        guard canManage else { throw AppFailure.access }
        if isDemo { groups.removeAll { $0.id == group.id }; for index in members.indices where members[index].groupID == group.id { members[index].groupID = nil }; return }
        try await mutate("delete_deacon_group", ["target_group": group.id.uuidString])
    }
    func reviewAccount(_ updated: Account) async throws {
        guard canAdminister else { throw AppFailure.access }
        if isDemo {
            if updated.id == account?.id && (updated.role != .admin || updated.status != .active) && accounts.filter({ $0.role == .admin && $0.status == .active }).count <= 1 { throw AppFailure.validation("Keep at least one active administrator.") }
            accounts.removeAll { $0.id == updated.id }; accounts.append(updated); if account?.id == updated.id { account = updated }; return
        }
        try await mutate("review_account_designations", ["target_id": updated.id.uuidString,"new_status": updated.status.rawValue,"new_role": updated.role.rawValue,"new_person_id": updated.memberID?.uuidString as Any? ?? NSNull(),"note": "Reviewed in native app","is_deacon": updated.designation == .deacon,"is_pastor": updated.designation == .pastor])
    }
    func uploadPhoto(_ data: Data, for member: Member) async throws {
        guard canManage else { throw AppFailure.access }
        guard let original = UIImage(data: data) else { throw AppFailure.validation("Choose a valid photo.") }
        let scale = min(1, 1600 / max(original.size.width, original.size.height))
        let size = CGSize(width: original.size.width * scale,height: original.size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: size)
        guard let jpeg = renderer.image(actions: { _ in original.draw(in: CGRect(origin: .zero,size: size)) }).jpegData(compressionQuality: 0.8) else { throw AppFailure.validation("Could not prepare the photo.") }
        if isDemo { throw AppFailure.unavailable("Photo upload requires a configured staging backend.") }
        let repository = try live()
        guard let current = members.first(where: { $0.id == member.id }) else { throw AppFailure.stale }
        let path = "\(member.id)/\(UUID()).jpg"
        let bucket = repository.client.storage.from("member-photos")
        _ = try await bucket.upload(path, data: jpeg, options: FileOptions(cacheControl: "0",contentType: "image/jpeg"))
        do { try await replacePhotoReference(current,path: path) }
        catch { _ = try? await bucket.remove(paths: [path]); throw error }
        if let old = current.photoPath { _ = try await bucket.remove(paths: [old]) }
        await refresh()
    }
    func removePhoto(_ member: Member) async throws {
        guard canManage else { throw AppFailure.access }
        if isDemo { return }
        let repository = try live()
        guard let current = members.first(where: { $0.id == member.id }) else { throw AppFailure.stale }
        try await replacePhotoReference(current,path: nil)
        if let old = current.photoPath { _ = try await repository.client.storage.from("member-photos").remove(paths: [old]) }
        await refresh()
    }
    func photoURL(for member: Member) async throws -> URL? {
        try requireActive()
        guard let path = member.photoPath else { return nil }
        return try await live().client.storage.from("member-photos").createSignedURL(path: path,expiresIn: 60)
    }
    private func replacePhotoReference(_ member: Member,path: String?) async throws {
        guard let stamp = member.updatedAt else { throw AppFailure.stale }
        let filter = stamp.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed.subtracting(CharacterSet(charactersIn: "+"))) ?? stamp
        let data = try await live().request("people?id=eq.\(member.id)&updated_at=eq.\(filter)",method: "PATCH",body: ["photo_path":path as Any? ?? NSNull()])
        guard let rows = try JSONSerialization.jsonObject(with: data) as? [[String: Any]], !rows.isEmpty else { throw AppFailure.stale }
    }
}
