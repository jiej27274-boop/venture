import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export interface SupabaseRuntimeStatus {
  enabled: boolean;
  authEnabled: boolean;
  storageEnabled: boolean;
  reason?: "missing_url" | "missing_anon_key" | "missing_service_key";
}

function config() {
  return {
    url: process.env.SUPABASE_URL?.trim() ?? "",
    anonKey: process.env.SUPABASE_ANON_KEY?.trim() ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
  };
}

export function supabaseRuntimeStatus(): SupabaseRuntimeStatus {
  const values = config();
  if (!values.url) return { enabled: false, authEnabled: false, storageEnabled: false, reason: "missing_url" };
  if (!values.anonKey) return { enabled: false, authEnabled: false, storageEnabled: false, reason: "missing_anon_key" };
  if (!values.serviceRoleKey) return { enabled: true, authEnabled: true, storageEnabled: false, reason: "missing_service_key" };
  return { enabled: true, authEnabled: true, storageEnabled: true };
}

let authClient: SupabaseClient | null | undefined;
let adminClient: SupabaseClient | null | undefined;

export function getSupabaseAuthClient(): SupabaseClient | null {
  if (authClient !== undefined) return authClient;
  const values = config();
  authClient = values.url && values.anonKey
    ? createClient(values.url, values.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
    : null;
  return authClient;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (adminClient !== undefined) return adminClient;
  const values = config();
  adminClient = values.url && values.serviceRoleKey
    ? createClient(values.url, values.serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      })
    : null;
  return adminClient;
}

export async function getSupabaseUser(accessToken: string): Promise<User | null> {
  const client = getSupabaseAuthClient();
  if (!client) return null;
  const result = await client.auth.getUser(accessToken);
  return result.error ? null : result.data.user;
}
