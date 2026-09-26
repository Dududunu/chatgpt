import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { removeUserWorkoutMedia } from "./workoutMediaCleanup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return response({ error: "Unauthorized" }, 401);

  let body: { confirmation?: unknown };
  try {
    body = await request.json();
  } catch {
    return response({ error: "Invalid request" }, 400);
  }
  if (body.confirmation !== "USUŃ") return response({ error: "Confirmation required" }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return response({ error: "Server configuration error" }, 500);

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const user = authData.user;
  if (authError || !user) return response({ error: "Unauthorized" }, 401);

  // Remove private objects before deleting the account. If Storage is unavailable,
  // keep the account intact so the user can retry without leaving orphaned photos.
  try {
    await removeUserWorkoutMedia(admin, user.id);
  } catch {
    return response({ error: "Could not delete workout photos" }, 500);
  }

  // Delete every record for this authenticated account first. These operations are
  // idempotent, so a retry can safely finish cleanup if a request is interrupted.
  for (const table of [
    "workout_templates",
    "workouts",
    "body_entries",
    "user_settings",
    "active_workout",
    "user_sync_state",
    "profiles",
    "user_app_state",
  ]) {
    const { error } = await admin.from(table).delete().eq("user_id", user.id);
    if (error) return response({ error: "Could not delete account data" }, 500);
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return response({ error: "Could not delete account" }, 500);
  return response({ deleted: true });
});
