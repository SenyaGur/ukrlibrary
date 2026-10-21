import { useEffect, useState } from "react";
import { usersApi, authApi } from "@/lib/api";
import type { UserProfile } from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserPlus, Shield, ShieldOff, Trash2 } from "lucide-react";

/** Format an ISO timestamp as a short local date-time string. */
function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("uk-UA", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function AdminUsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // New-admin form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");

  const load = async () => {
    try {
      const [list, me] = await Promise.all([usersApi.list(), authApi.me().catch(() => null)]);
      setUsers(list);
      setCurrentUserId(me?.id ?? null);
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося завантажити користувачів", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: "Заповніть поля", description: "Email та пароль обов'язкові", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await usersApi.create({ email: email.trim(), password, full_name: fullName.trim(), role: "admin" });
      toast({ title: "Адміністратора додано", description: email.trim() });
      setEmail(""); setFullName(""); setPassword("");
      await load();
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося створити користувача", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRole = async (u: UserProfile) => {
    const nextRole = u.role === "admin" ? "user" : "admin";
    try {
      await usersApi.updateRole(u.id, nextRole);
      toast({ title: "Роль оновлено", description: `${u.email}: ${nextRole === "admin" ? "адміністратор" : "користувач"}` });
      await load();
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося змінити роль", variant: "destructive" });
    }
  };

  const handleDelete = async (u: UserProfile) => {
    try {
      await usersApi.delete(u.id);
      toast({ title: "Користувача видалено", description: u.email });
      await load();
    } catch (e: any) {
      toast({ title: "Помилка", description: e?.message || "Не вдалося видалити користувача", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Додати адміністратора
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-name">Ім'я</Label>
              <Input id="new-admin-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ім'я та прізвище" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-email">Email *</Label>
              <Input id="new-admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@example.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-admin-pass">Пароль *</Label>
              <Input id="new-admin-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Мін. 6 символів" required />
            </div>
            <Button type="submit" disabled={saving} className="gap-2">
              <UserPlus className="w-4 h-4" />
              {saving ? "Додавання..." : "Додати"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Користувачі ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Завантаження...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ім'я</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Створено</TableHead>
                    <TableHead className="text-right">Дії</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => {
                    const isSelf = u.id === currentUserId;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}{isSelf && <span className="text-muted-foreground"> (ви)</span>}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                            {u.role === "admin" ? "Адміністратор" : "Користувач"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatDateTime(u.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline" size="sm" className="gap-1"
                              disabled={isSelf}
                              onClick={() => handleToggleRole(u)}
                              title={u.role === "admin" ? "Зробити користувачем" : "Зробити адміністратором"}
                            >
                              {u.role === "admin" ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                              {u.role === "admin" ? "Зняти права" : "Зробити адміном"}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={isSelf} className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Видалити користувача?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {u.email} буде видалено назавжди. Цю дію не можна скасувати.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Скасувати</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(u)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Видалити
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
