import { createClient } from "@supabase/supabase-js";

// Cliente server-side (service role). Nunca importar em client components.
// Quando tivermos a anon key, as tabelas publicas podem usar NEXT_PUBLIC_*.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
