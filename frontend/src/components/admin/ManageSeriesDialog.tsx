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
import { seriesApi } from "@/lib/api";

interface ManageSeriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  series?: { id: string; name: string } | null;
  onSuccess: () => void;
}

const ManageSeriesDialog = ({
  open,
  onOpenChange,
  series,
  onSuccess,
}: ManageSeriesDialogProps) => {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (series) {
      setName(series.name);
    } else {
      setName("");
    }
  }, [series, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (series) {
        await seriesApi.update(series.id, { name });

        toast({
          title: "Успішно",
          description: "Серію оновлено",
        });
      } else {
        await seriesApi.create({ name });

        toast({
          title: "Успішно",
          description: "Серію додано",
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
            {series ? "Редагувати серію" : "Додати серію"}
          </DialogTitle>
          <DialogDescription>
            {series ? "Змініть назву серії" : "Введіть назву нової серії"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Назва серії</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад: Гаррі Поттер"
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
              {loading ? "Збереження..." : series ? "Зберегти" : "Додати"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManageSeriesDialog;
