import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { booksApi, importApi, isInventoryConflict } from "@/lib/api";
import type { InventoryConflictPayload } from "@/lib/api-types";
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
  const [inventoryConflict, setInventoryConflict] = useState<InventoryConflictPayload | null>(null);
  const [importError, setImportError] = useState("");
  const [inventoryEdits, setInventoryEdits] = useState<Record<number, string>>({});
  const [suggestingNumbers, setSuggestingNumbers] = useState(false);
  const fileSelectionRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const selection = ++fileSelectionRef.current;

    setFileName(file.name);
    setBooksData([]);
    setInventoryConflict(null);
    setImportError("");
    setInventoryEdits({});
    setSuggestingNumbers(true);

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

        const rawInventoryNumber = row[1];
        const isMissing = rawInventoryNumber == null || (typeof rawInventoryNumber === "string" && !rawInventoryNumber.trim());
        const inventoryNumber = isMissing
          ? null
          : typeof rawInventoryNumber === "number"
            ? rawInventoryNumber
            : typeof rawInventoryNumber === "string" && /^\d+$/.test(rawInventoryNumber.trim())
              ? Number(rawInventoryNumber)
              : NaN;
        if (inventoryNumber !== null && (!Number.isSafeInteger(inventoryNumber) || inventoryNumber <= 0)) {
          throw new Error(`Рядок ${i + 1}: інвентарний номер має бути додатним цілим числом не більшим за 9007199254740991.`);
        }

        books.push({
          inventory_number: inventoryNumber,
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

      if (fileSelectionRef.current !== selection) return;
      setBooksData(books);
      toast.success(`Знайдено ${books.length} книг у файлі`);
      if (books.some(book => book.inventory_number === null)) {
        const suppliedNumbers = new Set(books.flatMap(book => book.inventory_number === null ? [] : [book.inventory_number]));
        const missingCount = books.filter(book => book.inventory_number === null).length;
        const data = await booksApi.inventorySuggestions(missingCount + suppliedNumbers.size);
        if (fileSelectionRef.current !== selection) return;
        const suggestions = data.suggested_inventory_numbers.filter(number => !suppliedNumbers.has(number)
          && Number.isSafeInteger(number) && number > 0);
        let suggestionIndex = 0;
        const withSuggestions = books.map(book => book.inventory_number === null && suggestionIndex < suggestions.length
          ? { ...book, inventory_number: suggestions[suggestionIndex++] }
          : book);
        setBooksData(withSuggestions);
        if (withSuggestions.some(book => book.inventory_number === null)) {
          setImportError("Отриманих підказок недостатньо для всіх порожніх номерів. Заповніть решту номерів нижче вручну.");
        }
      }
    } catch (error: any) {
      if (fileSelectionRef.current !== selection) return;
      console.error('Помилка читання файлу:', error);
      const message = error instanceof Error ? error.message : "Не вдалося прочитати файл або отримати вільні номери.";
      setImportError(message);
      toast.error(message);
    } finally {
      if (fileSelectionRef.current === selection) setSuggestingNumbers(false);
    }
  };

  const handleImport = async () => {
    if (loading || suggestingNumbers) return;
    if (booksData.length === 0) {
      toast.error('Спочатку оберіть файл');
      return;
    }

    setLoading(true);
    setImportError("");
    setInventoryConflict(null);
    try {
      const preparedBooks = booksData.map((book, index) => {
        const value = inventoryEdits[index] ?? String(book.inventory_number ?? "");
        const inventoryNumber = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(inventoryNumber) || inventoryNumber <= 0) {
          throw new Error(`Рядок імпорту ${index + 1}: інвентарний номер має бути додатним цілим числом не більшим за 9007199254740991.`);
        }
        return { ...book, inventory_number: inventoryNumber };
      });
      const data = await importApi.importBooks(preparedBooks);

      toast.success(`Імпорт завершено! Успішно: ${data.success}, Помилки: ${data.failed}`);

      if (data.errors && data.errors.length > 0) {
        console.error('Помилки імпорту:', data.errors);
        toast.error(`Деякі книги не вдалося імпортувати. Перевірте консоль для деталей.`);
      }

      // Очищуємо після успішного імпорту
      setBooksData([]);
      setInventoryEdits({});
      setFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      console.error('Помилка імпорту:', error);
      if (isInventoryConflict(error)) {
        setInventoryConflict(error.payload);
      }
      setImportError(error instanceof Error ? error.message : "Не вдалося імпортувати книги.");
      toast.error(`Помилка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const canApplySuggestions = inventoryConflict !== null
    && inventoryConflict.suggested_inventory_numbers.length === booksData.length
    && inventoryConflict.suggested_inventory_numbers.every(number => Number.isSafeInteger(number) && number > 0);

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

      {suggestingNumbers && <p role="status" className="text-sm text-muted-foreground">Підготовка файлу та вільних інвентарних номерів...</p>}
      {booksData.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Порожні номери заповнюються найменшими вільними номерами за зростанням. Перевірте або змініть їх перед імпортом; номери не зарезервовано.
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto" aria-label="Інвентарні номери для імпорту">
            {booksData.map((book, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <label htmlFor={`importInventoryNumber-${index}`} className="flex-1 text-sm">
                  Рядок імпорту {index + 1}: {book.title}
                </label>
                <Input
                  id={`importInventoryNumber-${index}`}
                  aria-label={`Інвентарний номер рядка імпорту ${index + 1}`}
                  type="number"
                  min={1}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  required
                  className="w-40"
                  placeholder="Інвентарний номер"
                  value={inventoryEdits[index] ?? book.inventory_number ?? ""}
                  onChange={event => setInventoryEdits(prev => ({ ...prev, [index]: event.target.value }))}
                  disabled={loading || suggestingNumbers}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {importError && <p role="alert" className="text-sm text-destructive">{importError}</p>}
      {inventoryConflict && (
        <div className="space-y-3 rounded-md border border-destructive p-3">
          <p className="text-sm">Жодної книги не імпортовано. Дані файлу збережено для повторного подання.</p>
          {inventoryConflict.conflicts && (
            <p className="text-sm">
              Конфліктні рядки імпорту: {inventoryConflict.conflicts.map(conflict => conflict.row).join(", ")}.
            </p>
          )}
          <p className="text-sm font-medium">Запропоновані заміни інвентарних номерів:</p>
          <ol className="max-h-64 overflow-y-auto space-y-1 text-sm" aria-label="Запропоновані заміни інвентарних номерів">
            {inventoryConflict.suggested_inventory_numbers.map((number, index) => (
              <li key={index}>
                Рядок імпорту {index + 1}: {inventoryEdits[index] ?? booksData[index]?.inventory_number} → <strong>{number}</strong>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Номери не зарезервовано. Заміни застосовуються лише після натискання кнопки; для імпорту натисніть «Імпортувати» ще раз.
          </p>
          <Button type="button" variant="outline" disabled={loading || !canApplySuggestions} onClick={() => {
            if (!canApplySuggestions) return;
            setBooksData(prev => prev.map((book, index) => ({
              ...book,
              inventory_number: inventoryConflict.suggested_inventory_numbers[index],
            })));
            setInventoryEdits({});
            setInventoryConflict(null);
            setImportError("");
          }}>
            Застосувати запропоновані номери
          </Button>
          {!canApplySuggestions && (
            <p role="alert" className="text-sm text-destructive">Не вдалося застосувати номери в безпечному числовому діапазоні. Виправте номери у файлі та оберіть його знову.</p>
          )}
        </div>
      )}

      {booksData.length > 0 && (
        <Button onClick={handleImport} disabled={loading || suggestingNumbers} className="w-fit">
          <FileUp className="mr-2 h-4 w-4" />
          {loading ? 'Імпорт...' : `Імпортувати ${booksData.length} книг`}
        </Button>
      )}
    </div>
  );
};
