import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, RefreshCw, Users, Edit, Shield, UserX, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Usuario {
  id: string;
  nome: string;
  perfil: string;
  ativo: boolean;
  aprovado: boolean;
  email?: string;
  roles: string[];
}

const Usuarios = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [editForm, setEditForm] = useState({
    nome: "",
    perfil: "",
    ativo: true,
    aprovado: true,
    roles: [] as string[],
  });

  // Verificar se o usuário é admin
  const { data: isAdmin, isLoading: checkingAdmin } = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      return !!data;
    },
  });

  // Buscar todos os usuários
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      // Buscar profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("nome");

      if (profilesError) throw profilesError;

      // Buscar roles de todos os usuários
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combinar dados
      const usuarios: Usuario[] = (profilesData || []).map((profile) => ({
        id: profile.id,
        nome: profile.nome,
        perfil: profile.perfil,
        ativo: profile.ativo,
        aprovado: profile.aprovado,
        roles: rolesData?.filter((r) => r.user_id === profile.id).map((r) => r.role) || [],
      }));

      return usuarios;
    },
    enabled: isAdmin === true,
  });

  // Mutation para atualizar usuário
  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; nome: string; perfil: string; ativo: boolean; aprovado: boolean; roles: string[] }) => {
      // Atualizar profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          nome: data.nome,
          perfil: data.perfil as "ADMIN" | "DIRECAO" | "SDR_COMERCIAL" | "TRAFEGO",
          ativo: data.ativo,
          aprovado: data.aprovado,
        })
        .eq("id", data.userId);

      if (profileError) throw profileError;

      // Buscar roles atuais
      const { data: currentRoles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId);

      const currentRolesList = currentRoles?.map((r) => r.role) || [];

      // Roles para adicionar
      const rolesToAdd = data.roles.filter((r) => !currentRolesList.includes(r as any));
      // Roles para remover
      const rolesToRemove = currentRolesList.filter((r) => !data.roles.includes(r));

      // Adicionar novas roles
      if (rolesToAdd.length > 0) {
        const { error: addError } = await supabase
          .from("user_roles")
          .insert(rolesToAdd.map((role) => ({ 
            user_id: data.userId, 
            role: role as "admin" | "direcao" | "sdr" | "trafego" 
          })));

        if (addError) throw addError;
      }

      // Remover roles antigas
      if (rolesToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .in("role", rolesToRemove as ("admin" | "direcao" | "sdr" | "trafego")[]);

        if (removeError) throw removeError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setIsEditDialogOpen(false);
      toast({
        title: "Usuário atualizado",
        description: "As alterações foram salvas com sucesso",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (usuario: Usuario) => {
    setSelectedUser(usuario);
    setEditForm({
      nome: usuario.nome,
      perfil: usuario.perfil,
      ativo: usuario.ativo,
      aprovado: usuario.aprovado,
      roles: usuario.roles,
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedUser) return;

    updateUserMutation.mutate({
      userId: selectedUser.id,
      nome: editForm.nome,
      perfil: editForm.perfil,
      ativo: editForm.ativo,
      aprovado: editForm.aprovado,
      roles: editForm.roles,
    });
  };

  const toggleRole = (role: string) => {
    setEditForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter((r) => r !== role)
        : [...prev.roles, role],
    }));
  };

  const getPerfilLabel = (perfil: string) => {
    const labels: Record<string, string> = {
      TRAFEGO: "Tráfego",
      SDR_COMERCIAL: "SDR / Comercial",
      DIRECAO: "Direção",
      ADMIN: "Administrador",
    };
    return labels[perfil] || perfil;
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Admin",
      direcao: "Direção",
      trafego: "Tráfego",
      sdr: "SDR",
    };
    return labels[role] || role;
  };

  // Redirecionar se não for admin
  useEffect(() => {
    if (!checkingAdmin && isAdmin === false) {
      navigate("/dashboard");
      toast({
        title: "Acesso negado",
        description: "Apenas administradores podem acessar esta página",
        variant: "destructive",
      });
    }
  }, [isAdmin, checkingAdmin, navigate, toast]);

  if (checkingAdmin || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando usuários...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
                <p className="text-sm text-muted-foreground">
                  Gerenciar perfis e permissões dos usuários
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["usuarios"] })}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Resumo */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usuarios?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ativos</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {usuarios?.filter((u) => u.ativo).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Usuários ativos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <UserX className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {usuarios?.filter((u) => !u.aprovado).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {usuarios?.filter((u) => u.roles.includes("admin")).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Administradores</p>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Usuários */}
        <div className="grid gap-4">
          {usuarios?.map((usuario) => (
            <Card key={usuario.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle>{usuario.nome}</CardTitle>
                      {!usuario.aprovado && (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-100">
                          Pendente Aprovação
                        </Badge>
                      )}
                      {!usuario.ativo && (
                        <Badge variant="destructive">Inativo</Badge>
                      )}
                      {usuario.roles.includes("admin") && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                          <Shield className="mr-1 h-3 w-3" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {getPerfilLabel(usuario.perfil)}
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(usuario)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium">Permissões:</span>
                  {usuario.roles.length === 0 ? (
                    <Badge variant="outline">Nenhuma permissão</Badge>
                  ) : (
                    usuario.roles.map((role) => (
                      <Badge key={role} variant="secondary">
                        {getRoleLabel(role)}
                      </Badge>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      {/* Dialog de Edição */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Altere as informações e permissões do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={editForm.nome}
                onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="perfil">Perfil</Label>
              <Select value={editForm.perfil} onValueChange={(value) => setEditForm({ ...editForm, perfil: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRAFEGO">Tráfego</SelectItem>
                  <SelectItem value="SDR_COMERCIAL">SDR / Comercial</SelectItem>
                  <SelectItem value="DIRECAO">Direção</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Permissões (Roles)</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {["admin", "direcao", "trafego", "sdr"].map((role) => (
                  <div key={role} className="flex items-center space-x-2">
                    <Checkbox
                      id={role}
                      checked={editForm.roles.includes(role)}
                      onCheckedChange={() => toggleRole(role)}
                    />
                    <label
                      htmlFor={role}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {getRoleLabel(role)}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3 border-t pt-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="aprovado"
                  checked={editForm.aprovado}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, aprovado: checked as boolean })}
                />
                <label
                  htmlFor="aprovado"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Usuário aprovado
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ativo"
                  checked={editForm.ativo}
                  onCheckedChange={(checked) => setEditForm({ ...editForm, ativo: checked as boolean })}
                />
                <label
                  htmlFor="ativo"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Usuário ativo
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Usuarios;
