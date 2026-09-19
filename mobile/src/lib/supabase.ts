import "react-native-url-polyfill/auto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import type { Database } from "./database";
import { createSecureSessionStorage } from "./secure-session-storage";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const isBackendConfigured = Boolean(url && key);
const secureStorage = createSecureSessionStorage({
  async getItem(key: string) { return SecureStore.getItemAsync(key); },
  async setItem(key: string, value: string) { await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  async removeItem(key: string) { await SecureStore.deleteItemAsync(key); },
});
let client: SupabaseClient<Database> | null = null;
export function getSupabase(): SupabaseClient<Database> | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient<Database>(url, key, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: secureStorage } : {}),
        autoRefreshToken: true,
        persistSession: true,
        // The callback route owns the PKCE exchange, including remount deduplication.
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
    if (Platform.OS !== "web") {
      AppState.addEventListener("change", (state) => {
        if (state === "active") client?.auth.startAutoRefresh();
        else client?.auth.stopAutoRefresh();
      });
    }
  }
  return client;
}
export function requireSupabase(): SupabaseClient<Database> {
  const result = getSupabase();
  if (!result) throw new Error("The church connection has not been configured.");
  return result;
}
