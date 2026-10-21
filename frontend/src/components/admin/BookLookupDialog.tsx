import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { bookLookupApi } from "@/lib/api";
import type { BookSearchResult, BookPrefill } from "@/lib/api-types";
import { Search, Loader2, BookOpen } from "lucide-react";

interface BookLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (prefill: BookPrefill) => void;
}

const BookLookupDialog = ({ open, onOpenChange, onImported }: BookLookupDialogProps) => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [importingUrl, setImportingUrl] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearched(true);
    try {
      const res = await bookLookupApi.search(q);
      setResults(res.results || []);
      if (res.error) {
        toast({ title: "Помилка пошуку", description: res.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Помилка", description: err?.message || "Не вдалося виконати пошук", variant: "destructive" });
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handlePick = async (r: BookSearchResult) => {
    setImportingUrl(r.url);
    try {
      const prefill = await bookLookupApi.import(r.url);
      onImported(prefill);
      // reset for next time
      setQuery("");
      setResults([]);
      setSearched(false);
    } catch (err: any) {
      toast({ title: "Помилка", description: err?.message || "Не вдалося отримати дані книги", variant: "destructive" });
    } finally {
      setImportingUrl(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Знайти книгу онлайн</DialogTitle>
          <DialogDescription>
            Пошук за назвою або автором. Дані книги (обкладинка, опис, автор, видавництво тощо) підставляться у форму додавання — ви зможете їх відредагувати перед збереженням.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              autoFocus
              placeholder="Напр. Котигорошко"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={searching || !query.trim()} className="gap-2">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Пошук
          </Button>
        </form>

        <div className="mt-3">
          {searching ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Шукаємо...</p>
          ) : searched && results.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Нічого не знайдено. Спробуйте іншу назву.</p>
          ) : (
            <div className="space-y-2">
              {results.map((r) => (
                <div key={r.url} className="flex items-center gap-3 border rounded-lg p-2">
                  <div className="w-12 h-16 shrink-0 rounded bg-muted overflow-hidden flex items-center justify-center">
                    {r.thumb ? (
                      <img src={r.thumb} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight line-clamp-2">{r.title}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handlePick(r)}
                    disabled={importingUrl !== null}
                    className="shrink-0 gap-2"
                  >
                    {importingUrl === r.url ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Обрати
                  </Button>
                </div>
              ))}
            </div>
          )}
          {!searched && (
            <p className="text-xs text-muted-foreground py-6 text-center">
              Джерело: knigoland.com.ua — введіть назву та натисніть «Пошук».
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookLookupDialog;
