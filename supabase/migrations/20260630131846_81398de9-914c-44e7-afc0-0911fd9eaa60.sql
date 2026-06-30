drop policy if exists "Team members update own clients" on public.clients;
create policy "Team members update own clients"
on public.clients
for update
to authenticated
using (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.id = clients.assigned_attorney_id
      and tm.active = true
  )
)
with check (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.id = clients.assigned_attorney_id
      and tm.active = true
  )
);

drop policy if exists "Team members update own contracts" on public.contracts;
create policy "Team members update own contracts"
on public.contracts
for update
to authenticated
using (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.id = contracts.attorney_id
      and tm.active = true
  )
)
with check (
  public.is_admin(auth.uid())
  or created_by = auth.uid()
  or exists (
    select 1
    from public.team_members tm
    where tm.user_id = auth.uid()
      and tm.id = contracts.attorney_id
      and tm.active = true
  )
);