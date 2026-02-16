-- RLS Policies for multiplayer draft system

-- Drafts table policies
-- Allow users to read drafts they participate in
CREATE POLICY "Users can view drafts they participate in" ON public.drafts
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.draft_participants 
      WHERE draft_id = id
    )
  );

-- Allow users to update drafts they host
CREATE POLICY "Hosts can update their drafts" ON public.drafts
  FOR UPDATE USING (
    auth.uid() = host_user_id
  );

-- Allow anyone to insert drafts (will be constrained by app logic)
CREATE POLICY "Users can create drafts" ON public.drafts
  FOR INSERT WITH CHECK (true);

-- Draft participants table policies
-- Allow users to read participants for drafts they participate in
CREATE POLICY "Users can view participants in their drafts" ON public.draft_participants
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.draft_participants 
      WHERE draft_id = draft_id
    )
  );

-- Allow users to insert themselves as participants
CREATE POLICY "Users can join drafts" ON public.draft_participants
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Allow users to update their own participant record
CREATE POLICY "Users can update their participation" ON public.draft_participants
  FOR UPDATE USING (
    auth.uid() = user_id
  );

-- Allow users to delete their own participation
CREATE POLICY "Users can leave drafts" ON public.draft_participants
  FOR DELETE USING (
    auth.uid() = user_id
  );

-- Draft actions table policies
-- Allow users to read actions for drafts they participate in
CREATE POLICY "Users can view actions in their drafts" ON public.draft_actions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM public.draft_participants 
      WHERE draft_id = draft_id
    )
  );

-- Allow users to insert actions for drafts they participate in
CREATE POLICY "Users can create actions in their drafts" ON public.draft_actions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    auth.uid() IN (
      SELECT user_id FROM public.draft_participants 
      WHERE draft_id = draft_id
    )
  );

-- No one should update or delete actions (immutable audit log)
CREATE POLICY "No updates to actions" ON public.draft_actions
  FOR UPDATE USING (false);

CREATE POLICY "No deletes to actions" ON public.draft_actions
  FOR DELETE USING (false);
