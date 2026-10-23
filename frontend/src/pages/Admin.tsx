import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { authApi, booksApi, rentalsApi, usersApi, categoriesApi, seriesApi, publishersApi, readersApi, getToken, setToken, resolveUrl, isInventoryConflict } from "@/lib/api";
import type { RentalRequest, Book, UserProfile, Category, Series, Publisher, ReaderWithChildren, Child } from "@/lib/api-types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  BookPlus,
  FileUp,
  FileDown,
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
  Merge,
  ChevronUp,
  ChevronDown,
  Filter
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatDueDate, isOverdue } from "@/lib/rentals";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Link, useNavigate } from "react-router-dom";
import AddBookDialog from "@/components/admin/AddBookDialog";
import BookLookupDialog from "@/components/admin/BookLookupDialog";
import type { BookPrefill } from "@/lib/api-types";
import { SearchableSelect } from "@/components/ui/searchable-select";
import RentalRequestCard from "@/components/admin/RentalRequestCard";
import ManageCategoriesDialog from "@/components/admin/ManageCategoriesDialog";
import ManageSeriesDialog from "@/components/admin/ManageSeriesDialog";
import ManagePublishersDialog from "@/components/admin/ManagePublishersDialog";
import { ImportBooksFromExcel } from "@/components/admin/ImportBooksFromExcel";
import ManageReadersDialog from "@/components/admin/ManageReadersDialog";
import AdminCreateRentalDialog from "@/components/admin/AdminCreateRentalDialog";
import OverdueRemindersDialog from "@/components/admin/OverdueRemindersDialog";
import { AdminUsersTab } from "@/components/admin/AdminUsersTab";
import { AuditLogTab } from "@/components/admin/AuditLogTab";
import * as XLSX from 'xlsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const Admin = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [rentalRequests, setRentalRequests] = useState<RentalRequest[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [archiveMode, setArchiveMode] = useState(false);
  const books = allBooks.filter(book => !book.archived_at);
  const visibleBooks = allBooks.filter(book => Boolean(book.archived_at) === archiveMode);
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
  const [adminBookAuthor, setAdminBookAuthor] = useState("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const [seriesSearchQuery, setSeriesSearchQuery] = useState("");
  const [publisherSearchQuery, setPublisherSearchQuery] = useState("");
  const [readerSearchQuery, setReaderSearchQuery] = useState("");
  const [journalSearchQuery, setJournalSearchQuery] = useState("");
  const [isAddBookOpen, setIsAddBookOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isLookupOpen, setIsLookupOpen] = useState(false);
  const [importPrefill, setImportPrefill] = useState<BookPrefill | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | null>(null);
  const [isPublisherDialogOpen, setIsPublisherDialogOpen] = useState(false);
  const [editingPublisher, setEditingPublisher] = useState<Publisher | null>(null);
  const [isReaderDialogOpen, setIsReaderDialogOpen] = useState(false);
  const [isCreateRentalOpen, setIsCreateRentalOpen] = useState(false);
  const [isOverdueDialogOpen, setIsOverdueDialogOpen] = useState(false);
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
  const [reassigningRental, setReassigningRental] = useState<RentalRequest | null>(null);
  const [reassignTargetReaderId, setReassignTargetReaderId] = useState("");
  const [reassignTargetChildId, setReassignTargetChildId] = useState("");
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return hash || localStorage.getItem('admin_tab') || "requests";
  });

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    localStorage.setItem('admin_tab', tab);
    window.location.hash = tab;
  };
  // Request filters & sorting
  const [requestFilterReader, setRequestFilterReader] = useState("all");
  const [requestFilterSeries, setRequestFilterSeries] = useState("all");
  const [requestSortField, setRequestSortField] = useState("date");
  const [requestSortDirection, setRequestSortDirection] = useState<"asc" | "desc">("desc");
  // Journal sorting & filters
  const [journalSortField, setJournalSortField] = useState("date");
  const [journalSortDirection, setJournalSortDirection] = useState<"asc" | "desc">("desc");
  const [journalFilterAuthor, setJournalFilterAuthor] = useState("all");
  const [journalFilterSeries, setJournalFilterSeries] = useState("all");
  const [journalFilterReader, setJournalFilterReader] = useState("all");
  const [journalFilterBook, setJournalFilterBook] = useState("all");
  const [requestInvSearch, setRequestInvSearch] = useState("");
  const [bookInvSearch, setBookInvSearch] = useState("");
  const [journalInvSearch, setJournalInvSearch] = useState("");
  const [bookFiltersOpen, setBookFiltersOpen] = useState(false);
  const [bookQuickFilter, setBookQuickFilter] = useState<string | null>(null);
  const [duplicateBookId, setDuplicateBookId] = useState<string | null>(null);
  const [duplicateInvNumber, setDuplicateInvNumber] = useState("");
  const [duplicateSupplier, setDuplicateSupplier] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicateSuggestion, setDuplicateSuggestion] = useState<number | null>(null);
  const duplicateInventoryTouchedRef = useRef(false);
  const duplicateSessionRef = useRef(0);
  const duplicateSuggestionRequestRef = useRef(0);
  const [addingCopy, setAddingCopy] = useState(false);
  const [deleteCopies, setDeleteCopies] = useState<Book[] | null>(null);
  const [archiveCopyId, setArchiveCopyId] = useState("");
  const [archiveError, setArchiveError] = useState("");
  const [archiving, setArchiving] = useState(false);
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
      const data = await booksApi.list('all');
      setAllBooks(data || []);
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

  const handleReassignRental = async () => {
    if (!reassigningRental || !reassignTargetReaderId) return;
    try {
      await rentalsApi.reassign(reassigningRental.id, reassignTargetReaderId, reassignTargetChildId || null);
      toast({ title: "Оренду перепризначено" });
      setReassigningRental(null);
      setReassignTargetReaderId("");
      setReassignTargetChildId("");
      fetchRentalRequests();
    } catch (e: any) {
      toast({ title: "Помилка", description: e.message, variant: "destructive" });
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

  const sendReminder = async (rental: { id: string; renter_name: string }) => {
    try {
      const res = await rentalsApi.remindRental(rental.id);
      if (res.sent) {
        toast({ title: "Нагадування надіслано", description: `Надіслано на ${res.email}` });
      } else {
        const reasons: Record<string, string> = {
          no_email: "У читача не вказано email — додайте його в картці читача",
          smtp_not_configured: "Надсилання email не налаштовано на сервері",
        };
        toast({ title: "Не надіслано", description: reasons[res.reason || ""] || "Не вдалося надіслати", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося надіслати нагадування", variant: "destructive" });
    }
  };

  const bookMap = new Map(allBooks.map(b => [b.id, b]));
  const childMap = new Map(readers.flatMap(r => (r.children || []).map(c => [c.id, c])));
  const readerMap = new Map(readers.map(r => [r.id, r]));

  const filteredRequests = rentalRequests.filter((request) => {
    const book = bookMap.get(request.book_id);
    const linkedReader = request.reader_id ? readerMap.get(request.reader_id) : null;
    const readerNameMatch = !!linkedReader && (
      `${linkedReader.parent_name} ${linkedReader.parent_surname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${linkedReader.parent_surname} ${linkedReader.parent_name}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const matchesSearch = !searchQuery ||
      request.renter_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      readerNameMatch ||
      request.book_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.renter_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesInv = !requestInvSearch || book?.inventory_number?.toString() === requestInvSearch.trim();
    const matchesReader = requestFilterReader === "all" || request.reader_id === requestFilterReader;
    const matchesSeries = requestFilterSeries === "all" || book?.series?.name === requestFilterSeries;
    return matchesSearch && matchesInv && matchesReader && matchesSeries;
  });

  const sortRequests = (requests: RentalRequest[]) => {
    return [...requests].sort((a, b) => {
      let cmp = 0;
      switch (requestSortField) {
        case "date": cmp = (a.approved_at || a.requested_at).localeCompare(b.approved_at || b.requested_at); break;
        case "book": cmp = a.book_title.localeCompare(b.book_title); break;
        case "series": cmp = (bookMap.get(a.book_id)?.series?.name || "").localeCompare(bookMap.get(b.book_id)?.series?.name || ""); break;
        case "author": cmp = (bookMap.get(a.book_id)?.author || "").localeCompare(bookMap.get(b.book_id)?.author || ""); break;
        case "reader": cmp = a.renter_name.localeCompare(b.renter_name); break;
      }
      return requestSortDirection === "asc" ? cmp : -cmp;
    });
  };

  const toggleRequestSort = (field: string) => {
    if (requestSortField === field) {
      setRequestSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setRequestSortField(field);
      setRequestSortDirection("asc");
    }
  };

  const handleReaderClick = (readerId: string) => {
    handleTabChange("readers");
    const reader = readers.find(r => r.id === readerId);
    if (reader) setReaderSearchQuery(reader.parent_surname);
  };

  const handleBookClick = (bookTitle: string) => {
    handleTabChange("books");
    setBookSearchQuery(bookTitle);
    // Scroll to the book after tab switch
    setTimeout(() => {
      const el = document.getElementById("books-list");
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const pendingRequests = sortRequests(filteredRequests.filter(r => r.status === "pending"));
  const approvedRequests = sortRequests(filteredRequests.filter(r => r.status === "approved"));
  const queuedRequests = filteredRequests.filter(r => r.status === "queued").sort((a, b) => (a.queue_position ?? 0) - (b.queue_position ?? 0));
  const returnedRequests = sortRequests(filteredRequests.filter(r => r.status === "returned"));
  const declinedRequests = sortRequests(filteredRequests.filter(r => r.status === "declined"));

  // Build set of duplicate inventory numbers
  const invCount = new Map<number, number>();
  allBooks.forEach(b => {
    if (b.inventory_number != null) invCount.set(b.inventory_number, (invCount.get(b.inventory_number) || 0) + 1);
  });
  const duplicateInvNumbers = new Set([...invCount.entries()].filter(([, c]) => c > 1).map(([n]) => n));

  const filteredBooks = visibleBooks.filter((book) => {
    const matchesSearch =
      book.title.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      book.author.toLowerCase().includes(bookSearchQuery.toLowerCase()) ||
      book.category.toLowerCase().includes(bookSearchQuery.toLowerCase());
    const matchesInv = !bookInvSearch || book.inventory_number?.toString() === bookInvSearch.trim();
    const matchesCategory = adminBookCategory === "all" || book.category === adminBookCategory;
    const matchesSeries = adminBookSeries === "all" || book.series?.name === adminBookSeries;
    const matchesPublisher = adminBookPublisher === "all" || book.publishers?.name === adminBookPublisher;
    const matchesAvailability = adminBookAvailability === "all" || (adminBookAvailability === "available" ? book.available : !book.available);
    const matchesAuthor = adminBookAuthor === "all" || book.author === adminBookAuthor;

    // Quick filters
    let matchesQuick = true;
    if (bookQuickFilter === "no-inv") {
      matchesQuick = book.inventory_number == null || duplicateInvNumbers.has(book.inventory_number);
    } else if (bookQuickFilter === "no-image") {
      matchesQuick = !book.cover_image_url;
    } else if (bookQuickFilter === "no-age") {
      matchesQuick = !book.age;
    }

    return matchesSearch && matchesInv && matchesCategory && matchesSeries && matchesPublisher && matchesAvailability && matchesAuthor && matchesQuick;
  });

  // Group filtered books by title+author for admin display
  const groupedBooks = (() => {
    const groups = new Map<string, { book: Book; copies: Book[]; total: number; available: number }>();
    for (const book of filteredBooks) {
      const key = JSON.stringify([book.title, book.author]);
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

  useEffect(() => {
    const session = ++duplicateSessionRef.current;
    const request = ++duplicateSuggestionRequestRef.current;
    if (!duplicateBookId) return;

    booksApi.inventorySuggestions().then(data => {
      if (duplicateSessionRef.current !== session || duplicateSuggestionRequestRef.current !== request) return;
      setDuplicateSuggestion(data.next_inventory_number);
      setDuplicateInvNumber(prev => duplicateInventoryTouchedRef.current || prev.trim()
        ? prev
        : String(data.next_inventory_number));
    }).catch(() => {
      if (duplicateSessionRef.current !== session || duplicateSuggestionRequestRef.current !== request) return;
      setDuplicateError("Не вдалося отримати вільний номер. Введіть його вручну.");
    });

    return () => { duplicateSessionRef.current++; };
  }, [duplicateBookId]);

  const handleAddCopy = (bookId: string) => {
    duplicateInventoryTouchedRef.current = false;
    setDuplicateSuggestion(null);
    setAddingCopy(false);
    setDuplicateBookId(bookId);
    setDuplicateInvNumber("");
    setDuplicateSupplier("");
    setDuplicateError("");
  };

  const confirmAddCopy = async () => {
    if (!duplicateBookId) return;
    const invNum = Number(duplicateInvNumber);
    if (!/^\d+$/.test(duplicateInvNumber) || !Number.isSafeInteger(invNum) || invNum <= 0) {
      setDuplicateError("Інвентарний номер має бути додатним цілим числом не більшим за 9007199254740991.");
      return;
    }
    const session = duplicateSessionRef.current;
    duplicateSuggestionRequestRef.current++;
    setAddingCopy(true);
    setDuplicateError("");
    try {
      await booksApi.duplicate(duplicateBookId, invNum, duplicateSupplier || null);
      if (duplicateSessionRef.current !== session) {
        fetchBooks();
        return;
      }
      toast({ title: "Примірник додано" });
      fetchBooks();
      setDuplicateBookId(null);
    } catch (error) {
      if (duplicateSessionRef.current !== session) return;
      if (isInventoryConflict(error)) {
        setDuplicateSuggestion(error.payload.next_inventory_number);
      }
      setDuplicateError(error instanceof Error ? error.message : "Не вдалося додати примірник. Спробуйте ще раз.");
    } finally {
      if (duplicateSessionRef.current === session) setAddingCopy(false);
    }
  };

  const handleRemoveCopy = (copies: Book[]) => {
    const availableCopies = copies.filter(b => b.available);
    if (availableCopies.length === 0) {
      toast({ title: "Помилка", description: "Усі примірники видані — архівування неможливе", variant: "destructive" });
      return;
    }
    setArchiveError("");
    setArchiveCopyId(availableCopies.length === 1 ? availableCopies[0].id : "");
    setDeleteCopies(availableCopies);
  };

  const confirmArchiveCopy = async () => {
    if (!archiveCopyId) return;
    setArchiving(true);
    setArchiveError("");
    try {
      await booksApi.archive(archiveCopyId);
      toast({ title: "Примірник переміщено в архів" });
      setDeleteCopies(null);
      fetchBooks();
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "Не вдалося архівувати примірник");
    } finally {
      setArchiving(false);
    }
  };

  const handleRestoreBook = async (bookId: string, scope?: 'title') => {
    try {
      await booksApi.restore(bookId, scope);
      toast({ title: scope ? "Усі примірники назви відновлено" : "Примірник відновлено" });
      fetchBooks();
    } catch (e) {
      toast({ title: "Помилка відновлення", description: e instanceof Error ? e.message : "Не вдалося відновити книгу", variant: "destructive" });
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

  // Journal: returned rentals with author/series lookup, sorting & filtering
  const toggleJournalSort = (field: string) => {
    if (journalSortField === field) {
      setJournalSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setJournalSortField(field);
      setJournalSortDirection("asc");
    }
  };

  const journalEntries = rentalRequests
    .filter(r => r.status === "returned")
    .filter(r => {
      if (journalSearchQuery) {
        const q = journalSearchQuery.toLowerCase();
        const jBook = bookMap.get(r.book_id);
        const author = jBook?.author || "";
        if (!(r.renter_name.toLowerCase().includes(q) ||
          r.book_title.toLowerCase().includes(q) ||
          author.toLowerCase().includes(q))) return false;
      }
      if (journalInvSearch) {
        const jBook = bookMap.get(r.book_id);
        if (jBook?.inventory_number?.toString() !== journalInvSearch.trim()) return false;
      }
      const book = bookMap.get(r.book_id);
      if (journalFilterAuthor !== "all" && book?.author !== journalFilterAuthor) return false;
      if (journalFilterSeries !== "all" && book?.series?.name !== journalFilterSeries) return false;
      if (journalFilterReader !== "all" && r.renter_name !== journalFilterReader) return false;
      if (journalFilterBook !== "all" && r.book_title !== journalFilterBook) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      switch (journalSortField) {
        case "date": cmp = (a.approved_at || a.requested_at).localeCompare(b.approved_at || b.requested_at); break;
        case "author": cmp = (bookMap.get(a.book_id)?.author || "").localeCompare(bookMap.get(b.book_id)?.author || ""); break;
        case "title": cmp = a.book_title.localeCompare(b.book_title); break;
        case "series": cmp = (bookMap.get(a.book_id)?.series?.name || "").localeCompare(bookMap.get(b.book_id)?.series?.name || ""); break;
        case "return_date": cmp = (a.return_date || "").localeCompare(b.return_date || ""); break;
        case "reader": cmp = a.renter_name.localeCompare(b.renter_name); break;
        case "child": cmp = (childMap.get(a.child_id || "")?.name || "").localeCompare(childMap.get(b.child_id || "")?.name || ""); break;
      }
      return journalSortDirection === "asc" ? cmp : -cmp;
    });

  // Unique values for journal filter dropdowns
  const journalAuthors = [...new Set(allBooks.map(b => b.author).filter(Boolean))].sort();
  const journalSeriesNames = [...new Set(allBooks.map(b => b.series?.name).filter(Boolean) as string[])].sort();
  const journalReaders = [...new Set(rentalRequests.filter(r => r.status === "returned").map(r => r.renter_name))].sort();
  const journalBookTitles = [...new Set(rentalRequests.filter(r => r.status === "returned").map(r => r.book_title))].sort();

  const [editingBookCopies, setEditingBookCopies] = useState<Book[]>([]);

  const handleEditBook = (book: Book, copies?: Book[]) => {
    setEditingBook(book);
    setEditingBookCopies(copies && copies.length > 1 ? copies : []);
    setIsAddBookOpen(true);
  };

  const handleArchiveBook = async (bookId: string) => {
    await booksApi.archive(bookId, 'title');
    toast({ title: "Усі примірники назви переміщено в архів" });
    fetchBooks();
  };

  const handleExportBooks = () => {
    const exportData = books.map((b, idx) => ({
      '№': idx + 1,
      'Інв. №': b.inventory_number || '',
      'Категорія': b.category,
      'Автор': b.author,
      'Назва': b.title,
      'Наявність': b.available ? 'Так' : 'Ні',
      'Серія': b.series?.name || '',
      'Видавництво': b.publishers?.name || '',
      'Рік видання': b.publication_year || '',
      'ISBN': b.isbn || '',
      'Даритель': b.supplier || '',
      'Вік': b.age || '',
      'Опис': b.description || '',
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Книги');
    XLSX.writeFile(wb, `бібліотека_книги_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Експорт завершено", description: `${books.length} книг експортовано` });
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
      setImportPrefill(null);
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
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList>
            <TabsTrigger value="requests">Запити на оренду</TabsTrigger>
            <TabsTrigger value="journal">Журнал</TabsTrigger>
            <TabsTrigger value="books">Управління книгами</TabsTrigger>
            <TabsTrigger value="categories">Категорії</TabsTrigger>
            <TabsTrigger value="series">Серії</TabsTrigger>
            <TabsTrigger value="publishers">Видавництва</TabsTrigger>
            <TabsTrigger value="readers">Читачі</TabsTrigger>
            <TabsTrigger value="users">Адміністратори</TabsTrigger>
            <TabsTrigger value="audit">Журнал дій</TabsTrigger>
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
                    placeholder="Шукати за ім'ям, книгою..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex flex-wrap gap-3 mt-3">
                  <Input
                    type="number"
                    placeholder="Інв. №"
                    value={requestInvSearch}
                    onChange={(e) => setRequestInvSearch(e.target.value)}
                    className="w-24"
                  />
                  <Select value={requestFilterReader} onValueChange={setRequestFilterReader}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Читач" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі читачі</SelectItem>
                      {readers.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.parent_surname} {r.parent_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={requestFilterSeries} onValueChange={setRequestFilterSeries}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Серія" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Всі серії</SelectItem>
                      {series.map(s => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-center text-muted-foreground">Завантаження...</p>
                ) : (
                  <div className="space-y-6">
                    {/* Render a request table section */}
                    {(() => {
                      const RequestTableHeader = () => (
                        <TableHeader>
                          <TableRow>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleRequestSort("date")}>
                              <div className="flex items-center gap-1">Дата {requestSortField === "date" && (requestSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleRequestSort("book")}>
                              <div className="flex items-center gap-1">Книга {requestSortField === "book" && (requestSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleRequestSort("series")}>
                              <div className="flex items-center gap-1">Серія {requestSortField === "series" && (requestSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none max-w-[150px]" onClick={() => toggleRequestSort("author")}>
                              <div className="flex items-center gap-1">Автор {requestSortField === "author" && (requestSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </TableHead>
                            <TableHead className="cursor-pointer select-none" onClick={() => toggleRequestSort("reader")}>
                              <div className="flex items-center gap-1">Читач {requestSortField === "reader" && (requestSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                            </TableHead>
                            <TableHead>Статус</TableHead>
                            <TableHead>Дії</TableHead>
                          </TableRow>
                        </TableHeader>
                      );

                      const renderSection = (title: string, items: RentalRequest[], badgeVariant: "default" | "secondary" | "outline", renderRow: (r: RentalRequest) => React.ReactNode) => {
                        if (items.length === 0 && (title === "Черга резервацій" || title === "Повернені" || title === "Відхилені")) return null;
                        return (
                          <div>
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                              {title}
                              <Badge variant={badgeVariant}>{items.length}</Badge>
                            </h3>
                            {items.length === 0 ? (
                              <p className="text-sm text-muted-foreground">Немає запитів</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <Table>
                                  <RequestTableHeader />
                                  <TableBody>{items.map(renderRow)}</TableBody>
                                </Table>
                              </div>
                            )}
                          </div>
                        );
                      };

                      return <>
                        {renderSection("Черга резервацій", queuedRequests, "outline", (request) => (
                          <RentalRequestCard key={request.id} request={request} bookMap={bookMap} onReaderClick={handleReaderClick} onBookClick={handleBookClick}
                            onDecline={() => updateRequestStatus(request.id, "declined")}
                            onReassign={() => setReassigningRental(request)} />
                        ))}
                        {renderSection("Нові запити", pendingRequests, "default", (request) => (
                          <RentalRequestCard key={request.id} request={request} bookMap={bookMap} onReaderClick={handleReaderClick} onBookClick={handleBookClick}
                            onApprove={() => updateRequestStatus(request.id, "approved")}
                            onDecline={() => updateRequestStatus(request.id, "declined")}
                            onSendReminder={() => sendReminder(request)}
                            onReassign={() => setReassigningRental(request)} />
                        ))}
                        {renderSection("Схвалені", approvedRequests, "secondary", (request) => (
                          <RentalRequestCard key={request.id} request={request} bookMap={bookMap} onReaderClick={handleReaderClick} onBookClick={handleBookClick}
                            onReturn={() => updateRequestStatus(request.id, "returned")}
                            onSendReminder={() => sendReminder(request)}
                            onReassign={() => setReassigningRental(request)} />
                        ))}
                        {renderSection("Повернені", returnedRequests, "secondary", (request) => (
                          <RentalRequestCard key={request.id} request={request} bookMap={bookMap} onReaderClick={handleReaderClick} onBookClick={handleBookClick}
                            onReassign={() => setReassigningRental(request)} />
                        ))}
                        {renderSection("Відхилені", declinedRequests, "outline", (request) => (
                          <RentalRequestCard key={request.id} request={request} bookMap={bookMap} onReaderClick={handleReaderClick} onBookClick={handleBookClick}
                            onReassign={() => setReassigningRental(request)} />
                        ))}
                      </>;
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="journal" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <CardTitle>Журнал видач ({journalEntries.length})</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 shrink-0"
                    onClick={() => setIsOverdueDialogOpen(true)}
                    title="Переглянути прострочені книги, додати email та надіслати нагадування"
                  >
                    <Mail className="w-4 h-4" />
                    Прострочені книги
                  </Button>
                </div>
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
                <div className="flex flex-wrap gap-3 mt-3">
                  <Input
                    type="number"
                    placeholder="Інв. №"
                    value={journalInvSearch}
                    onChange={(e) => setJournalInvSearch(e.target.value)}
                    className="w-24"
                  />
                  <SearchableSelect
                    value={journalFilterBook}
                    onValueChange={setJournalFilterBook}
                    options={journalBookTitles.map(t => ({ value: t, label: t }))}
                    placeholder="Книга"
                    searchPlaceholder="Шукати книгу..."
                    allLabel="Всі книги"
                    className="w-48"
                  />
                  <SearchableSelect
                    value={journalFilterAuthor}
                    onValueChange={setJournalFilterAuthor}
                    options={journalAuthors.map(a => ({ value: a, label: a }))}
                    placeholder="Автор"
                    searchPlaceholder="Шукати автора..."
                    allLabel="Всі автори"
                    className="w-44"
                  />
                  <SearchableSelect
                    value={journalFilterSeries}
                    onValueChange={setJournalFilterSeries}
                    options={journalSeriesNames.map(s => ({ value: s, label: s }))}
                    placeholder="Серія"
                    searchPlaceholder="Шукати серію..."
                    allLabel="Всі серії"
                    className="w-44"
                  />
                  <SearchableSelect
                    value={journalFilterReader}
                    onValueChange={setJournalFilterReader}
                    options={journalReaders.map(r => ({ value: r, label: r }))}
                    placeholder="Читач"
                    searchPlaceholder="Шукати читача..."
                    allLabel="Всі читачі"
                    className="w-48"
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
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleJournalSort("date")}>
                            <div className="flex items-center gap-1">Дата видачі {journalSortField === "date" && (journalSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none w-[100px] max-w-[100px]" onClick={() => toggleJournalSort("author")}>
                            <div className="flex items-center gap-1">Автор {journalSortField === "author" && (journalSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleJournalSort("title")}>
                            <div className="flex items-center gap-1">Назва {journalSortField === "title" && (journalSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleJournalSort("series")}>
                            <div className="flex items-center gap-1">Серія {journalSortField === "series" && (journalSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleJournalSort("return_date")}>
                            <div className="flex items-center gap-1">Дата повернення {journalSortField === "return_date" && (journalSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                          </TableHead>
                          <TableHead>Очікуване повернення</TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleJournalSort("reader")}>
                            <div className="flex items-center gap-1">Читач {journalSortField === "reader" && (journalSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                          </TableHead>
                          <TableHead className="cursor-pointer select-none" onClick={() => toggleJournalSort("child")}>
                            <div className="flex items-center gap-1">Дитина {journalSortField === "child" && (journalSortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}</div>
                          </TableHead>
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
                            <TableCell className="w-[100px] max-w-[100px] truncate" title={bookMap.get(entry.book_id)?.author || ""}>{bookMap.get(entry.book_id)?.author || "—"}</TableCell>
                            <TableCell className="font-medium">{entry.book_title}</TableCell>
                            <TableCell>{bookMap.get(entry.book_id)?.series?.name || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap">
                              {entry.return_date
                                ? new Date(entry.return_date).toLocaleDateString('uk-UA')
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {entry.return_date ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <span className={isOverdue(entry.approved_at, entry.rental_duration, entry.return_date) ? "text-red-600 font-semibold" : ""}>
                                  {formatDueDate(entry.approved_at, entry.rental_duration)}
                                  {isOverdue(entry.approved_at, entry.rental_duration, entry.return_date) ? " · прострочено" : ""}
                                </span>
                              )}
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
                  <CardTitle>{archiveMode ? "Архів" : "Управління книгами"} ({groupedBooks.length} назв, {filteredBooks.length} прим.)</CardTitle>
                  <div className="flex gap-2">
                    <Button variant={archiveMode ? "default" : "outline"} onClick={() => setArchiveMode(mode => !mode)}>
                      {archiveMode ? "Активні книги" : "Архів"}
                    </Button>
                    <Button variant="outline" onClick={handleExportBooks} className="gap-2">
                      <FileDown className="w-4 h-4" />
                      Експорт
                    </Button>
                    <Button variant="outline" onClick={() => setIsLookupOpen(true)} className="gap-2">
                      <Search className="w-4 h-4" />
                      Знайти онлайн
                    </Button>
                    <Button onClick={() => setIsAddBookOpen(true)} className="gap-2">
                      <BookPlus className="w-4 h-4" />
                      Додати книгу
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="Шукати книгу за назвою, автором або категорією..."
                      value={bookSearchQuery}
                      onChange={(e) => setBookSearchQuery(e.target.value)}
                      className="pl-10 border-2"
                    />
                  </div>
                  <Input
                    type="number"
                    placeholder="Інв. №"
                    value={bookInvSearch}
                    onChange={(e) => setBookInvSearch(e.target.value)}
                    className="w-24 border-2"
                  />
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <Collapsible open={bookFiltersOpen} onOpenChange={setBookFiltersOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                      <Filter className="w-4 h-4" />
                      Фільтри
                      {(adminBookCategory !== "all" || adminBookSeries !== "all" || adminBookPublisher !== "all" || adminBookAvailability !== "all" || adminBookAuthor !== "all") && (
                        <Badge variant="secondary" className="ml-1">Активні</Badge>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="flex flex-wrap gap-3 mt-3 p-3 bg-muted/50 rounded-lg">
                      <SearchableSelect
                        value={adminBookCategory}
                        onValueChange={setAdminBookCategory}
                        options={categories.map(cat => ({ value: cat.name, label: cat.name }))}
                        placeholder="Категорія"
                        searchPlaceholder="Шукати категорію..."
                        allLabel="Всі категорії"
                        className="w-40"
                      />
                      <SearchableSelect
                        value={adminBookSeries}
                        onValueChange={setAdminBookSeries}
                        options={series.map(s => ({ value: s.name, label: s.name }))}
                        placeholder="Серія"
                        searchPlaceholder="Шукати серію..."
                        allLabel="Всі серії"
                        className="w-40"
                      />
                      <SearchableSelect
                        value={adminBookPublisher}
                        onValueChange={setAdminBookPublisher}
                        options={publishers.map(pub => ({ value: pub.name, label: pub.name }))}
                        placeholder="Видавництво"
                        searchPlaceholder="Шукати видавництво..."
                        allLabel="Всі видавництва"
                        className="w-44"
                      />
                      <SearchableSelect
                        value={adminBookAuthor}
                        onValueChange={setAdminBookAuthor}
                        options={[...new Set(visibleBooks.map(b => b.author).filter(Boolean))].sort().map(a => ({ value: a, label: a }))}
                        placeholder="Автор"
                        searchPlaceholder="Шукати автора..."
                        allLabel="Всі автори"
                        className="w-44"
                      />
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
                  </CollapsibleContent>
                </Collapsible>
                  <span className="text-xs text-muted-foreground mx-1">|</span>
                  <Button
                    variant={bookQuickFilter === "no-inv" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setBookQuickFilter(bookQuickFilter === "no-inv" ? null : "no-inv")}
                  >
                    Без інв. / дублі
                  </Button>
                  <Button
                    variant={bookQuickFilter === "no-image" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setBookQuickFilter(bookQuickFilter === "no-image" ? null : "no-image")}
                  >
                    Без фото
                  </Button>
                  <Button
                    variant={bookQuickFilter === "no-age" ? "default" : "outline"}
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => setBookQuickFilter(bookQuickFilter === "no-age" ? null : "no-age")}
                  >
                    Без віку
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card id="books-list">
              <CardContent className="pt-6">
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
                                    Примірники: {total}{!archiveMode && ` (${available} дост.)`}
                                  </Badge>
                                  {!archiveMode && available < total && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                                      {total - available} на руках
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {archiveMode ? (
                                  <Button variant="outline" onClick={() => handleRestoreBook(book.id, 'title')}>Відновити всі примірники</Button>
                                ) : (
                                <>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleRemoveCopy(copies)}
                                    title="Архівувати примірник"
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
                                  onClick={() => handleEditBook(book, copies)}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                </>
                                )}
                              </div>
                            </div>
                            {archiveMode && (
                              <div className="flex flex-col gap-2 mt-3">
                                <p className="text-xs text-muted-foreground">Історію читання збережено, інвентарні номери зарезервовано.</p>
                                {copies.map(copy => (
                                  <div key={copy.id} className="flex items-center gap-3 text-sm">
                                    <span>Інв. № {copy.inventory_number ?? "—"}</span>
                                    <Button size="sm" variant="outline" onClick={() => handleRestoreBook(copy.id)}>Відновити</Button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* On-hand copies: who holds them and until when (shown for single- and multi-copy books) */}
                            {!archiveMode && copies.some((c) => !c.available) && (
                              <div className="flex flex-col gap-1 mt-2">
                                {copies.filter((c) => !c.available).map((copy) => {
                                  const cr = copy.current_rental;
                                  const overdue = cr ? isOverdue(cr.approved_at, cr.rental_duration, null) : false;
                                  return (
                                    <div key={copy.id} className="text-xs flex flex-wrap items-center gap-1.5">
                                      <Badge variant="secondary" className="text-xs">
                                        {copy.inventory_number ? `Інв. ${copy.inventory_number}` : "без інв."} — видана
                                      </Badge>
                                      {cr ? (
                                        <span className={overdue ? "text-red-600 font-semibold" : "text-muted-foreground"}>
                                          на руках у {cr.renter_name} до {formatDueDate(cr.approved_at, cr.rental_duration)}
                                          {overdue ? " · прострочено" : ""}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">на руках</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {/* Available copies summary (only when multiple copies) */}
                            {!archiveMode && copies.length > 1 && copies.some((c) => c.available) && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {copies.filter((c) => c.available).map((copy) => (
                                  <Badge key={copy.id} variant="outline" className="text-xs">
                                    {copy.inventory_number ? `Інв. ${copy.inventory_number}` : "без інв."}{copy.supplier ? ` (${copy.supplier})` : ""} — вільна
                                  </Badge>
                                ))}
                              </div>
                            )}
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

          <TabsContent value="users" className="space-y-6">
            {activeTab === "users" && <AdminUsersTab />}
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            {activeTab === "audit" && <AuditLogTab />}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteCopies} onOpenChange={(open) => { if (!open && !archiving) setDeleteCopies(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архівувати примірник?</AlertDialogTitle>
            <AlertDialogDescription>
              Оберіть примірник і підтвердьте переміщення в архів. Історія читання збережеться, інвентарний номер залишиться зарезервованим. Примірник можна відновити з архіву.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {deleteCopies?.map((copy) => (
              <Button key={copy.id} variant={archiveCopyId === copy.id ? "default" : "outline"}
                disabled={archiving} className="w-full justify-between" onClick={() => setArchiveCopyId(copy.id)}>
                <span>Інв. № {copy.inventory_number ?? "—"}</span>
                <Badge variant="outline" className="text-xs">вільна</Badge>
              </Button>
            ))}
          </div>
          {archiveError && <p role="alert" className="text-sm text-destructive">{archiveError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiving}>Скасувати</AlertDialogCancel>
            <Button disabled={!archiveCopyId || archiving} onClick={confirmArchiveCopy}>
              {archiving ? "Архівування..." : "Архівувати"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!duplicateBookId} onOpenChange={(open) => { if (!open) { setDuplicateBookId(null); setDuplicateSupplier(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Додати примірник</AlertDialogTitle>
            <AlertDialogDescription>
              Вкажіть додатний цілий інвентарний номер для нового примірника. Запропонований номер можна змінити; він не зарезервований до збереження.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            id="duplicateInventoryNumber"
            aria-label="Інвентарний номер примірника"
            type="number"
            min={1}
            max={Number.MAX_SAFE_INTEGER}
            step={1}
            required
            placeholder="Інвентарний номер"
            value={duplicateInvNumber}
            onChange={(e) => { duplicateInventoryTouchedRef.current = true; setDuplicateInvNumber(e.target.value); setDuplicateError(""); }}
            autoFocus
          />
          {duplicateSuggestion !== null && (
            <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
              <span>Вільний номер: <strong>{duplicateSuggestion}</strong></span>
              <Button type="button" variant="outline" size="sm" onClick={() => {
                duplicateInventoryTouchedRef.current = true;
                setDuplicateInvNumber(String(duplicateSuggestion));
                setDuplicateError("");
              }}>Застосувати номер</Button>
            </div>
          )}
          {duplicateError && <p role="alert" className="text-sm text-destructive">{duplicateError}</p>}
          <Input
            placeholder="Даритель (необов'язково)"
            value={duplicateSupplier}
            onChange={(e) => setDuplicateSupplier(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <Button type="button" disabled={addingCopy} onClick={confirmAddCopy}>{addingCopy ? "Додавання..." : "Додати"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddBookDialog
        open={isAddBookOpen}
        onOpenChange={(open) => { handleCloseDialog(open); if (!open) setEditingBookCopies([]); }}
        onSuccess={fetchBooks}
        onArchive={handleArchiveBook}
        book={editingBook}
        copies={editingBookCopies}
        initialData={importPrefill ? {
          title: importPrefill.title,
          author: importPrefill.author,
          description: importPrefill.description,
          publicationYear: importPrefill.publicationYear,
          isbn: importPrefill.isbn,
          age: importPrefill.age,
          categoryId: importPrefill.categoryId,
          publisherId: importPrefill.publisherId,
          seriesId: importPrefill.seriesId,
          coverImageUrl: importPrefill.coverImageUrl,
        } : null}
        allInventoryNumbers={(() => {
          const m = new Map<number, string>();
          allBooks.forEach(b => { if (b.inventory_number != null) m.set(b.inventory_number, b.id); });
          return m;
        })()}
      />

      <BookLookupDialog
        open={isLookupOpen}
        onOpenChange={setIsLookupOpen}
        onImported={(prefill) => {
          setEditingBook(null);
          setEditingBookCopies([]);
          setImportPrefill(prefill);
          setIsLookupOpen(false);
          setIsAddBookOpen(true);
          if (prefill.publisherId == null && prefill.publisherName) {
            toast({ title: "Перевірте видавництво", description: `Видавництво «${prefill.publisherName}» не знайдено у базі — оберіть або створіть його у формі.` });
          }
        }}
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

      <OverdueRemindersDialog
        open={isOverdueDialogOpen}
        onOpenChange={setIsOverdueDialogOpen}
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

      {/* Reassign rental reader dialog */}
      <AlertDialog open={!!reassigningRental} onOpenChange={(open) => { if (!open) { setReassigningRental(null); setReassignTargetReaderId(""); setReassignTargetChildId(""); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Перепризначити читача</AlertDialogTitle>
            <AlertDialogDescription>
              Поточний читач: {reassigningRental?.renter_name}. Оберіть нового читача для цього запиту.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-2">
            <Select value={reassignTargetReaderId} onValueChange={(v) => { setReassignTargetReaderId(v); setReassignTargetChildId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Оберіть читача..." />
              </SelectTrigger>
              <SelectContent>
                {readers.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.parent_surname} {r.parent_name} — {r.phone1}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reassignTargetReaderId && readers.find(r => r.id === reassignTargetReaderId)?.children.length! > 0 && (
              <Select value={reassignTargetChildId || "none"} onValueChange={(v) => setReassignTargetChildId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Оберіть дитину..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— без дитини —</SelectItem>
                  {readers.find(r => r.id === reassignTargetReaderId)?.children.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.surname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction onClick={handleReassignRental} disabled={!reassignTargetReaderId}>Перепризначити</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
