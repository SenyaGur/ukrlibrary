import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { authApi, booksApi, rentalsApi, usersApi, categoriesApi, seriesApi, publishersApi, readersApi, getToken, setToken, resolveUrl } from "@/lib/api";
import type { RentalRequest, Book, UserProfile, Category, Series, Publisher, ReaderWithChildren, Child } from "@/lib/api-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  BookPlus,
  FileUp,
  CheckCircle,
  XCircle,
  Mail,
  Search,
  Edit,
  LogOut,
  Plus,
  Minus,
  Trash2,
  ArrowRightLeft,
  Check,
  ChevronsUpDown,
  Baby,
  Merge
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link, useNavigate } from "react-router-dom";
import AddBookDialog from "@/components/admin/AddBookDialog";
import RentalRequestCard from "@/components/admin/RentalRequestCard";
import ManageCategoriesDialog from "@/components/admin/ManageCategoriesDialog";
import ManageSeriesDialog from "@/components/admin/ManageSeriesDialog";
import ManagePublishersDialog from "@/components/admin/ManagePublishersDialog";
import { ImportBooksFromExcel } from "@/components/admin/ImportBooksFromExcel";
import ManageReadersDialog from "@/components/admin/ManageReadersDialog";
import AdminCreateRentalDialog from "@/components/admin/AdminCreateRentalDialog";

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [rentalRequests, setRentalRequests] = useState<RentalRequest[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [readers, setReaders] = useState<ReaderWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookSearchQuery, setBookSearchQuery] = useState("");
  const [adminBookCategory, setAdminBookCategory] = useState("all");
  const [adminBookSeries, setAdminBookSeries] = useState("all");
  const [adminBookPublisher, setAdminBookPublisher] = useState("all");
  const [adminBookAvailability, setAdminBookAvailability] = useState("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [seriesSearchQuery, setSeriesSearchQuery] = useState("");
  const [publisherSearchQuery, setPublisherSearchQuery] = useState("");
  const [readerSearchQuery, setReaderSearchQuery] = useState("");
  const [journalSearchQuery, setJournalSearchQuery] = useState("");
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [isPublisherDialogOpen, setIsPublisherDialogOpen] = useState(false);
  const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
  const [isReaderDialogOpen, setIsReaderDialogOpen] = useState(false);
  const [isCreateRentalOpen, setIsCreateRentalOpen] = useState(false);
  const [editingReader, setEditingReader] = useState<ReaderWithChildren | null>(null);
  const [reassigningChild, setReassigningChild] = useState<Child | null>(null);
  const [reassignReaderId, setReassignReaderId] = useState("");
  const [reassignPopoverOpen, setReassignPopoverOpen] = useState(false);
  const [convertingReader, setConvertingReader] = useState<ReaderWithChildren | null>(null);
  const [convertParentId, setConvertParentId] = useState("");
  const [convertPopoverOpen, setConvertPopoverOpen] = useState(false);
  const [mergingReader, setMergingReader] = useState<ReaderWithChildren | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState("");
  const [mergePopoverOpen, setMergePopoverOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuthAndLoad = async () => {
      if (!getToken()) {
        navigate("/auth");
        return;
      }

      try {
        // Check if user is admin
        const user = await authApi.me();
        setCurrentUserId(user.id);

        if (user.role !== 'admin') {
          toast({
            title: "Доступ заборонено",
            description: "У вас немає прав адміністратора",
            variant: "destructive",
          });
          navigate("/");
          return;
        }

        setIsLoggedIn(true);
        setIsAdmin(true);

        // Only fetch data if admin
        fetchRentalRequests();
        fetchBooks();
        fetchUsers();
        fetchCategories();
        fetchSeries();
        fetchPublishers();
        fetchReaders();
      } catch (error) {
        setToken(null);
        navigate("/auth");
      }
    };

    checkAuthAndLoad();

    // Set up polling for rental requests and books (replaces real-time subscription)
    const interval = setInterval(() => {
      fetchRentalRequests();
      fetchBooks();
    }, 300000); // 5 minutes

    return () => {
      clearInterval(interval);
    };
  }, [navigate]);

  const fetchRentalRequests = async () => {
    console.log("Fetching rental requests...");
    try {
      const data = await rentalsApi.list();
      console.log("Rental requests fetched:", data?.length || 0, "requests");
      setRentalRequests(data || []);
    } catch (error) {
      console.error("Помилка завантаження запитів:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити запити на оренду",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const fetchBooks = async () => {
    try {
      const data = await booksApi.list();
      setBooks(data || []);
    } catch (error) {
      console.error("Помилка завантаження книг:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити книги",
        variant: "destructive",
      });
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data.map(u => ({ ...u, full_name: u.full_name || 'Без імені' })));
    } catch (error) {
      console.error("Помилка завантаження користувачів:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити користувачів",
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, newRole: 'admin' | 'user') => {
    try {
      await usersApi.updateRole(userId, newRole);
      toast({
        title: "Успішно",
        description: `Роль користувача змінено на ${newRole === 'admin' ? 'Адміністратор' : 'Читач'}`,
      });
      fetchUsers();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося оновити роль користувача",
        variant: "destructive",
      });
    }
  };

  const fetchCategories = async () => {
    try {
      const data = await categoriesApi.list();
      setCategories(data || []);
    } catch (error) {
      console.error("Помилка завантаження категорій:", error);
    }
  };

  const fetchSeries = async () => {
    try {
      const data = await seriesApi.list();
      setSeries(data || []);
    } catch (error) {
      console.error("Помилка завантаження серій:", error);
    }
  };

  const fetchPublishers = async () => {
    try {
      const data = await publishersApi.list();
      setPublishers(data || []);
    } catch (error) {
      console.error("Помилка завантаження видавництв:", error);
    }
  };

  const fetchReaders = async () => {
    try {
      const data = await readersApi.list();
      setReaders(data || []);
    } catch (error) {
      console.error("Помилка завантаження читачів:", error);
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      await categoriesApi.delete(id);
      toast({
        title: "Успішно",
        description: "Категорію видалено",
      });
      fetchCategories();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити категорію",
        variant: "destructive",
      });
    }
  };

  const deleteSeries = async (id: string) => {
    try {
      await seriesApi.delete(id);
      toast({
        title: "Успішно",
        description: "Серію видалено",
      });
      fetchSeries();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити серію",
        variant: "destructive",
      });
    }
  };

  const deletePublisher = async (id: string) => {
    try {
      await publishersApi.delete(id);
      toast({
        title: "Успішно",
        description: "Видавництво видалено",
      });
      fetchPublishers();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити видавництво",
        variant: "destructive",
      });
    }
  };

  const deleteReader = async (id: string) => {
    try {
      await readersApi.delete(id);
      toast({
        title: "Успішно",
        description: "Читача видалено",
      });
      fetchReaders();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося видалити читача",
        variant: "destructive",
      });
    }
  };

  const handleReassignChild = async () => {
    if (!reassigningChild || !reassignReaderId) return;
    try {
      await readersApi.reassignChild(reassigningChild.id, reassignReaderId);
      toast({
        title: "Успішно",
        description: `Дитину "${reassigningChild.name}" переведено`,
      });
      setReassigningChild(null);
      setReassignReaderId("");
      fetchReaders();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося перевести дитину",
        variant: "destructive",
      });
    }
  };

  const handleMergeReader = async () => {
    if (!mergingReader || !mergeTargetId) return;
    try {
      await readersApi.merge(mergingReader.id, mergeTargetId);
      const target = readers.find(r => r.id === mergeTargetId);
      toast({
        title: "Успішно",
        description: `"${mergingReader.parent_name} ${mergingReader.parent_surname}" об'єднано з "${target?.parent_name} ${target?.parent_surname}"`,
      });
      setMergingReader(null);
      setMergeTargetId("");
      fetchReaders();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося об'єднати читачів",
        variant: "destructive",
      });
    }
  };

  const handleConvertToChild = async () => {
    if (!convertingReader || !convertParentId) return;
    try {
      await readersApi.convertToChild(convertingReader.id, convertParentId);
      toast({
        title: "Успішно",
        description: `"${convertingReader.parent_name} ${convertingReader.parent_surname}" перетворено на дитину`,
      });
      setConvertingReader(null);
      setConvertParentId("");
      fetchReaders();
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося перетворити на дитину",
        variant: "destructive",
      });
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: "approved" | "declined" | "returned") => {
    try {
      await rentalsApi.updateStatus(requestId, newStatus);
      const messages = {
        approved: { title: "Схвалено", desc: "Запит успішно схвалено" },
        declined: { title: "Відхилено", desc: "Запит успішно відхилено" },
        returned: { title: "Повернено", desc: "Книгу повернено" },
      };
      toast({
        title: messages[newStatus].title,
        description: messages[newStatus].desc,
      });
      fetchRentalRequests();
      fetchBooks();
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Не вдалося оновити статус",
        variant: "destructive",
      });
    }
  };

  const sendReminder = async (email: string, name: string) => {
    // TODO: Інтеграція з email сервісом
    toast({
      title: "Нагадування надіслано",
      description: `Email нагадування надіслано на ${email}`,
    });
    console.log(`Sending reminder to ${name} at ${email}`);
  };

  const filteredRequests = rentalRequests.filter((request) =>
    request.renter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.book_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    request.renter_email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingRequests = filteredRequests.filter(r => r.status === "pending");
  const approvedRequests = filteredRequests.filter(r => r.status === "approved");
  const queuedRequests = filteredRequests.filter(r => r.status === "queued").sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
  const returnedRequests = filteredRequests.filter(r => r.status === "returned");
  const declinedRequests = filteredRequests.filter(r => r.status === "declined");

  const filteredBooks = books.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      book.category.toLowerCase().includes(bookSearchQuery.toLowerCase());
    const matchesCategory = adminBookCategory === "all" || book.category === adminBookCategory;
    const matchesSeries = adminBookSeries === "all" || book.series?.name === adminBookSeries;
    const matchesPublisher = adminBookPublisher === "all" || book.publishers?.name === adminBookPublisher;
    const matchesAvailability = adminBookAvailability === "all" || (adminBookAvailability === "available" ? book.available : !book.available);
    return matchesSearch && matchesCategory && matchesSeries && matchesPublisher && matchesAvailability;
  });

  // Group filtered books by title+author for admin display
  const groupedBooks = (() => {
    const groups = new Map<string, { book: Book; copies: Book[]; total: number; available: number }>();
    for (const book of filteredBooks) {
      const key = `${book.title}|||${book.author}`;
      const existing = groups.get(key);
      if (existing) {
        existing.copies.push(book);
        existing.total++;
        if (book.available) existing.available++;
        if (!existing.book.cover_image_url && book.cover_image_url) {
          existing.book = book;
        }
      } else {
        groups.set(key, { book, copies: [book], total: 1, available: book.available ? 1 : 0 });
      }
    }
    return Array.from(groups.values());
  })();

  const handleAddCopy = async (bookId: string) => {
    try {
      await booksApi.duplicate(bookId);
      toast({ title: "Примірник додано" });
      fetchBooks();
    } catch (e) {
      toast({ title: "Помилка", description: "Не вдалося додати примірник", variant: "destructive" });
    }
  };

  const handleRemoveCopy = async (copies: Book[]) => {
    const availableCopy = copies.find(b => b.available);
    if (!availableCopy) {
      toast({ title: "Помилка", description: "Всі примірники орендовані — видалити неможливо", variant: "destructive" });
      return;
    }
    try {
      await booksApi.delete(availableCopy.id);
      toast({ title: "Примірник видалено" });
      fetchBooks();
    } catch (e: any) {
      toast({ title: "Помилка", description: e.message || "Не вдалося видалити примірник", variant: "destructive" });
    }
  };

  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
  );

  const filteredSeries = series.filter((s) =>
    s.name.toLowerCase().includes(seriesSearchQuery.toLowerCase())
  );

  const filteredPublishers = publishers.filter((pub) =>
    pub.name.toLowerCase().includes(publisherSearchQuery.toLowerCase()) ||
    pub.city.toLowerCase().includes(publisherSearchQuery.toLowerCase())
  );

  const filteredReaders = readers.filter((reader) => {
    const q = readerSearchQuery.toLowerCase();
    return reader.parent_surname.toLowerCase().includes(q) ||
      reader.parent_name.toLowerCase().includes(q) ||
      reader.phone1.includes(readerSearchQuery) ||
      (reader.children || []).some(c => c.name.toLowerCase().includes(q));
  });

  const getChildAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  };

  // Journal: approved + returned rentals with author lookup
  const bookMap = new Map(books.map(b => [b.id, b]));
  const childMap = new Map(readers.flatMap(r => (r.children || []).map(c => [c.id, c])));
  const journalEntries = rentalRequests
    .filter(r => r.status === "returned")
    .filter(r => {
      if (!journalSearchQuery) return true;
      const q = journalSearchQuery.toLowerCase();
      const author = bookMap.get(r.book_id)?.author || "";
      return r.renter_name.toLowerCase().includes(q) ||
        r.book_title.toLowerCase().includes(q) ||
        author.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const da = a.approved_at || a.requested_at;
      const db = b.approved_at || b.requested_at;
      return db.localeCompare(da);
    });

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setIsAddBookOpen(true);
  };

  const [availabilityBook, setAvailabilityBook] = useState<Book | null>(null);

  const handleToggleAvailability = async () => {
    if (!availabilityBook) return;
    try {
      if (availabilityBook.available) {
        await booksApi.update(availabilityBook.id, { available: false } as any);
        toast({ title: `"${availabilityBook.title}" зарезервовано` });
      } else {
        await booksApi.forceAvailable(availabilityBook.id);
        toast({ title: `"${availabilityBook.title}" повернуто в наявність` });
      }
      fetchBooks();
      fetchRentalRequests();
    } catch (e) {
      toast({ title: "Помилка", description: "Не вдалося змінити статус", variant: "destructive" });
    } finally {
      setAvailabilityBook(null);
    }
  };

  const handleCloseDialog = (open: boolean) => {
    setIsAddBookOpen(open);
    if (!open) {
      setEditingBook(null);
    }
  };

  const handleLogout = async () => {
    authApi.logout();
    navigate("/auth");
  };

  if (!isLoggedIn || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <h1 className="text-2xl font-bold">Адмін-панель</h1>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Вийти
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList>
            <TabsTrigger value="requests">Запити на оренду</TabsTrigger>
            <TabsTrigger value="journal">Журнал</TabsTrigger>
            <TabsTrigger value="books">Управління книгами</TabsTrigger>
            <TabsTrigger value="users">Користувачі</TabsTrigger>
            <TabsTrigger value="categories">Категорії</TabsTrigger>
            <TabsTrigger value="series">Серії</TabsTrigger>
            <TabsTrigger value="publishers">Видавництва</TabsTrigger>
            <TabsTrigger value="readers">Читачі</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Запити на оренду</CardTitle>
                  <Button onClick={() => setIsCreateRentalOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Нова оренда
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати за ім'ям, книгою або email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground">Завантаження...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Черга резервацій */}
                    {queuedRequests.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          Черга резервацій
                          <Badge variant="outline">{queuedRequests.length}</Badge>
                        </h3>
                        <div className="space-y-3">
                          {queuedRequests.map((request) => (
                            <RentalRequestCard
                              key={request.id}
                              request={request}
                              onDecline={() => updateRequestStatus(request.id, "declined")}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Нові запити */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        Нові запити
                        <Badge variant="default">{pendingRequests.length}</Badge>
                      </h3>
                      {pendingRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Немає нових запитів</p>
                      ) : (
                        <div className="space-y-3">
                          {pendingRequests.map((request) => (
                            <RentalRequestCard
                              key={request.id}
                              request={request}
                              onApprove={() => updateRequestStatus(request.id, "approved")}
                              onDecline={() => updateRequestStatus(request.id, "declined")}
                              onSendReminder={() => sendReminder(request.renter_email, request.renter_name)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Схвалені запити */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        Схвалені
                        <Badge variant="secondary">{approvedRequests.length}</Badge>
                      </h3>
                      {approvedRequests.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Немає схвалених запитів</p>
                      ) : (
                        <div className="space-y-3">
                          {approvedRequests.map((request) => (
                            <RentalRequestCard
                              key={request.id}
                              request={request}
                              onReturn={() => updateRequestStatus(request.id, "returned")}
                              onSendReminder={() => sendReminder(request.renter_email, request.renter_name)}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Повернені запити */}
                    {returnedRequests.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          Повернені
                          <Badge variant="secondary">{returnedRequests.length}</Badge>
                        </h3>
                        <div className="space-y-3">
                          {returnedRequests.map((request) => (
                            <RentalRequestCard
                              key={request.id}
                              request={request}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Відхилені запити */}
                    {declinedRequests.length > 0 && (
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          Відхилені
                          <Badge variant="outline">{declinedRequests.length}</Badge>
                        </h3>
                        <div className="space-y-3">
                          {declinedRequests.map((request) => (
                            <RentalRequestCard
                              key={request.id}
                              request={request}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journal" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Журнал видач ({journalEntries.length})</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати за назвою, автором або читачем..."
                    value={journalSearchQuery}
                    onChange={(e) => setJournalSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {journalEntries.length === 0 ? (
                  <p className="text-center text-muted-foreground">Записів не знайдено</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Дата видачі</TableHead>
                          <TableHead>Автор</TableHead>
                          <TableHead>Назва</TableHead>
                          <TableHead>Дата повернення</TableHead>
                          <TableHead>Читач</TableHead>
                          <TableHead>Дитина</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journalEntries.map((entry, idx) => (
                          <TableRow key={entry.id}>
                            <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {entry.approved_at
                                ? new Date(entry.approved_at).toLocaleDateString('uk-UA')
                                : "—"}
                            </TableCell>
                            <TableCell>{bookMap.get(entry.book_id)?.author || "—"}</TableCell>
                            <TableCell className="font-medium">{entry.book_title}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {entry.return_date
                                ? new Date(entry.return_date).toLocaleDateString('uk-UA')
                                : "—"}
                            </TableCell>
                            <TableCell>{entry.renter_name}</TableCell>
                            <TableCell>
                              {entry.child_id ? childMap.get(entry.child_id)?.name || "—" : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="books" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Імпорт книг з Excel</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <ImportBooksFromExcel />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Управління книгами ({groupedBooks.length} назв, {books.length} прим.)</CardTitle>
                  <Button onClick={() => setIsAddBookOpen(true)} className="gap-2">
                    <BookPlus className="w-4 h-4" />
                    Додати книгу
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати книгу за назвою, автором або категорією..."
                    value={bookSearchQuery}
                    onChange={(e) => setBookSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  <Select value={adminBookCategory} onValueChange={setAdminBookCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Категорія" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі категорії</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={adminBookSeries} onValueChange={setAdminBookSeries}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Серія" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі серії</SelectItem>
                      {series.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={adminBookPublisher} onValueChange={setAdminBookPublisher}>
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Видавництво" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі видавництва</SelectItem>
                      {publishers.map((pub) => (
                        <SelectItem key={pub.id} value={pub.name}>{pub.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={adminBookAvailability} onValueChange={setAdminBookAvailability}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Наявність" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі</SelectItem>
                      <SelectItem value="available">В наявності</SelectItem>
                      <SelectItem value="unavailable">Орендовані</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground">Завантаження...</p>
                ) : groupedBooks.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    {bookSearchQuery ? "Книг не знайдено" : "Немає книг у базі даних"}
                  </p>
                ) : (
                  <div className="grid gap-4">
                    {groupedBooks.map(({ book, copies, total, available }) => (
                      <Card key={book.id} className="overflow-hidden">
                        <div className="flex gap-4 p-4">
                          <div
                            className="w-16 h-20 rounded flex-shrink-0 overflow-hidden flex items-center justify-center"
                            style={{ backgroundColor: book.cover_color }}
                          >
                            {book.cover_image_url ? (
                              <img
                                src={resolveUrl(book.cover_image_url)}
                                alt={book.title}
                                className="w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg truncate">{book.title}</h3>
                                <p className="text-sm text-muted-foreground">{book.author}</p>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge variant="secondary">{book.category}</Badge>
                                  <Badge variant="outline">
                                    Примірники: {total} ({available} дост.)
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleRemoveCopy(copies)}
                                    disabled={total <= 1}
                                    title="Видалити примірник"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </Button>
                                  <span className="text-sm font-medium w-6 text-center">{total}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleAddCopy(book.id)}
                                    title="Додати примірник"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </Button>
                                </div>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleEditBook(book)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Користувачі ({users.length})</CardTitle>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати за іменем..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground">Завантаження...</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    {userSearchQuery ? "Користувачів не знайдено" : "Немає користувачів"}
                  </p>
                ) : (
                  <div className="grid gap-4">
                    {filteredUsers.map((user) => (
                      <Card key={user.id} className="overflow-hidden">
                        <div className="flex gap-4 p-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-lg">{user.full_name}</h3>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                                    {user.role === 'admin' ? 'Адміністратор' : 'Читач'}
                                  </Badge>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => updateUserRole(
                                  user.id,
                                  user.role === 'admin' ? 'user' : 'admin'
                                )}
                                disabled={user.id === currentUserId}
                              >
                                {user.role === 'admin' ? 'Зробити читачем' : 'Зробити адміном'}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Категорії ({categories.length})</CardTitle>
                  <Button onClick={() => setIsCategoryDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Додати категорію
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати категорію..."
                    value={categorySearchQuery}
                    onChange={(e) => setCategorySearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredCategories.length === 0 ? (
                  <p className="text-center text-muted-foreground">Категорій не знайдено</p>
                ) : (
                  <div className="grid gap-2">
                    {filteredCategories.map((category) => (
                      <Card key={category.id}>
                        <div className="flex items-center justify-between p-4">
                          <span className="font-medium">{category.name}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setEditingCategory(category);
                                setIsCategoryDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deleteCategory(category.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="series" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Серії ({series.length})</CardTitle>
                  <Button onClick={() => setIsSeriesDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Додати серію
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати серію..."
                    value={seriesSearchQuery}
                    onChange={(e) => setSeriesSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredSeries.length === 0 ? (
                  <p className="text-center text-muted-foreground">Серій не знайдено</p>
                ) : (
                  <div className="grid gap-2">
                    {filteredSeries.map((s) => (
                      <Card key={s.id}>
                        <div className="flex items-center justify-between p-4">
                          <span className="font-medium">{s.name}</span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setEditingSeries(s);
                                setIsSeriesDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deleteSeries(s.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="publishers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Видавництва ({publishers.length})</CardTitle>
                  <Button onClick={() => setIsPublisherDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Додати видавництво
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати видавництво..."
                    value={publisherSearchQuery}
                    onChange={(e) => setPublisherSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredPublishers.length === 0 ? (
                  <p className="text-center text-muted-foreground">Видавництв не знайдено</p>
                ) : (
                  <div className="grid gap-2">
                    {filteredPublishers.map((pub) => (
                      <Card key={pub.id}>
                        <div className="flex items-center justify-between p-4">
                          <div>
                            <div className="font-medium">{pub.name}</div>
                            <div className="text-sm text-muted-foreground">{pub.city}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setEditingPublisher(pub);
                                setIsPublisherDialogOpen(true);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deletePublisher(pub.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="readers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Читачі ({readers.length})</CardTitle>
                  <Button onClick={() => setIsReaderDialogOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Додати читача
                  </Button>
                </div>
                <div className="relative mt-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Шукати читача..."
                    value={readerSearchQuery}
                    onChange={(e) => setReaderSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredReaders.length === 0 ? (
                  <p className="text-center text-muted-foreground">Читачів не знайдено</p>
                ) : (
                  <div className="grid gap-3">
                    {filteredReaders.map((reader) => {
                      const activeRentals = rentalRequests.filter(r => r.reader_id === reader.id && r.status === 'approved').length;
                      const children = reader.children || [];
                      return (
                        <Card key={reader.id}>
                          <div className="flex items-start justify-between p-4">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">
                                {reader.parent_surname} {reader.parent_name}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {reader.phone1}
                                {reader.phone2 && `, ${reader.phone2}`}
                              </div>
                              <div className="text-sm text-muted-foreground">{reader.address}</div>
                              {reader.comment && (
                                <div className="text-sm text-muted-foreground italic mt-1">{reader.comment}</div>
                              )}
                              {children.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {children.map((child) => (
                                    <Badge
                                      key={child.id}
                                      variant="outline"
                                      className="text-xs cursor-pointer hover:bg-accent gap-1"
                                      onClick={() => {
                                        setReassigningChild(child);
                                        setReassignReaderId("");
                                      }}
                                    >
                                      {child.name}
                                      {child.birth_date && `, ${getChildAge(child.birth_date)}р`}
                                      {child.gender && ` (${child.gender})`}
                                      <ArrowRightLeft className="w-3 h-3 ml-1 opacity-50" />
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              {activeRentals > 0 && (
                                <Badge variant="secondary" className="mt-2">
                                  Книг на руках: {activeRentals}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-2 ml-2">
                              <Button
                                variant="outline"
                                size="icon"
                                title="Об'єднати з іншим читачем"
                                onClick={() => {
                                  setMergingReader(reader);
                                  setMergeTargetId("");
                                }}
                              >
                                <Merge className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                title="Перетворити на дитину"
                                onClick={() => {
                                  setConvertingReader(reader);
                                  setConvertParentId("");
                                }}
                              >
                                <Baby className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => {
                                  setEditingReader(reader);
                                  setIsReaderDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => deleteReader(reader.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddBookDialog
        open={isAddBookOpen}
        onOpenChange={handleCloseDialog}
        onSuccess={fetchBooks}
        book={editingBook}
      />

      <ManageCategoriesDialog
        open={isCategoryDialogOpen}
        onOpenChange={(open) => {
          setIsCategoryDialogOpen(open);
          if (!open) setEditingCategory(null);
        }}
        category={editingCategory}
        onSuccess={fetchCategories}
      />

      <ManageSeriesDialog
        open={isSeriesDialogOpen}
        onOpenChange={(open) => {
          setIsSeriesDialogOpen(open);
          if (!open) setEditingSeries(null);
        }}
        series={editingSeries}
        onSuccess={fetchSeries}
      />

      <ManagePublishersDialog
        open={isPublisherDialogOpen}
        onOpenChange={(open) => {
          setIsPublisherDialogOpen(open);
          if (!open) setEditingPublisher(null);
        }}
        publisher={editingPublisher}
        onSuccess={fetchPublishers}
      />

      <AdminCreateRentalDialog
        open={isCreateRentalOpen}
        onOpenChange={setIsCreateRentalOpen}
        books={books}
        readers={readers}
        onSuccess={() => { fetchRentalRequests(); fetchBooks(); }}
      />

      <ManageReadersDialog
        open={isReaderDialogOpen}
        onOpenChange={(open) => {
          setIsReaderDialogOpen(open);
          if (!open) setEditingReader(null);
        }}
        reader={editingReader}
        onSuccess={fetchReaders}
      />

      <AlertDialog open={!!availabilityBook} onOpenChange={(open) => { if (!open) setAvailabilityBook(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {availabilityBook?.available ? "Зарезервувати книгу?" : "Повернути книгу в наявність?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {availabilityBook?.available
                ? `"${availabilityBook?.title}" буде позначено як недоступну.`
                : `"${availabilityBook?.title}" буде позначено як доступну, а пов'язані запити — як повернені.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleAvailability}>
              {availabilityBook?.available ? "Зарезервувати" : "Повернути"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reassign child dialog */}
      <AlertDialog open={!!reassigningChild} onOpenChange={(open) => { if (!open) { setReassigningChild(null); setReassignReaderId(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перевести дитину</AlertDialogTitle>
            <AlertDialogDescription>
              Оберіть нового батька/матір для {reassigningChild?.name} {reassigningChild?.surname}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Popover open={reassignPopoverOpen} onOpenChange={setReassignPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left"
                >
                  {reassignReaderId
                    ? (() => {
                        const r = readers.find(r => r.id === reassignReaderId);
                        return r ? `${r.parent_surname} ${r.parent_name}` : "";
                      })()
                    : <span className="text-muted-foreground">Оберіть читача...</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0 pointer-events-auto" align="start">
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput placeholder="Пошук читача..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>Читачів не знайдено</CommandEmpty>
                    <CommandGroup>
                      {readers
                        .filter(r => r.id !== reassigningChild?.reader_id)
                        .map((reader) => (
                          <CommandItem
                            key={reader.id}
                            value={`${reader.parent_surname} ${reader.parent_name} ${reader.phone1}`}
                            onSelect={() => {
                              setReassignReaderId(reader.id);
                              setReassignPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", reassignReaderId === reader.id ? "opacity-100" : "opacity-0")} />
                            {reader.parent_surname} {reader.parent_name} — {reader.phone1}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={handleReassignChild} disabled={!reassignReaderId}>
              Перевести
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert reader to child dialog */}
      <AlertDialog open={!!convertingReader} onOpenChange={(open) => { if (!open) { setConvertingReader(null); setConvertParentId(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перетворити на дитину</AlertDialogTitle>
            <AlertDialogDescription>
              "{convertingReader?.parent_name} {convertingReader?.parent_surname}" стане дитиною обраного читача. Оренди та існуючі діти будуть перенесені.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Popover open={convertPopoverOpen} onOpenChange={setConvertPopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left"
                >
                  {convertParentId
                    ? (() => {
                        const r = readers.find(r => r.id === convertParentId);
                        return r ? `${r.parent_surname} ${r.parent_name}` : "";
                      })()
                    : <span className="text-muted-foreground">Оберіть батька/матір...</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0 pointer-events-auto" align="start">
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput placeholder="Пошук читача..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>Читачів не знайдено</CommandEmpty>
                    <CommandGroup>
                      {readers
                        .filter(r => r.id !== convertingReader?.id)
                        .map((reader) => (
                          <CommandItem
                            key={reader.id}
                            value={`${reader.parent_surname} ${reader.parent_name} ${reader.phone1}`}
                            onSelect={() => {
                              setConvertParentId(reader.id);
                              setConvertPopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", convertParentId === reader.id ? "opacity-100" : "opacity-0")} />
                            {reader.parent_surname} {reader.parent_name} — {reader.phone1}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={handleConvertToChild} disabled={!convertParentId}>
              Перетворити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge readers dialog */}
      <AlertDialog open={!!mergingReader} onOpenChange={(open) => { if (!open) { setMergingReader(null); setMergeTargetId(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Об'єднати читачів</AlertDialogTitle>
            <AlertDialogDescription>
              Діти та оренди "{mergingReader?.parent_name} {mergingReader?.parent_surname}" будуть перенесені до обраного читача, а поточного буде видалено.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Popover open={mergePopoverOpen} onOpenChange={setMergePopoverOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between font-normal h-auto min-h-10 whitespace-normal text-left"
                >
                  {mergeTargetId
                    ? (() => {
                        const r = readers.find(r => r.id === mergeTargetId);
                        return r ? `${r.parent_surname} ${r.parent_name}` : "";
                      })()
                    : <span className="text-muted-foreground">Оберіть читача...</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0 pointer-events-auto" align="start">
                <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
                  <CommandInput placeholder="Пошук читача..." />
                  <CommandList className="max-h-[200px]">
                    <CommandEmpty>Читачів не знайдено</CommandEmpty>
                    <CommandGroup>
                      {readers
                        .filter(r => r.id !== mergingReader?.id)
                        .map((reader) => (
                          <CommandItem
                            key={reader.id}
                            value={`${reader.parent_surname} ${reader.parent_name} ${reader.phone1}`}
                            onSelect={() => {
                              setMergeTargetId(reader.id);
                              setMergePopoverOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", mergeTargetId === reader.id ? "opacity-100" : "opacity-0")} />
                            {reader.parent_surname} {reader.parent_name} — {reader.phone1}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={handleMergeReader} disabled={!mergeTargetId}>
              Об'єднати
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
