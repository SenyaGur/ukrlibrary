import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RegisterReaderDialog from "@/components/RegisterReaderDialog";
import ReaderHistoryDialog from "@/components/ReaderHistoryDialog";
import { Users, Search, Plus, Phone, MapPin, Baby, History } from "lucide-react";
import { Link } from "react-router-dom";
import { readersApi } from "@/lib/api";
import type { ReaderWithChildren } from "@/lib/api-types";

const Readers = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [readers, setReaders] = useState<ReaderWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [selectedReaderId, setSelectedReaderId] = useState<string | null>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

  useEffect(() => {
    fetchReaders();
  }, []);

  const fetchReaders = async () => {
    try {
      // readersApi.list() returns readers; we need to get children for each
      const readersData = await readersApi.list();

      // Load children for each reader
      const readersWithChildren = await Promise.all(
        readersData.map(async (reader) => {
          try {
            const children = await readersApi.getChildren(reader.id);
            return { ...reader, children };
          } catch {
            return { ...reader, children: [] };
          }
        })
      );

      setReaders(readersWithChildren);
    } catch (error) {
      console.error("Помилка завантаження читачів:", error);
    }
    setLoading(false);
  };

  const filteredReaders = readers.filter((reader) =>
    reader.parent_surname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reader.parent_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    reader.phone1.includes(searchQuery) ||
    reader.children.some(child =>
      child.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      child.surname.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleViewHistory = (readerId: string) => {
    setSelectedReaderId(readerId);
    setIsHistoryDialogOpen(true);
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
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
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold text-foreground">Читачі</h1>
                <p className="text-sm text-muted-foreground">
                  Керування читачами бібліотеки
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/">
                <Button variant="outline">На головну</Button>
              </Link>
              <Button onClick={() => setIsRegisterDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Зареєструвати читача
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Шукати за ПІБ, телефоном або ім'ям дитини..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Readers List */}
        {filteredReaders.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReaders.map((reader) => (
              <Card key={reader.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="bg-primary/5">
                  <CardTitle className="text-lg">
                    {reader.parent_surname} {reader.parent_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <div>
                      <p>{reader.phone1}</p>
                      {reader.phone2 && <p>{reader.phone2}</p>}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 mt-0.5" />
                    <p>{reader.address}</p>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Baby className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Діти:</span>
                    </div>
                    <div className="space-y-2">
                      {reader.children.map((child) => (
                        <div key={child.id} className="flex items-center justify-between text-sm">
                          <span>
                            {child.surname} {child.name}
                          </span>
                          <Badge variant="secondary">
                            {calculateAge(child.birth_date)} років
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => handleViewHistory(reader.id)}
                  >
                    <History className="w-4 h-4 mr-2" />
                    Історія орендувань
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "Читачів не знайдено" : "Немає зареєстрованих читачів"}
            </p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <RegisterReaderDialog
        open={isRegisterDialogOpen}
        onOpenChange={setIsRegisterDialogOpen}
        onSuccess={fetchReaders}
      />

      {selectedReaderId && (
        <ReaderHistoryDialog
          open={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          readerId={selectedReaderId}
        />
      )}
    </div>
  );
};

export default Readers;
