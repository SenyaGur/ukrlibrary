import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { readersApi } from "@/lib/api";
import { z } from "zod";
import { Plus, Trash2 } from "lucide-react";

interface RegisterReaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Child {
  surname: string;
  name: string;
  birth_date: string;
}

const readerFormSchema = z.object({
  parent_surname: z.string().trim().min(2, "Прізвище має містити мінімум 2 символи").max(100, "Прізвище занадто довге"),
  parent_name: z.string().trim().min(2, "Ім'я має містити мінімум 2 символи").max(100, "Ім'я занадто довге"),
  phone1: z.string().trim().min(10, "Введіть коректний номер телефону").max(15, "Номер телефону занадто довгий"),
  phone2: z.string().trim().max(15, "Номер телефону занадто довгий").optional(),
  address: z.string().trim().min(5, "Адреса має містити мінімум 5 символів").max(200, "Адреса занадто довга"),
});

const childSchema = z.object({
  surname: z.string().trim().min(2, "Прізвище дитини має містити мінімум 2 символи"),
  name: z.string().trim().min(2, "Ім'я дитини має містити мінімум 2 символи"),
  birth_date: z.string().min(1, "Оберіть дату народження"),
});

const RegisterReaderDialog = ({ open, onOpenChange, onSuccess }: RegisterReaderDialogProps) => {
  const [formData, setFormData] = useState({
    parent_surname: "",
    parent_name: "",
    phone1: "",
    phone2: "",
    address: "",
  });
  const [children, setChildren] = useState<Child[]>([{ surname: "", name: "", birth_date: "" }]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Валідація основної форми
      const validatedReader = readerFormSchema.parse(formData);

      // Валідація дітей
      const validatedChildren = children.map((child, index) => {
        try {
          return childSchema.parse(child);
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Дитина ${index + 1}: ${error.errors[0].message}`);
          }
          throw error;
        }
      });

      // Створюємо читача з дітьми через один API виклик
      await readersApi.create({
        parent_name: validatedReader.parent_name,
        parent_surname: validatedReader.parent_surname,
        phone1: validatedReader.phone1,
        phone2: validatedReader.phone2 || undefined,
        address: validatedReader.address,
        children: validatedChildren.map(child => ({
          name: child.name,
          surname: child.surname,
          birth_date: child.birth_date,
        })),
      });

      toast({
        title: "Успіх!",
        description: "Читача успішно зареєстровано",
      });

      // Скидаємо форму
      setFormData({
        parent_surname: "",
        parent_name: "",
        phone1: "",
        phone2: "",
        address: "",
      });
      setChildren([{ surname: "", name: "", birth_date: "" }]);
      setErrors({});
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      } else if (error instanceof Error) {
        toast({
          title: "Помилка",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Помилка",
          description: "Не вдалося зареєструвати читача. Спробуйте ще раз.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleChildChange = (index: number, field: keyof Child, value: string) => {
    setChildren((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addChild = () => {
    setChildren((prev) => [...prev, { surname: "", name: "", birth_date: "" }]);
  };

  const removeChild = (index: number) => {
    if (children.length > 1) {
      setChildren((prev) => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Реєстрація читача</DialogTitle>
          <DialogDescription>
            Заповніть інформацію про батьків та дітей
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold text-foreground">Інформація про батьків</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="parent_surname">Прізвище*</Label>
                <Input
                  id="parent_surname"
                  value={formData.parent_surname}
                  onChange={(e) => handleChange("parent_surname", e.target.value)}
                  className={errors.parent_surname ? "border-destructive" : ""}
                />
                {errors.parent_surname && <p className="text-sm text-destructive">{errors.parent_surname}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent_name">Ім'я*</Label>
                <Input
                  id="parent_name"
                  value={formData.parent_name}
                  onChange={(e) => handleChange("parent_name", e.target.value)}
                  className={errors.parent_name ? "border-destructive" : ""}
                />
                {errors.parent_name && <p className="text-sm text-destructive">{errors.parent_name}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone1">Телефон 1*</Label>
                <Input
                  id="phone1"
                  type="tel"
                  value={formData.phone1}
                  onChange={(e) => handleChange("phone1", e.target.value)}
                  placeholder="+380XXXXXXXXX"
                  className={errors.phone1 ? "border-destructive" : ""}
                />
                {errors.phone1 && <p className="text-sm text-destructive">{errors.phone1}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone2">Телефон 2</Label>
                <Input
                  id="phone2"
                  type="tel"
                  value={formData.phone2}
                  onChange={(e) => handleChange("phone2", e.target.value)}
                  placeholder="+380XXXXXXXXX"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Адреса*</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                className={errors.address ? "border-destructive" : ""}
              />
              {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Діти</h3>
              <Button type="button" variant="outline" size="sm" onClick={addChild}>
                <Plus className="w-4 h-4 mr-2" />
                Додати дитину
              </Button>
            </div>

            {children.map((child, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3 relative">
                {children.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => removeChild(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}

                <p className="text-sm font-medium text-muted-foreground">Дитина {index + 1}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor={`child_surname_${index}`}>Прізвище*</Label>
                    <Input
                      id={`child_surname_${index}`}
                      value={child.surname}
                      onChange={(e) => handleChildChange(index, "surname", e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`child_name_${index}`}>Ім'я*</Label>
                    <Input
                      id={`child_name_${index}`}
                      value={child.name}
                      onChange={(e) => handleChildChange(index, "name", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`child_birth_${index}`}>Дата народження*</Label>
                  <Input
                    id={`child_birth_${index}`}
                    type="date"
                    value={child.birth_date}
                    onChange={(e) => handleChildChange(index, "birth_date", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Скасувати
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? "Збереження..." : "Зареєструвати"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterReaderDialog;
