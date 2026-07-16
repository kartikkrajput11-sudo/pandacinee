ALTER TABLE public.love_letters
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS reply_body text,
  ADD COLUMN IF NOT EXISTS reply_reaction text,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS unlock_on_anniversary boolean NOT NULL DEFAULT false;

-- Allow the recipient to update reply fields on letters addressed to them.
DROP POLICY IF EXISTS "Recipient can reply to their letter" ON public.love_letters;
CREATE POLICY "Recipient can reply to their letter"
  ON public.love_letters
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);