import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableRow, TableCell } from "@/components/ui/table";
import { CheckCircle, XCircle, RotateCcw, Mail, User } from "lucide-react";
import type { Book } from "@/lib/api-types";
import { formatDueDate, isOverdue } from "@/lib/rentals";
import { cn } from "@/lib/utils";

interface RentalRequest {
  id: string;
  book_id: string;
  book_title: string;
  renter_name: string;
  renter_phone: string;
  renter_email: string;
  rental_duration: number;
  status: string;
  queue_position?: number | null;
  reader_id?: string | null;
  requested_at: string;
  approved_at?: string | null;
}

interface RentalRequestCardProps {
  request: RentalRequest;
  bookMap: Map<string, Book>;
  onApprove?: () => void;
  onDecline?: () => void;
  onReturn?: () => void;
  onSendReminder?: () => void;
  onReaderClick?: (readerId: string) => void;
  onBookClick?: (bookTitle: string) => void;
  onReassign?: () => void;
}

const RentalRequestCard = ({ request, bookMap, onApprove, onDecline, onReturn, onSendReminder, onReaderClick, onBookClick, onReassign }: RentalRequestCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const book = bookMap.get(request.book_id);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="text-xs">Очікує</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500 text-xs">Схвалено</Badge>;
      case "declined":
        return <Badge variant="destructive" className="text-xs">Відхилено</Badge>;
      case "returned":
        return <Badge variant="secondary" className="text-xs">Повернено</Badge>;
      case "queued":
        return <Badge variant="outline" className="text-xs">В черзі #{request.queue_position}</Badge>;
      default:
        return <Badge variant="secondary" className="text-xs">{status}</Badge>;
    }
  };

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-sm">
        {formatDate(request.approved_at || request.requested_at)}
        {request.status === "approved" && request.approved_at && (
          <div
            className={cn(
              "text-xs",
              isOverdue(request.approved_at, request.rental_duration, null)
                ? "text-red-600 font-semibold"
                : "text-muted-foreground",
            )}
          >
            Повернути до {formatDueDate(request.approved_at, request.rental_duration)}
            {isOverdue(request.approved_at, request.rental_duration, null) ? " · прострочено" : ""}
          </div>
        )}
      </TableCell>
      <TableCell className="text-sm font-medium">
        {onBookClick ? (
          <button
            className="text-primary hover:underline text-left"
            onClick={() => onBookClick(request.book_title)}
          >
            {request.book_title}
          </button>
        ) : (
          request.book_title
        )}
      </TableCell>
      <TableCell className="text-sm">{book?.series?.name || "—"}</TableCell>
      <TableCell className="text-sm max-w-[150px] truncate" title={book?.author}>{book?.author || "—"}</TableCell>
      <TableCell className="text-sm">
        {request.reader_id && onReaderClick ? (
          <button
            className="text-primary hover:underline text-left"
            onClick={() => onReaderClick(request.reader_id!)}
          >
            {request.renter_name}
          </button>
        ) : (
          request.renter_name
        )}
      </TableCell>
      <TableCell>{getStatusBadge(request.status)}</TableCell>
      <TableCell>
        <div className="flex gap-1">
          {onApprove && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onApprove} title="Схвалити">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </Button>
          )}
          {onReturn && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onReturn} title="Повернути">
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
          {onDecline && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onDecline} title="Відхилити">
              <XCircle className="w-4 h-4 text-red-500" />
            </Button>
          )}
          {onSendReminder && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onSendReminder} title="Нагадування">
              <Mail className="w-4 h-4" />
            </Button>
          )}
          {onReassign && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onReassign} title="Перепризначити читача">
              <User className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default RentalRequestCard;
