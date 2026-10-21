import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { rentalsApi, readersApi } from "@/lib/api";
import { Mail, AlertTriangle } from "lucide-react";

interface OverdueRemindersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface OverdueItem {
  id: string;
  book_title: string;
  renter_name: string;
  reader_id: string | null;
  email: string;
  due: string;
  days_overdue: number;
  has_email: boolean;
}

interface ReaderGroup {
  reader_id: string;
  name: string;
  email: string;
  books: OverdueItem[];
}

const OverdueRemindersDialog = ({ open, onOpenChange }: OverdueRemindersDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<ReaderGroup[]>([]);
  const [unlinked, setUnlinked] = useState<OverdueItem[]>([]);
  const [emailEdits, setEmailEdits] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await rentalsApi.getOverdue();
      const byReader = new Map<string, ReaderGroup>();
      const noReader: OverdueItem[] = [];
      for (const it of items) {
        if (!it.reader_id) { noReader.push(it); continue; }
        const g = byReader.get(it.reader_id);
        if (g) g.books.push(it);
        else byReader.set(it.reader_id, { reader_id: it.reader_id, name: it.renter_name, email: it.email || "", books: [it] });
      }
      const grouped = Array.from(byReader.values()).sort((a, b) => b.books.length - a.books.length);
      setGroups(grouped);
      setUnlinked(noReader);
      // seed email edits with current values
      const seed: Record<string, string> = {};
      grouped.forEach((g) => { seed[g.reader_id] = g.email; });
      setEmailEdits(seed);
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося завантажити прострочені", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const handleSend = async (g: ReaderGroup) => {
    const email = (emailEdits[g.reader_id] || "").trim();
    if (!email) {
      toast({ title: "Вкажіть email", description: "Додайте електронну пошту читача", variant: "destructive" });
      return;
    }
    setSendingId(g.reader_id);
    try {
      // Save the email to the reader first if it changed (adds it when missing).
      if (email !== (g.email || "")) {
        await readersApi.update(g.reader_id, { email });
      }
      const res = await rentalsApi.remindOverdueReader(g.reader_id);
      if (res.sent) {
        toast({ title: "Нагадування надіслано", description: `${g.name} — ${res.email} (${res.books} кн.)` });
        await load();
      } else {
        const reasons: Record<string, string> = {
          no_email: "У читача немає email",
          smtp_not_configured: "Email не налаштовано на сервері",
          no_overdue: "Немає прострочених книг",
          no_reader: "Читача не знайдено",
        };
        toast({ title: "Не надіслано", description: reasons[res.reason || ""] || "Не вдалося надіслати", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося надіслати нагадування", variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const totalOverdue = groups.reduce((n, g) => n + g.books.length, 0) + unlinked.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>Прострочені книги ({totalOverdue})</DialogTitle>
          <DialogDescription>
            Додайте email читача (якщо потрібно) та надішліть нагадування про повернення.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-muted-foreground text-sm py-6 text-center">Завантаження...</p>
        ) : totalOverdue === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">Прострочених книг немає 🎉</p>
        ) : (
          <div className="space-y-3 mt-2">
            {groups.map((g) => (
              <div key={g.reader_id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium min-w-0 break-words">{g.name}</span>
                  <Badge variant="secondary" className="shrink-0">{g.books.length} кн.</Badge>
                </div>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  {g.books.map((b) => (
                    <li key={b.id} className="flex justify-between items-start gap-3">
                      <span className="min-w-0 break-words">{b.book_title}</span>
                      <span className="text-red-600 whitespace-nowrap shrink-0">до {b.due} · {b.days_overdue} дн.</span>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={emailEdits[g.reader_id] ?? ""}
                    onChange={(e) => setEmailEdits((prev) => ({ ...prev, [g.reader_id]: e.target.value }))}
                    className="flex-1 min-w-0"
                  />
                  <Button
                    onClick={() => handleSend(g)}
                    disabled={sendingId === g.reader_id || !(emailEdits[g.reader_id] || "").trim()}
                    className="gap-2 shrink-0"
                  >
                    <Mail className="w-4 h-4" />
                    {sendingId === g.reader_id ? "Надсилання..." : "Надіслати"}
                  </Button>
                </div>
                {!g.email && (
                  <p className="text-xs text-muted-foreground">У цього читача не було email — його буде збережено при надсиланні.</p>
                )}
              </div>
            ))}

            {unlinked.length > 0 && (
              <div className="border rounded-lg p-3 bg-muted/40">
                <div className="flex items-center gap-2 text-sm font-medium mb-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Не прив'язані до читача ({unlinked.length})
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  Ці видачі оформлені без читача, тож нагадування надіслати не можна. Прив'яжіть читача у журналі, щоб додати email.
                </p>
                <ul className="text-sm text-muted-foreground space-y-0.5">
                  {unlinked.map((b) => (
                    <li key={b.id} className="flex justify-between items-start gap-3">
                      <span className="min-w-0 break-words">{b.book_title} — {b.renter_name}</span>
                      <span className="text-red-600 whitespace-nowrap shrink-0">{b.days_overdue} дн.</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OverdueRemindersDialog;
