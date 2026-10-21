import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { readersApi, rentalsApi } from "@/lib/api";
import type { RentalHistory } from "@/lib/api-types";
import { Calendar, BookOpen, Clock, Printer, Mail } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { computeDueDate, isOverdue, formatDate as fmtDue, parseServerDate } from "@/lib/rentals";
import { cn } from "@/lib/utils";
import { printHtml, escapeHtml } from "@/lib/print";
import { useToast } from "@/hooks/use-toast";

const STATUS_UK: Record<string, string> = {
  approved: "На руках", returned: "Повернено", pending: "Очікує",
  declined: "Відхилено", queued: "У черзі",
};

interface ReaderHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readerId: string;
}

const ReaderHistoryDialog = ({ open, onOpenChange, readerId }: ReaderHistoryDialogProps) => {
  const [history, setHistory] = useState<RentalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [readerInfo, setReaderInfo] = useState<{ parent_name: string; parent_surname: string; email: string } | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && readerId) {
      fetchHistory();
    }
  }, [open, readerId]);

  const fetchHistory = async () => {
    setLoading(true);

    try {
      // Завантажуємо інформацію про читача (з дітьми)
      const reader = await readersApi.get(readerId);
      setReaderInfo({ parent_name: reader.parent_name, parent_surname: reader.parent_surname, email: reader.email || "" });

      // Завантажуємо історію орендувань
      const rentals = await rentalsApi.getByReader(readerId);

      // child_name already comes from the API for RentalHistory
      setHistory(rentals);
    } catch (error) {
      console.error("Помилка завантаження історії:", error);
    }

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Очікує</Badge>;
      case "approved":
        return <Badge variant="default">Підтверджено</Badge>;
      case "rejected":
        return <Badge variant="destructive">Відхилено</Badge>;
      case "returned":
        return <Badge>Повернено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const readerName = readerInfo ? `${readerInfo.parent_surname} ${readerInfo.parent_name}` : "";

  const buildReportHtml = (): string => {
    const active = history.filter((r) => r.status === "approved" && !r.return_date);
    const activeRows = active.length
      ? active.map((r) => {
          const overdue = isOverdue(r.approved_at, r.rental_duration, r.return_date);
          return `<tr><td>${escapeHtml(r.book_title)}</td><td>${escapeHtml(fmtDue(parseServerDate(r.approved_at)))}</td>` +
            `<td class="${overdue ? "overdue" : ""}">${escapeHtml(fmtDue(computeDueDate(r.approved_at, r.rental_duration)))}${overdue ? " (прострочено)" : ""}</td></tr>`;
        }).join("")
      : `<tr><td colspan="3" class="muted">Немає книг на руках</td></tr>`;
    const histRows = history.length
      ? history.map((r) =>
          `<tr><td>${escapeHtml(r.book_title)}</td><td>${escapeHtml(fmtDue(parseServerDate(r.requested_at)))}</td>` +
          `<td>${escapeHtml(STATUS_UK[r.status] || r.status)}</td>` +
          `<td>${r.return_date ? escapeHtml(fmtDue(parseServerDate(r.return_date))) : "—"}</td></tr>`
        ).join("")
      : `<tr><td colspan="4" class="muted">Історія порожня</td></tr>`;
    return `
      <div class="header"><div><h1>Довідка читача</h1><div class="muted">${escapeHtml(readerName)}</div></div>
        <div class="muted">${escapeHtml(fmtDue(new Date()))}</div></div>
      <h2>Книги на руках</h2>
      <table><thead><tr><th>Назва</th><th>Видано</th><th>Повернути до</th></tr></thead><tbody>${activeRows}</tbody></table>
      <h2>Історія читання</h2>
      <table><thead><tr><th>Назва</th><th>Дата запиту</th><th>Статус</th><th>Повернено</th></tr></thead><tbody>${histRows}</tbody></table>
      <div class="footer">Бібліотека</div>`;
  };

  const handlePrint = () => {
    try {
      printHtml(`Довідка читача — ${readerName}`, buildReportHtml());
    } catch {
      toast({ title: "Не вдалося відкрити друк", description: "Дозвольте спливаючі вікна у браузері", variant: "destructive" });
    }
  };

  const handleEmail = async () => {
    if (!readerInfo?.email) {
      toast({ title: "Немає email", description: "У читача не вказано електронну пошту", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      const res = await readersApi.sendReport(readerId);
      toast({ title: "Надіслано", description: `Довідку надіслано на ${res.email}` });
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося надіслати email", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Історія орендувань</DialogTitle>
          <DialogDescription>
            {readerName}
          </DialogDescription>
        </DialogHeader>

        {!loading && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" /> Друкувати
            </Button>
            <Button
              variant="outline" size="sm" onClick={handleEmail}
              disabled={sendingEmail || !readerInfo?.email}
              title={readerInfo?.email ? `Надіслати на ${readerInfo.email}` : "У читача не вказано email"}
              className="gap-2"
            >
              <Mail className="w-4 h-4" /> {sendingEmail ? "Надсилання..." : "Надіслати на пошту"}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Завантаження...
          </div>
        ) : history.length > 0 ? (
          <div className="space-y-4 mt-4">
            {history.map((rental) => (
              <div key={rental.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <BookOpen className="w-5 h-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{rental.book_title}</h4>
                      {rental.child_name && (
                        <p className="text-sm text-muted-foreground">Для: {rental.child_name}</p>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(rental.status)}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(new Date(rental.requested_at), "d MMMM yyyy", { locale: uk })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>{rental.rental_duration} {rental.rental_duration === 1 ? "тиждень" : "тижні"}</span>
                  </div>
                </div>

                {rental.approved_at && (
                  <div className="text-sm text-muted-foreground border-t pt-2">
                    Підтверджено: {format(new Date(rental.approved_at), "d MMMM yyyy", { locale: uk })}
                  </div>
                )}

                {rental.status === "approved" && !rental.return_date && rental.approved_at && (() => {
                  const due = computeDueDate(rental.approved_at, rental.rental_duration);
                  const overdue = isOverdue(rental.approved_at, rental.rental_duration, rental.return_date);
                  return due ? (
                    <div className={cn("text-sm border-t pt-2", overdue ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                      Очікуване повернення: {format(due, "d MMMM yyyy", { locale: uk })}{overdue ? " · прострочено" : ""}
                    </div>
                  ) : null;
                })()}

                {rental.return_date && (
                  <div className="text-sm text-muted-foreground border-t pt-2">
                    Повернено: {format(new Date(rental.return_date), "d MMMM yyyy", { locale: uk })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Історія орендувань порожня</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ReaderHistoryDialog;
