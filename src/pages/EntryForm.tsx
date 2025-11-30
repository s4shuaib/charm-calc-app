import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar as CalendarIcon, Clock, Settings, Image as ImageIcon, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calculator } from "@/components/Calculator";

const PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Card", "Cheque", "Other"];
const CATEGORIES = ["Uncategorized", "Food", "Transport", "Shopping", "Bills", "Salary", "Business", "Other"];

const EntryForm = () => {
  const { bookId, entryId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get("type") === "cash_out" ? "cash_out" : "cash_in") as "cash_in" | "cash_out";

  const [type, setType] = useState<"cash_in" | "cash_out">(initialType);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [category, setCategory] = useState("Uncategorized");
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [entryTime, setEntryTime] = useState(format(new Date(), "HH:mm"));
  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (entryId && entryId !== "new") {
      setIsEditMode(true);
      fetchEntry();
    }
  }, [entryId]);

  const fetchEntry = async () => {
    try {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("id", entryId)
        .single();

      if (error) throw error;

      setType(data.type as "cash_in" | "cash_out");
      setAmount(data.amount.toString());
      setRemark(data.remark || "");
      setPaymentMode(data.payment_mode);
      setCategory(data.category);
      setEntryDate(data.entry_date);
      setEntryTime(data.entry_time);
      const attachments = Array.isArray(data.attachments) ? data.attachments : [];
      setExistingAttachments(attachments);
    } catch (error: any) {
      toast.error("Failed to load entry");
      navigate(`/books/${bookId}`);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];
    const previews: string[] = [];

    files.forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 5MB`);
        return;
      }
      validFiles.push(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        previews.push(reader.result as string);
        if (previews.length === validFiles.length) {
          setImagePreviews(prev => [...prev, ...previews]);
        }
      };
      reader.readAsDataURL(file);
    });

    setImageFiles(prev => [...prev, ...validFiles]);
  };

  const handleAddImageUrl = () => {
    if (imageUrl.trim()) {
      setExistingAttachments(prev => [...prev, { url: imageUrl, type: 'url' }]);
      setImageUrl("");
      toast.success("Image URL added");
    }
  };

  const handleRemoveImage = (index: number, isPreview: boolean) => {
    if (isPreview) {
      setImageFiles(prev => prev.filter((_, i) => i !== index));
      setImagePreviews(prev => prev.filter((_, i) => i !== index));
    } else {
      setExistingAttachments(prev => prev.filter((_, i) => i !== index));
    }
  };

  const uploadImage = async (file: File, userId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}_${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('entry-attachments')
      .upload(fileName, file);

    if (uploadError) throw uploadError;
    return fileName;
  };

  const handleSubmit = async (e: React.FormEvent, addAnother = false) => {
    e.preventDefault();

    if (amount === "" || Number(amount) < 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload new images
      const uploadedUrls = await Promise.all(
        imageFiles.map(file => uploadImage(file, user.id))
      );

      // Combine existing attachments with newly uploaded ones
      const allAttachments = [
        ...existingAttachments,
        ...uploadedUrls.map(url => ({ url, type: 'upload' }))
      ];

      const entryData = {
        book_id: bookId,
        user_id: user.id,
        amount: Number(amount),
        type,
        remark,
        payment_mode: paymentMode,
        category,
        entry_date: entryDate,
        entry_time: entryTime,
        attachments: allAttachments,
      };

      if (isEditMode) {
        const { error } = await supabase
          .from("entries")
          .update(entryData)
          .eq("id", entryId);

        if (error) throw error;
        toast.success("Entry updated successfully");
      } else {
        const { error } = await supabase.from("entries").insert(entryData);
        if (error) throw error;
        toast.success("Entry added successfully");
      }

      if (addAnother && !isEditMode) {
        // Reset form for new entry
        setAmount("");
        setRemark("");
        setEntryDate(format(new Date(), "yyyy-MM-dd"));
        setEntryTime(format(new Date(), "HH:mm"));
        setImageFiles([]);
        setImagePreviews([]);
        setImageUrl("");
        setExistingAttachments([]);
      } else {
        navigate(`/books/${bookId}`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save entry");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/books/${bookId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-semibold text-success">
              {isEditMode ? "Edit" : `Add Cash ${type === "cash_in" ? "In" : "Out"} Entry`}
            </h1>
          </div>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Form */}
      <div className="p-4">
        <form className="space-y-4">
          {/* Type Tabs */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "cash_in" ? "default" : "outline"}
              className={type === "cash_in" ? "flex-1 bg-success/10 text-success border-success hover:bg-success/20" : "flex-1"}
              onClick={() => setType("cash_in")}
            >
              Cash In
            </Button>
            <Button
              type="button"
              variant={type === "cash_out" ? "default" : "outline"}
              className="flex-1"
              onClick={() => setType("cash_out")}
            >
              Cash Out
            </Button>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Input
                type="time"
                value={entryTime}
                onChange={(e) => setEntryTime(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          {/* Amount */}
          <div>
            <Label>Amount</Label>
            <div 
              onClick={() => setShowCalculator(true)}
              className="cursor-pointer"
            >
              <Input
                type="text"
                placeholder="0"
                value={amount}
                readOnly
                className="text-xl font-semibold"
              />
            </div>
            {amount && (
              <div className="mt-1 text-xl font-semibold text-primary">
                = {Number(amount).toLocaleString()}
              </div>
            )}
          </div>

          {/* Remark */}
          <div>
            <Label>Remark</Label>
            <Textarea
              placeholder="Add a note..."
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              rows={3}
            />
          </div>

          {/* Image Attachments */}
          <div className="space-y-3">
            <Label>Attach Images (Optional)</Label>
            
            {/* Image URL Input */}
            <div className="flex gap-2">
              <Input
                placeholder="Paste image URL"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddImageUrl}
                disabled={!imageUrl.trim()}
              >
                Add URL
              </Button>
            </div>

            {/* Upload Button */}
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <Label htmlFor="image-upload" className="cursor-pointer">
                <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload images (Max 5MB each)
                </p>
              </Label>
            </div>

            {/* Image Previews */}
            <div className="grid grid-cols-2 gap-2">
              {imagePreviews.map((preview, index) => (
                <div key={`preview-${index}`} className="relative">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => handleRemoveImage(index, true)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              {existingAttachments.map((attachment, index) => (
                <div key={`existing-${index}`} className="relative">
                  <img
                    src={
                      attachment.type === 'url'
                        ? attachment.url
                        : supabase.storage.from('entry-attachments').getPublicUrl(attachment.url).data.publicUrl
                    }
                    alt={`Attachment ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => handleRemoveImage(index, false)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Mode */}
          <div>
            <Label>Payment Mode</Label>
            <div className="flex gap-2">
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {mode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Category */}
          <div>
            <Label>Category</Label>
            <div className="flex gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            {!isEditMode && (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => handleSubmit(e, true)}
                disabled={isLoading}
                className="flex-1"
              >
                SAVE & ADD NEW
              </Button>
            )}
            <Button
              type="button"
              onClick={(e) => handleSubmit(e, false)}
              disabled={isLoading}
              className="flex-1"
            >
              {isEditMode ? "SAVE CHANGES" : "SAVE"}
            </Button>
          </div>
        </form>
      </div>

      {/* Calculator Modal */}
      {showCalculator && (
        <Calculator
          value={amount}
          onChange={(value) => setAmount(value)}
          onClose={() => setShowCalculator(false)}
        />
      )}
    </div>
  );
};

export default EntryForm;
