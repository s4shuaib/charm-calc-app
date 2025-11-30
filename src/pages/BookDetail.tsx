import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Search, Filter, Plus, Minus, Mic, Calendar, ChevronDown, Paperclip, Download, Upload, FileText, Users, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseCSVToEntries, exportEntriesToCSV, downloadCSV } from "@/lib/csvUtils";
import { generatePDF } from "@/lib/pdfUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface Entry {
  id: string;
  amount: number;
  type: string;
  remark: string;
  payment_mode: string;
  category: string;
  entry_date: string;
  entry_time: string;
  created_at: string;
  attachment_url: string | null;
  attachments?: any[];
}

interface Member {
  id: string;
  user_id: string;
  email: string;
  role: 'viewer' | 'editor';
  created_at: string;
}

const BookDetail = () => {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<any>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | "cash_in" | "cash_out">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<'viewer' | 'editor'>('viewer');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchBookAndEntries();
    fetchMembers();
  }, [bookId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("book_members")
        .select("*")
        .eq("book_id", bookId);

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      console.error("Failed to load members:", error);
    }
  };

  const fetchBookAndEntries = async () => {
    try {
      setIsLoading(true);

      // Fetch book details
      const { data: bookData, error: bookError } = await supabase
        .from("books")
        .select("*")
        .eq("id", bookId)
        .single();

      if (bookError) throw bookError;
      setBook(bookData);

      // Fetch entries
      const { data: entriesData, error: entriesError } = await supabase
        .from("entries")
        .select("*")
        .eq("book_id", bookId)
        .order("entry_date", { ascending: false })
        .order("entry_time", { ascending: false });

      if (entriesError) throw entriesError;
      setEntries((entriesData || []).map(entry => ({
        ...entry,
        attachments: entry.attachments as any[]
      })));
    } catch (error: any) {
      toast.error("Failed to load book details");
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.remark?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.amount.toString().includes(searchQuery);
    const matchesType = selectedType === "all" || entry.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Calculate balance from filtered entries
  const calculateBalance = () => {
    let totalIn = 0;
    let totalOut = 0;
    filteredEntries.forEach((entry) => {
      if (entry.type === "cash_in") {
        totalIn += Number(entry.amount);
      } else {
        totalOut += Number(entry.amount);
      }
    });
    return {
      net: totalIn - totalOut,
      totalIn,
      totalOut,
    };
  };

  const balance = calculateBalance();

  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    const date = format(new Date(entry.entry_date), "dd MMMM yyyy");
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {} as Record<string, Entry[]>);

  const getRunningBalance = (entryIndex: number) => {
    let runningBalance = 0;
    for (let i = entries.length - 1; i >= entryIndex; i--) {
      const entry = entries[i];
      if (entry.type === "cash_in") {
        runningBalance += Number(entry.amount);
      } else {
        runningBalance -= Number(entry.amount);
      }
    }
    return runningBalance;
  };

  const handleImportCSV = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const csvContent = e.target?.result as string;
        const parsedEntries = parseCSVToEntries(csvContent);

        if (parsedEntries.length === 0) {
          toast.error('No valid entries found in CSV');
          return;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('You must be logged in to import entries');
          return;
        }

        // Insert entries into database
        const entriesToInsert = parsedEntries.map(entry => ({
          ...entry,
          book_id: bookId,
          user_id: user.id,
        }));

        const { error } = await supabase
          .from('entries')
          .insert(entriesToInsert);

        if (error) throw error;

        toast.success(`Successfully imported ${parsedEntries.length} entries`);
        fetchBookAndEntries();
      } catch (error: any) {
        console.error('Import error:', error);
        toast.error(error.message || 'Failed to import CSV');
      } finally {
        setIsImporting(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (entries.length === 0) {
      toast.error('No entries to export');
      return;
    }

    try {
      const csvContent = exportEntriesToCSV(entries);
      const filename = `${book?.name || 'cashbook'}_${format(new Date(), 'dd-MM-yyyy')}.csv`;
      downloadCSV(csvContent, filename);
      toast.success('Entries exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export entries');
    }
  };

  const handleGeneratePDF = () => {
    if (filteredEntries.length === 0) {
      toast.error('No entries to generate report');
      return;
    }

    try {
      generatePDF(book?.name || 'Cashbook', filteredEntries);
      toast.success('PDF report generated successfully');
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate PDF report');
    }
  };

  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newMemberEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      // Check if member already exists
      const { data: existingMember } = await supabase
        .from('book_members')
        .select('id')
        .eq('book_id', bookId)
        .eq('email', newMemberEmail.toLowerCase())
        .single();

      if (existingMember) {
        toast.error('This member is already added');
        return;
      }

      // Insert member with temporary user_id (will be updated when they log in)
      const { error } = await supabase
        .from('book_members')
        .insert({
          book_id: bookId,
          email: newMemberEmail.toLowerCase(),
          role: newMemberRole,
          user_id: '00000000-0000-0000-0000-000000000000' // Placeholder until user logs in
        });

      if (error) throw error;

      toast.success('Member invited! They will see this book when they log in.');
      setNewMemberEmail('');
      setNewMemberRole('viewer');
      fetchMembers();
    } catch (error: any) {
      console.error('Add member error:', error);
      toast.error(error.message || 'Failed to add member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('book_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member removed successfully');
      fetchMembers();
    } catch (error: any) {
      console.error('Remove member error:', error);
      toast.error('Failed to remove member');
    }
  };

  const isBookOwner = currentUserId && book?.user_id === currentUserId;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">{book?.name}</h1>
              <p className="text-xs text-muted-foreground">Add Member, Book Activity etc</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Users className="h-4 w-4 mr-1" />
                  Members
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Manage Members</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Add Member Section */}
                  {isBookOwner && (
                    <div className="space-y-3 pb-4 border-b">
                      <Label>Add New Member</Label>
                      <Input
                        type="email"
                        placeholder="Enter email address"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                      />
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newMemberRole} onValueChange={(value: 'viewer' | 'editor') => setNewMemberRole(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer - Can view entries and reports only</SelectItem>
                            <SelectItem value="editor">Editor - Can add, edit, and delete entries</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleAddMember} className="w-full">
                        Add Member
                      </Button>
                    </div>
                  )}

                  {/* Current Members List */}
                  <div className="space-y-3">
                    <Label>Current Members ({members.length})</Label>
                    {members.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No members yet
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {members.map((member) => (
                          <Card key={member.id} className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{member.email}</p>
                                <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                              </div>
                              {isBookOwner && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveMember(member.id)}
                                  className="h-8 w-8"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button
              variant="outline"
              size="sm"
              onClick={handleImportCSV}
              disabled={isImporting}
            >
              <Upload className="h-4 w-4 mr-1" />
              {isImporting ? 'Importing...' : 'Import'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={entries.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </header>

      {/* Search and Filters */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by remark or amount"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          <Button 
            variant={selectedType === "all" ? "default" : "outline"} 
            size="sm" 
            className="shrink-0"
            onClick={() => setSelectedType("all")}
          >
            All
          </Button>
          <Button 
            variant={selectedType === "cash_in" ? "default" : "outline"} 
            size="sm" 
            className="shrink-0"
            onClick={() => setSelectedType("cash_in")}
          >
            Cash In
          </Button>
          <Button 
            variant={selectedType === "cash_out" ? "default" : "outline"} 
            size="sm" 
            className="shrink-0"
            onClick={() => setSelectedType("cash_out")}
          >
            Cash Out
          </Button>
        </div>

        {/* Balance Card */}
        <Card className="p-4 bg-gradient-to-br from-card to-primary/5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Net Balance</h3>
            <p className={`text-2xl font-bold ${balance.net >= 0 ? "text-success" : "text-destructive"}`}>
              {balance.net >= 0 ? "" : "-"}{Math.abs(balance.net).toLocaleString()}
            </p>
          </div>
          <div className="space-y-2 mb-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total In (+)</span>
              <span className="font-semibold text-success">{balance.totalIn.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Out (-)</span>
              <span className="font-semibold text-destructive">{balance.totalOut.toLocaleString()}</span>
            </div>
          </div>
          <Button 
            variant="link" 
            className="text-primary p-0 h-auto font-semibold"
            onClick={handleGeneratePDF}
            disabled={filteredEntries.length === 0}
          >
            VIEW REPORTS →
          </Button>
        </Card>

        {/* Entries Count */}
        <p className="text-center text-sm text-muted-foreground">
          Showing {filteredEntries.length} entries
        </p>

        {/* Entries List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </Card>
            ))}
          </div>
        ) : Object.keys(groupedEntries).length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">No entries yet. Add your first transaction!</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedEntries).map(([date, dateEntries]) => (
              <div key={date}>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">{date}</h3>
                <div className="space-y-3">
                  {dateEntries.map((entry, idx) => {
                    const entryIndex = entries.findIndex(e => e.id === entry.id);
                    const runningBalance = getRunningBalance(entryIndex);
                    
                    return (
                      <Card
                        key={entry.id}
                        className="p-4 cursor-pointer hover:bg-accent transition-colors"
                        onClick={() => navigate(`/books/${bookId}/entries/${entry.id}`)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-start gap-3">
                            <div className={`${entry.type === "cash_in" ? "bg-success/10" : "bg-muted"} px-2 py-1 rounded text-xs font-medium`}>
                              {entry.payment_mode}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${entry.type === "cash_in" ? "text-success" : "text-foreground"}`}>
                              {entry.type === "cash_out" && "-"}{Number(entry.amount).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Balance: {runningBalance.toLocaleString()}</p>
                          </div>
                        </div>
                        {entry.remark && (
                          <p className="text-sm text-foreground mb-2">{entry.remark}</p>
                        )}
                        {entry.attachment_url && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <Paperclip className="h-3 w-3" />
                            <span>1 Attachment</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Entry by You at {format(new Date(`2000-01-01T${entry.entry_time}`), "h:mm a")}
                        </p>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4 flex gap-3">
        <Button
          className="flex-1 bg-success hover:bg-success/90 text-success-foreground h-12"
          onClick={() => navigate(`/books/${bookId}/entries/new?type=cash_in`)}
        >
          <Plus className="h-5 w-5 mr-2" />
          CASH IN
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full bg-primary text-primary-foreground border-0"
        >
          <Mic className="h-5 w-5" />
        </Button>
        <Button
          className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground h-12"
          onClick={() => navigate(`/books/${bookId}/entries/new?type=cash_out`)}
        >
          <Minus className="h-5 w-5 mr-2" />
          CASH OUT
        </Button>
      </div>
    </div>
  );
};

export default BookDetail;
