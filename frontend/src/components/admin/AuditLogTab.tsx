import { useEffect, useState, useCallback } from "react";
import { auditApi } from "@/lib/api";
import type { AuditEntry } from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, RefreshCw } from "lucide-react";

/** Human-readable Ukrainian labels for Flask endpoints (action field). */
const ACTION_LABELS: Record<string, string> = {
  "books.create_book": "Додано книгу",
  "books.update_book": "Оновлено книгу",
  "books.delete_book": "Видалено книгу",
  "books.archive_book": "Книгу переміщено до архіву",
  "books.restore_book": "Книгу відновлено з архіву",
  "books.duplicate_book": "Створено примірник",
  "books.add_book_media": "Додано медіа книги",
  "books.delete_book_media": "Видалено медіа книги",
  "books.reorder_book_media": "Змінено порядок медіа",
  "books.import_books": "Імпорт книг",
  "books.force_available": "Позначено доступною",
  "rentals.create_rental": "Створено оренду/видачу",
  "rentals.update_rental_status": "Змінено статус оренди",
  "rentals.reassign_rental": "Переприв'язано оренду",
  "rentals.cleanup_orphan_rentals": "Очищення оренд",
  "readers.create_reader": "Додано читача",
  "readers.update_reader": "Оновлено читача",
  "readers.delete_reader": "Видалено читача",
  "readers.add_child": "Додано дитину",
  "readers.update_child": "Оновлено дитину",
  "readers.delete_child": "Видалено дитину",
  "readers.reassign_child": "Переприв'язано дитину",
  "readers.convert_to_child": "Читача → дитину",
  "readers.merge_readers": "Об'єднано читачів",
  "categories.create_category": "Додано категорію",
  "categories.update_category": "Оновлено категорію",
  "categories.delete_category": "Видалено категорію",
  "series.create_series": "Додано серію",
  "series.update_series": "Оновлено серію",
  "series.delete_series": "Видалено серію",
  "publishers.create_publisher": "Додано видавництво",
  "publishers.update_publisher": "Оновлено видавництво",
  "publishers.delete_publisher": "Видалено видавництво",
  "users.create_user": "Додано користувача",
  "users.update_user_role": "Змінено роль користувача",
  "users.delete_user": "Видалено користувача",
  "auth.login": "Вхід у систему",
  "auth.signup": "Реєстрація",
  "auth.reset_password": "Зміна пароля",
  "upload.upload_book_cover": "Завантажено обкладинку",
  "upload.upload_book_media": "Завантажено медіафайл",
};

const ENTITY_LABELS: Record<string, string> = {
  books: "Книги", rentals: "Оренди", readers: "Читачі", children: "Діти",
  users: "Користувачі", categories: "Категорії", series: "Серії",
  publishers: "Видавництва", auth: "Автентифікація", upload: "Файли", audit: "Аудит",
};

function actionLabel(entry: AuditEntry): string {
  return ACTION_LABELS[entry.action] || `${entry.method} ${entry.action}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("uk-UA", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function detailsSummary(entry: AuditEntry): string {
  if (!entry.details) return "";
  try {
    const obj = JSON.parse(entry.details);
    return Object.entries(obj)
      .filter(([k]) => !k.endsWith("_id") || k === "reader_id" || k === "child_id")
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  } catch {
    return entry.details;
  }
}

export function AuditLogTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState<string>("all");
  const [limit, setLimit] = useState(100);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditApi.list({
        q: q.trim() || undefined,
        entity_type: entityType === "all" ? undefined : entityType,
        limit,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося завантажити журнал дій", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [q, entityType, limit, toast]);

  useEffect(() => { load(); }, [entityType, limit]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card>
      <CardHeader>
        <CardTitle>Журнал дій ({total})</CardTitle>
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <form
            className="relative flex-1"
            onSubmit={(e) => { e.preventDefault(); load(); }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Пошук за користувачем або шляхом..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-10"
            />
          </form>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Усі розділи</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => load()} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Оновити
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Завантаження...</p>
        ) : items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Записів не знайдено</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Час</TableHead>
                    <TableHead>Хто</TableHead>
                    <TableHead>Дія</TableHead>
                    <TableHead>Розділ</TableHead>
                    <TableHead>Деталі</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">{formatDateTime(entry.created_at)}</TableCell>
                      <TableCell className="text-sm">
                        {entry.user_email || <span className="text-muted-foreground">анонімно</span>}
                        {entry.user_name && <div className="text-xs text-muted-foreground">{entry.user_name}</div>}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{actionLabel(entry)}</TableCell>
                      <TableCell>
                        {entry.entity_type && (
                          <Badge variant="outline">{ENTITY_LABELS[entry.entity_type] || entry.entity_type}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate" title={detailsSummary(entry)}>
                        {detailsSummary(entry)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {items.length < total && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" onClick={() => setLimit((l) => l + 100)}>
                  Показати більше ({items.length} з {total})
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
