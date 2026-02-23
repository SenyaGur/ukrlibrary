import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { importApi } from "@/lib/api";
import { toast } from "sonner";
import * as XLSX from 'xlsx';
import { FileUp } from "lucide-react";

interface BookData {
  inventory_number: number | null;
  category: string;
  author: string | null;
  title: string;
  available: string;
  series: string | null;
  publisher: string | null;
  publication_year: string | null;
  supplier: string | null;
  isbn: string | null;
  age: string | null;
  description: string | null;
}

export const ImportBooksFromExcel = () => {
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [booksData, setBooksData] = useState<BookData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);

      // Читаємо сторінку "КНИГИ" (або другу сторінку, якщо назви немає)
      const sheetName = workbook.SheetNames[1] || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Конвертуємо в JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Пропускаємо заголовок (перший рядок)
      const books: BookData[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];

        // Пропускаємо порожні рядки
        if (!row[4] || row[4].toString().trim() === '') continue;

        books.push({
          inventory_number: row[1] ? Number(row[1]) : null,
          category: row[2] || 'Без категорії',
          author: row[3] || null,
          title: row[4] || 'Без назви',
          available: row[5] || '',
          series: row[6] || null,
          publisher: row[7] || null,
          publication_year: row[8] ? String(row[8]) : null,
          isbn: row[9] ? String(row[9]) : null,
          supplier: row[10] || null,
          age: row[12] || null,
          description: row[13] || null,
        });
      }

      setBooksData(books);
      toast.success(`Знайдено ${books.length} книг у файлі`);
    } catch (error: any) {
      console.error('Помилка читання файлу:', error);
      toast.error(`Помилка читання файлу: ${error.message}`);
    }
  };

  const handleImport = async () => {
    if (booksData.length === 0) {
      toast.error('Спочатку оберіть файл');
      return;
    }

    setLoading(true);
    try {
      const data = await importApi.importBooks(booksData);

      toast.success(`Імпорт завершено! Успішно: ${data.success}, Помилки: ${data.failed}`);

      if (data.errors && data.errors.length > 0) {
        console.error('Помилки імпорту:', data.errors);
        toast.error(`Деякі книги не вдалося імпортувати. Перевірте консоль для деталей.`);
      }

      // Очищуємо після успішного імпорту
      setBooksData([]);
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Помилка імпорту:', error);
      toast.error(`Помилка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <Input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          disabled={loading}
          className="max-w-xs"
        />
        {fileName && (
          <span className="text-sm text-muted-foreground">
            {fileName} ({booksData.length} книг)
          </span>
        )}
      </div>

      {booksData.length > 0 && (
        <Button onClick={handleImport} disabled={loading} className="w-fit">
          <FileUp className="mr-2 h-4 w-4" />
          {loading ? 'Імпорт...' : `Імпортувати ${booksData.length} книг`}
        </Button>
      )}
    </div>
  );
};
