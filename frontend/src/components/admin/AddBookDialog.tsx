import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useToast } from "@/hooks/use-toast";
import { categoriesApi, publishersApi, seriesApi, booksApi, uploadApi, resolveUrl, readersApi } from "@/lib/api";
import { z } from "zod";
import { Upload, X, Image as ImageIcon, Video, Plus, Check, ChevronsUpDown, ChevronUp, ChevronDown, Trash2, Camera } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  onDelete?: (bookId: string) => void;
  book?: Book | null;
  copies?: Book[];
  allInventoryNumbers?: Map<number, string>; // inv_number -> book_id
  // Pre-fill values for a NEW book (e.g. imported from an online lookup).
  initialData?: {
    title?: string; author?: string; description?: string; publicationYear?: string;
    isbn?: string; categoryId?: string | null; publisherId?: string | null;
    seriesId?: string | null; coverImageUrl?: string | null; age?: string;
  } | null;
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

import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const AddBookDialog = ({ open, onOpenChange, onSuccess, onDelete, book, copies = [], allInventoryNumbers = new Map(), initialData = null }: AddBookDialogProps) => {
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
  const [prefilledCover, setPrefilledCover] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [existingMedia, setExistingMedia] = useState<MediaFile[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [seriesPopoverOpen, setSeriesPopoverOpen] = useState(false);
  const [newSeriesName, setNewSeriesName] = useState("");
  const [isCreatingNewSeries, setIsCreatingNewSeries] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copyInvNumbers, setCopyInvNumbers] = useState<Record<string, string>>({});
  const [copySuppliers, setCopySuppliers] = useState<Record<string, string>>({});
  const [suppliers, setSuppliers] = useState<string[]>([]);
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [publisherPopoverOpen, setPublisherPopoverOpen] = useState(false);
  const [isCreatingNewPublisher, setIsCreatingNewPublisher] = useState(false);
  const [newPublisherName, setNewPublisherName] = useState("");
  const [newPublisherCity, setNewPublisherCity] = useState("");
  const { toast } = useToast();

  // Load categories, publishers, and series
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesData, publishersData, seriesData, filtersData, readersData] = await Promise.all([
          categoriesApi.list(),
          publishersApi.list(),
          seriesApi.list(),
          booksApi.filters(),
          readersApi.list(),
        ]);

        const readerNames = readersData.map(r => `${r.parent_surname} ${r.parent_name}`);
        const allDonors = [...new Set([...(filtersData.suppliers || []), ...readerNames])].sort();
        setSuppliers(allDonors);
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
          title: initialData?.title || "",
          author: initialData?.author || "",
          categoryId: initialData?.categoryId || "",
          publisherId: initialData?.publisherId || "",
          seriesId: initialData?.seriesId || "",
          coverColor: "#4A90E2",
          supplier: "",
          isbn: initialData?.isbn || "",
          inventoryNumber: "",
          age: initialData?.age || "",
          description: initialData?.description || "",
          publicationYear: initialData?.publicationYear || "",
          newBook: true,
        });
        setExistingMedia([]);
        setPrefilledCover(initialData?.coverImageUrl || null);
      }
      setImageFile(null);
      setMediaFiles([]);
      setErrors({});

      // Initialize copy inventory numbers and suppliers
      if (copies.length > 0) {
        const invMap: Record<string, string> = {};
        copies.forEach(c => { invMap[c.id] = c.inventory_number?.toString() ?? ""; });
        setCopyInvNumbers(invMap);
        const supMap: Record<string, string> = {};
        copies.forEach(c => { supMap[c.id] = c.supplier ?? ""; });
        setCopySuppliers(supMap);
      } else {
        setCopyInvNumbers({});
        setCopySuppliers({});
      }
    };

    loadBookData();
  }, [book, open, copies]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

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

        // Update inventory numbers and suppliers for other copies
        for (const [copyId, invStr] of Object.entries(copyInvNumbers)) {
          if (copyId === book.id) continue; // main book already updated above
          const invNum = invStr.trim() ? parseInt(invStr) : null;
          const originalCopy = copies.find(c => c.id === copyId);
          if (originalCopy && invNum !== originalCopy.inventory_number) {
            await booksApi.update(copyId, { inventory_number: invNum } as any);
          }
        }
        for (const [copyId, supStr] of Object.entries(copySuppliers)) {
          if (copyId === book.id) continue;
          const originalCopy = copies.find(c => c.id === copyId);
          if (originalCopy && supStr !== (originalCopy.supplier || "")) {
            await booksApi.update(copyId, { supplier: supStr || null } as any);
          }
        }
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
          cover_image_url: coverImageUrl || prefilledCover || null,
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
        const message = error instanceof Error ? error.message : "Не вдалося додати книгу. Спробуйте ще раз.";
        setErrors({ submit: message });
        toast({
          title: "Помилка",
          description: message,
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

  const substringFilter = (value: string, search: string) => {
    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
    return 0;
  };

  const processMediaFiles = (files: File[]) => {
    files.sort((a, b) => a.name.localeCompare(b.name));
    const totalMedia = existingMedia.length + mediaFiles.length + files.length;
    if (totalMedia > 10) {
      toast({ title: "Забагато файлів", description: "Максимум 10 медіа-файлів на книгу", variant: "destructive" });
      return;
    }
    const newMedia: MediaFile[] = files.map((file, index) => {
      const isVideo = file.type.startsWith('video/');
      if (file.size > 20 * 1024 * 1024) {
        toast({ title: "Файл занадто великий", description: `${file.name}: Максимум 20MB`, variant: "destructive" });
        return null;
      }
      return { file, type: isVideo ? 'video' : 'image', display_order: existingMedia.length + mediaFiles.length + index };
    }).filter(Boolean) as MediaFile[];
    setMediaFiles(prev => [...prev, ...newMedia]);
  };

  const handleMediaFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processMediaFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };
  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/') || f.type.startsWith('video/'));
    if (files.length > 0) processMediaFiles(files);
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

  const moveExistingMedia = async (index: number, direction: 'up' | 'down') => {
    const newMedia = [...existingMedia];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newMedia.length) return;
    [newMedia[index], newMedia[targetIndex]] = [newMedia[targetIndex], newMedia[index]];
    newMedia.forEach((m, i) => m.display_order = i);
    setExistingMedia(newMedia);
    if (book) {
      try {
        await booksApi.reorderMedia(book.id, newMedia.map(m => m.id!));
      } catch (error) {
        console.error("Error reordering media:", error);
      }
    }
  };

  const moveNewMedia = (index: number, direction: 'up' | 'down') => {
    const newMedia = [...mediaFiles];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newMedia.length) return;
    [newMedia[index], newMedia[targetIndex]] = [newMedia[targetIndex], newMedia[index]];
    newMedia.forEach((m, i) => m.display_order = existingMedia.length + i);
    setMediaFiles(newMedia);
  };

  const handleDeleteBook = () => {
    if (book && onDelete) {
      onDelete(book.id);
      setShowDeleteConfirm(false);
      onOpenChange(false);
    }
  };

  return (
    <>
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Видалити книгу?</AlertDialogTitle>
          <AlertDialogDescription>
            Ви впевнені, що хочете видалити "{book?.title}"? Цю дію неможливо скасувати.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Скасувати</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteBook} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Видалити
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
          {errors.submit && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{errors.submit}</p>}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-base font-semibold">Назва книги *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange("title", e.target.value)}
              placeholder="Назва книги"
              className={cn("border-2 border-primary/50 focus:border-primary bg-primary/5", errors.title && "border-destructive")}
              autoFocus={!book}
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
            <SearchableSelect
              value={formData.categoryId}
              onValueChange={(value) => handleChange("categoryId", value)}
              options={categories.map(cat => ({ value: cat.id, label: cat.name }))}
              placeholder="Оберіть категорію"
              searchPlaceholder="Шукати категорію..."
              className={cn("w-full", errors.categoryId && "border-destructive")}
            />
            {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="publisherId">Видавництво</Label>
            <Popover open={publisherPopoverOpen} onOpenChange={setPublisherPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {formData.publisherId ? (() => { const p = publishers.find(pub => pub.id === formData.publisherId); return p ? `${p.name}${p.city ? ` (${p.city})` : ""}` : ""; })() : <span className="text-muted-foreground">Оберіть видавництво (необов'язково)</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                <Command filter={substringFilter}>
                  <CommandInput placeholder="Шукати видавництво..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>Видавництв не знайдено</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__new__ нове видавництво додати створити" onSelect={() => { setIsCreatingNewPublisher(true); setPublisherPopoverOpen(false); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        + Нове видавництво
                      </CommandItem>
                      <CommandItem value="__none__ без видавництва очистити" onSelect={() => { handleChange("publisherId", ""); setPublisherPopoverOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", !formData.publisherId ? "opacity-100" : "opacity-0")} />
                        — без видавництва —
                      </CommandItem>
                      {publishers.map((pub) => (
                        <CommandItem key={pub.id} value={`${pub.name} ${pub.city || ""}`} onSelect={() => { handleChange("publisherId", pub.id); setPublisherPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", formData.publisherId === pub.id ? "opacity-100" : "opacity-0")} />
                          {pub.name}{pub.city ? ` (${pub.city})` : ""}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {isCreatingNewPublisher && (
              <div className="flex gap-2">
                <Input value={newPublisherName} onChange={(e) => setNewPublisherName(e.target.value)} placeholder="Назва видавництва" className="flex-1" autoFocus />
                <Input value={newPublisherCity} onChange={(e) => setNewPublisherCity(e.target.value)} placeholder="Місто" className="w-28" />
                <Button type="button" size="sm" onClick={async () => {
                  if (!newPublisherName.trim()) return;
                  try {
                    const created = await publishersApi.create({ name: newPublisherName.trim(), city: newPublisherCity.trim() });
                    setPublishers(prev => [...prev, created]);
                    handleChange("publisherId", created.id);
                    setNewPublisherName("");
                    setNewPublisherCity("");
                    setIsCreatingNewPublisher(false);
                    toast({ title: "Видавництво створено", description: `${created.name}${created.city ? ` (${created.city})` : ""}` });
                  } catch (e) {
                    toast({ title: "Помилка", description: "Не вдалося створити видавництво", variant: "destructive" });
                  }
                }}>OK</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setIsCreatingNewPublisher(false); setNewPublisherName(""); setNewPublisherCity(""); }}>✕</Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="seriesId">Серія</Label>
            <Popover open={seriesPopoverOpen} onOpenChange={setSeriesPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {formData.seriesId ? series.find(s => s.id === formData.seriesId)?.name : <span className="text-muted-foreground">Оберіть серію (необов'язково)</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                <Command filter={substringFilter}>
                  <CommandInput placeholder="Пошук серії..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>Серій не знайдено</CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__new__ нова серія додати створити" onSelect={() => { setIsCreatingNewSeries(true); setSeriesPopoverOpen(false); }}>
                        <Plus className="mr-2 h-4 w-4" />
                        + Нова серія
                      </CommandItem>
                      <CommandItem value="__none__ без серії очистити" onSelect={() => { handleChange("seriesId", ""); setSeriesPopoverOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", !formData.seriesId ? "opacity-100" : "opacity-0")} />
                        — без серії —
                      </CommandItem>
                      {series.map((ser) => (
                        <CommandItem key={ser.id} value={ser.name} onSelect={() => { handleChange("seriesId", ser.id); setSeriesPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", formData.seriesId === ser.id ? "opacity-100" : "opacity-0")} />
                          {ser.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {isCreatingNewSeries && (
              <div className="flex gap-2">
                <Input value={newSeriesName} onChange={(e) => setNewSeriesName(e.target.value)} placeholder="Назва нової серії" className="flex-1" autoFocus />
                <Button type="button" size="sm" onClick={async () => {
                  if (!newSeriesName.trim()) return;
                  try {
                    const created = await seriesApi.create({ name: newSeriesName.trim() });
                    setSeries(prev => [...prev, created]);
                    handleChange("seriesId", created.id);
                    setNewSeriesName("");
                    setIsCreatingNewSeries(false);
                    toast({ title: "Серію створено", description: created.name });
                  } catch (e) {
                    toast({ title: "Помилка", description: "Не вдалося створити серію", variant: "destructive" });
                  }
                }}>OK</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setIsCreatingNewSeries(false); setNewSeriesName(""); }}>✕</Button>
              </div>
            )}
          </div>

          <div className={cn("grid gap-4", copies.length > 1 ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input
                id="isbn"
                value={formData.isbn}
                onChange={(e) => handleChange("isbn", e.target.value)}
                placeholder="ISBN (необов'язково)"
              />
            </div>

            {copies.length <= 1 && (() => {
              const num = formData.inventoryNumber ? parseInt(formData.inventoryNumber) : null;
              const dup = num != null && !isNaN(num) && allInventoryNumbers.has(num) && allInventoryNumbers.get(num) !== book?.id;
              return (
              <div className="space-y-2">
                <Label htmlFor="inventoryNumber">Інвентарний номер</Label>
                <Input
                  id="inventoryNumber"
                  type="number"
                  value={formData.inventoryNumber}
                  onChange={(e) => handleChange("inventoryNumber", e.target.value)}
                  placeholder="Номер (необов'язково)"
                  className={dup ? "border-destructive border-2 text-destructive" : ""}
                />
                {dup && <p className="text-xs text-destructive">Дублікат</p>}
              </div>
              );
            })()}
          </div>

          {/* Other copies inventory numbers */}
          {copies.length > 1 && book && (() => {
            const copyIds = new Set(copies.map(c => c.id));
            // Collect current inv numbers for all copies in this dialog
            const currentInvValues: { id: string; num: number }[] = [];
            for (const c of copies) {
              const val = c.id === book.id ? formData.inventoryNumber : (copyInvNumbers[c.id] ?? "");
              if (val) currentInvValues.push({ id: c.id, num: parseInt(val as string) });
            }
            const isDuplicate = (copyId: string, val: string) => {
              if (!val) return false;
              const num = parseInt(val);
              if (isNaN(num)) return false;
              // Check against other copies in this dialog
              const sameInDialog = currentInvValues.filter(v => v.num === num && v.id !== copyId);
              if (sameInDialog.length > 0) return true;
              // Check against other books in the system
              const ownerBookId = allInventoryNumbers.get(num);
              return !!ownerBookId && !copyIds.has(ownerBookId);
            };
            return (
            <div className="space-y-2 border rounded-lg p-3 bg-muted/30">
              <Label className="text-sm font-semibold">Примірники ({copies.length})</Label>
              <datalist id="copy-donors-list">
                {suppliers.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <div className="space-y-2">
                {copies.map((copy) => {
                  const val = copy.id === book.id ? formData.inventoryNumber : (copyInvNumbers[copy.id] ?? "");
                  const dup = isDuplicate(copy.id, val as string);
                  return (
                  <div key={copy.id} className="flex flex-wrap items-center gap-2">
                    <Badge variant={copy.available ? "outline" : "secondary"} className="text-xs w-16 justify-center shrink-0">
                      {copy.available ? "вільна" : "видана"}
                    </Badge>
                    <span className="text-xs text-muted-foreground shrink-0">Інв.:</span>
                    <div className="flex flex-col">
                      <Input
                        type="number"
                        className={cn("h-8 w-28", dup && "border-destructive border-2 text-destructive")}
                        value={val}
                        placeholder="—"
                        onChange={(e) => {
                          if (copy.id === book.id) {
                            handleChange("inventoryNumber", e.target.value);
                          } else {
                            setCopyInvNumbers(prev => ({ ...prev, [copy.id]: e.target.value }));
                          }
                        }}
                      />
                      {dup && <span className="text-xs text-destructive">Дублікат</span>}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">Дар.:</span>
                    <Input
                      list="copy-donors-list"
                      className="h-8 flex-1 min-w-[180px]"
                      value={copySuppliers[copy.id] ?? copy.supplier ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        setCopySuppliers(prev => ({ ...prev, [copy.id]: e.target.value }));
                      }}
                    />
                  </div>
                  );
                })}
              </div>
            </div>
            );
          })()}

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
            <Label htmlFor="supplier">Даритель</Label>
            <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {formData.supplier || <span className="text-muted-foreground">Оберіть або введіть дарителя</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 pointer-events-auto" align="start">
                <Command filter={substringFilter}>
                  <CommandInput
                    placeholder="Шукати дарителя..."
                    onValueChange={(val) => handleChange("supplier", val)}
                  />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>
                      {formData.supplier ? (
                        <button className="w-full text-left px-2 py-1.5 text-sm" onClick={() => setSupplierPopoverOpen(false)}>
                          Додати: "{formData.supplier}"
                        </button>
                      ) : "Введіть назву"}
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem value="__none__ без дарителя очистити" onSelect={() => { handleChange("supplier", ""); setSupplierPopoverOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", !formData.supplier ? "opacity-100" : "opacity-0")} />
                        — без дарителя —
                      </CommandItem>
                      {suppliers.map((s) => (
                        <CommandItem key={s} value={s} onSelect={() => { handleChange("supplier", s); setSupplierPopoverOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", formData.supplier === s ? "opacity-100" : "opacity-0")} />
                          {s}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

            {/* Обкладинка, підтягнута з онлайн-імпорту (нова книга) */}
            {!book && !imageFile && prefilledCover && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Обкладинка з імпорту:</p>
                <div className="relative w-24 h-32 group">
                  <img
                    src={resolveUrl(prefilledCover)}
                    alt="Обкладинка з імпорту"
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

          <div
            className={cn("space-y-3 border-t pt-4 rounded-lg p-3 transition-colors", isDragging && "border-2 border-dashed border-primary bg-primary/5")}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
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
                  {existingMedia.map((media, index) => (
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
                      <div className="absolute top-1 left-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" variant="secondary" size="icon" className="h-5 w-5" disabled={index === 0} onClick={() => moveExistingMedia(index, 'up')}>
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button type="button" variant="secondary" size="icon" className="h-5 w-5" disabled={index === existingMedia.length - 1} onClick={() => moveExistingMedia(index, 'down')}>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
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
                      <div className="absolute top-1 left-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button type="button" variant="secondary" size="icon" className="h-5 w-5" disabled={index === 0} onClick={() => moveNewMedia(index, 'up')}>
                          <ChevronUp className="w-3 h-3" />
                        </Button>
                        <Button type="button" variant="secondary" size="icon" className="h-5 w-5" disabled={index === mediaFiles.length - 1} onClick={() => moveNewMedia(index, 'down')}>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                      </div>
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
                <Input
                  id="media-camera"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleMediaFilesChange}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => document.getElementById('media-files')?.click()}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Додати фото/відео
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => document.getElementById('media-camera')?.click()}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Зняти фото
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Максимум 20MB на файл. Перетягніть файли або натисніть кнопку
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

          {book && onDelete && (
            <div className="border-t pt-4 mt-2">
              <Button
                type="button"
                variant="destructive"
                className="w-full gap-2"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
                Видалити книгу
              </Button>
            </div>
          )}
        </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default AddBookDialog;
