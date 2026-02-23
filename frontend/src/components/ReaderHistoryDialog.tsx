import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { readersApi, rentalsApi } from "@/lib/api";
import type { RentalHistory } from "@/lib/api-types";
import { Calendar, BookOpen, Clock } from "lucide-react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";

interface ReaderHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readerId: string;
}

const ReaderHistoryDialog = ({ open, onOpenChange, readerId }: ReaderHistoryDialogProps) => {
  const [history, setHistory] = useState<RentalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [readerInfo, setReaderInfo] = useState<{ parent_name: string; parent_surname: string } | null>(null);

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
      setReaderInfo({ parent_name: reader.parent_name, parent_surname: reader.parent_surname });

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Історія орендувань</DialogTitle>
          <DialogDescription>
            {readerInfo && `${readerInfo.parent_surname} ${readerInfo.parent_name}`}
          </DialogDescription>
        </DialogHeader>

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
