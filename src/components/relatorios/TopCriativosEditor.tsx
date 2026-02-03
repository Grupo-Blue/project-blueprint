import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Image, Upload, Edit2, X, Check, Eye, EyeOff } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface CriativoComMetricas {
  id_criativo: string;
  descricao: string | null;
  url_preview: string | null;
  url_midia: string | null;
  tipo: string;
  campanha_nome: string;
  leads: number;
  verba: number;
  cpl: number | null;
  impressoes: number;
  cliques: number;
}

export interface CriativoEditado {
  id_criativo: string;
  imagemCustomizada?: string;
  descricaoCustomizada?: string;
  incluirNoRelatorio: boolean;
}

interface TopCriativosEditorProps {
  criativos: CriativoComMetricas[];
  criativosEditados: CriativoEditado[];
  onEditadosChange: (editados: CriativoEditado[]) => void;
  editMode?: boolean;
}

export function TopCriativosEditor({
  criativos,
  criativosEditados,
  onEditadosChange,
  editMode = false,
}: TopCriativosEditorProps) {
  const [editingCriativo, setEditingCriativo] = useState<CriativoComMetricas | null>(null);
  const [tempDescricao, setTempDescricao] = useState("");
  const [tempImagem, setTempImagem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getEditado = (idCriativo: string): CriativoEditado | undefined => {
    return criativosEditados.find((e) => e.id_criativo === idCriativo);
  };

  const isIncluido = (idCriativo: string): boolean => {
    const editado = getEditado(idCriativo);
    return editado ? editado.incluirNoRelatorio : true;
  };

  const getImagemFinal = (criativo: CriativoComMetricas): string | null => {
    const editado = getEditado(criativo.id_criativo);
    if (editado?.imagemCustomizada) return editado.imagemCustomizada;
    return criativo.url_preview || criativo.url_midia;
  };

  const getDescricaoFinal = (criativo: CriativoComMetricas): string => {
    const editado = getEditado(criativo.id_criativo);
    if (editado?.descricaoCustomizada) return editado.descricaoCustomizada;
    return criativo.descricao || `Criativo ${criativo.tipo}`;
  };

  const toggleIncluir = (idCriativo: string) => {
    const editado = getEditado(idCriativo);
    if (editado) {
      onEditadosChange(
        criativosEditados.map((e) =>
          e.id_criativo === idCriativo
            ? { ...e, incluirNoRelatorio: !e.incluirNoRelatorio }
            : e
        )
      );
    } else {
      onEditadosChange([
        ...criativosEditados,
        { id_criativo: idCriativo, incluirNoRelatorio: false },
      ]);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempImagem(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const openEditor = (criativo: CriativoComMetricas) => {
    setEditingCriativo(criativo);
    const editado = getEditado(criativo.id_criativo);
    setTempDescricao(editado?.descricaoCustomizada || criativo.descricao || "");
    setTempImagem(editado?.imagemCustomizada || null);
  };

  const saveEdit = () => {
    if (!editingCriativo) return;

    const existingIndex = criativosEditados.findIndex(
      (e) => e.id_criativo === editingCriativo.id_criativo
    );

    const novoEditado: CriativoEditado = {
      id_criativo: editingCriativo.id_criativo,
      imagemCustomizada: tempImagem || undefined,
      descricaoCustomizada: tempDescricao || undefined,
      incluirNoRelatorio: isIncluido(editingCriativo.id_criativo),
    };

    if (existingIndex >= 0) {
      onEditadosChange(
        criativosEditados.map((e, i) => (i === existingIndex ? novoEditado : e))
      );
    } else {
      onEditadosChange([...criativosEditados, novoEditado]);
    }

    setEditingCriativo(null);
    setTempDescricao("");
    setTempImagem(null);
  };

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  if (criativos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Criativos da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum criativo com dados no período.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Top Criativos da Semana</CardTitle>
        {editMode && (
          <Badge variant="outline" className="text-xs">
            Modo Edição
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {criativos.map((criativo, index) => {
          const imagemFinal = getImagemFinal(criativo);
          const descricaoFinal = getDescricaoFinal(criativo);
          const incluido = isIncluido(criativo.id_criativo);
          const ctr = criativo.impressoes > 0 
            ? (criativo.cliques / criativo.impressoes) * 100 
            : 0;

          return (
            <div
              key={criativo.id_criativo}
              className={`flex gap-4 p-4 border rounded-lg transition-opacity ${
                !incluido ? "opacity-50" : ""
              }`}
            >
              {/* Ranking */}
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shrink-0">
                {index + 1}
              </div>

              {/* Imagem */}
              <div className="w-24 h-24 shrink-0 bg-muted rounded-lg overflow-hidden">
                {imagemFinal ? (
                  <AspectRatio ratio={1}>
                    <img
                      src={imagemFinal}
                      alt={descricaoFinal}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </AspectRatio>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{descricaoFinal}</p>
                <p className="text-sm text-muted-foreground truncate">
                  {criativo.campanha_nome}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">
                    {criativo.leads} leads
                  </Badge>
                  <Badge variant="outline">
                    CPL: {criativo.cpl ? formatCurrency(criativo.cpl) : "N/A"}
                  </Badge>
                  <Badge variant="outline">
                    CTR: {formatPercent(ctr)}
                  </Badge>
                </div>
                <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Verba: {formatCurrency(criativo.verba)}</span>
                  <span>Impr: {criativo.impressoes.toLocaleString("pt-BR")}</span>
                  <span>Cliques: {criativo.cliques.toLocaleString("pt-BR")}</span>
                </div>
              </div>

              {/* Ações */}
              {editMode && (
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleIncluir(criativo.id_criativo)}
                    title={incluido ? "Ocultar do relatório" : "Incluir no relatório"}
                  >
                    {incluido ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditor(criativo)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Editar Criativo</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        {/* Preview da imagem */}
                        <div className="w-full h-48 bg-muted rounded-lg overflow-hidden relative">
                          {(tempImagem || imagemFinal) ? (
                            <img
                              src={tempImagem || imagemFinal || ""}
                              alt="Preview"
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Image className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}
                        </div>

                        {/* Upload */}
                        <div>
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept="image/*"
                            className="hidden"
                          />
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            {tempImagem ? "Trocar Imagem" : "Carregar Imagem"}
                          </Button>
                          {tempImagem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-full mt-1"
                              onClick={() => setTempImagem(null)}
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remover imagem customizada
                            </Button>
                          )}
                        </div>

                        {/* Descrição */}
                        <div>
                          <label className="text-sm font-medium">Descrição</label>
                          <Textarea
                            value={tempDescricao}
                            onChange={(e) => setTempDescricao(e.target.value)}
                            placeholder="Descrição do criativo..."
                            rows={3}
                          />
                        </div>

                        {/* Salvar */}
                        <Button className="w-full" onClick={saveEdit}>
                          <Check className="h-4 w-4 mr-2" />
                          Salvar Alterações
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
