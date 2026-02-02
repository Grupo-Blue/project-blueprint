import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft } from "lucide-react";

type AuthMode = "signin" | "signup" | "forgot-password" | "reset-password";
type Perfil = "TRAFEGO" | "SDR_COMERCIAL" | "DIRECAO" | "ADMIN";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nome, setNome] = useState("");
  const [perfil, setPerfil] = useState<Perfil>("TRAFEGO");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if this is a password reset flow
    const type = searchParams.get("type");
    if (type === "recovery") {
      setMode("reset-password");
      return;
    }

    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && mode !== "reset-password") {
        navigate("/dashboard");
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset-password");
      } else if (event === "SIGNED_IN" && session && mode !== "reset-password") {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams, mode]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Erro ao fazer login",
            description: "Email ou senha incorretos",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao fazer login",
            description: error.message,
            variant: "destructive",
          });
        }
      } else if (data.user) {
        // Verificar se o usuário foi aprovado
        const { data: profile } = await supabase
          .from("profiles")
          .select("aprovado")
          .eq("id", data.user.id)
          .single();

        if (!profile?.aprovado) {
          await supabase.auth.signOut();
          toast({
            title: "Acesso pendente",
            description: "Seu cadastro ainda não foi aprovado pelo administrador",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro ao fazer login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nome,
            perfil,
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        if (error.message.includes("User already registered")) {
          toast({
            title: "Erro ao cadastrar",
            description: "Este email já está cadastrado",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro ao cadastrar",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Aguarde a aprovação do administrador para acessar o sistema",
        });
        setMode("signin");
        setPassword("");
      }
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro ao cadastrar",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?type=recovery`,
      });

      if (error) {
        toast({
          title: "Erro ao enviar email",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Email enviado!",
          description: "Verifique sua caixa de entrada para redefinir sua senha",
        });
        setMode("signin");
      }
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro ao enviar o email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no mínimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        toast({
          title: "Erro ao redefinir senha",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Senha redefinida!",
          description: "Sua senha foi alterada com sucesso",
        });
        setPassword("");
        setConfirmPassword("");
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Erro inesperado",
        description: error.message || "Ocorreu um erro ao redefinir a senha",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "signin":
        return "Bem-vindo ao SGT";
      case "signup":
        return "Cadastre-se no SGT";
      case "forgot-password":
        return "Esqueceu sua senha?";
      case "reset-password":
        return "Redefinir senha";
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "signin":
        return "Entre com suas credenciais para acessar o sistema";
      case "signup":
        return "Crie sua conta para começar";
      case "forgot-password":
        return "Digite seu email para receber o link de recuperação";
      case "reset-password":
        return "Digite sua nova senha";
    }
  };

  const getFormHandler = () => {
    switch (mode) {
      case "signin":
        return handleSignIn;
      case "signup":
        return handleSignUp;
      case "forgot-password":
        return handleForgotPassword;
      case "reset-password":
        return handleResetPassword;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          {(mode === "forgot-password" || mode === "reset-password") && (
            <button
              onClick={() => setMode("signin")}
              className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar ao login
            </button>
          )}
          <CardTitle className="text-2xl font-bold text-center">
            {getTitle()}
          </CardTitle>
          <CardDescription className="text-center">
            {getDescription()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={getFormHandler()} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo</Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="perfil">Perfil</Label>
                  <Select value={perfil} onValueChange={(value) => setPerfil(value as Perfil)} disabled={loading}>
                    <SelectTrigger id="perfil">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRAFEGO">Tráfego</SelectItem>
                      <SelectItem value="SDR_COMERCIAL">SDR / Comercial</SelectItem>
                      <SelectItem value="DIRECAO">Direção</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {(mode === "signin" || mode === "signup" || mode === "forgot-password") && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            )}

            {(mode === "signin" || mode === "signup") && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
            )}

            {mode === "reset-password" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
              </>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" && "Entrar"}
              {mode === "signup" && "Cadastrar"}
              {mode === "forgot-password" && "Enviar link de recuperação"}
              {mode === "reset-password" && "Redefinir senha"}
            </Button>
          </form>

          {mode === "signin" && (
            <div className="mt-4 text-center">
              <button
                onClick={() => setMode("forgot-password")}
                className="text-sm text-muted-foreground hover:text-primary hover:underline"
                disabled={loading}
              >
                Esqueceu sua senha?
              </button>
            </div>
          )}

          <div className="mt-4 text-center text-sm">
            {mode === "signin" && (
              <p>
                Não tem uma conta?{" "}
                <button
                  onClick={() => setMode("signup")}
                  className="text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  Cadastre-se
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p>
                Já tem uma conta?{" "}
                <button
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline font-medium"
                  disabled={loading}
                >
                  Fazer login
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
