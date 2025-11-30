-- Make entry-attachments bucket public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'entry-attachments';

-- Update entries table to support multiple attachments (array of URLs)
ALTER TABLE public.entries 
ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- Copy existing attachment_url to new attachments array
UPDATE public.entries 
SET attachments = jsonb_build_array(jsonb_build_object('url', attachment_url, 'type', 'upload'))
WHERE attachment_url IS NOT NULL;

-- We'll keep attachment_url for now for backward compatibility but new entries will use attachments