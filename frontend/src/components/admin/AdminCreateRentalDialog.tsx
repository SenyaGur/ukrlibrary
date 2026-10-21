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
import { Check, ChevronsUpDown, X, Printer, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { rentalsApi, readersApi } from "@/lib/api";
import type { Book, ReaderWithChildren } from "@/lib/api-types";
import { computeDueDate, formatDate } from "@/lib/rentals";
import { printHtml, escapeHtml } from "@/lib/print";

interface IssueReceipt {
  readerName: string;
  readerId?: string;
  email: string;
  issuedAt: string;
  items: Array<{ title: string; author: string; inventory_number: number | null; due: string }>;
}

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
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedReaderId, setSelectedReaderId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [email, setEmail] = useState("");
  const [duration, setDuration] = useState("4");
  const [bookPopoverOpen, setBookPopoverOpen] = useState(false);
  const [readerPopoverOpen, setReaderPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<IssueReceipt | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();

  const selectedReader = selectedReaderId && selectedReaderId !== "__new__"
    ? readers.find(r => r.id === selectedReaderId)
    : null;

  const readerChildren = selectedReader?.children || [];

  // Group books by title+author, collect all copies
  const groupedBooks = (() => {
    const groups = new Map<string, { book: Book; copies: Book[]; available: boolean }>();
    for (const book of books) {
      if (selectedBookIds.includes(book.id)) continue;
      const key = `${book.title}|||${book.author}`;
      const existing = groups.get(key);
      if (existing) {
        existing.copies.push(book);
        if (!existing.available && book.available) existing.book = book;
        if (book.available) existing.available = true;
      } else {
        groups.set(key, { book, copies: [book], available: !!book.available });
      }
    }
    return Array.from(groups.values());
  })();

  // Substring filter for cmdk
  const substringFilter = (value: string, search: string) => {
    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
    return 0;
  };

  const parseMinAge = (ageStr: string | null | undefined): number | null => {
    if (!ageStr) return null;
    const match = ageStr.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
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
    setSelectedBookIds([]);
    setSelectedReaderId("");
    setSelectedChildId("");
    setManualName("");
    setManualPhone("");
    setEmail("");
    setDuration("4");
  };

  const handleReaderChange = (readerId: string) => {
    setSelectedReaderId(readerId);
    setSelectedChildId("");
    // Prefill the email from the chosen reader (blank if they have none yet).
    const r = readers.find((x) => x.id === readerId);
    setEmail(r?.email || "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedBookIds.length === 0) {
      toast({ title: "Помилка", description: "Додайте хоча б одну книгу", variant: "destructive" });
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
      const weeks = parseInt(duration);
      const dueStr = formatDate(computeDueDate(new Date().toISOString(), weeks));
      const renterEmail = email.trim();

      // If a reader is selected and an email was entered/changed, save it to the
      // reader so future receipts/reminders can reach them.
      if (selectedReader && renterEmail && renterEmail !== (selectedReader.email || "")) {
        try { await readersApi.update(selectedReader.id, { email: renterEmail }); } catch { /* non-fatal */ }
      }

      let queuedCount = 0;
      const issuedItems: IssueReceipt["items"] = [];
      for (const bookId of selectedBookIds) {
        const book = books.find(b => b.id === bookId);
        if (!book) continue;
        await rentalsApi.create({
          book_id: bookId,
          book_title: book.title,
          renter_name: renterName.trim(),
          renter_phone: renterPhone || "не вказано",
          renter_email: renterEmail,
          rental_duration: weeks,
          reader_id: selectedReader?.id,
          child_id: selectedChildId || undefined,
          auto_approve: true,
        });
        if (book.available) {
          issuedItems.push({ title: book.title, author: book.author, inventory_number: book.inventory_number ?? null, due: dueStr });
        } else {
          queuedCount++;
        }
      }

      let msg = "";
      if (issuedItems.length > 0) msg += `Видано ${issuedItems.length} книг`;
      if (queuedCount > 0) msg += (msg ? ", " : "") + `${queuedCount} додано в чергу`;
      toast({ title: "Готово", description: msg });

      onSuccess();

      if (issuedItems.length > 0) {
        // Keep the dialog open to offer a printable / emailable receipt.
        const newReceipt: IssueReceipt = {
          readerName: renterName.trim(),
          readerId: selectedReader?.id,
          email: renterEmail,
          issuedAt: formatDate(new Date()),
          items: issuedItems,
        };
        resetForm();
        setReceipt(newReceipt);
      } else {
        resetForm();
        onOpenChange(false);
      }
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

  const closeReceipt = () => {
    setReceipt(null);
    resetForm();
    onOpenChange(false);
  };

  const buildReceiptHtml = (r: IssueReceipt): string => {
    const rows = r.items.map((i) =>
      `<tr><td>${escapeHtml(i.title)}</td><td>${escapeHtml(i.author)}</td>` +
      `<td>${i.inventory_number ?? "—"}</td><td>${escapeHtml(i.due)}</td></tr>`
    ).join("");
    return `
      <div class="header"><div><h1>Видача книг</h1><div class="muted">${escapeHtml(r.readerName)}</div></div>
        <div class="muted">${escapeHtml(r.issuedAt)}</div></div>
      <table><thead><tr><th>Назва</th><th>Автор</th><th>Інв. №</th><th>Повернути до</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Дякуємо, що користуєтесь нашою бібліотекою!</div>`;
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    try { printHtml(`Видача — ${receipt.readerName}`, buildReceiptHtml(receipt)); }
    catch { toast({ title: "Не вдалося відкрити друк", description: "Дозвольте спливаючі вікна у браузері", variant: "destructive" }); }
  };

  const handleEmailReceipt = async () => {
    if (!receipt) return;
    if (!receipt.email) { toast({ title: "Немає email", description: "У читача не вказано електронну пошту", variant: "destructive" }); return; }
    setSendingEmail(true);
    try {
      const res = await rentalsApi.sendReceipt({
        reader_id: receipt.readerId,
        email: receipt.email,
        reader_name: receipt.readerName,
        issued_at: receipt.issuedAt,
        items: receipt.items,
      });
      toast({ title: "Надіслано", description: `Квитанцію надіслано на ${res.email}` });
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося надіслати email", variant: "destructive" });
    } finally { setSendingEmail(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { resetForm(); setReceipt(null); } }}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{receipt ? "Книги видано" : "Нова оренда"}</DialogTitle>
          <DialogDescription>
            {receipt ? "Роздрукуйте або надішліть підтвердження читачу" : "Оберіть читача та книги для створення оренди"}
          </DialogDescription>
        </DialogHeader>

        {receipt ? (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Читач</p>
              <p className="font-medium">{receipt.readerName}</p>
              <div className="mt-3 space-y-1.5">
                {receipt.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between items-baseline text-sm gap-3">
                    <span className="min-w-0 flex-1 truncate" title={i.title}>{i.title}{i.inventory_number ? ` [Інв. ${i.inventory_number}]` : ""}</span>
                    <span className="text-muted-foreground whitespace-nowrap shrink-0">до {i.due}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handlePrintReceipt} className="gap-2">
                <Printer className="w-4 h-4" /> Друкувати
              </Button>
              <Button
                type="button" variant="outline" onClick={handleEmailReceipt}
                disabled={sendingEmail || !receipt.email}
                title={receipt.email ? `Надіслати на ${receipt.email}` : "У читача не вказано email"}
                className="gap-2"
              >
                <Mail className="w-4 h-4" /> {sendingEmail ? "Надсилання..." : "Надіслати email"}
              </Button>
              <Button type="button" onClick={closeReceipt} className="flex-1 min-w-[120px]">Готово</Button>
            </div>
            {!receipt.email && (
              <p className="text-xs text-muted-foreground">У читача не вказано email — доступний лише друк.</p>
            )}
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
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

          {/* Email — used for the issue receipt and reminders */}
          <div className="space-y-2">
            <Label>Email <span className="text-xs text-muted-foreground font-normal">— для квитанції та нагадувань</span></Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          {/* Book combobox */}
          <div className="space-y-2">
            <Label>Книги</Label>
            <Popover open={bookPopoverOpen} onOpenChange={setBookPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left"
                >
                  <span className="text-muted-foreground">Додати книгу...</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[450px] p-0 pointer-events-auto" align="start">
                <Command filter={substringFilter}>
                  <CommandInput placeholder="Пошук за назвою, автором або інв. номером..." />
                  <CommandList className="max-h-[250px]">
                    <CommandEmpty>Книг не знайдено</CommandEmpty>
                    <CommandGroup>
                      {groupedBooks.map(({ book, copies, available }) => {
                        const availableCopies = copies.filter(c => c.available);
                        if (copies.length <= 1) {
                          return (
                            <CommandItem
                              key={book.id}
                              value={`${book.title} ${book.author} ${book.inventory_number || ""}`}
                              onSelect={() => {
                                setSelectedBookIds(prev => [...prev, book.id]);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                              <span className="flex-1 truncate">
                                {book.title} — {book.author}
                                {book.inventory_number ? ` [Інв. ${book.inventory_number}]` : ""}
                              </span>
                              {!available && <Badge variant="outline" className="ml-2 text-xs shrink-0">зайнята</Badge>}
                            </CommandItem>
                          );
                        }
                        return availableCopies.length > 0 ? availableCopies.map(copy => (
                          <CommandItem
                            key={copy.id}
                            value={`${copy.title} ${copy.author} ${copy.inventory_number || ""}`}
                            onSelect={() => {
                              setSelectedBookIds(prev => [...prev, copy.id]);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                            <span className="flex-1 truncate">
                              {copy.title} — {copy.author}
                              {copy.inventory_number ? ` [Інв. ${copy.inventory_number}]` : ` [без інв.]`}
                            </span>
                          </CommandItem>
                        )) : (
                          <CommandItem
                            key={book.id}
                            value={`${book.title} ${book.author} ${book.inventory_number || ""}`}
                            onSelect={() => {
                              setSelectedBookIds(prev => [...prev, book.id]);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                            <span className="flex-1 truncate">{book.title} — {book.author}</span>
                            <Badge variant="outline" className="ml-2 text-xs shrink-0">зайнята</Badge>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selected books list */}
          {selectedBookIds.length > 0 && (
            <div className="space-y-1">
              {selectedBookIds.map(id => {
                const book = books.find(b => b.id === id);
                return book ? (
                  <div key={id} className="flex items-center justify-between bg-muted rounded-md px-3 py-1.5 text-sm">
                    <span>{book.title} — {book.author}{book.inventory_number ? ` [Інв. ${book.inventory_number}]` : ""}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedBookIds(prev => prev.filter(bid => bid !== id))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : null;
              })}
            </div>
          )}

          {/* Age restriction warning */}
          {selectedChildId && selectedBookIds.length > 0 && (() => {
            const child = readerChildren.find(c => c.id === selectedChildId);
            if (!child) return null;
            const childAge = getChildAge(child.birth_date);
            const warnings = selectedBookIds.map(id => {
              const book = books.find(b => b.id === id);
              if (!book) return null;
              const minAge = parseMinAge(book.age);
              if (minAge && childAge < minAge) {
                return `"${book.title}" (від ${minAge} р.) — дитині ${childAge} р.`;
              }
              return null;
            }).filter(Boolean);
            if (warnings.length === 0) return null;
            return (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800">
                <p className="font-medium mb-1">⚠️ Увага: вікове обмеження</p>
                {warnings.map((w, i) => <p key={i}>• {w}</p>)}
              </div>
            );
          })()}

          {/* Queue warning for unavailable books */}
          {selectedBookIds.some(id => !books.find(b => b.id === id)?.available) && (
            <p className="text-sm text-amber-600">Деякі книги недоступні — вони будуть додані в чергу резервацій</p>
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
            <Button type="submit" disabled={loading || selectedBookIds.length === 0} className="flex-1">
              {loading ? "Створення..." : `Видати ${selectedBookIds.length} книг`}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AdminCreateRentalDialog;
