// Public Supabase settings (safe to expose: the anon key is protected by Row Level Security).
// Supabase dashboard → Project Settings → API → "Project URL" and "anon public" key.
// NEVER put the service_role key, database password or any payment/email key here.
window.ARAM_CONFIG = {
  SUPABASE_URL: "https://YOUR-PROJECT-REF.supabase.co",
  SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY"
};
