-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own books" ON public.books;
DROP POLICY IF EXISTS "Users can view members of their books" ON public.book_members;

-- Recreate books policy without circular reference
CREATE POLICY "Users can view their own books"
  ON public.books FOR SELECT
  USING (
    auth.uid() = user_id OR 
    id IN (
      SELECT book_id FROM public.book_members 
      WHERE user_id = auth.uid()
    )
  );

-- Recreate book_members policy without circular reference
CREATE POLICY "Users can view members of their books"
  ON public.book_members FOR SELECT
  USING (
    book_id IN (
      SELECT id FROM public.books 
      WHERE user_id = auth.uid()
    )
  );

-- Add attachment_url column to entries for storing image references
ALTER TABLE public.entries 
ADD COLUMN IF NOT EXISTS attachment_url TEXT;

-- Create storage bucket for entry attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('entry-attachments', 'entry-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for entry attachments
CREATE POLICY "Users can upload attachments for their entries"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'entry-attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'entry-attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own attachments"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'entry-attachments' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );