import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { BookOpen, Plus, Users, Settings as SettingsIcon, LogOut, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Book {
  id: string;
  name: string;
  updated_at: string;
  balance?: number;
  members_count?: number;
}

const Books = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBookName, setNewBookName] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
    fetchBooks();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const fetchBooks = async () => {
    try {
      setIsLoading(true);
      const { data: booksData, error } = await supabase
        .from("books")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;

      // Fetch balances for each book
      const booksWithBalances = await Promise.all(
        (booksData || []).map(async (book) => {
          const { data: entries } = await supabase
            .from("entries")
            .select("amount, type")
            .eq("book_id", book.id);

          const balance = (entries || []).reduce((acc, entry) => {
            return entry.type === "cash_in" 
              ? acc + Number(entry.amount)
              : acc - Number(entry.amount);
          }, 0);

          const { count: membersCount } = await supabase
            .from("book_members")
            .select("*", { count: "exact", head: true })
            .eq("book_id", book.id);

          return {
            ...book,
            balance,
            members_count: membersCount || 0,
          };
        })
      );

      setBooks(booksWithBalances);
    } catch (error: any) {
      console.error("Error loading books", error);
      toast.error(error?.message || "Failed to load books");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newBookName.trim()) {
      toast.error("Please enter a book name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("books").insert({
        name: newBookName,
        user_id: user.id,
      });

      if (error) throw error;

      toast.success("Book created successfully");
      setNewBookName("");
      setIsDialogOpen(false);
      fetchBooks();
    } catch (error: any) {
      toast.error(error.message || "Failed to create book");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-lg">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Cashbook</h1>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Your Books</h2>
          <Button variant="ghost" size="icon">
            <Search className="h-5 w-5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </Card>
            ))}
          </div>
        ) : books.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground mb-4">No books yet. Create your first book!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {books.map((book) => (
              <Card
                key={book.id}
                className="p-4 cursor-pointer hover:bg-accent transition-colors"
                onClick={() => navigate(`/books/${book.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      {book.members_count > 0 ? (
                        <Users className="h-5 w-5 text-primary" />
                      ) : (
                        <BookOpen className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{book.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {book.members_count > 0 && `${book.members_count} Members • `}
                        Updated on {format(new Date(book.updated_at), "MMM dd yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${book.balance && book.balance >= 0 ? "text-success" : "text-destructive"}`}>
                      {book.balance !== undefined ? book.balance.toLocaleString() : "0"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Add Book Button */}
      <div className="fixed bottom-20 right-4">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg h-14 px-6">
              <Plus className="h-5 w-5 mr-2" />
              ADD NEW BOOK
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Book</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateBook} className="space-y-4">
              <div>
                <Label htmlFor="book-name">Book Name</Label>
                <Input
                  id="book-name"
                  placeholder="e.g., Personal Expenses"
                  value={newBookName}
                  onChange={(e) => setNewBookName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Create Book
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border">
        <div className="flex justify-around items-center h-16">
          <Button variant="ghost" className="flex-col h-full gap-1">
            <BookOpen className="h-5 w-5" />
            <span className="text-xs">Payments</span>
          </Button>
          <Button variant="ghost" className="flex-col h-full gap-1 text-primary">
            <BookOpen className="h-5 w-5" />
            <span className="text-xs font-semibold">Cashbooks</span>
          </Button>
          <Button variant="ghost" className="flex-col h-full gap-1">
            <SettingsIcon className="h-5 w-5" />
            <span className="text-xs">Settings</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Books;
