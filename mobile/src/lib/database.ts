import type { AccessRole, AccountStatus, MinistryDesignation } from "./domain";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type ProfileRow = { id: string; person_id: string | null; display_name: string; status: AccountStatus; role: AccessRole; designation: MinistryDesignation; revision: number; created_at: string };
export type PersonRow = { id: string; name: string; ministry: string; ministry_uk: string; phone: string | null; email: string | null; photo_path: string | null; membership_group_id: string | null; membership_joined_at: string | null; archived_at: string | null; revision: number; created_at: string };
export type GroupRow = { id: string; name: string; kind: "membership" | "responsibility"; archived_at: string | null; revision: number };
export type MinistryRow = { id: string; name: string; name_uk: string; archived_at: string | null; revision: number; created_at: string };
export type VisitRow = { id: string; pastor_id: string | null; person_id: string; scheduled_at: string; location: string; notes: string; status: "open" | "cancelled" | "completed"; completed_at: string | null; archived_at: string | null; revision: number; submission_id: string; created_at: string; updated_fields: Array<"scheduledAt" | "location" | "notes"> };
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
/** Maintained with the clean baseline. Regenerate from the approved catalog before deployment. */
export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow>;
      people: Table<PersonRow>;
      ministries: Table<MinistryRow>;
      person_ministries: Table<{ person_id: string; ministry_id: string }>;
      deacon_groups: Table<GroupRow>;
      deacon_group_members: Table<{ group_id: string; person_id: string }>;
      deacon_group_deacons: Table<{ group_id: string; account_id: string; slot: number }>;
      visit_requests: Table<VisitRow>;
      visit_recipients: Table<{ visit_id: string; account_id: string; response: "pending" | "accepted" | "declined"; reason: string | null; responded_at: string | null; last_viewed_revision: number }>;
      favorites: Table<{ account_id: string; person_id: string }>;
      personal_reminders: Table<{ id: string; account_id: string; person_id: string; title: string; remind_at: string; completed_at: string | null; notification_enabled: boolean; revision: number }>;
      preferences: Table<{ account_id: string; locale: "en" | "uk"; appearance: "system" | "light" | "dark"; notifications_enabled: boolean }>;
      device_tokens: Table<{ id: string; account_id: string; token: string; platform: "ios"; invalidated_at: string | null; updated_at: string }>;
      group_birthday_notification_preferences: Table<{ account_id: string; group_id: string; enabled: boolean; updated_at: string }>;
      audit_events: Table<{ id: string; actor_id: string | null; action: string; entity_id: string | null; created_at: string; metadata: Json }>;
    };
    Views: { ministry_accounts: { Row: { id: string; display_name: string; designation: MinistryDesignation; person_id: string | null }; Relationships: [] } };
    Functions: {
      mobile_contract_version: { Args: Record<string, never>; Returns: string };
      save_person: { Args: { p_id: string | null; p_revision: number | null; p_data: Json }; Returns: PersonRow };
      save_group: { Args: { p_id: string | null; p_revision: number | null; p_name: string; p_kind: string; p_archived: boolean; p_deacon_ids: string[]; p_member_ids: string[] }; Returns: GroupRow };
      delete_group: { Args: { p_id: string; p_revision: number }; Returns: undefined };
      update_account: { Args: { p_id: string; p_revision: number; p_status: AccountStatus; p_role: AccessRole; p_designation: MinistryDesignation; p_person_id: string | null }; Returns: ProfileRow };
      save_ministry: { Args: { p_id: string | null; p_revision: number | null; p_name: string; p_name_uk: string | null; p_archived: boolean }; Returns: { id: string; name: string; name_uk: string | null; archived_at: string | null; revision: number } };
      management_member_details: { Args: { p_person_id: string }; Returns: { person_id: string; birth_date: string | null; address: string | null; ministry_ids: string[] }[] };
      management_member_care_details: { Args: { p_person_id: string }; Returns: { person_id: string; birth_date: string | null; address: string | null; marital_status: string | null; orphan_status: boolean | null; ministry_ids: string[] }[] };
      management_accounts: { Args: Record<string, never>; Returns: { id: string; person_id: string | null; display_name: string; email: string; status: AccountStatus; role: AccessRole; designation: MinistryDesignation; revision: number; created_at: string }[] };
      save_visit: { Args: { p_id: string | null; p_revision: number | null; p_submission_id: string; p_person_id: string; p_scheduled_at: string; p_location: string; p_notes: string; p_deacon_ids: string[] }; Returns: VisitRow };
      respond_to_visit: { Args: { p_id: string; p_revision: number; p_response: string; p_reason: string | null }; Returns: VisitRow };
      transition_visit: { Args: { p_id: string; p_revision: number; p_action: string }; Returns: VisitRow };
      group_birthdays: { Args: { p_group_id: string }; Returns: { person_id: string; name: string; month: number; day: number }[] };
      group_birthday_notification_setting: { Args: { p_group_id: string }; Returns: boolean };
      set_group_birthday_notifications: { Args: { p_group_id: string; p_enabled: boolean }; Returns: undefined };
      group_summary_counts: { Args: { p_group_id: string }; Returns: { total: number; orphans: number; widows: number }[] };
      request_account_deletion: { Args: Record<string, never>; Returns: string };
      mark_visit_viewed: { Args: { p_id: string; p_revision: number }; Returns: undefined };
      set_person_photo: { Args: { p_id: string; p_revision: number; p_path: string | null }; Returns: PersonRow };
      member_profile_details: { Args: { p_person_id: string }; Returns: { person_id: string; birth_date: string | null; address: string | null; marital_status: string | null; orphan_status: boolean | null; membership_joined_at: string | null }[] };
      visit_person_defaults: { Args: Record<string, never>; Returns: { person_id: string; address: string | null }[] };
      directory_active_members: { Args: Record<string, never>; Returns: { id: string; name: string; ministry: string; ministry_uk: string; phone: string | null; photo_path: string | null; designation: MinistryDesignation; is_orphan: boolean; is_widow: boolean }[] };
      directory_visible_visit_count: { Args: Record<string, never>; Returns: number };
    };
    Enums: { app_role: AccessRole; account_status: AccountStatus; ministry_designation: MinistryDesignation };
    CompositeTypes: Record<string, never>;
  };
};
