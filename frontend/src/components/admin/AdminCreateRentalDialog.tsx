import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X, Printer, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { rentalsApi } from "@/lib/api";
import type { Book, ReaderWithChildren } from "@/lib/api-types";
import { computeDueDate, formatDate } from "@/lib/rentals";
import { printHtml, escapeHtml } from "@/lib/print";

interface ChildBooks { childId: string; bookIds: string[] }
interface IssueReceipt {
  readerName: string;
  readerId: string;
  email: string;
  issuedAt: string;
  items: Array<{ rentalId: string; childId: string; childName: string; title: string; author: string; inventory_number: number | null; due: string }>;
}
interface AdminCreateRentalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  books: Book[];
  readers: ReaderWithChildren[];
  onSuccess: () => void;
}

const AdminCreateRentalDialog = ({ open, onOpenChange, books, readers, onSuccess }: AdminCreateRentalDialogProps) => {
  const [groups, setGroups] = useState<ChildBooks[]>([{ childId: "", bookIds: [] }]);
  const [selectedReaderId, setSelectedReaderId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [duration, setDuration] = useState("4");
  const [bookGroup, setBookGroup] = useState<number | null>(null);
  const [childGroup, setChildGroup] = useState<number | null>(null);
  const [bookSearch, setBookSearch] = useState("");
  const [readerPopoverOpen, setReaderPopoverOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<IssueReceipt | null>(null);
  const [issueError, setIssueError] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();
  const selectedReader = readers.find(r => r.id === selectedReaderId);
  const readerChildren = selectedReader?.children || [];
  const selectedBookIds = groups.flatMap(g => g.bookIds);
  const normalizedBookSearch = bookSearch.trim().toLowerCase();
  const isInventorySearch = /^\d+$/.test(normalizedBookSearch);
  const groupedBooks = (() => {
    const result = new Map<string, { book: Book; copies: Book[]; available: boolean }>();
    for (const book of books) {
      if (selectedBookIds.includes(book.id)) continue;
      if (isInventorySearch) {
        if (book.inventory_number?.toString() !== normalizedBookSearch) continue;
      } else if (!`${book.title} ${book.author}`.toLowerCase().includes(normalizedBookSearch)) continue;
      const key = isInventorySearch ? book.id : `${book.title}|||${book.author}`;
      const existing = result.get(key);
      if (existing) {
        existing.copies.push(book);
        if (!existing.available && book.available) existing.book = book;
        if (book.available) existing.available = true;
      } else result.set(key, { book, copies: [book], available: !!book.available });
    }
    return Array.from(result.values());
  })();
  const substringFilter = (value: string, search: string) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
  const getChildAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };
  const childName = (childId: string) => {
    const child = readerChildren.find(c => c.id === childId);
    return child ? `${child.name} ${child.surname}` : "Читач особисто";
  };
  const resetForm = () => {
    setGroups([{ childId: "", bookIds: [] }]);
    setSelectedReaderId("");
    setBookSearch("");
    setBookGroup(null);
    setChildGroup(null);
    setManualName("");
    setManualPhone("");
    setDuration("4");
    setIssueError("");
  };
  const handleReaderChange = (id: string) => {
    setSelectedReaderId(id);
    setGroups([{ childId: "", bookIds: [] }]);
    setBookGroup(null);
    setChildGroup(null);
    setBookSearch("");
    setIssueError("");
  };
  const addBook = (groupIndex: number, bookId: string) => {
    setGroups(prev => prev.map((g, i) => i === groupIndex ? { ...g, bookIds: [...g.bookIds, bookId] } : g));
    setBookSearch("");
    setBookGroup(null);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookIds.length || groups.some(g => !g.bookIds.length || (readerChildren.length > 0 && !g.childId))) {
      toast({ title: "Помилка", description: "Оберіть дитину та додайте книги до кожного списку", variant: "destructive" });
      return;
    }
    const renterName = selectedReader ? `${selectedReader.parent_name} ${selectedReader.parent_surname}` : manualName.trim();
    if (!renterName) {
      toast({ title: "Помилка", description: "Вкажіть ім'я читача", variant: "destructive" });
      return;
    }
    setLoading(true);
    setIssueError("");
    const issuedItems: IssueReceipt["items"] = [];
    let receiptReaderId = selectedReader?.id || "";
    let queuedCount = 0;
    let completedCount = 0;
    try {
      const weeks = parseInt(duration);
      for (const group of groups) {
        for (const bookId of group.bookIds) {
          const book = books.find(b => b.id === bookId);
          if (!book) throw new Error("Книгу не знайдено. Оновіть список книг.");
          const rental = await rentalsApi.issue({
            book_id: bookId, book_title: book.title, renter_name: renterName,
            renter_phone: selectedReader?.phone1 || manualPhone || "не вказано",
            renter_email: selectedReader?.email || "", rental_duration: weeks,
            reader_id: receiptReaderId || undefined, child_id: group.childId || undefined,
          });
          if (rental.status === "pending") {
            throw new Error("Книгу не видано: сервер створив лише запит на оренду. Авторизацію адміністратора не підтверджено. Увійдіть знову та перевірте цей запит у розділі «Запити на оренду» перед повторною видачею.");
          }
          receiptReaderId = rental.reader_id || receiptReaderId;
          if (rental.status === "approved") {
            issuedItems.push({ rentalId: rental.id, childId: group.childId, childName: childName(group.childId),
              title: book.title, author: book.author, inventory_number: book.inventory_number ?? null,
              due: formatDate(computeDueDate(rental.approved_at || new Date().toISOString(), weeks)) });
          } else queuedCount++;
          completedCount++;
          // Successful copies cannot be submitted again after a later request fails.
          setGroups(prev => prev.map(g => ({ ...g, bookIds: g.bookIds.filter(id => id !== bookId) })));
        }
      }
      toast({ title: "Готово", description: `Видано ${issuedItems.length} книг${queuedCount ? `, ${queuedCount} додано в чергу` : ""}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не вдалося створити оренду";
      setIssueError(`Видачу зупинено. Оброблено ${completedCount} із ${selectedBookIds.length}. ${message} Необроблені книги залишилися у списках.`);
      setGroups(prev => {
        const remaining = prev.filter(g => g.bookIds.length > 0);
        return remaining.length ? remaining : [{ childId: "", bookIds: [] }];
      });
    } finally {
      if (completedCount) onSuccess();
      if (issuedItems.length) {
        setReceipt({ readerName: renterName, readerId: receiptReaderId, email: selectedReader?.email?.trim() || "",
          issuedAt: formatDate(new Date()), items: issuedItems });
      } else if (completedCount === selectedBookIds.length) {
        resetForm();
        onOpenChange(false);
      }
      setLoading(false);
    }
  };
  const receiptGroups = receipt ? Array.from(new Set(receipt.items.map(i => i.childId))).map(id => ({
    name: receipt.items.find(i => i.childId === id)!.childName,
    items: receipt.items.filter(i => i.childId === id),
  })) : [];
  const handlePrintReceipt = () => {
    if (!receipt) return;
    const tables = receiptGroups.map(g => `<h2>${escapeHtml(g.name)}</h2><table><thead><tr><th>Назва</th><th>Автор</th><th>Інв. №</th><th>Повернути до</th></tr></thead><tbody>${g.items.map(i =>
      `<tr><td>${escapeHtml(i.title)}</td><td>${escapeHtml(i.author)}</td><td>${escapeHtml(String(i.inventory_number ?? "—"))}</td><td>${escapeHtml(i.due)}</td></tr>`).join("")}</tbody></table>`).join("");
    try {
      printHtml(`Видача — ${receipt.readerName}`, `<div class="header"><div><h1>Видача книг</h1><div class="muted">${escapeHtml(receipt.readerName)}</div></div><div class="muted">${escapeHtml(receipt.issuedAt)}</div></div>${tables}<div class="footer">Дякуємо, що користуєтесь нашою бібліотекою!</div>`);
    } catch { toast({ title: "Не вдалося відкрити друк", description: "Дозвольте спливаючі вікна у браузері", variant: "destructive" }); }
  };
  const handleEmailReceipt = async () => {
    if (!receipt?.email || !receipt.readerId) return;
    setSendingEmail(true);
    try {
      const res = await rentalsApi.sendReceipt({ reader_id: receipt.readerId, rental_ids: receipt.items.map(i => i.rentalId) });
      toast({ title: "Надіслано", description: `Квитанцію надіслано на ${res.email}` });
    } catch (error) {
      toast({ title: "Помилка", description: error instanceof Error ? error.message : "Не вдалося надіслати email", variant: "destructive" });
    } finally { setSendingEmail(false); }
  };
  const close = () => { resetForm(); setReceipt(null); onOpenChange(false); };

  return (
    <Dialog open={open} onOpenChange={o => { if (!loading && !sendingEmail) { if (!o) close(); else onOpenChange(o); } }}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{receipt ? "Книги видано" : "Нова оренда"}</DialogTitle>
          <DialogDescription>{receipt ? "Роздрукуйте або надішліть підтвердження читачу" : "Оберіть читача, дитину та її книги. За потреби додайте іншу дитину."}</DialogDescription>
        </DialogHeader>
        {issueError && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{issueError}</p>}
        {receipt ? (
          <div className="space-y-4 mt-2">
            <div className="rounded-lg border p-3">
              <p className="text-sm text-muted-foreground">Читач</p><p className="font-medium">{receipt.readerName}</p>
              {receiptGroups.map((g, index) => <section key={index} className="mt-3 space-y-1.5">
                <h3 className="font-semibold">{g.name}</h3>
                {g.items.map(i => <div key={i.rentalId} className="flex justify-between items-baseline text-sm gap-3">
                  <span>{i.title}{i.inventory_number != null ? ` [Інв. ${i.inventory_number}]` : ""}</span>
                  <span className="text-muted-foreground whitespace-nowrap">до {i.due}</span>
                </div>)}
              </section>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handlePrintReceipt} className="gap-2"><Printer className="w-4 h-4" /> Друкувати</Button>
              <Button type="button" variant="outline" onClick={handleEmailReceipt} disabled={sendingEmail || !receipt.email}
                title={receipt.email ? `Надіслати на ${receipt.email}` : "У читача не вказано email"} className="gap-2">
                <Mail className="w-4 h-4" /> {sendingEmail ? "Надсилання..." : "Надіслати email"}
              </Button>
              <Button type="button" disabled={sendingEmail} onClick={() => { if (issueError) setReceipt(null); else close(); }} className="flex-1">
                {issueError ? "До необроблених книг" : "Готово"}
              </Button>
            </div>
            {!receipt.email && <p className="text-xs text-muted-foreground">У читача не вказано email — доступний лише друк.</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <fieldset disabled={loading} className="space-y-4">
              <div className="space-y-2">
                <Label>Читач</Label>
                <Popover open={readerPopoverOpen} onOpenChange={setReaderPopoverOpen} modal>
                  <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left">
                    {selectedReader ? `${selectedReader.parent_surname} ${selectedReader.parent_name} — ${selectedReader.phone1}` : selectedReaderId === "__new__" ? "Новий читач (вручну)" : "Оберіть читача..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button></PopoverTrigger>
                  <PopoverContent className="w-[450px] max-w-[90vw] p-0 pointer-events-auto" align="start">
                    <Command filter={substringFilter}><CommandInput placeholder="Пошук читача..." /><CommandList className="max-h-[250px]">
                      <CommandEmpty>Читачів не знайдено</CommandEmpty><CommandGroup>
                        <CommandItem value="__new__ новий читач ввести вручну" onSelect={() => { handleReaderChange("__new__"); setReaderPopoverOpen(false); }}>+ Новий читач (ввести вручну)</CommandItem>
                        {readers.map(reader => <CommandItem key={reader.id} value={`${reader.parent_surname} ${reader.parent_name} ${reader.phone1}`} onSelect={() => { handleReaderChange(reader.id); setReaderPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedReaderId === reader.id ? "opacity-100" : "opacity-0")} />{reader.parent_surname} {reader.parent_name} — {reader.phone1}
                        </CommandItem>)}
                      </CommandGroup></CommandList></Command>
                  </PopoverContent>
                </Popover>
              </div>
              {selectedReaderId === "__new__" && <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2"><Label htmlFor="issue-name">Ім'я читача</Label><Input id="issue-name" value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Ім'я та прізвище" /></div>
                <div className="space-y-2"><Label htmlFor="issue-phone">Телефон</Label><Input id="issue-phone" value={manualPhone} onChange={e => setManualPhone(e.target.value)} /></div>
              </div>}
              {selectedReader && <p className="text-xs text-muted-foreground">{selectedReader.email ? `Email читача: ${selectedReader.email}. Лист буде надіслано лише за кнопкою після видачі.` : "У читача не вказано email — після видачі доступний друк."}</p>}
              {selectedReaderId && groups.map((group, index) => {
                const child = readerChildren.find(c => c.id === group.childId);
                const warnings = child ? group.bookIds.flatMap(id => {
                  const book = books.find(b => b.id === id);
                  const minAge = book?.age?.match(/(\d+)/);
                  const age = getChildAge(child.birth_date);
                  return book && minAge && age < Number(minAge[1]) ? [`«${book.title}» (від ${minAge[1]} р.) — дитині ${age} р.`] : [];
                }) : [];
                return <section key={index} className="space-y-3 rounded-lg border p-3" aria-label={`Список книг ${index + 1}`}>
                  <div className="flex items-center gap-2">
                    {readerChildren.length ? <Popover open={childGroup === index} onOpenChange={o => setChildGroup(o ? index : null)} modal>
                      <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" className="flex-1 justify-between">{child ? childName(child.id) : "Оберіть дитину..."}<ChevronsUpDown className="ml-2 h-4 w-4" /></Button></PopoverTrigger>
                      <PopoverContent className="p-0 pointer-events-auto"><Command filter={substringFilter}><CommandInput placeholder="Пошук дитини..." /><CommandList><CommandEmpty>Дітей не знайдено</CommandEmpty><CommandGroup>
                        {readerChildren.filter(c => c.id === group.childId || !groups.some(g => g.childId === c.id)).map(c => <CommandItem key={c.id} value={`${c.name} ${c.surname}`} onSelect={() => { setGroups(prev => prev.map((g, i) => i === index ? { ...g, childId: c.id } : g)); setChildGroup(null); }}>
                          {c.name} {c.surname}{c.birth_date ? `, ${getChildAge(c.birth_date)} р.` : ""}
                        </CommandItem>)}
                      </CommandGroup></CommandList></Command></PopoverContent>
                    </Popover> : <h3 className="flex-1 font-semibold">Читач особисто</h3>}
                    {groups.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Видалити список дитини" onClick={() => { setGroups(prev => prev.filter((_, i) => i !== index)); setBookGroup(null); setChildGroup(null); }}><X className="h-4 w-4" /></Button>}
                  </div>
                  {group.bookIds.map(id => {
                    const book = books.find(b => b.id === id);
                    return book && <div key={id} className="flex items-center justify-between bg-muted rounded-md px-3 py-1.5 text-sm">
                      <span>{book.title} — {book.author}{book.inventory_number != null ? ` [Інв. ${book.inventory_number}]` : ""}</span>
                      <Button type="button" variant="ghost" size="icon" aria-label={`Прибрати ${book.title}`} className="h-6 w-6 shrink-0" onClick={() => setGroups(prev => prev.map((g, i) => i === index ? { ...g, bookIds: g.bookIds.filter(bid => bid !== id) } : g))}><X className="h-3 w-3" /></Button>
                    </div>;
                  })}
                  {(!readerChildren.length || group.childId) && <div className="space-y-2">
                    <Popover open={bookGroup === index} onOpenChange={o => { setBookGroup(o ? index : null); setBookSearch(""); }} modal>
                      <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">Додати книгу...<ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" /></Button></PopoverTrigger>
                      <PopoverContent className="w-[450px] max-w-[90vw] p-0 pointer-events-auto" align="start"><Command shouldFilter={false}>
                        <CommandInput placeholder="Пошук за назвою, автором або інв. номером..." value={bookSearch} onValueChange={setBookSearch} />
                        <CommandList className="max-h-[250px]"><CommandEmpty>Книг не знайдено</CommandEmpty><CommandGroup>
                          {groupedBooks.flatMap(({ book, copies }) => {
                            const availableCopies = copies.filter(c => c.available);
                            return (availableCopies.length ? availableCopies : [book]).map(copy => <CommandItem key={copy.id} value={copy.id} onSelect={() => addBook(index, copy.id)}>
                              <span className="flex-1">{copy.title} — {copy.author}{copy.inventory_number != null ? ` [Інв. ${copy.inventory_number}]` : " [без інв.]"}</span>
                              {!copy.available && <Badge variant="outline" className="ml-2 text-xs">зайнята</Badge>}
                            </CommandItem>);
                          })}
                        </CommandGroup></CommandList>
                      </Command></PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground">Лише цифри — точний інвентарний номер.</p>
                  </div>}
                  {warnings.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-800"><p className="font-medium">⚠️ Увага: вікове обмеження — {childName(group.childId)}</p>{warnings.map(w => <p key={w}>• {w}</p>)}</div>}
                </section>;
              })}
              {readerChildren.length > groups.length && <Button type="button" variant="outline" disabled={groups.some(g => !g.childId || !g.bookIds.length)} onClick={() => setGroups(prev => [...prev, { childId: "", bookIds: [] }])}>Додати іншу дитину</Button>}
              {selectedBookIds.some(id => !books.find(b => b.id === id)?.available) && <p className="text-sm text-amber-600">Деякі книги недоступні — вони будуть додані в чергу резервацій</p>}
              <div className="space-y-2"><Label>Термін оренди</Label><RadioGroup value={duration} onValueChange={setDuration} className="flex gap-4">
                {[1, 2, 3, 4].map(weeks => <div key={weeks} className="flex items-center space-x-1"><RadioGroupItem value={String(weeks)} id={`adm-w${weeks}`} /><Label htmlFor={`adm-w${weeks}`} className="font-normal cursor-pointer">{weeks} тиж.</Label></div>)}
              </RadioGroup></div>
              <div className="flex gap-3 pt-2"><Button type="button" variant="outline" onClick={close} className="flex-1">Скасувати</Button>
                <Button type="submit" disabled={!selectedBookIds.length || groups.some(g => !g.bookIds.length || (readerChildren.length > 0 && !g.childId))} className="flex-1">{loading ? "Створення..." : `Видати ${selectedBookIds.length} книг`}</Button>
              </div>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
export default AdminCreateRentalDialog;
