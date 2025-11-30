import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Entry {
  id: string;
  amount: number;
  type: string;
  remark: string;
  payment_mode: string;
  category: string;
  entry_date: string;
  entry_time: string;
  attachment_url: string | null;
}

const EntryDetail = () => {
  const { bookId, entryId } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEntry();
  }, [entryId]);

  const fetchEntry = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (error) throw error;
      setEntry(data);
    } catch (error: any) {
      toast.error("Failed to load entry");
      navigate(`/books/${bookId}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      // Delete attachment if exists
      if (entry?.attachment_url) {
        await supabase.storage
          .from('entry-attachments')
          .remove([entry.attachment_url]);
      }

      const { error } = await supabase
        .from("entries")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      toast.success("Entry deleted successfully");
      navigate(`/books/${bookId}`);
    } catch (error: any) {
      toast.error("Failed to delete entry");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/books/${bookId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">Loading...</h1>
          </div>
        </header>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/books/${bookId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold">Entry Details</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/books/${bookId}/entries/${entryId}/edit`)}
            >
              <Edit className="h-5 w-5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Entry</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this entry? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Amount Card */}
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">Amount</p>
          <p className={`text-4xl font-bold ${entry.type === "cash_in" ? "text-success" : "text-destructive"}`}>
            {entry.type === "cash_out" && "-"}
            {Number(entry.amount).toLocaleString()}
          </p>
          <div className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-medium ${
            entry.type === "cash_in" 
              ? "bg-success/10 text-success" 
              : "bg-destructive/10 text-destructive"
          }`}>
            {entry.type === "cash_in" ? "Cash In" : "Cash Out"}
          </div>
        </Card>

        {/* Details Card */}
        <Card className="p-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Date & Time</p>
            <p className="font-medium">
              {format(new Date(entry.entry_date), "MMMM dd, yyyy")} at{" "}
              {format(new Date(`2000-01-01T${entry.entry_time}`), "h:mm a")}
            </p>
          </div>

          {entry.remark && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Remark</p>
              <p className="font-medium">{entry.remark}</p>
            </div>
          )}

          <div>
            <p className="text-sm text-muted-foreground mb-1">Payment Mode</p>
            <p className="font-medium">{entry.payment_mode}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">Category</p>
            <p className="font-medium">{entry.category}</p>
          </div>

          {(entry as any).attachments && (entry as any).attachments.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">Attachments ({(entry as any).attachments.length})</p>
              <div className="grid grid-cols-2 gap-2">
                {(entry as any).attachments.map((attachment: any, index: number) => (
                  <img
                    key={index}
                    src={
                      attachment.type === 'url'
                        ? attachment.url
                        : supabase.storage.from('entry-attachments').getPublicUrl(attachment.url).data.publicUrl
                    }
                    alt={`Attachment ${index + 1}`}
                    className="w-full rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => window.open(
                      attachment.type === 'url'
                        ? attachment.url
                        : supabase.storage.from('entry-attachments').getPublicUrl(attachment.url).data.publicUrl,
                      '_blank'
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default EntryDetail;
