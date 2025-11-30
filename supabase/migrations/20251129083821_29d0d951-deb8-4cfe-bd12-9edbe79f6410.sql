-- Function to link user to book memberships after signup
CREATE OR REPLACE FUNCTION public.link_user_to_book_memberships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update book_members records where email matches the new user's email
  UPDATE public.book_members
  SET user_id = NEW.id
  WHERE email = NEW.email
    AND user_id = '00000000-0000-0000-0000-000000000000';
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to link memberships on signup
DROP TRIGGER IF EXISTS on_auth_user_created_link_memberships ON auth.users;
CREATE TRIGGER on_auth_user_created_link_memberships
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_user_to_book_memberships();