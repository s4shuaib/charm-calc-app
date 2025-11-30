import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Auth from "@/pages/Auth";
import Books from "@/pages/Books";
import BookDetail from "@/pages/BookDetail";
import EntryForm from "@/pages/EntryForm";
import EntryDetail from "@/pages/EntryDetail";
import NotFound from "@/pages/NotFound";

function App() {
  return (
    <>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<Books />} />
        <Route path="/books/:bookId" element={<BookDetail />} />
        <Route path="/books/:bookId/entries/new" element={<EntryForm />} />
        <Route path="/books/:bookId/entries/:entryId" element={<EntryDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </>
  );
}

export default App;
