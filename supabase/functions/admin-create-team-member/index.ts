// Cria membro da equipe usando Admin API (sem disparar e-mail de confirmação),
// evitando o rate limit de e-mail do Supabase Auth.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: userData.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Apenas administradores podem cadastrar membros' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { full_name, email, password, role_title, specialty, phone } = body ?? {};
    if (!full_name || !email || !password) {
      return new Response(JSON.stringify({ error: 'Nome, e-mail e senha são obrigatórios' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Cria usuário já confirmado, sem enviar e-mail
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr || !created.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? 'Falha ao criar usuário' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const newUserId = created.user.id;

    const { error: roleErr } = await admin.from('user_roles').insert({ user_id: newUserId, role: 'team_member' });
    if (roleErr) {
      await admin.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(JSON.stringify({ error: `Erro ao atribuir papel: ${roleErr.message}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { error: tmErr } = await admin.from('team_members').insert({
      user_id: newUserId,
      full_name,
      email,
      role_title: role_title || null,
      specialty: specialty || null,
      phone: phone || null,
    });
    if (tmErr) {
      await admin.from('user_roles').delete().eq('user_id', newUserId);
      await admin.auth.admin.deleteUser(newUserId).catch(() => {});
      return new Response(JSON.stringify({ error: `Erro ao cadastrar membro: ${tmErr.message}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, user_id: newUserId }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
