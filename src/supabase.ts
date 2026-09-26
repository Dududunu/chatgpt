import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL="https://sjkehvbnrkbddoqlfmui.supabase.co";
const SUPABASE_PUBLISHABLE_KEY="sb_publishable_u7nNrUPVHwG0ksxXsU4nwA_rKkmuVsY";

export const supabase=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
 auth:{
  persistSession:true,
  autoRefreshToken:true,
  detectSessionInUrl:true
 }
});
