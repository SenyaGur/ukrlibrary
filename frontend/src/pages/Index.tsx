import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BookCard from "@/components/BookCard";
import RentBookDialog from "@/components/RentBookDialog";
import BookDetailsDialog from "@/components/BookDetailsDialog";
import { BookOpen, Library, Search, Settings, Users, LogOut, Filter } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { authApi, booksApi, getToken, setToken } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import libraryLogo from "@/assets/library-logo.png";


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
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedPublisher, setSelectedPublisher] = useState<string>("all");
  const [selectedAuthor, setSelectedAuthor] = useState<string>("all");
  const [selectedAge, setSelectedAge] = useState<string>("all");
  const [selectedSeries, setSelectedSeries] = useState<string>("all");
  const [selectedAvailability, setSelectedAvailability] = useState<string>("all");
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

    const matchesCategory = selectedCategory === "all" || book.category === selectedCategory;
    const matchesAuthor = selectedAuthor === "all" || book.author === selectedAuthor;
    const matchesPublisher = selectedPublisher === "all" || book.publishers?.name === selectedPublisher;
    const matchesAge = selectedAge === "all" || book.age === selectedAge;
    const matchesSeries = selectedSeries === "all" || book.series?.name === selectedSeries;
    const matchesAvailability = selectedAvailability === "all" || (selectedAvailability === "available" ? book.available : !book.available);

    return matchesSearch && matchesCategory && matchesAuthor && matchesPublisher && matchesAge && matchesSeries && matchesAvailability;
  });

  // Group filtered books by title+author, keeping one representative card per group
  const groupedBooks = (() => {
    const groups = new Map<string, { book: Book; total: number; available: number }>();
    for (const book of filteredBooks) {
      const key = `${book.title}|||${book.author}`;
      const existing = groups.get(key);
      if (existing) {
        existing.total++;
        if (book.available) existing.available++;
        // Prefer a copy with a cover image as representative
        if (!existing.book.cover_image_url && book.cover_image_url) {
          existing.book = book;
        }
      } else {
        groups.set(key, { book, total: 1, available: book.available ? 1 : 0 });
      }
    }
    return Array.from(groups.values());
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
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <Library className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Дитяча бібліотека</span>
            </div>
            {isLoggedIn && (
              <div className="flex items-center gap-3">
                <Link to="/admin">
                  <Button variant="ghost" size="sm" className="gap-2 text-white hover:text-white hover:bg-white/20">
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Адмін-панель</span>
                  </Button>
                </Link>
                <Button size="sm" className="gap-2 bg-white text-sky-600 hover:bg-sky-50" onClick={handleLogout}>
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
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="flex items-center justify-center gap-6">
            <img
              src={libraryLogo}
              alt="Логотип бібліотеки"
              className="w-20 h-20 md:w-28 md:h-28 object-contain"
            />
            <h1 className="text-4xl md:text-6xl font-display text-foreground">
              Дитяча бібліотека
            </h1>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="container mx-auto px-4 py-8 border-b">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-foreground mb-1">Дитячі книги</h2>
            <p className="text-sm text-muted-foreground">{books.length} книг у колекції</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
            {categories.slice(0, 12).map((category) => (
              <button
                key={category}
                onClick={() => {
                  setSelectedCategory(category);
                  scrollToBooks();
                }}
                className="text-left font-condensed text-sm text-primary hover:underline"
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
            <h2 className="text-2xl font-bold text-foreground">Рекомендовані книги</h2>
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
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40 bg-background">
                <SelectValue placeholder="Жанр" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">Всі жанри</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
              <SelectTrigger className="w-40 bg-background">
                <SelectValue placeholder="Автор" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">Всі автори</SelectItem>
                {authors.map((author) => (
                  <SelectItem key={author} value={author}>
                    {author}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPublisher} onValueChange={setSelectedPublisher}>
              <SelectTrigger className="w-44 bg-background">
                <SelectValue placeholder="Видавництво" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">Всі видавництва</SelectItem>
                {publishers.map((publisher) => (
                  <SelectItem key={publisher} value={publisher}>
                    {publisher}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAge} onValueChange={setSelectedAge}>
              <SelectTrigger className="w-36 bg-background">
                <SelectValue placeholder="Вік" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">Всі вікові групи</SelectItem>
                {ages.map((age) => (
                  <SelectItem key={age} value={age}>
                    {age}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedSeries} onValueChange={setSelectedSeries}>
              <SelectTrigger className="w-36 bg-background">
                <SelectValue placeholder="Серія" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">Всі серії</SelectItem>
                {seriesList.map((series) => (
                  <SelectItem key={series} value={series}>
                    {series}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
          </div>
        </div>

        {groupedBooks.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {groupedBooks.map(({ book, total, available }) => (
              <BookCard
                key={book.id}
                id={book.id}
                title={book.title}
                author={book.author}
                coverColor={book.cover_color}
                coverImageUrl={book.cover_image_url}
                available={available > 0}
                isNew={book.new_book || false}
                totalCopies={total}
                availableCopies={available}
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
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Library className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg text-foreground">Дитяча бібліотека</span>
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
              © 2024 Дитяча бібліотека. Приємного читання!
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
