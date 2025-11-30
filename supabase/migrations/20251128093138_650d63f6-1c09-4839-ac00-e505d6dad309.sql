-- Create books table
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create entries table
CREATE TABLE public.entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(15, 2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash_in', 'cash_out')),
  remark TEXT,
  payment_mode TEXT DEFAULT 'Cash',
  category TEXT DEFAULT 'Uncategorized',
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  entry_time TIME NOT NULL DEFAULT CURRENT_TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create book_members table for shared books
CREATE TABLE public.book_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(book_id, user_id)
);

-- Enable RLS
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_members ENABLE ROW LEVEL SECURITY;

-- Books policies
CREATE POLICY "Users can view their own books"
  ON public.books FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM public.book_members 
      WHERE book_id = books.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create books"
  ON public.books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books"
  ON public.books FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books"
  ON public.books FOR DELETE
  USING (auth.uid() = user_id);

-- Entries policies
CREATE POLICY "Users can view entries of their books"
  ON public.entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.books 
      WHERE id = entries.book_id AND (
        user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.book_members 
          WHERE book_id = books.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can create entries in their books"
  ON public.entries FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.books 
      WHERE id = book_id AND (
        user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.book_members 
          WHERE book_id = books.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can update entries in their books"
  ON public.entries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.books 
      WHERE id = entries.book_id AND (
        user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.book_members 
          WHERE book_id = books.id AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can delete entries in their books"
  ON public.entries FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.books 
      WHERE id = entries.book_id AND (
        user_id = auth.uid() OR 
        EXISTS (
          SELECT 1 FROM public.book_members 
          WHERE book_id = books.id AND user_id = auth.uid()
        )
      )
    )
  );

-- Book members policies
CREATE POLICY "Users can view members of their books"
  ON public.book_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.books 
      WHERE id = book_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Book owners can add members"
  ON public.book_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.books 
      WHERE id = book_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Book owners can remove members"
  ON public.book_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.books 
      WHERE id = book_id AND user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_books_user_id ON public.books(user_id);
CREATE INDEX idx_entries_book_id ON public.entries(book_id);
CREATE INDEX idx_entries_user_id ON public.entries(user_id);
CREATE INDEX idx_entries_date ON public.entries(entry_date DESC);
CREATE INDEX idx_book_members_book_id ON public.book_members(book_id);
CREATE INDEX idx_book_members_user_id ON public.book_members(user_id);

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_books_updated_at
  BEFORE UPDATE ON public.books
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entries_updated_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();