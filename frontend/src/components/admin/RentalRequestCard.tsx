import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Mail, Calendar, User, Phone, BookOpen, RotateCcw } from "lucide-react";

interface RentalRequest {
  id: string;
  book_title: string;
  renter_name: string;
  renter_phone: string;
  renter_email: string;
  rental_duration: number;
  status: string;
  queue_position?: number | null;
  requested_at: string;
}

interface RentalRequestCardProps {
  request: RentalRequest;
  onApprove?: () => void;
  onDecline?: () => void;
  onReturn?: () => void;
  onSendReminder?: () => void;
}

const RentalRequestCard = ({ request, onApprove, onDecline, onReturn, onSendReminder }: RentalRequestCardProps) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge>Очікує</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500">Схвалено</Badge>;
      case "declined":
        return <Badge variant="destructive">Відхилено</Badge>;
      case "returned":
        return <Badge variant="secondary">Повернено</Badge>;
      case "queued":
        return <Badge variant="outline">В черзі #{request.queue_position}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-semibold">{request.book_title}</h4>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span>{formatDate(request.requested_at)}</span>
            </div>
          </div>
          {getStatusBadge(request.status)}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>{request.renter_name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span>{request.renter_phone}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{request.renter_email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>Термін: {request.rental_duration} {request.rental_duration === 1 ? "тиждень" : "тижні"}</span>
          </div>
        </div>

        {(onApprove || onDecline || onReturn || onSendReminder) && (
          <div className="flex gap-2 pt-2">
            {onApprove && (
              <Button size="sm" onClick={onApprove} className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Схвалити
              </Button>
            )}
            {onReturn && (
              <Button size="sm" variant="outline" onClick={onReturn} className="gap-2">
                <RotateCcw className="w-4 h-4" />
                Повернути
              </Button>
            )}
            {onDecline && (
              <Button size="sm" variant="outline" onClick={onDecline} className="gap-2">
                <XCircle className="w-4 h-4" />
                Відхилити
              </Button>
            )}
            {onSendReminder && (
              <Button size="sm" variant="secondary" onClick={onSendReminder} className="gap-2">
                <Mail className="w-4 h-4" />
                Нагадування
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default RentalRequestCard;
