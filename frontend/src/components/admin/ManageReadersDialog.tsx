import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { readersApi } from "@/lib/api";
import type { ReaderWithChildren, Child } from "@/lib/api-types";
import { Plus, Trash2 } from "lucide-react";

interface ChildFormData {
  id?: string;
  name: string;
  surname: string;
  birth_date: string;
  gender: string;
  _isNew?: boolean;
  _deleted?: boolean;
}

interface ManageReadersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reader?: ReaderWithChildren | null;
  onSuccess: () => void;
}

const ManageReadersDialog = ({
  open,
  onOpenChange,
  reader,
  onSuccess,
}: ManageReadersDialogProps) => {
  const [parentName, setParentName] = useState("");
  const [parentSurname, setParentSurname] = useState("");
  const [phone1, setPhone1] = useState("");
  const [phone2, setPhone2] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [comment, setComment] = useState("");
  const [children, setChildren] = useState<ChildFormData[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (reader) {
      setParentName(reader.parent_name);
      setParentSurname(reader.parent_surname);
      setPhone1(reader.phone1);
      setPhone2(reader.phone2 || "");
      setEmail(reader.email || "");
      setAddress(reader.address);
      setComment(reader.comment || "");
      setChildren(
        (reader.children || []).map((c) => ({
          id: c.id,
          name: c.name,
          surname: c.surname,
          birth_date: c.birth_date,
          gender: c.gender || "",
        }))
      );
    } else {
      setParentName("");
      setParentSurname("");
      setPhone1("");
      setPhone2("");
      setEmail("");
      setAddress("");
      setComment("");
      setChildren([]);
    }
  }, [reader, open]);

  const addChildRow = () => {
    setChildren([...children, { name: "", surname: "", birth_date: "", gender: "", _isNew: true }]);
  };

  const updateChildRow = (index: number, field: keyof ChildFormData, value: string) => {
    setChildren(children.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const removeChildRow = (index: number) => {
    const child = children[index];
    if (child.id && !child._isNew) {
      // Mark existing child for deletion
      setChildren(children.map((c, i) => i === index ? { ...c, _deleted: true } : c));
    } else {
      // Remove new (unsaved) child row
      setChildren(children.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        parent_name: parentName,
        parent_surname: parentSurname,
        phone1,
        phone2: phone2 || undefined,
        email: email || "",
        address,
        comment: comment || "",
      };

      if (reader) {
        // Update reader info
        await readersApi.update(reader.id, data);

        // Handle children changes
        const visibleChildren = children.filter((c) => !c._deleted);
        const deletedChildren = children.filter((c) => c._deleted && c.id);

        // Delete removed children
        for (const child of deletedChildren) {
          await readersApi.deleteChild(reader.id, child.id!);
        }

        // Add new children
        for (const child of visibleChildren.filter((c) => c._isNew)) {
          if (child.name.trim() && child.birth_date) {
            await readersApi.addChild(reader.id, {
              name: child.name.trim(),
              surname: child.surname.trim(),
              birth_date: child.birth_date,
              gender: child.gender,
            });
          }
        }

        // Update existing children
        const originalChildren = reader.children || [];
        for (const child of visibleChildren.filter((c) => c.id && !c._isNew)) {
          const original = originalChildren.find((o) => o.id === child.id);
          if (
            original &&
            (original.name !== child.name ||
              original.surname !== child.surname ||
              original.birth_date !== child.birth_date ||
              original.gender !== child.gender)
          ) {
            await readersApi.updateChild(reader.id, child.id!, {
              name: child.name.trim(),
              surname: child.surname.trim(),
              birth_date: child.birth_date,
              gender: child.gender,
            });
          }
        }

        toast({
          title: "Успішно",
          description: "Дані читача оновлено",
        });
      } else {
        // Create new reader with children
        const newChildren = children
          .filter((c) => !c._deleted && c.name.trim() && c.birth_date)
          .map((c) => ({
            name: c.name.trim(),
            surname: c.surname.trim(),
            birth_date: c.birth_date,
            gender: c.gender,
          }));

        await readersApi.create({ ...data, phone2: phone2 || undefined, children: newChildren });
        toast({
          title: "Успішно",
          description: "Читача додано",
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

  const visibleChildren = children.filter((c) => !c._deleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reader ? "Редагувати читача" : "Додати читача"}
          </DialogTitle>
          <DialogDescription>
            {reader ? "Змініть дані читача" : "Введіть дані нового читача"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="parentName">Ім'я</Label>
              <Input
                id="parentName"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="Ім'я"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parentSurname">Прізвище</Label>
              <Input
                id="parentSurname"
                value={parentSurname}
                onChange={(e) => setParentSurname(e.target.value)}
                placeholder="Прізвище"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone1">Телефон 1</Label>
              <Input
                id="phone1"
                value={phone1}
                onChange={(e) => setPhone1(e.target.value)}
                placeholder="+380..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone2">Телефон 2</Label>
              <Input
                id="phone2"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value)}
                placeholder="+359..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Адреса / район</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Район або адреса"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Коментар</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Коментар або примітки"
              rows={2}
            />
          </div>

          {/* Children section */}
          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Діти</Label>
              <Button type="button" variant="outline" size="sm" onClick={addChildRow} className="gap-1">
                <Plus className="w-3 h-3" />
                Додати дитину
              </Button>
            </div>

            {visibleChildren.length === 0 && (
              <p className="text-sm text-muted-foreground">Немає дітей</p>
            )}

            {visibleChildren.map((child, visIdx) => {
              const realIdx = children.indexOf(child);
              return (
                <div key={child.id || `new-${visIdx}`} className="grid grid-cols-[1fr_1fr_120px_110px_36px] gap-2 items-end">
                  <div className="space-y-1">
                    {visIdx === 0 && <Label className="text-xs">Ім'я</Label>}
                    <Input
                      value={child.name}
                      onChange={(e) => updateChildRow(realIdx, "name", e.target.value)}
                      placeholder="Ім'я"
                    />
                  </div>
                  <div className="space-y-1">
                    {visIdx === 0 && <Label className="text-xs">Прізвище</Label>}
                    <Input
                      value={child.surname}
                      onChange={(e) => updateChildRow(realIdx, "surname", e.target.value)}
                      placeholder="Прізвище"
                    />
                  </div>
                  <div className="space-y-1">
                    {visIdx === 0 && <Label className="text-xs">Дата нар.</Label>}
                    <Input
                      type="date"
                      value={child.birth_date}
                      onChange={(e) => updateChildRow(realIdx, "birth_date", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    {visIdx === 0 && <Label className="text-xs">Стать</Label>}
                    <Select
                      value={child.gender || "none"}
                      onValueChange={(v) => updateChildRow(realIdx, "gender", v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        <SelectItem value="хлопчик">хлопчик</SelectItem>
                        <SelectItem value="дівчинка">дівчинка</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 text-destructive hover:text-destructive"
                    onClick={() => removeChildRow(realIdx)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
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
              {loading ? "Збереження..." : reader ? "Зберегти" : "Додати"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ManageReadersDialog;
