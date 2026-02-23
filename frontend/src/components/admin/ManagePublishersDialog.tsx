import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { publishersApi } from "@/lib/api";

interface ManagePublishersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publisher?: { id: string; name: string; city: string } | null;
  onSuccess: () => void;
}

const ManagePublishersDialog = ({
  open,
  onOpenChange,
  publisher,
  onSuccess,
}: ManagePublishersDialogProps) => {
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (publisher) {
      setName(publisher.name);
      setCity(publisher.city);
    } else {
      setName("");
      setCity("");
    }
  }, [publisher, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (publisher) {
        await publishersApi.update(publisher.id, { name, city });

        toast({
          title: "Успішно",
          description: "Видавництво оновлено",
        });
      } else {
        await publishersApi.create({ name, city });

        toast({
          title: "Успішно",
          description: "Видавництво додано",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {publisher ? "Редагувати видавництво" : "Додати видавництво"}
          </DialogTitle>
          <DialogDescription>
            {publisher ? "Змініть дані видавництва" : "Введіть дані нового видавництва"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Назва видавництва</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад: А-БА-БА-ГА-ЛА-МА-ГА"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Місто</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Наприклад: Київ"
              required
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Скасувати
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Збереження..." : publisher ? "Зберегти" : "Додати"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManagePublishersDialog;
