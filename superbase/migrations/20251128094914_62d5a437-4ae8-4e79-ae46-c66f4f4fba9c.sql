-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view their own books" ON public.books;
DROP POLICY IF EXISTS "Users can view members of their books" ON public.book_members;
DROP POLICY IF EXISTS "Book owners can add members" ON public.book_members;
DROP POLICY IF EXISTS "Book owners can remove members" ON public.book_members;

-- Create security definer function to check if user owns a book
CREATE OR REPLACE FUNCTION public.user_owns_book(_user_id uuid, _book_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.books
    WHERE id = _book_id AND user_id = _user_id
  );
$$;

-- Create security definer function to check if user is a member of a book
CREATE OR REPLACE FUNCTION public.user_is_book_member(_user_id uuid, _book_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.book_members
    WHERE book_id = _book_id AND user_id = _user_id
  );
$$;

-- Recreate books policies using security definer functions
CREATE POLICY "Users can view their own books"
  ON public.books FOR SELECT
  USING (
    auth.uid() = user_id OR 
    public.user_is_book_member(auth.uid(), id)
  );

-- Recreate book_members policies using security definer function
CREATE POLICY "Users can view members of their books"
  ON public.book_members FOR SELECT
  USING (public.user_owns_book(auth.uid(), book_id));

CREATE POLICY "Book owners can add members"
  ON public.book_members FOR INSERT
  WITH CHECK (public.user_owns_book(auth.uid(), book_id));

CREATE POLICY "Book owners can remove members"
  ON public.book_members FOR DELETE
  USING (public.user_owns_book(auth.uid(), book_id));