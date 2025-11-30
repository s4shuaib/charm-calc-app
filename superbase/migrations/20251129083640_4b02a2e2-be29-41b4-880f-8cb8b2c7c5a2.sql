-- Create enum for member roles
CREATE TYPE public.member_role AS ENUM ('viewer', 'editor');

-- Update book_members table to use the enum
ALTER TABLE public.book_members 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE member_role USING role::member_role,
  ALTER COLUMN role SET DEFAULT 'viewer'::member_role;

-- Create function to check member role
CREATE OR REPLACE FUNCTION public.user_has_book_role(_user_id uuid, _book_id uuid, _role member_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_members
    WHERE book_id = _book_id 
      AND user_id = _user_id 
      AND role = _role
  );
$$;

-- Create function to get user's role in a book
CREATE OR REPLACE FUNCTION public.get_user_book_role(_user_id uuid, _book_id uuid)
RETURNS member_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.book_members
  WHERE book_id = _book_id AND user_id = _user_id
  LIMIT 1;
$$;

-- Drop ALL existing policies on entries table
DROP POLICY IF EXISTS "Users can create entries in their books" ON public.entries;
DROP POLICY IF EXISTS "Users can update entries in their books" ON public.entries;
DROP POLICY IF EXISTS "Users can delete entries in their books" ON public.entries;
DROP POLICY IF EXISTS "Users can view entries of their books" ON public.entries;
DROP POLICY IF EXISTS "Editors can create entries" ON public.entries;
DROP POLICY IF EXISTS "Editors can update entries" ON public.entries;
DROP POLICY IF EXISTS "Editors can delete entries" ON public.entries;

-- Create new policies with role-based permissions
-- Viewers and editors can view entries
CREATE POLICY "Users can view entries of their books"
ON public.entries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM books
    WHERE books.id = entries.book_id 
    AND (
      books.user_id = auth.uid() 
      OR user_is_book_member(auth.uid(), books.id)
    )
  )
);

-- Only editors and owners can create entries
CREATE POLICY "Editors can create entries"
ON public.entries FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (
    user_owns_book(auth.uid(), book_id)
    OR user_has_book_role(auth.uid(), book_id, 'editor'::member_role)
  )
);

-- Only editors and owners can update entries
CREATE POLICY "Editors can update entries"
ON public.entries FOR UPDATE
USING (
  user_owns_book(auth.uid(), book_id)
  OR user_has_book_role(auth.uid(), book_id, 'editor'::member_role)
);

-- Only editors and owners can delete entries
CREATE POLICY "Editors can delete entries"
ON public.entries FOR DELETE
USING (
  user_owns_book(auth.uid(), book_id)
  OR user_has_book_role(auth.uid(), book_id, 'editor'::member_role)
);

-- Add email column to book_members for invitations
ALTER TABLE public.book_members ADD COLUMN IF NOT EXISTS email text;

-- Update RLS policy to allow viewing members
DROP POLICY IF EXISTS "Users can view members of their books" ON public.book_members;
CREATE POLICY "Users can view members of their books"
ON public.book_members FOR SELECT
USING (
  user_owns_book(auth.uid(), book_id)
  OR user_is_book_member(auth.uid(), book_id)
);