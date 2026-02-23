import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authApi, getToken, setToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Library, Key, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Некоректна email адреса"),
  password: z.string().min(6, "Пароль має бути мінімум 6 символів"),
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Ім'я має містити мінімум 2 символи"),
  email: z.string().email("Некоректна email адреса"),
  password: z.string().min(6, "Пароль має бути мінімум 6 символів"),
});

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  const generatePassword = () => {
    const length = 12;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(password);
    setShowPassword(true);
    toast({
      title: "Пароль згенеровано",
      description: "Збережіть його у безпечному місці",
    });
  };

  useEffect(() => {
    // Check if already logged in
    if (getToken()) {
      setIsLoggedIn(true);
      navigate("/");
    }
  }, [navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      z.object({ email: z.string().email("Некоректна email адреса") }).parse({ email });

      toast({
        title: "Інформація",
        description: "Зверніться до адміністратора для скидання паролю",
      });

      setIsForgotPassword(false);
      setIsLogin(true);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast({
          title: "Помилка",
          description: error.message || "Щось пішло не так",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      if (isLogin) {
        const validatedData = loginSchema.parse({ email, password });

        try {
          const result = await authApi.login({
            email: validatedData.email,
            password: validatedData.password,
          });
          setToken(result.token);
          setIsLoggedIn(true);

          toast({
            title: "Успішно!",
            description: "Ви увійшли в систему",
          });

          navigate("/");
        } catch (error: any) {
          if (error.message?.includes("Invalid") || error.message?.includes("invalid")) {
            throw new Error("Невірний email або пароль");
          }
          throw error;
        }
      } else {
        const validatedData = signupSchema.parse({ fullName, email, password });

        try {
          const result = await authApi.signup({
            email: validatedData.email,
            password: validatedData.password,
            full_name: validatedData.fullName,
          });
          setToken(result.token);

          toast({
            title: "Успішно!",
            description: "Обліковий запис створено. Ви можете увійти в систему.",
          });

          // Переключаємось на форму логіну
          setIsLogin(true);
          setPassword("");
        } catch (error: any) {
          if (error.message?.includes("already") || error.message?.includes("exists")) {
            throw new Error("Користувач з таким email вже зареєстрований");
          }
          throw error;
        }
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast({
          title: "Помилка",
          description: error.message || "Щось пішло не так",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return isLoggedIn ? null : (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Library className="w-12 h-12 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {isForgotPassword ? "Відновлення пароля" : isLogin ? "Вхід" : "Реєстрація"}
          </CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Введіть email для відновлення пароля"
              : isLogin
              ? "Введіть свої дані для входу в систему"
              : "Створіть новий обліковий запис"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isForgotPassword ? handleForgotPassword : handleSubmit} className="space-y-4">
            {!isLogin && !isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Повне ім'я</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) {
                      setErrors(prev => ({ ...prev, fullName: "" }));
                    }
                  }}
                  placeholder="Ім'я Прізвище"
                  className={errors.fullName ? "border-destructive" : ""}
                />
                {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) {
                    setErrors(prev => ({ ...prev, email: "" }));
                  }
                }}
                placeholder="your@email.com"
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {!isForgotPassword && (
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) {
                      setErrors(prev => ({ ...prev, password: "" }));
                    }
                  }}
                  placeholder="••••••••"
                  className={errors.password ? "border-destructive pr-20" : "pr-20"}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  {!isLogin && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={generatePassword}
                      title="Згенерувати пароль"
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Приховати пароль" : "Показати пароль"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Завантаження..." : isForgotPassword ? "Відновити пароль" : isLogin ? "Увійти" : "Зареєструватися"}
            </Button>

            {isLogin && !isForgotPassword && (
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => setIsForgotPassword(true)}
              >
                Забули пароль?
              </Button>
            )}

            {!isForgotPassword && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFullName("");
                  setPassword("");
                }}
              >
                {isLogin
                  ? "Немає облікового запису? Зареєструватися"
                  : "Вже є обліковий запис? Увійти"}
              </Button>
            )}

            {isForgotPassword && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsForgotPassword(false);
                  setIsLogin(true);
                  setErrors({});
                }}
              >
                Повернутися до входу
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
