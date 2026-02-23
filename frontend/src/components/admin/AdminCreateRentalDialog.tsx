import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { rentalsApi } from "@/lib/api";
import type { Book, ReaderWithChildren } from "@/lib/api-types";

interface AdminCreateRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: Book[];
  readers: ReaderWithChildren[];
  onSuccess: () => void;
}

const AdminCreateRentalDialog = ({
  open,
  onOpenChange,
  books,
  readers,
  onSuccess,
}: AdminCreateRentalDialogProps) => {
  const [selectedBookId, setSelectedBookId] = useState("");
  const [selectedReaderId, setSelectedReaderId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [duration, setDuration] = useState("4");
  const [bookPopoverOpen, setBookPopoverOpen] = useState(false);
  const [readerPopoverOpen, setReaderPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedBook = books.find(b => b.id === selectedBookId);
  const selectedReader = selectedReaderId && selectedReaderId !== "__new__"
    ? readers.find(r => r.id === selectedReaderId)
    : null;

  const readerChildren = selectedReader?.children || [];

  // Group books by title+author, pick one representative (prefer available)
  const groupedBooks = (() => {
    const groups = new Map<string, { book: Book; available: boolean }>();
    for (const book of books) {
      const key = `${book.title}|||${book.author}`;
      const existing = groups.get(key);
      if (existing) {
        if (!existing.available && book.available) existing.book = book;
        if (book.available) existing.available = true;
      } else {
        groups.set(key, { book, available: !!book.available });
      }
    }
    return Array.from(groups.values());
  })();

  // Substring filter for cmdk
  const substringFilter = (value: string, search: string) => {
    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
    return 0;
  };

  const getChildAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  const resetForm = () => {
    setSelectedBookId("");
    setSelectedReaderId("");
    setSelectedChildId("");
    setManualName("");
    setManualPhone("");
    setDuration("4");
  };

  const handleReaderChange = (readerId: string) => {
    setSelectedReaderId(readerId);
    setSelectedChildId("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedBook) {
      toast({ title: "Помилка", description: "Оберіть книгу", variant: "destructive" });
      return;
    }

    const renterName = selectedReader
      ? `${selectedReader.parent_name} ${selectedReader.parent_surname}`
      : manualName;
    const renterPhone = selectedReader ? selectedReader.phone1 : manualPhone;

    if (!renterName.trim()) {
      toast({ title: "Помилка", description: "Вкажіть ім'я читача", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await rentalsApi.create({
        book_id: selectedBook.id,
        book_title: selectedBook.title,
        renter_name: renterName.trim(),
        renter_phone: renterPhone || "не вказано",
        renter_email: "",
        rental_duration: parseInt(duration),
        reader_id: selectedReader?.id,
        child_id: selectedChildId || undefined,
        auto_approve: true,
      });

      const isQueued = !selectedBook.available;
      toast({
        title: isQueued ? "Додано в чергу" : "Оренду створено",
        description: isQueued
          ? `"${selectedBook.title}" недоступна — додано в чергу резервацій`
          : `"${selectedBook.title}" видано читачу ${renterName}`,
      });

      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося створити оренду",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Нова оренда</DialogTitle>
          <DialogDescription>Оберіть книгу та читача для створення оренди</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Book combobox */}
          <div className="space-y-2">
            <Label>Книга</Label>
            <Popover open={bookPopoverOpen} onOpenChange={setBookPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left"
                >
                  {selectedBook
                    ? <span>{selectedBook.title} — {selectedBook.author}</span>
                    : <span className="text-muted-foreground">Оберіть книгу...</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0 pointer-events-auto" align="start">
                <Command filter={substringFilter}>
                  <CommandInput placeholder="Пошук книги..." />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty>Книг не знайдено</CommandEmpty>
                    <CommandGroup>
                      {groupedBooks.map(({ book, available }) => (
                        <CommandItem
                          key={book.id}
                          value={`${book.title} ${book.author}`}
                          onSelect={() => {
                            setSelectedBookId(book.id);
                            setBookPopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedBookId === book.id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{book.title} — {book.author}</span>
                          {!available && <Badge variant="outline" className="ml-2 text-xs shrink-0">зайнята</Badge>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selectedBook && !selectedBook.available && (
              <p className="text-sm text-amber-600">Книга зараз недоступна — буде додано в чергу резервацій</p>
            )}
          </div>

          {/* Reader combobox */}
          <div className="space-y-2">
            <Label>Читач</Label>
            <Popover open={readerPopoverOpen} onOpenChange={setReaderPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left"
                >
                  {selectedReader
                    ? <span>{selectedReader.parent_surname} {selectedReader.parent_name} — {selectedReader.phone1}</span>
                    : selectedReaderId === "__new__"
                    ? <span>Новий читач (вручну)</span>
                    : <span className="text-muted-foreground">Оберіть читача...</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0 pointer-events-auto" align="start">
                <Command filter={substringFilter}>
                  <CommandInput placeholder="Пошук читача..." />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty>Читачів не знайдено</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="__new__ новий читач ввести вручну"
                        onSelect={() => {
                          handleReaderChange("__new__");
                          setReaderPopoverOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedReaderId === "__new__" ? "opacity-100" : "opacity-0")} />
                        + Новий читач (ввести вручну)
                      </CommandItem>
                      {readers.map((reader) => (
                        <CommandItem
                          key={reader.id}
                          value={`${reader.parent_surname} ${reader.parent_name} ${reader.phone1}`}
                          onSelect={() => {
                            handleReaderChange(reader.id);
                            setReaderPopoverOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedReaderId === reader.id ? "opacity-100" : "opacity-0")} />
                          {reader.parent_surname} {reader.parent_name} — {reader.phone1}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Manual name/phone when "new reader" or nothing selected */}
          {(selectedReaderId === "__new__" || selectedReaderId === "") && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Ім'я читача</Label>
                <Input
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Ім'я та прізвище"
                />
              </div>
              <div className="space-y-2">
                <Label>Телефон</Label>
                <Input
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="+380..."
                />
              </div>
            </div>
          )}

          {/* Selected reader info + child selector */}
          {selectedReader && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground bg-muted rounded-md p-3">
                {selectedReader.parent_name} {selectedReader.parent_surname} — {selectedReader.phone1}
                {selectedReader.address && selectedReader.address !== "не вказано" && ` (${selectedReader.address})`}
              </div>

              {readerChildren.length > 0 && (
                <div className="space-y-2">
                  <Label>Дитина</Label>
                  <Select value={selectedChildId || "none"} onValueChange={(v) => setSelectedChildId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Оберіть дитину..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— без вибору —</SelectItem>
                      {readerChildren.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {child.name} {child.surname}{child.birth_date ? `, ${getChildAge(child.birth_date)} р.` : ""}
                          {child.gender ? ` (${child.gender})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label>Термін оренди</Label>
            <RadioGroup value={duration} onValueChange={setDuration} className="flex gap-4">
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="1" id="adm-w1" />
                <Label htmlFor="adm-w1" className="font-normal cursor-pointer">1 тиж.</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="2" id="adm-w2" />
                <Label htmlFor="adm-w2" className="font-normal cursor-pointer">2 тиж.</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="3" id="adm-w3" />
                <Label htmlFor="adm-w3" className="font-normal cursor-pointer">3 тиж.</Label>
              </div>
              <div className="flex items-center space-x-1">
                <RadioGroupItem value="4" id="adm-w4" />
                <Label htmlFor="adm-w4" className="font-normal cursor-pointer">4 тиж.</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Скасувати
            </Button>
            <Button type="submit" disabled={loading || !selectedBookId} className="flex-1">
              {loading ? "Створення..." : selectedBook && !selectedBook.available ? "Додати в чергу" : "Видати книгу"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AdminCreateRentalDialog;
