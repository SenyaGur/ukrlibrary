import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { categoriesApi, publishersApi, seriesApi, booksApi, uploadApi, resolveUrl } from "@/lib/api";
import { z } from "zod";
import { Upload, X, Image as ImageIcon, Video } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  category_id?: string | null;
  series_id?: string | null;
  publisher_id?: string | null;
  cover_color: string;
  cover_image_url: string | null;
  available: boolean;
  supplier?: string | null;
  isbn?: string | null;
  inventory_number?: number | null;
  age?: string | null;
  description?: string | null;
  publication_year?: string | null;
  new_book?: boolean | null;
}

interface AddBookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  book?: Book | null;
}

interface MediaFile {
  id?: string;
  file?: File;
  url?: string;
  type: 'image' | 'video';
  display_order: number;
}

const bookSchema = z.object({
  title: z.string().trim().min(1, "Назва обов'язкова").max(255, "Назва занадто довга"),
  author: z.string().trim().min(1, "Автор обов'язковий").max(255, "Ім'я автора занадто довге"),
  categoryId: z.string().min(1, "Категорія обов'язкова"),
  coverColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Невірний формат кольору (використовуйте #RRGGBB)"),
});

const AddBookDialog = ({ open, onOpenChange, onSuccess, book }: AddBookDialogProps) => {
  const [formData, setFormData] = useState({
    title: "",
    author: "",
    categoryId: "",
    publisherId: "",
    seriesId: "",
    coverColor: "#4A90E2",
    supplier: "",
    isbn: "",
    inventoryNumber: "",
    age: "",
    description: "",
    publicationYear: "",
    newBook: false,
  });
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [publishers, setPublishers] = useState<Array<{ id: string; name: string; city: string }>>([]);
  const [series, setSeries] = useState<Array<{ id: string; name: string }>>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Load categories, publishers, and series
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, publishersData, seriesData] = await Promise.all([
          categoriesApi.list(),
          publishersApi.list(),
          seriesApi.list(),
        ]);

        setCategories(categoriesData);
        setPublishers(publishersData);
        setSeries(seriesData);
      } catch (error) {
        console.error("Error loading form data:", error);
      }
    };

    loadData();
  }, []);

  // Update form when book prop changes
  useEffect(() => {
    const loadBookData = async () => {
      if (book) {
        setFormData({
          title: book.title,
          author: book.author,
          categoryId: book.category_id || "",
          publisherId: book.publisher_id || "",
          seriesId: book.series_id || "",
          coverColor: book.cover_color,
          supplier: book.supplier || "",
          isbn: book.isbn || "",
          inventoryNumber: book.inventory_number?.toString() || "",
          age: book.age || "",
          description: book.description || "",
          publicationYear: book.publication_year || "",
          newBook: book.new_book || false,
        });

        // Завантажуємо існуючі медіа-файли
        try {
          const mediaData = await booksApi.getMedia(book.id);
          setExistingMedia(mediaData.map(m => ({
            id: m.id,
            url: m.file_url,
            type: m.file_type as 'image' | 'video',
            display_order: m.display_order
          })));
        } catch (error) {
          console.error("Error loading media:", error);
        }
      } else {
        setFormData({
          title: "",
          author: "",
          categoryId: "",
          publisherId: "",
          seriesId: "",
          coverColor: "#4A90E2",
          supplier: "",
          isbn: "",
          inventoryNumber: "",
          age: "",
          description: "",
          publicationYear: "",
          newBook: false,
        });
        setExistingMedia([]);
      }
      setImageFile(null);
      setMediaFiles([]);
      setErrors({});
    };

    loadBookData();
  }, [book, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const validatedData = bookSchema.parse(formData);

      let coverImageUrl: string | null = null;

      // Завантажуємо зображення якщо є
      if (imageFile) {
        const uploadResult = await uploadApi.bookCover(imageFile);
        coverImageUrl = uploadResult.url;
      }

      let bookId = book?.id;

      // Get category name for the category field
      const selectedCategory = categories.find(c => c.id === validatedData.categoryId);
      if (!selectedCategory) {
        throw new Error("Категорію не знайдено");
      }

      // Додаємо або оновлюємо книгу в базі
      if (book) {
        // Оновлюємо існуючу книгу
        const updateData: any = {
          title: validatedData.title,
          author: validatedData.author,
          category: selectedCategory.name,
          category_id: validatedData.categoryId,
          publisher_id: formData.publisherId || null,
          series_id: formData.seriesId || null,
          cover_color: validatedData.coverColor,
          supplier: formData.supplier || null,
          isbn: formData.isbn || null,
          inventory_number: formData.inventoryNumber ? parseInt(formData.inventoryNumber) : null,
          age: formData.age || null,
          description: formData.description || null,
          publication_year: formData.publicationYear || null,
          new_book: formData.newBook,
        };

        if (coverImageUrl) {
          updateData.cover_image_url = coverImageUrl;
        }

        await booksApi.update(book.id, updateData);
      } else {
        // Додаємо нову книгу
        const newBook = await booksApi.create({
          title: validatedData.title,
          author: validatedData.author,
          category: selectedCategory.name,
          category_id: validatedData.categoryId,
          publisher_id: formData.publisherId || null,
          series_id: formData.seriesId || null,
          cover_color: validatedData.coverColor,
          cover_image_url: coverImageUrl,
          available: true,
          supplier: formData.supplier || null,
          isbn: formData.isbn || null,
          inventory_number: formData.inventoryNumber ? parseInt(formData.inventoryNumber) : null,
          age: formData.age || null,
          description: formData.description || null,
          publication_year: formData.publicationYear || null,
          new_book: formData.newBook,
        });

        bookId = newBook.id;
      }

      // Завантажуємо нові медіа-файли
      if (mediaFiles.length > 0 && bookId) {
        for (let i = 0; i < mediaFiles.length; i++) {
          const media = mediaFiles[i];
          if (media.file) {
            try {
              const uploadResult = await uploadApi.bookMedia(media.file);

              // Зберігаємо запис в базі
              await booksApi.addMedia(bookId, {
                file_url: uploadResult.url,
                file_type: media.type,
                display_order: existingMedia.length + i,
              });
            } catch (error) {
              console.error("Error uploading media:", error);
              continue;
            }
          }
        }
      }

      toast({
        title: book ? "Книга оновлена!" : "Книга додана!",
        description: book
          ? `"${validatedData.title}" успішно оновлено`
          : `"${validatedData.title}" успішно додано до бібліотеки`,
      });

      // Скидаємо форму
      setFormData({
        title: "",
        author: "",
        categoryId: "",
        publisherId: "",
        seriesId: "",
        coverColor: "#4A90E2",
        supplier: "",
        isbn: "",
        inventoryNumber: "",
        age: "",
        description: "",
        publicationYear: "",
        newBook: false,
      });
      setImageFile(null);
      setMediaFiles([]);
      setExistingMedia([]);
      setErrors({});
      onOpenChange(false);
      onSuccess();
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
          description: "Не вдалося додати книгу. Спробуйте ще раз.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "Файл занадто великий",
          description: "Максимальний розмір файлу - 5MB",
          variant: "destructive",
        });
        return;
      }
      setImageFile(file);
    }
  };

  const handleMediaFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalMedia = existingMedia.length + mediaFiles.length + files.length;

    if (totalMedia > 10) {
      toast({
        title: "Забагато файлів",
        description: "Максимум 10 медіа-файлів на книгу",
        variant: "destructive",
      });
      return;
    }

    const newMedia: MediaFile[] = files.map((file, index) => {
      const isVideo = file.type.startsWith('video/');

      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "Файл занадто великий",
          description: `${file.name}: Максимум 20MB`,
          variant: "destructive",
        });
        return null;
      }

      return {
        file,
        type: isVideo ? 'video' : 'image',
        display_order: existingMedia.length + mediaFiles.length + index,
      };
    }).filter(Boolean) as MediaFile[];

    setMediaFiles([...mediaFiles, ...newMedia]);
    e.target.value = '';
  };

  const removeMediaFile = (index: number) => {
    setMediaFiles(mediaFiles.filter((_, i) => i !== index));
  };

  const removeExistingMedia = async (mediaId: string) => {
    try {
      await booksApi.deleteMedia(mediaId);
      setExistingMedia(existingMedia.filter(m => m.id !== mediaId));
      toast({
        title: "Видалено",
        description: "Медіа-файл видалено",
      });
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити файл",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader className="relative">
          <DialogTitle>{book ? "Редагувати книгу" : "Додати нову книгу"}</DialogTitle>
          <DialogDescription>
            {book ? "Оновіть інформацію про книгу" : "Заповніть інформацію про книгу"}
          </DialogDescription>
          <div className="absolute right-0 top-0 flex items-center space-x-2">
            <Checkbox
              id="newBook"
              checked={formData.newBook}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, newBook: checked === true }))}
            />
            <Label htmlFor="newBook" className="text-sm font-medium cursor-pointer">
              Новинка
            </Label>
          </div>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Назва книги</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Назва книги"
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="author">Автор</Label>
            <Input
              id="author"
              value={formData.author}
              onChange={(e) => handleChange("author", e.target.value)}
              placeholder="Ім'я автора"
              className={errors.author ? "border-destructive" : ""}
            />
            {errors.author && <p className="text-sm text-destructive">{errors.author}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Категорія</Label>
            <Select
              value={formData.categoryId}
              onValueChange={(value) => handleChange("categoryId", value)}
            >
              <SelectTrigger className={errors.categoryId ? "border-destructive" : ""}>
                <SelectValue placeholder="Оберіть категорію" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="publisherId">Видавництво</Label>
            <Select
              value={formData.publisherId}
              onValueChange={(value) => handleChange("publisherId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Оберіть видавництво (необов'язково)" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {publishers.map((pub) => (
                  <SelectItem key={pub.id} value={pub.id}>
                    {pub.name} {pub.city && `(${pub.city})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seriesId">Серія</Label>
            <Select
              value={formData.seriesId}
              onValueChange={(value) => handleChange("seriesId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Оберіть серію (необов'язково)" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {series.map((ser) => (
                  <SelectItem key={ser.id} value={ser.id}>
                    {ser.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                value={formData.isbn}
                onChange={(e) => handleChange("isbn", e.target.value)}
                placeholder="ISBN (необов'язково)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="inventoryNumber">Інвентарний номер</Label>
              <Input
                id="inventoryNumber"
                type="number"
                value={formData.inventoryNumber}
                onChange={(e) => handleChange("inventoryNumber", e.target.value)}
                placeholder="Номер (необов'язково)"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age">Вік</Label>
              <Input
                id="age"
                value={formData.age}
                onChange={(e) => handleChange("age", e.target.value)}
                placeholder="Напр. 6-8 років"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicationYear">Рік видання</Label>
              <Input
                id="publicationYear"
                value={formData.publicationYear}
                onChange={(e) => handleChange("publicationYear", e.target.value)}
                placeholder="Напр. 2023"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Поставщик</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => handleChange("supplier", e.target.value)}
              placeholder="Назва постачальника (необов'язково)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Опис</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Опис книги (необов'язково)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverColor">Колір обкладинки</Label>
            <div className="flex gap-2">
              <Input
                id="coverColor"
                type="color"
                value={formData.coverColor}
                onChange={(e) => handleChange("coverColor", e.target.value)}
                className="w-20 h-10"
              />
              <Input
                value={formData.coverColor}
                onChange={(e) => handleChange("coverColor", e.target.value)}
                placeholder="#4A90E2"
                className={errors.coverColor ? "border-destructive flex-1" : "flex-1"}
              />
            </div>
            {errors.coverColor && <p className="text-sm text-destructive">{errors.coverColor}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="image">Зображення обкладинки (необов'язково)</Label>

            {/* Показуємо існуючу обкладинку при редагуванні */}
            {book?.cover_image_url && !imageFile && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Поточна обкладинка:</p>
                <div className="relative w-24 h-32 group">
                  <img
                    src={resolveUrl(book.cover_image_url)}
                    alt="Поточна обкладинка"
                    className="w-full h-full object-cover rounded border"
                  />
                </div>
              </div>
            )}

            {/* Показуємо превью нового файлу */}
            {imageFile && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Нова обкладинка:</p>
                <div className="relative w-24 h-32 group">
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt="Нова обкладинка"
                    className="w-full h-full object-cover rounded border"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setImageFile(null)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">Максимум 5MB</p>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Медіа-галерея (до 10 файлів)</Label>
              <span className="text-xs text-muted-foreground">
                {existingMedia.length + mediaFiles.length}/10
              </span>
            </div>

            {/* Існуючі медіа */}
            {existingMedia.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Завантажені файли:</p>
                <div className="grid grid-cols-3 gap-2">
                  {existingMedia.map((media) => (
                    <div key={media.id} className="relative group">
                      {media.type === 'image' ? (
                        <img
                          src={resolveUrl(media.url)}
                          alt="Media"
                          className="w-full h-24 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-full h-24 bg-muted rounded border flex items-center justify-center">
                          <Video className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => media.id && removeExistingMedia(media.id)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Нові медіа для завантаження */}
            {mediaFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Нові файли:</p>
                <div className="grid grid-cols-3 gap-2">
                  {mediaFiles.map((media, index) => (
                    <div key={index} className="relative group">
                      {media.type === 'image' && media.file ? (
                        <img
                          src={URL.createObjectURL(media.file)}
                          alt="Preview"
                          className="w-full h-24 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-full h-24 bg-muted rounded border flex items-center justify-center">
                          <Video className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeMediaFile(index)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Кнопка завантаження */}
            {(existingMedia.length + mediaFiles.length) < 10 && (
              <div>
                <Input
                  id="media-files"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleMediaFilesChange}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => document.getElementById('media-files')?.click()}
                >
                  <ImageIcon className="w-4 h-4 mr-2" />
                  Додати фото/відео
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Підтримується: JPG, PNG, MP4, MOV (до 20MB)
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Скасувати
            </Button>
            <Button type="submit" className="flex-1 gap-2" disabled={isSubmitting}>
              <Upload className="w-4 h-4" />
              {isSubmitting
                ? (book ? "Оновлення..." : "Додавання...")
                : (book ? "Оновити книгу" : "Додати книгу")
              }
            </Button>
          </div>
        </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AddBookDialog;
