// @ts-nocheck -- Supabase Edge Functions run in Deno, outside Expo.
// The dedicated recoverable-removal endpoint fails closed on backends that have
// not deployed this capability. Both endpoints share the same audited handler.
import "../delete-member/index.ts";
