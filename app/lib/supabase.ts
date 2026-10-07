import { createClient } from "@supabase/supabase-js";

// Anon key: leitura publica das tabelas de mercado (RLS libera SELECT).
// Escrita (rotas, observacoes) e so via service role, fora do app.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);
