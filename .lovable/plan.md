

# Corrigir tela travada em "Carregando..."

## Problema identificado

No arquivo `src/components/AppLayout.tsx`, a funcao `checkAuth` (linhas 93-124) faz uma consulta ao banco para buscar o perfil do usuario. Se essa consulta falhar por timeout ou qualquer outro erro, o codigo nunca chega ao `setLoading(false)` na linha 123, deixando a tela presa no spinner "Carregando..." para sempre.

Os logs confirmam que o banco esta sofrendo timeouts (`canceling statement due to statement timeout`), o que causa exatamente esse comportamento.

## Solucao

Adicionar um bloco `try/catch/finally` na funcao `checkAuth` para garantir que `setLoading(false)` seja sempre executado, mesmo em caso de erro.

## Detalhes tecnicos

### Arquivo: `src/components/AppLayout.tsx`

Envolver o conteudo de `checkAuth` em um `try/catch`:

```typescript
const checkAuth = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileData && !profileData.aprovado) {
      await supabase.auth.signOut();
      toast({
        title: "Acesso pendente",
        description: "Seu cadastro ainda não foi aprovado pelo administrador",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setProfile(profileData);
  } catch (error) {
    console.error("Erro ao verificar autenticação:", error);
    toast({
      title: "Erro de conexão",
      description: "Não foi possível carregar seus dados. Tente novamente.",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};
```

A mudanca principal e mover `setLoading(false)` para um bloco `finally`, garantindo que sempre sera executado independente de sucesso ou falha. Em caso de erro, o usuario vera um toast com a mensagem de erro e o dashboard carregara (mesmo que sem dados de perfil), em vez de ficar preso eternamente no spinner.

