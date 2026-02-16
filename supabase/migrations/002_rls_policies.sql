-- =========================================
-- RLS Policies for multiplayer draft system
-- (Corrected row correlation + auth scoping)
-- =========================================

-- Clean slate (safe re-run)
drop policy if exists "Users can view drafts they participate in" on public.drafts;
drop policy if exists "Hosts can update their drafts" on public.drafts;
drop policy if exists "Users can create drafts" on public.drafts;

drop policy if exists "Users can view participants in their drafts" on public.draft_participants;
drop policy if exists "Users can join drafts" on public.draft_participants;
drop policy if exists "Users can update their participation" on public.draft_participants;
drop policy if exists "Users can leave drafts" on public.draft_participants;

drop policy if exists "Users can view actions in their drafts" on public.draft_actions;
drop policy if exists "Users can create actions in their drafts" on public.draft_actions;
drop policy if exists "No updates to actions" on public.draft_actions;
drop policy if exists "No deletes to actions" on public.draft_actions;

-- -----------------------------------------
-- drafts
-- -----------------------------------------

create policy "Users can view drafts they participate in"
on public.drafts
for select
to authenticated
using (
  exists (
    select 1
    from public.draft_participants dp
    where dp.draft_id = drafts.id
      and dp.user_id = auth.uid()
  )
);

create policy "Hosts can update their drafts"
on public.drafts
for update
to authenticated
using (auth.uid() = drafts.host_user_id)
with check (auth.uid() = drafts.host_user_id);

create policy "Users can create drafts"
on public.drafts
for insert
to authenticated
with check (auth.uid() = host_user_id);

-- -----------------------------------------
-- draft_participants
-- -----------------------------------------

create policy "Users can view participants in their drafts"
on public.draft_participants
for select
to authenticated
using (
  exists (
    select 1
    from public.draft_participants me
    where me.draft_id = draft_participants.draft_id
      and me.user_id = auth.uid()
  )
);

create policy "Users can join drafts"
on public.draft_participants
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update their participation"
on public.draft_participants
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can leave drafts"
on public.draft_participants
for delete
to authenticated
using (auth.uid() = user_id);

-- -----------------------------------------
-- draft_actions (append-only)
-- -----------------------------------------

create policy "Users can view actions in their drafts"
on public.draft_actions
for select
to authenticated
using (
  exists (
    select 1
    from public.draft_participants dp
    where dp.draft_id = draft_actions.draft_id
      and dp.user_id = auth.uid()
  )
);

create policy "Users can create actions in their drafts"
on public.draft_actions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.draft_participants dp
    where dp.draft_id = draft_actions.draft_id
      and dp.user_id = auth.uid()
  )
);

create policy "No updates to actions"
on public.draft_actions
for update
to authenticated
using (false);

create policy "No deletes to actions"
on public.draft_actions
for delete
to authenticated
using (false);
