import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, MessageCircle, Share2, Bookmark, Eye, MousePointer, TrendingUp, Image, Video, Grid3x3, FileText } from "lucide-react";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const REDE_COLORS: Record<string, string> = {
  INSTAGRAM: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  FACEBOOK: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  LINKEDIN: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  TIKTOK: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  YOUTUBE: "bg-red-500/10 text-red-600 border-red-500/20",
  TWITTER: "bg-gray-500/10 text-gray-600 border-gray-500/20",
};

const TIPO_ICONS: Record<string, any> = {
  IMAGE: Image,
  VIDEO: Video,
  REEL: Video,
  CAROUSEL: Grid3x3,
  STORY: Eye,
  TEXT: FileText,
};

export function PostsOrganicosRanking() {
  const { empresaSelecionada } = useEmpresa();
  const [redeFilter, setRedeFilter] = useState<string>("todas");
  const [ordenacao, setOrdenacao] = useState<string>("engajamento");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["social-posts", empresaSelecionada],
    queryFn: async () => {
      let query = supabase
        .from("social_posts")
        .select("*")
        .order("data_publicacao", { ascending: false })
        .limit(50);

      if (empresaSelecionada) {
        query = query.eq("id_empresa", empresaSelecionada);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!empresaSelecionada,
  });

  if (!empresaSelecionada) return null;

  const redes = [...new Set(posts?.map(p => p.rede_social) || [])];

  const postsFiltrados = (posts || [])
    .filter(p => redeFilter === "todas" || p.rede_social === redeFilter)
    .sort((a, b) => {
      switch (ordenacao) {
        case "engajamento": return (b.engajamento_total || 0) - (a.engajamento_total || 0);
        case "alcance": return (b.alcance || 0) - (a.alcance || 0);
        case "likes": return (b.likes || 0) - (a.likes || 0);
        case "recentes": return new Date(b.data_publicacao || 0).getTime() - new Date(a.data_publicacao || 0).getTime();
        default: return 0;
      }
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Posts Orgânicos
            {posts && <Badge variant="secondary" className="ml-2">{posts.length}</Badge>}
          </CardTitle>
          <div className="flex gap-2">
            <Select value={redeFilter} onValueChange={setRedeFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as redes</SelectItem>
                {redes.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={ordenacao} onValueChange={setOrdenacao}>
              <SelectTrigger className="w-[150px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engajamento">Mais Engajamento</SelectItem>
                <SelectItem value="alcance">Maior Alcance</SelectItem>
                <SelectItem value="likes">Mais Likes</SelectItem>
                <SelectItem value="recentes">Mais Recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : postsFiltrados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum post orgânico coletado ainda. Execute a coleta de conteúdo Metricool.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {postsFiltrados.map((post) => {
              const TipoIcon = TIPO_ICONS[post.tipo || "IMAGE"] || Image;
              return (
                <div key={post.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-card">
                  {/* Preview da mídia */}
                  {post.url_midia ? (
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      <img 
                        src={post.url_midia} 
                        alt="Post preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      <Badge className={`absolute top-2 left-2 text-xs ${REDE_COLORS[post.rede_social] || ""}`}>
                        {post.rede_social}
                      </Badge>
                      <Badge variant="secondary" className="absolute top-2 right-2 text-xs">
                        <TipoIcon className="h-3 w-3 mr-1" />
                        {post.tipo}
                      </Badge>
                    </div>
                  ) : (
                    <div className="aspect-video bg-muted flex items-center justify-center relative">
                      <TipoIcon className="h-8 w-8 text-muted-foreground/50" />
                      <Badge className={`absolute top-2 left-2 text-xs ${REDE_COLORS[post.rede_social] || ""}`}>
                        {post.rede_social}
                      </Badge>
                    </div>
                  )}

                  {/* Conteúdo */}
                  <div className="p-3 space-y-2">
                    {post.texto && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {post.texto}
                      </p>
                    )}
                    {post.data_publicacao && (
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(post.data_publicacao), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    )}

                    {/* Métricas */}
                    <div className="grid grid-cols-4 gap-1 pt-2 border-t">
                      <div className="text-center">
                        <Heart className="h-3 w-3 mx-auto text-red-500" />
                        <p className="text-xs font-medium mt-0.5">{post.likes || 0}</p>
                      </div>
                      <div className="text-center">
                        <MessageCircle className="h-3 w-3 mx-auto text-blue-500" />
                        <p className="text-xs font-medium mt-0.5">{post.comentarios || 0}</p>
                      </div>
                      <div className="text-center">
                        <Share2 className="h-3 w-3 mx-auto text-green-500" />
                        <p className="text-xs font-medium mt-0.5">{post.compartilhamentos || 0}</p>
                      </div>
                      <div className="text-center">
                        <Bookmark className="h-3 w-3 mx-auto text-yellow-500" />
                        <p className="text-xs font-medium mt-0.5">{post.salvos || 0}</p>
                      </div>
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span><Eye className="h-3 w-3 inline mr-1" />{post.alcance || 0} alcance</span>
                      <span>{Number(post.taxa_engajamento || 0).toFixed(1)}% eng.</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
