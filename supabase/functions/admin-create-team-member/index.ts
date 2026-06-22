// Cria/repara membro da equipe usando Admin API (sem disparar e-mail de confirmação),
// evitando o rate limit de e-mail do Supabase Auth.
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return json({ error: 'Não autenticado' }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Sessão inválida' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isAdmin } = await admin.rpc('is_admin', { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: 'Apenas administradores podem gerenciar membros' }, 403);

    const body = await req.json();
    const action: string = body?.action ?? 'create';

    // ----- REPAIR ACCESS -----
    if (action === 'repair_access') {
      const { user_id, email, full_name, role_title, specialty, phone, new_password } = body ?? {};
      if (!user_id && !email) return json({ error: 'user_id ou email obrigatório' }, 400);

      // Resolve target user
      let targetId: string | null = user_id ?? null;
      if (!targetId && email) {
        const { data: lookup } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        targetId = lookup?.users?.find(u => u.email?.toLowerCase() === String(email).toLowerCase())?.id ?? null;
      }
      if (!targetId) return json({ error: 'Usuário não encontrado no Auth' }, 404);

      const updatePayload: Record<string, unknown> = { email_confirm: true };
      if (new_password) updatePayload.password = new_password;
      if (email) updatePayload.email = email;
      if (full_name) updatePayload.user_metadata = { full_name };

      const { error: updErr } = await admin.auth.admin.updateUserById(targetId, updatePayload);
      if (updErr) return json({ error: `Falha ao atualizar usuário: ${updErr.message}` }, 400);

      // Garante profile
      await admin.from('profiles').upsert(
        { user_id: targetId, full_name: full_name ?? null },
        { onConflict: 'user_id' },
      );

      // Garante role team_member
      await admin.from('user_roles').upsert(
        { user_id: targetId, role: 'team_member' },
        { onConflict: 'user_id,role' },
      );

      // Garante team_members
      await admin.from('team_members').upsert(
        {
          user_id: targetId,
          full_name: full_name ?? email ?? 'Membro',
          email: email ?? null,
          role_title: role_title ?? null,
          specialty: specialty ?? null,
          phone: phone ?? null,
          active: true,
        },
        { onConflict: 'user_id' },
      );

      return json({ ok: true, user_id: targetId, repaired: true });
    }

    // ----- CREATE -----
    const { full_name, email, password, role_title, specialty, phone } = body ?? {};
    if (!full_name || !email || !password) {
      return json({ error: 'Nome, e-mail e senha são obrigatórios' }, 400);
    }

    // Se já existe um usuário com esse e-mail, REPARA em vez de criar novo (evita travar)
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = list?.users?.find(u => u.email?.toLowerCase() === String(email).toLowerCase());
    let newUserId = existing?.id ?? null;

    if (!newUserId) {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createErr || !created.user) {
        return json({ error: createErr?.message ?? 'Falha ao criar usuário' }, 400);
      }
      newUserId = created.user.id;
    } else {
      // Já existe: força confirmação e redefine senha (garante login).
      const { error: updErr } = await admin.auth.admin.updateUserById(newUserId, {
        password, email_confirm: true, user_metadata: { full_name },
      });
      if (updErr) return json({ error: `Usuário já existe e não pôde ser atualizado: ${updErr.message}` }, 400);
    }

    await admin.from('profiles').upsert(
      { user_id: newUserId, full_name },
      { onConflict: 'user_id' },
    );

    const { error: roleErr } = await admin.from('user_roles').upsert(
      { user_id: newUserId, role: 'team_member' },
      { onConflict: 'user_id,role' },
    );
    if (roleErr) return json({ error: `Erro ao atribuir papel: ${roleErr.message}` }, 400);

    const { error: tmErr } = await admin.from('team_members').upsert(
      {
        user_id: newUserId,
        full_name,
        email,
        role_title: role_title || null,
        specialty: specialty || null,
        phone: phone || null,
        active: true,
      },
      { onConflict: 'user_id' },
    );
    if (tmErr) return json({ error: `Erro ao cadastrar membro: ${tmErr.message}` }, 400);

    return json({ ok: true, user_id: newUserId, reused_existing: !!existing });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado';
    return json({ error: msg }, 500);
  }
});
