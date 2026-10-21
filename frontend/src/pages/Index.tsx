import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect, SearchableMultiSelect } from "@/components/ui/searchable-select";
import BookCard from "@/components/BookCard";
import RentBookDialog from "@/components/RentBookDialog";
import BookDetailsDialog from "@/components/BookDetailsDialog";
import { BookOpen, Search, Settings, Users, LogOut, Filter } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, booksApi, getToken, setToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import libraryLogo from "@/assets/library-logo.svg";


interface Book {
  id: string;
  title: string;
  author: string;
  cover_color: string;
  cover_image_url: string | null;
  description: string | null;
  available: boolean;
  category: string;
  age: string | null;
  publication_year: string | null;
  new_book?: boolean | null;
  rental_count?: number;
  publishers?: {
    name: string;
    city: string;
  } | null;
  series?: {
    name: string;
  } | null;
}

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isRentDialogOpen, setIsRentDialogOpen] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!getToken());
  const [categories, setCategories] = useState<string[]>([]);
  const [publishers, setPublishers] = useState<string[]>([]);
  const [authors, setAuthors] = useState<string[]>([]);
  const [ages, setAges] = useState<string[]>([]);
  const [seriesList, setSeriesList] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedAges, setSelectedAges] = useState<string[]>([]);
  const [selectedSeriesList, setSelectedSeriesList] = useState<string[]>([]);
  const [selectedAvailability, setSelectedAvailability] = useState<string>("all");
  const [showNewOnly, setShowNewOnly] = useState(false);
  const [sortMode, setSortMode] = useState<"default" | "popularity" | "title-asc" | "title-desc">("default");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchBooks();
    fetchFilters();

    // Check for existing session
    const checkAuth = async () => {
      if (getToken()) {
        try {
          await authApi.me();
          setIsLoggedIn(true);
        } catch {
          setToken(null);
          setIsLoggedIn(false);
        }
      }
    };
    checkAuth();
  }, []);

  const fetchBooks = async () => {
    console.log("Fetching books from database...");
    try {
      const data = await booksApi.list();
      console.log("Books fetched successfully:", data);
      console.log("Number of books:", data?.length);
      setBooks(data || []);
    } catch (error) {
      console.error("Помилка завантаження книг:", error);
    }
    setLoading(false);
  };

  const fetchFilters = async () => {
    try {
      const data = await booksApi.filters();
      setCategories(data.categories);
      setAuthors(data.authors);
      setAges(data.ages);
      setPublishers(data.publishers);
      setSeriesList(data.series);
    } catch (error) {
      console.error("Помилка завантаження фільтрів:", error);
    }
  };

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      book.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(book.category);
    const matchesAuthor = selectedAuthors.length === 0 || selectedAuthors.includes(book.author);
    const matchesPublisher = selectedPublishers.length === 0 || (book.publishers?.name && selectedPublishers.includes(book.publishers.name));
    const matchesAge = selectedAges.length === 0 || (book.age && selectedAges.includes(book.age));
    const matchesSeries = selectedSeriesList.length === 0 || (book.series?.name && selectedSeriesList.includes(book.series.name));
    const matchesAvailability = selectedAvailability === "all" || (selectedAvailability === "available" ? book.available : !book.available);
    const matchesNew = !showNewOnly || book.new_book;

    return matchesSearch && matchesCategory && matchesAuthor && matchesPublisher && matchesAge && matchesSeries && matchesAvailability && matchesNew;
  });

  // Group filtered books by title+author, keeping one representative card per group
  const groupedBooks = (() => {
    const groups = new Map<string, { book: Book; total: number; available: number; rentalCount: number }>();
    for (const book of filteredBooks) {
      const key = `${book.title}|||${book.author}`;
      const existing = groups.get(key);
      if (existing) {
        existing.total++;
        existing.rentalCount += book.rental_count || 0;
        if (book.available) existing.available++;
        // Prefer a copy with a cover image as representative
        if (!existing.book.cover_image_url && book.cover_image_url) {
          existing.book = book;
        }
      } else {
        groups.set(key, { book, total: 1, available: book.available ? 1 : 0, rentalCount: book.rental_count || 0 });
      }
    }
    return Array.from(groups.values()).sort((a, b) => {
      switch (sortMode) {
        case "title-asc":
          return a.book.title.localeCompare(b.book.title, 'uk');
        case "title-desc":
          return b.book.title.localeCompare(a.book.title, 'uk');
        case "popularity":
          return (b.rentalCount - a.rentalCount) || a.book.title.localeCompare(b.book.title, 'uk');
        case "default":
        default: {
          const aNew = a.book.new_book ? 1 : 0;
          const bNew = b.book.new_book ? 1 : 0;
          if (aNew !== bNew) return bNew - aNew; // new books first
          return a.book.title.localeCompare(b.book.title, 'uk');
        }
      }
    });
  })();

  const handleBookClick = (book: Book) => {
    setSelectedBook(book);
    setIsDetailsDialogOpen(true);
  };

  const handleRentFromDetails = () => {
    setIsRentDialogOpen(true);
  };

  const scrollToBooks = () => {
    document.getElementById("books-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleLogout = async () => {
    authApi.logout();
    setIsLoggedIn(false);
    toast({
      title: "Успішно",
      description: "Ви вийшли з системи",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Завантаження...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Blue Stripe */}
      <header className="bg-sky-500 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={libraryLogo} alt="Логотип" className="w-14 h-14 rounded-lg" />
              <span className="text-base md:text-lg font-medium text-white">Український дитячий клуб в Софії</span>
            </div>
            {isLoggedIn && (
              <div className="flex items-center gap-3">
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-2 text-white hover:text-white hover:bg-white/20">
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Адмін-панель</span>
                  </Button>
                </Link>
                <Button size="sm" className="gap-2 bg-white text-sky-600 hover:bg-sky-50 font-display font-semibold uppercase tracking-wide text-xs" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  Вийти
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section - Yellow Stripe with Logo */}
      <section className="hero-stripe">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center justify-center gap-6">
            <img
              src={libraryLogo}
              alt="Логотип бібліотеки"
              className="w-44 h-44 md:w-64 md:h-64 object-contain"
            />
            <h1 className="text-2xl md:text-4xl font-display font-bold text-foreground uppercase">
              Дитяча бібліотека
            </h1>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="container mx-auto px-4 py-8 border-b">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-1">Дитячі книги</h2>
            <p className="text-base text-muted-foreground">{books.length} книг у колекції</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
            {categories.slice(0, 12).map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategories([category]);
                  scrollToBooks();
                }}
                className="text-left font-medium text-sm text-primary hover:underline"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Books Grid Section */}
      <section id="books-section" className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-semibold text-foreground">Рекомендовані книги</h2>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Знайти книгу..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 py-5 border-border rounded-lg"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <SearchableMultiSelect
              values={selectedCategories}
              onValuesChange={setSelectedCategories}
              options={categories.map(c => ({ value: c, label: c }))}
              placeholder="Жанр"
              searchPlaceholder="Шукати жанр..."
              className="w-40"
            />

            <SearchableMultiSelect
              values={selectedAuthors}
              onValuesChange={setSelectedAuthors}
              options={authors.map(a => ({ value: a, label: a }))}
              placeholder="Автор"
              searchPlaceholder="Шукати автора..."
              className="w-40"
            />

            <SearchableMultiSelect
              values={selectedPublishers}
              onValuesChange={setSelectedPublishers}
              options={publishers.map(p => ({ value: p, label: p }))}
              placeholder="Видавництво"
              searchPlaceholder="Шукати видавництво..."
              className="w-44"
            />

            <SearchableMultiSelect
              values={selectedAges}
              onValuesChange={setSelectedAges}
              options={ages.map(a => ({ value: a, label: a }))}
              placeholder="Вік"
              searchPlaceholder="Шукати вік..."
              className="w-36"
            />

            <SearchableMultiSelect
              values={selectedSeriesList}
              onValuesChange={setSelectedSeriesList}
              options={seriesList.map(s => ({ value: s, label: s }))}
              placeholder="Серія"
              searchPlaceholder="Шукати серію..."
              className="w-36"
            />

            <Select value={selectedAvailability} onValueChange={setSelectedAvailability}>
              <SelectTrigger className="w-40 bg-background">
                <SelectValue placeholder="Наявність" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">Всі</SelectItem>
                <SelectItem value="available">В наявності</SelectItem>
                <SelectItem value="unavailable">Орендовані</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant={showNewOnly ? "default" : "outline"}
              size="sm"
              className="h-10"
              onClick={() => setShowNewOnly(!showNewOnly)}
            >
              Новинки
            </Button>

            <Button
              variant={selectedAvailability === "available" ? "default" : "outline"}
              size="sm"
              className="h-10"
              onClick={() => setSelectedAvailability(selectedAvailability === "available" ? "all" : "available")}
            >
              В наявності
            </Button>

            <Select value={sortMode} onValueChange={(v) => setSortMode(v as typeof sortMode)}>
              <SelectTrigger className="w-48 bg-background">
                <SelectValue placeholder="Сортування" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="default">Стандартно</SelectItem>
                <SelectItem value="popularity">За популярністю</SelectItem>
                <SelectItem value="title-asc">За назвою (А-Я)</SelectItem>
                <SelectItem value="title-desc">За назвою (Я-А)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {groupedBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {groupedBooks.map(({ book, total, available, rentalCount }) => (
              <BookCard
                key={book.id}
                id={book.id}
                title={book.title}
                author={book.author}
                coverColor={book.cover_color}
                coverImageUrl={book.cover_image_url}
                available={available > 0}
                isNew={book.new_book || false}
                age={book.age}
                totalCopies={total}
                availableCopies={available}
                rentalCount={rentalCount}
                onClick={() => handleBookClick(book)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Книги не знайдено. Спробуйте інший пошуковий запит.</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-16 bg-secondary/50">
        <div className="container mx-auto px-4 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={libraryLogo} alt="Логотип" className="w-16 h-16 rounded-lg" />
              <span className="font-display font-semibold text-lg text-foreground">Дитяча бібліотека</span>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <Link to="/readers">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary">
                  <Users className="w-4 h-4" />
                  Читачі
                </Button>
              </Link>
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground hover:bg-accent">
                  <Settings className="w-4 h-4" />
                  Адмін-панель
                </Button>
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              © 2026 Дитяча бібліотека. Приємного читання!
            </p>
          </div>
        </div>
      </footer>

      {/* Book Details Dialog */}
      {selectedBook && (
        <BookDetailsDialog
          open={isDetailsDialogOpen}
          onOpenChange={setIsDetailsDialogOpen}
          bookId={selectedBook.id}
          bookTitle={selectedBook.title}
          bookAuthor={selectedBook.author}
          bookDescription={selectedBook.description}
          bookAge={selectedBook.age}
          bookPublisher={selectedBook.publishers?.name}
          bookPublisherCity={selectedBook.publishers?.city}
          bookPublicationYear={selectedBook.publication_year}
          bookSeries={selectedBook.series?.name}
          bookCategory={selectedBook.category}
          coverColor={selectedBook.cover_color}
          coverImageUrl={selectedBook.cover_image_url}
          available={selectedBook.available}
          onRent={handleRentFromDetails}
        />
      )}

      {/* Rent Book Dialog */}
      {selectedBook && (
        <RentBookDialog
          open={isRentDialogOpen}
          onOpenChange={setIsRentDialogOpen}
          bookTitle={selectedBook.title}
          bookId={selectedBook.id}
          isReservation={!selectedBook.available}
          onSuccess={fetchBooks}
        />
      )}
    </div>
  );
};

export default Index;
