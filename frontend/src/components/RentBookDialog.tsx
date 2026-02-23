import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { rentalsApi } from "@/lib/api";
import { z } from "zod";

interface RentBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookTitle: string;
  bookId: string;
  isReservation?: boolean;
  onSuccess?: () => void;
}

const rentFormSchema = z.object({
  name: z.string().trim().min(2, "Ім'я має містити мінімум 2 символи").max(100, "Ім'я занадто довге"),
  phone: z.string().trim().min(10, "Введіть коректний номер телефону").max(15, "Номер телефону занадто довгий"),
  email: z.string().trim().email("Введіть коректну email адресу").max(255, "Email занадто довгий"),
  duration: z.enum(["1", "2", "3"], { required_error: "Оберіть термін оренди" }),
});

const RentBookDialog = ({ open, onOpenChange, bookTitle, bookId, isReservation = false, onSuccess }: RentBookDialogProps) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    duration: "2",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = rentFormSchema.parse(formData);

      // Відправляємо запит на оренду
      console.log("Submitting rental request for:", bookTitle);
      await rentalsApi.create({
        book_id: bookId,
        book_title: bookTitle,
        renter_name: validatedData.name,
        renter_phone: validatedData.phone,
        renter_email: validatedData.email,
        rental_duration: parseInt(validatedData.duration),
      });

      console.log("Rental request submitted successfully");

      toast({
        title: isReservation ? "Резервацію створено!" : "Запит надіслано!",
        description: isReservation
          ? `Вас додано в чергу на книгу "${bookTitle}". Ми повідомимо, коли книга стане доступною.`
          : `Ваш запит на оренду книги "${bookTitle}" відправлено. Очікуйте підтвердження.`,
      });

      // Скидаємо форму та закриваємо діалог
      setFormData({ name: "", phone: "", email: "", duration: "2" });
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
      } else {
        toast({
          title: "Помилка",
          description: "Не вдалося надіслати запит. Спробуйте ще раз.",
          variant: "destructive",
        });
      }
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Очищаємо помилку при введенні
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isReservation ? "Зарезервувати книгу" : "Орендувати книгу"}</DialogTitle>
          <DialogDescription>
            {isReservation
              ? `Книга "${bookTitle}" зараз недоступна. Заповніть форму, щоб стати в чергу — ми повідомимо, коли книга стане доступною.`
              : `Заповніть форму для оренди книги "${bookTitle}"`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ім'я та прізвище</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Введіть ваше ім'я"
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="+380XXXXXXXXX"
              className={errors.phone ? "border-destructive" : ""}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="example@email.com"
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-2">
            <Label>Термін оренди</Label>
            <RadioGroup value={formData.duration} onValueChange={(value) => handleChange("duration", value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1" id="week1" />
                <Label htmlFor="week1" className="font-normal cursor-pointer">1 тиждень</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2" id="week2" />
                <Label htmlFor="week2" className="font-normal cursor-pointer">2 тижні</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3" id="week3" />
                <Label htmlFor="week3" className="font-normal cursor-pointer">3 тижні</Label>
              </div>
            </RadioGroup>
            {errors.duration && <p className="text-sm text-destructive">{errors.duration}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Скасувати
            </Button>
            <Button type="submit" className="flex-1">
              {isReservation ? "Зарезервувати" : "Орендувати"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default RentBookDialog;
