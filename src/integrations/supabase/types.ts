export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      acao: {
        Row: {
          anexos: Json | null
          categoria: Database["public"]["Enums"]["categoria_acao"]
          created_at: string
          data_criacao: string
          data_execucao: string | null
          descricao: string
          id_acao: string
          id_empresa: string
          id_usuario: string
          impacto_esperado: string | null
          motivo_reprovacao: string | null
          status: Database["public"]["Enums"]["status_acao"]
          tipo_acao: string
          updated_at: string
        }
        Insert: {
          anexos?: Json | null
          categoria: Database["public"]["Enums"]["categoria_acao"]
          created_at?: string
          data_criacao?: string
          data_execucao?: string | null
          descricao: string
          id_acao?: string
          id_empresa: string
          id_usuario: string
          impacto_esperado?: string | null
          motivo_reprovacao?: string | null
          status?: Database["public"]["Enums"]["status_acao"]
          tipo_acao: string
          updated_at?: string
        }
        Update: {
          anexos?: Json | null
          categoria?: Database["public"]["Enums"]["categoria_acao"]
          created_at?: string
          data_criacao?: string
          data_execucao?: string | null
          descricao?: string
          id_acao?: string
          id_empresa?: string
          id_usuario?: string
          impacto_esperado?: string | null
          motivo_reprovacao?: string | null
          status?: Database["public"]["Enums"]["status_acao"]
          tipo_acao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "acao_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      acao_aprovacao: {
        Row: {
          comentario: string | null
          created_at: string
          data_aprovacao: string
          id_acao: string
          id_aprovacao: string
          id_usuario_aprovador: string
          status: Database["public"]["Enums"]["status_aprovacao"]
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          data_aprovacao?: string
          id_acao: string
          id_aprovacao?: string
          id_usuario_aprovador: string
          status: Database["public"]["Enums"]["status_aprovacao"]
        }
        Update: {
          comentario?: string | null
          created_at?: string
          data_aprovacao?: string
          id_acao?: string
          id_aprovacao?: string
          id_usuario_aprovador?: string
          status?: Database["public"]["Enums"]["status_aprovacao"]
        }
        Relationships: [
          {
            foreignKeyName: "acao_aprovacao_id_acao_fkey"
            columns: ["id_acao"]
            isOneToOne: true
            referencedRelation: "acao"
            referencedColumns: ["id_acao"]
          },
        ]
      }
      acao_campanha: {
        Row: {
          created_at: string
          id_acao: string
          id_acao_campanha: string
          id_campanha: string
        }
        Insert: {
          created_at?: string
          id_acao: string
          id_acao_campanha?: string
          id_campanha: string
        }
        Update: {
          created_at?: string
          id_acao?: string
          id_acao_campanha?: string
          id_campanha?: string
        }
        Relationships: [
          {
            foreignKeyName: "acao_campanha_id_acao_fkey"
            columns: ["id_acao"]
            isOneToOne: false
            referencedRelation: "acao"
            referencedColumns: ["id_acao"]
          },
          {
            foreignKeyName: "acao_campanha_id_campanha_fkey"
            columns: ["id_campanha"]
            isOneToOne: false
            referencedRelation: "campanha"
            referencedColumns: ["id_campanha"]
          },
        ]
      }
      alerta_utm: {
        Row: {
          created_at: string | null
          data_deteccao: string | null
          data_resolucao: string | null
          detalhes: Json | null
          id_alerta: string
          id_campanha: string
          id_criativo: string
          resolvido: boolean | null
          tipo_discrepancia: string
          updated_at: string | null
          url_capturada: string | null
          url_esperada: string | null
        }
        Insert: {
          created_at?: string | null
          data_deteccao?: string | null
          data_resolucao?: string | null
          detalhes?: Json | null
          id_alerta?: string
          id_campanha: string
          id_criativo: string
          resolvido?: boolean | null
          tipo_discrepancia: string
          updated_at?: string | null
          url_capturada?: string | null
          url_esperada?: string | null
        }
        Update: {
          created_at?: string | null
          data_deteccao?: string | null
          data_resolucao?: string | null
          detalhes?: Json | null
          id_alerta?: string
          id_campanha?: string
          id_criativo?: string
          resolvido?: boolean | null
          tipo_discrepancia?: string
          updated_at?: string | null
          url_capturada?: string | null
          url_esperada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerta_utm_id_campanha_fkey"
            columns: ["id_campanha"]
            isOneToOne: false
            referencedRelation: "campanha"
            referencedColumns: ["id_campanha"]
          },
          {
            foreignKeyName: "alerta_utm_id_criativo_fkey"
            columns: ["id_criativo"]
            isOneToOne: false
            referencedRelation: "criativo"
            referencedColumns: ["id_criativo"]
          },
        ]
      }
      analise_inteligencia: {
        Row: {
          analise_texto: string
          created_at: string
          data_analise: string
          data_fim_periodo: string
          data_inicio_periodo: string
          id_analise: string
          id_empresa: string
          metricas_resumo: Json | null
          updated_at: string
        }
        Insert: {
          analise_texto: string
          created_at?: string
          data_analise: string
          data_fim_periodo: string
          data_inicio_periodo: string
          id_analise?: string
          id_empresa: string
          metricas_resumo?: Json | null
          updated_at?: string
        }
        Update: {
          analise_texto?: string
          created_at?: string
          data_analise?: string
          data_fim_periodo?: string
          data_inicio_periodo?: string
          id_analise?: string
          id_empresa?: string
          metricas_resumo?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analise_inteligencia_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      aprendizado_semana: {
        Row: {
          anexos: Json | null
          created_at: string
          descricao: string
          id_aprendizado: string
          id_empresa: string
          id_semana: string
          metricas_suporte: string | null
          tipo: Database["public"]["Enums"]["tipo_aprendizado"]
          updated_at: string
        }
        Insert: {
          anexos?: Json | null
          created_at?: string
          descricao: string
          id_aprendizado?: string
          id_empresa: string
          id_semana: string
          metricas_suporte?: string | null
          tipo: Database["public"]["Enums"]["tipo_aprendizado"]
          updated_at?: string
        }
        Update: {
          anexos?: Json | null
          created_at?: string
          descricao?: string
          id_aprendizado?: string
          id_empresa?: string
          id_semana?: string
          metricas_suporte?: string | null
          tipo?: Database["public"]["Enums"]["tipo_aprendizado"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "aprendizado_semana_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "aprendizado_semana_id_semana_fkey"
            columns: ["id_semana"]
            isOneToOne: false
            referencedRelation: "semana"
            referencedColumns: ["id_semana"]
          },
        ]
      }
      campanha: {
        Row: {
          ativa: boolean
          created_at: string
          data_criacao: string
          id_campanha: string
          id_campanha_externo: string
          id_conta: string
          nome: string
          objetivo: string | null
          updated_at: string
          url_esperada: string | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          data_criacao?: string
          id_campanha?: string
          id_campanha_externo: string
          id_conta: string
          nome: string
          objetivo?: string | null
          updated_at?: string
          url_esperada?: string | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          data_criacao?: string
          id_campanha?: string
          id_campanha_externo?: string
          id_conta?: string
          nome?: string
          objetivo?: string | null
          updated_at?: string
          url_esperada?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campanha_id_conta_fkey"
            columns: ["id_conta"]
            isOneToOne: false
            referencedRelation: "conta_anuncio"
            referencedColumns: ["id_conta"]
          },
        ]
      }
      campanha_metricas_dia: {
        Row: {
          cliques: number
          created_at: string
          data: string
          id_campanha: string
          id_metricas_dia: string
          impressoes: number
          leads: number
          verba_investida: number
        }
        Insert: {
          cliques?: number
          created_at?: string
          data: string
          id_campanha: string
          id_metricas_dia?: string
          impressoes?: number
          leads?: number
          verba_investida?: number
        }
        Update: {
          cliques?: number
          created_at?: string
          data?: string
          id_campanha?: string
          id_metricas_dia?: string
          impressoes?: number
          leads?: number
          verba_investida?: number
        }
        Relationships: [
          {
            foreignKeyName: "campanha_metricas_dia_id_campanha_fkey"
            columns: ["id_campanha"]
            isOneToOne: false
            referencedRelation: "campanha"
            referencedColumns: ["id_campanha"]
          },
        ]
      }
      campanha_semana_metricas: {
        Row: {
          cac: number | null
          cpl: number | null
          created_at: string
          id_campanha: string
          id_campanha_semana: string
          id_semana: string
          leads: number
          levantadas: number | null
          mqls: number | null
          reunioes: number | null
          ticket_medio: number | null
          updated_at: string
          vendas: number | null
          verba_investida: number
        }
        Insert: {
          cac?: number | null
          cpl?: number | null
          created_at?: string
          id_campanha: string
          id_campanha_semana?: string
          id_semana: string
          leads?: number
          levantadas?: number | null
          mqls?: number | null
          reunioes?: number | null
          ticket_medio?: number | null
          updated_at?: string
          vendas?: number | null
          verba_investida?: number
        }
        Update: {
          cac?: number | null
          cpl?: number | null
          created_at?: string
          id_campanha?: string
          id_campanha_semana?: string
          id_semana?: string
          leads?: number
          levantadas?: number | null
          mqls?: number | null
          reunioes?: number | null
          ticket_medio?: number | null
          updated_at?: string
          vendas?: number | null
          verba_investida?: number
        }
        Relationships: [
          {
            foreignKeyName: "campanha_semana_metricas_id_campanha_fkey"
            columns: ["id_campanha"]
            isOneToOne: false
            referencedRelation: "campanha"
            referencedColumns: ["id_campanha"]
          },
          {
            foreignKeyName: "campanha_semana_metricas_id_semana_fkey"
            columns: ["id_semana"]
            isOneToOne: false
            referencedRelation: "semana"
            referencedColumns: ["id_semana"]
          },
        ]
      }
      cliente_notion: {
        Row: {
          anos_fiscais: Json | null
          cpf_cnpj: string | null
          created_at: string | null
          data_nascimento: string | null
          email: string | null
          email_secundario: string | null
          id_cliente: string
          id_notion: string
          last_edited_time: string | null
          nome: string
          produtos_contratados: Json | null
          status_cliente: string
          telefone: string | null
          updated_at: string | null
        }
        Insert: {
          anos_fiscais?: Json | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          email_secundario?: string | null
          id_cliente?: string
          id_notion: string
          last_edited_time?: string | null
          nome: string
          produtos_contratados?: Json | null
          status_cliente?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Update: {
          anos_fiscais?: Json | null
          cpf_cnpj?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          email?: string | null
          email_secundario?: string | null
          id_cliente?: string
          id_notion?: string
          last_edited_time?: string | null
          nome?: string
          produtos_contratados?: Json | null
          status_cliente?: string
          telefone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      conta_anuncio: {
        Row: {
          ativa: boolean
          created_at: string
          id_conta: string
          id_empresa: string
          id_externo: string
          nome: string
          plataforma: Database["public"]["Enums"]["plataforma_midia"]
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id_conta?: string
          id_empresa: string
          id_externo: string
          nome: string
          plataforma: Database["public"]["Enums"]["plataforma_midia"]
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id_conta?: string
          id_empresa?: string
          id_externo?: string
          nome?: string
          plataforma?: Database["public"]["Enums"]["plataforma_midia"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conta_anuncio_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      criativo: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id_anuncio_externo: string | null
          id_campanha: string
          id_criativo: string
          id_criativo_externo: string
          tipo: Database["public"]["Enums"]["tipo_criativo"]
          updated_at: string
          url_esperada: string | null
          url_final: string | null
          url_midia: string | null
          url_preview: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id_anuncio_externo?: string | null
          id_campanha: string
          id_criativo?: string
          id_criativo_externo: string
          tipo: Database["public"]["Enums"]["tipo_criativo"]
          updated_at?: string
          url_esperada?: string | null
          url_final?: string | null
          url_midia?: string | null
          url_preview?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id_anuncio_externo?: string | null
          id_campanha?: string
          id_criativo?: string
          id_criativo_externo?: string
          tipo?: Database["public"]["Enums"]["tipo_criativo"]
          updated_at?: string
          url_esperada?: string | null
          url_final?: string | null
          url_midia?: string | null
          url_preview?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "criativo_id_campanha_fkey"
            columns: ["id_campanha"]
            isOneToOne: false
            referencedRelation: "campanha"
            referencedColumns: ["id_campanha"]
          },
        ]
      }
      criativo_metricas_dia: {
        Row: {
          cliques: number
          created_at: string
          data: string
          id_criativo: string
          id_metricas_dia: string
          impressoes: number
          leads: number
          verba_investida: number
        }
        Insert: {
          cliques?: number
          created_at?: string
          data: string
          id_criativo: string
          id_metricas_dia?: string
          impressoes?: number
          leads?: number
          verba_investida?: number
        }
        Update: {
          cliques?: number
          created_at?: string
          data?: string
          id_criativo?: string
          id_metricas_dia?: string
          impressoes?: number
          leads?: number
          verba_investida?: number
        }
        Relationships: [
          {
            foreignKeyName: "criativo_metricas_dia_id_criativo_fkey"
            columns: ["id_criativo"]
            isOneToOne: false
            referencedRelation: "criativo"
            referencedColumns: ["id_criativo"]
          },
        ]
      }
      cronjob_execucao: {
        Row: {
          created_at: string
          data_execucao: string
          detalhes_execucao: Json | null
          duracao_ms: number | null
          id_execucao: string
          mensagem_erro: string | null
          nome_cronjob: string
          status: string
        }
        Insert: {
          created_at?: string
          data_execucao?: string
          detalhes_execucao?: Json | null
          duracao_ms?: number | null
          id_execucao?: string
          mensagem_erro?: string | null
          nome_cronjob: string
          status: string
        }
        Update: {
          created_at?: string
          data_execucao?: string
          detalhes_execucao?: Json | null
          duracao_ms?: number | null
          id_execucao?: string
          mensagem_erro?: string | null
          nome_cronjob?: string
          status?: string
        }
        Relationships: []
      }
      empresa: {
        Row: {
          cac_maximo: number
          cpl_maximo: number
          created_at: string
          dias_alerta_cpl: number
          id_empresa: string
          lucro_minimo_por_venda: number
          margem_minima_percentual: number
          meta_conversao_lead_venda: number
          meta_verba_mensal: number | null
          nome: string
          semanas_alerta_cac: number
          ticket_medio_alvo: number
          updated_at: string
        }
        Insert: {
          cac_maximo: number
          cpl_maximo: number
          created_at?: string
          dias_alerta_cpl?: number
          id_empresa?: string
          lucro_minimo_por_venda: number
          margem_minima_percentual: number
          meta_conversao_lead_venda: number
          meta_verba_mensal?: number | null
          nome: string
          semanas_alerta_cac?: number
          ticket_medio_alvo: number
          updated_at?: string
        }
        Update: {
          cac_maximo?: number
          cpl_maximo?: number
          created_at?: string
          dias_alerta_cpl?: number
          id_empresa?: string
          lucro_minimo_por_venda?: number
          margem_minima_percentual?: number
          meta_conversao_lead_venda?: number
          meta_verba_mensal?: number | null
          nome?: string
          semanas_alerta_cac?: number
          ticket_medio_alvo?: number
          updated_at?: string
        }
        Relationships: []
      }
      empresa_semana_metricas: {
        Row: {
          cac: number | null
          cpl: number | null
          created_at: string
          id_empresa: string
          id_empresa_semana: string
          id_semana: string
          leads_total: number
          levantadas: number
          mqls: number
          reunioes: number
          ticket_medio: number | null
          updated_at: string
          vendas: number
          verba_investida: number
        }
        Insert: {
          cac?: number | null
          cpl?: number | null
          created_at?: string
          id_empresa: string
          id_empresa_semana?: string
          id_semana: string
          leads_total?: number
          levantadas?: number
          mqls?: number
          reunioes?: number
          ticket_medio?: number | null
          updated_at?: string
          vendas?: number
          verba_investida?: number
        }
        Update: {
          cac?: number | null
          cpl?: number | null
          created_at?: string
          id_empresa?: string
          id_empresa_semana?: string
          id_semana?: string
          leads_total?: number
          levantadas?: number
          mqls?: number
          reunioes?: number
          ticket_medio?: number | null
          updated_at?: string
          vendas?: number
          verba_investida?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_semana_metricas_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "empresa_semana_metricas_id_semana_fkey"
            columns: ["id_semana"]
            isOneToOne: false
            referencedRelation: "semana"
            referencedColumns: ["id_semana"]
          },
        ]
      }
      hipotese_teste: {
        Row: {
          anexos: Json | null
          comentario_resultado: string | null
          created_at: string
          criterio_sucesso: string
          descricao: string
          id_campanha: string | null
          id_empresa: string
          id_hipotese: string
          id_semana: string
          resultado_semana_seguinte:
            | Database["public"]["Enums"]["resultado_hipotese"]
            | null
          tipo: string
          updated_at: string
        }
        Insert: {
          anexos?: Json | null
          comentario_resultado?: string | null
          created_at?: string
          criterio_sucesso: string
          descricao: string
          id_campanha?: string | null
          id_empresa: string
          id_hipotese?: string
          id_semana: string
          resultado_semana_seguinte?:
            | Database["public"]["Enums"]["resultado_hipotese"]
            | null
          tipo: string
          updated_at?: string
        }
        Update: {
          anexos?: Json | null
          comentario_resultado?: string | null
          created_at?: string
          criterio_sucesso?: string
          descricao?: string
          id_campanha?: string | null
          id_empresa?: string
          id_hipotese?: string
          id_semana?: string
          resultado_semana_seguinte?:
            | Database["public"]["Enums"]["resultado_hipotese"]
            | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hipotese_teste_id_campanha_fkey"
            columns: ["id_campanha"]
            isOneToOne: false
            referencedRelation: "campanha"
            referencedColumns: ["id_campanha"]
          },
          {
            foreignKeyName: "hipotese_teste_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "hipotese_teste_id_semana_fkey"
            columns: ["id_semana"]
            isOneToOne: false
            referencedRelation: "semana"
            referencedColumns: ["id_semana"]
          },
        ]
      }
      instagram_metricas_dia: {
        Row: {
          alcance: number
          cliques_website: number
          created_at: string
          data: string
          id_empresa: string
          id_metrica: string
          impressoes: number
          novos_seguidores: number
          seguidores_total: number
          updated_at: string
          visitas_perfil: number
        }
        Insert: {
          alcance?: number
          cliques_website?: number
          created_at?: string
          data: string
          id_empresa: string
          id_metrica?: string
          impressoes?: number
          novos_seguidores?: number
          seguidores_total?: number
          updated_at?: string
          visitas_perfil?: number
        }
        Update: {
          alcance?: number
          cliques_website?: number
          created_at?: string
          data?: string
          id_empresa?: string
          id_metrica?: string
          impressoes?: number
          novos_seguidores?: number
          seguidores_total?: number
          updated_at?: string
          visitas_perfil?: number
        }
        Relationships: [
          {
            foreignKeyName: "instagram_metricas_dia_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      integracao: {
        Row: {
          ativo: boolean
          config_json: Json
          created_at: string
          id_integracao: string
          tipo: Database["public"]["Enums"]["tipo_integracao"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          config_json: Json
          created_at?: string
          id_integracao?: string
          tipo: Database["public"]["Enums"]["tipo_integracao"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          config_json?: Json
          created_at?: string
          id_integracao?: string
          tipo?: Database["public"]["Enums"]["tipo_integracao"]
          updated_at?: string
        }
        Relationships: []
      }
      lead: {
        Row: {
          cidade_mautic: string | null
          cliente_status: string | null
          created_at: string
          data_criacao: string
          data_levantou_mao: string | null
          data_mql: string | null
          data_reuniao: string | null
          data_venda: string | null
          email: string | null
          estado_mautic: string | null
          id_cliente_notion: string | null
          id_criativo: string | null
          id_empresa: string
          id_lead: string
          id_lead_externo: string | null
          id_mautic_contact: string | null
          is_mql: boolean
          lead_pago: boolean | null
          levantou_mao: boolean
          mautic_first_visit: string | null
          mautic_last_active: string | null
          mautic_page_hits: number | null
          mautic_score: number | null
          mautic_segments: Json | null
          mautic_tags: Json | null
          merged: boolean | null
          merged_at: string | null
          merged_by: string | null
          merged_into_lead_id: string | null
          nome_lead: string | null
          organizacao: string | null
          origem_campanha: string | null
          origem_canal: Database["public"]["Enums"]["canal_origem"] | null
          origem_tipo: Database["public"]["Enums"]["origem_lead"] | null
          pipeline_id: string | null
          reuniao_realizada: boolean
          stage_atual: string | null
          tem_reuniao: boolean
          tokeniza_carrinho_abandonado: boolean | null
          tokeniza_investidor: boolean | null
          tokeniza_primeiro_investimento: string | null
          tokeniza_projeto_nome: string | null
          tokeniza_projetos: Json | null
          tokeniza_qtd_investimentos: number | null
          tokeniza_ultimo_investimento: string | null
          tokeniza_user_id: string | null
          tokeniza_valor_carrinho: number | null
          tokeniza_valor_investido: number | null
          updated_at: string
          url_pipedrive: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_venda: number | null
          venda_realizada: boolean
        }
        Insert: {
          cidade_mautic?: string | null
          cliente_status?: string | null
          created_at?: string
          data_criacao?: string
          data_levantou_mao?: string | null
          data_mql?: string | null
          data_reuniao?: string | null
          data_venda?: string | null
          email?: string | null
          estado_mautic?: string | null
          id_cliente_notion?: string | null
          id_criativo?: string | null
          id_empresa: string
          id_lead?: string
          id_lead_externo?: string | null
          id_mautic_contact?: string | null
          is_mql?: boolean
          lead_pago?: boolean | null
          levantou_mao?: boolean
          mautic_first_visit?: string | null
          mautic_last_active?: string | null
          mautic_page_hits?: number | null
          mautic_score?: number | null
          mautic_segments?: Json | null
          mautic_tags?: Json | null
          merged?: boolean | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_lead_id?: string | null
          nome_lead?: string | null
          organizacao?: string | null
          origem_campanha?: string | null
          origem_canal?: Database["public"]["Enums"]["canal_origem"] | null
          origem_tipo?: Database["public"]["Enums"]["origem_lead"] | null
          pipeline_id?: string | null
          reuniao_realizada?: boolean
          stage_atual?: string | null
          tem_reuniao?: boolean
          tokeniza_carrinho_abandonado?: boolean | null
          tokeniza_investidor?: boolean | null
          tokeniza_primeiro_investimento?: string | null
          tokeniza_projeto_nome?: string | null
          tokeniza_projetos?: Json | null
          tokeniza_qtd_investimentos?: number | null
          tokeniza_ultimo_investimento?: string | null
          tokeniza_user_id?: string | null
          tokeniza_valor_carrinho?: number | null
          tokeniza_valor_investido?: number | null
          updated_at?: string
          url_pipedrive?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_venda?: number | null
          venda_realizada?: boolean
        }
        Update: {
          cidade_mautic?: string | null
          cliente_status?: string | null
          created_at?: string
          data_criacao?: string
          data_levantou_mao?: string | null
          data_mql?: string | null
          data_reuniao?: string | null
          data_venda?: string | null
          email?: string | null
          estado_mautic?: string | null
          id_cliente_notion?: string | null
          id_criativo?: string | null
          id_empresa?: string
          id_lead?: string
          id_lead_externo?: string | null
          id_mautic_contact?: string | null
          is_mql?: boolean
          lead_pago?: boolean | null
          levantou_mao?: boolean
          mautic_first_visit?: string | null
          mautic_last_active?: string | null
          mautic_page_hits?: number | null
          mautic_score?: number | null
          mautic_segments?: Json | null
          mautic_tags?: Json | null
          merged?: boolean | null
          merged_at?: string | null
          merged_by?: string | null
          merged_into_lead_id?: string | null
          nome_lead?: string | null
          organizacao?: string | null
          origem_campanha?: string | null
          origem_canal?: Database["public"]["Enums"]["canal_origem"] | null
          origem_tipo?: Database["public"]["Enums"]["origem_lead"] | null
          pipeline_id?: string | null
          reuniao_realizada?: boolean
          stage_atual?: string | null
          tem_reuniao?: boolean
          tokeniza_carrinho_abandonado?: boolean | null
          tokeniza_investidor?: boolean | null
          tokeniza_primeiro_investimento?: string | null
          tokeniza_projeto_nome?: string | null
          tokeniza_projetos?: Json | null
          tokeniza_qtd_investimentos?: number | null
          tokeniza_ultimo_investimento?: string | null
          tokeniza_user_id?: string | null
          tokeniza_valor_carrinho?: number | null
          tokeniza_valor_investido?: number | null
          updated_at?: string
          url_pipedrive?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_venda?: number | null
          venda_realizada?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "lead_id_cliente_notion_fkey"
            columns: ["id_cliente_notion"]
            isOneToOne: false
            referencedRelation: "cliente_notion"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "lead_id_criativo_fkey"
            columns: ["id_criativo"]
            isOneToOne: false
            referencedRelation: "criativo"
            referencedColumns: ["id_criativo"]
          },
          {
            foreignKeyName: "lead_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "lead_merged_into_lead_id_fkey"
            columns: ["merged_into_lead_id"]
            isOneToOne: false
            referencedRelation: "lead"
            referencedColumns: ["id_lead"]
          },
        ]
      }
      lead_evento: {
        Row: {
          created_at: string
          data_evento: string
          etapa: string
          id_evento: string
          id_lead: string
          observacao: string | null
        }
        Insert: {
          created_at?: string
          data_evento?: string
          etapa: string
          id_evento?: string
          id_lead: string
          observacao?: string | null
        }
        Update: {
          created_at?: string
          data_evento?: string
          etapa?: string
          id_evento?: string
          id_lead?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_evento_id_lead_fkey"
            columns: ["id_lead"]
            isOneToOne: false
            referencedRelation: "lead"
            referencedColumns: ["id_lead"]
          },
        ]
      }
      log_acao: {
        Row: {
          acao: string
          created_at: string
          data_log: string
          id_log: string
          id_registro: string | null
          id_usuario: string | null
          tabela_afetada: string | null
          valores_antes: Json | null
          valores_depois: Json | null
        }
        Insert: {
          acao: string
          created_at?: string
          data_log?: string
          id_log?: string
          id_registro?: string | null
          id_usuario?: string | null
          tabela_afetada?: string | null
          valores_antes?: Json | null
          valores_depois?: Json | null
        }
        Update: {
          acao?: string
          created_at?: string
          data_log?: string
          id_log?: string
          id_registro?: string | null
          id_usuario?: string | null
          tabela_afetada?: string | null
          valores_antes?: Json | null
          valores_depois?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aprovado: boolean
          ativo: boolean
          created_at: string
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["perfil_usuario"]
          updated_at: string
        }
        Insert: {
          aprovado?: boolean
          ativo?: boolean
          created_at?: string
          id: string
          nome: string
          perfil: Database["public"]["Enums"]["perfil_usuario"]
          updated_at?: string
        }
        Update: {
          aprovado?: boolean
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          perfil?: Database["public"]["Enums"]["perfil_usuario"]
          updated_at?: string
        }
        Relationships: []
      }
      relatorio_acao: {
        Row: {
          created_at: string
          id_acao: string
          id_relatorio: string
          id_relatorio_acao: string
        }
        Insert: {
          created_at?: string
          id_acao: string
          id_relatorio: string
          id_relatorio_acao?: string
        }
        Update: {
          created_at?: string
          id_acao?: string
          id_relatorio?: string
          id_relatorio_acao?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_acao_id_acao_fkey"
            columns: ["id_acao"]
            isOneToOne: false
            referencedRelation: "acao"
            referencedColumns: ["id_acao"]
          },
          {
            foreignKeyName: "relatorio_acao_id_relatorio_fkey"
            columns: ["id_relatorio"]
            isOneToOne: false
            referencedRelation: "relatorio_semanal"
            referencedColumns: ["id_relatorio"]
          },
        ]
      }
      relatorio_hipotese: {
        Row: {
          created_at: string
          id_hipotese: string | null
          id_relatorio: string
          id_relatorio_hipotese: string
        }
        Insert: {
          created_at?: string
          id_hipotese?: string | null
          id_relatorio: string
          id_relatorio_hipotese?: string
        }
        Update: {
          created_at?: string
          id_hipotese?: string | null
          id_relatorio?: string
          id_relatorio_hipotese?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_hipotese_id_relatorio_fkey"
            columns: ["id_relatorio"]
            isOneToOne: false
            referencedRelation: "relatorio_semanal"
            referencedColumns: ["id_relatorio"]
          },
        ]
      }
      relatorio_semanal: {
        Row: {
          aprendizado_resumo: string | null
          created_at: string
          data_fechamento: string | null
          id_empresa: string
          id_relatorio: string
          id_semana: string
          status: Database["public"]["Enums"]["status_relatorio"]
          texto_comparacao: string | null
          updated_at: string
        }
        Insert: {
          aprendizado_resumo?: string | null
          created_at?: string
          data_fechamento?: string | null
          id_empresa: string
          id_relatorio?: string
          id_semana: string
          status?: Database["public"]["Enums"]["status_relatorio"]
          texto_comparacao?: string | null
          updated_at?: string
        }
        Update: {
          aprendizado_resumo?: string | null
          created_at?: string
          data_fechamento?: string | null
          id_empresa?: string
          id_relatorio?: string
          id_semana?: string
          status?: Database["public"]["Enums"]["status_relatorio"]
          texto_comparacao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_semanal_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "relatorio_semanal_id_semana_fkey"
            columns: ["id_semana"]
            isOneToOne: false
            referencedRelation: "semana"
            referencedColumns: ["id_semana"]
          },
        ]
      }
      semana: {
        Row: {
          ano: number
          created_at: string
          data_fim: string
          data_inicio: string
          id_semana: string
          numero_semana: number
        }
        Insert: {
          ano: number
          created_at?: string
          data_fim: string
          data_inicio: string
          id_semana?: string
          numero_semana: number
        }
        Update: {
          ano?: number
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id_semana?: string
          numero_semana?: number
        }
        Relationships: []
      }
      smartlink_cliques: {
        Row: {
          cliques: number
          created_at: string
          data: string
          id_empresa: string
          id_smartlink: string
          smartlink_id: string
          smartlink_nome: string | null
          smartlink_url: string | null
          updated_at: string
        }
        Insert: {
          cliques?: number
          created_at?: string
          data: string
          id_empresa: string
          id_smartlink?: string
          smartlink_id: string
          smartlink_nome?: string | null
          smartlink_url?: string | null
          updated_at?: string
        }
        Update: {
          cliques?: number
          created_at?: string
          data?: string
          id_empresa?: string
          id_smartlink?: string
          smartlink_id?: string
          smartlink_nome?: string | null
          smartlink_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartlink_cliques_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      social_metricas_dia: {
        Row: {
          alcance: number
          cliques_website: number
          created_at: string
          data: string
          engajamento: number
          id_empresa: string
          id_metrica: string
          impressoes: number
          novos_seguidores: number
          rede_social: Database["public"]["Enums"]["rede_social"]
          seguidores_total: number
          updated_at: string
          visitas_perfil: number
        }
        Insert: {
          alcance?: number
          cliques_website?: number
          created_at?: string
          data: string
          engajamento?: number
          id_empresa: string
          id_metrica?: string
          impressoes?: number
          novos_seguidores?: number
          rede_social: Database["public"]["Enums"]["rede_social"]
          seguidores_total?: number
          updated_at?: string
          visitas_perfil?: number
        }
        Update: {
          alcance?: number
          cliques_website?: number
          created_at?: string
          data?: string
          engajamento?: number
          id_empresa?: string
          id_metrica?: string
          impressoes?: number
          novos_seguidores?: number
          rede_social?: Database["public"]["Enums"]["rede_social"]
          seguidores_total?: number
          updated_at?: string
          visitas_perfil?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_metricas_dia_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      tokeniza_investimento: {
        Row: {
          amount: number
          bank_of_brazil_entry_hash: string | null
          created_at: string
          created_nft: string | null
          data_atualizacao: string | null
          data_criacao: string
          deposit_id: string | null
          fin_operation: boolean | null
          id: string
          id_empresa: string
          id_externo: string
          project_id: string | null
          status: string
          updated_at: string
          usd_amount: number | null
          user_id_tokeniza: string | null
          was_paid: boolean | null
        }
        Insert: {
          amount?: number
          bank_of_brazil_entry_hash?: string | null
          created_at?: string
          created_nft?: string | null
          data_atualizacao?: string | null
          data_criacao?: string
          deposit_id?: string | null
          fin_operation?: boolean | null
          id?: string
          id_empresa: string
          id_externo: string
          project_id?: string | null
          status: string
          updated_at?: string
          usd_amount?: number | null
          user_id_tokeniza?: string | null
          was_paid?: boolean | null
        }
        Update: {
          amount?: number
          bank_of_brazil_entry_hash?: string | null
          created_at?: string
          created_nft?: string | null
          data_atualizacao?: string | null
          data_criacao?: string
          deposit_id?: string | null
          fin_operation?: boolean | null
          id?: string
          id_empresa?: string
          id_externo?: string
          project_id?: string | null
          status?: string
          updated_at?: string
          usd_amount?: number | null
          user_id_tokeniza?: string | null
          was_paid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tokeniza_investimento_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      tokeniza_projeto: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: string
          nome: string
          project_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome: string
          project_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          project_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tokeniza_usuario: {
        Row: {
          cnpj: string | null
          cpf: string | null
          created_at: string
          data_cadastro: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          phone: string | null
          updated_at: string
          user_id_tokeniza: string
        }
        Insert: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id_tokeniza: string
        }
        Update: {
          cnpj?: string | null
          cpf?: string | null
          created_at?: string
          data_cadastro?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          updated_at?: string
          user_id_tokeniza?: string
        }
        Relationships: []
      }
      tokeniza_venda: {
        Row: {
          address_id: string | null
          asset_id: string | null
          created_at: string
          data_atualizacao: string | null
          data_criacao: string
          data_expiracao: string | null
          external_id: string | null
          has_cashback: boolean | null
          id: string
          id_empresa: string
          id_externo: string
          indication_reward_status: string | null
          is_nft_buy: boolean | null
          is_ticket_buy: boolean | null
          is_token_buy: boolean | null
          items: Json | null
          nft_id: string | null
          package_id: string | null
          payment_method: string | null
          quantity: number | null
          shipping_amount: number | null
          status: string
          store_id: string | null
          tax_amount: number | null
          tokens_amount: number | null
          total_amount: number
          transaction_id: string | null
          unit_of_money: string | null
          unit_purchased: string | null
          updated_at: string
          user_email: string | null
          user_id_tokeniza: string | null
          user_wallet_id: string | null
          was_paid: boolean | null
        }
        Insert: {
          address_id?: string | null
          asset_id?: string | null
          created_at?: string
          data_atualizacao?: string | null
          data_criacao?: string
          data_expiracao?: string | null
          external_id?: string | null
          has_cashback?: boolean | null
          id?: string
          id_empresa: string
          id_externo: string
          indication_reward_status?: string | null
          is_nft_buy?: boolean | null
          is_ticket_buy?: boolean | null
          is_token_buy?: boolean | null
          items?: Json | null
          nft_id?: string | null
          package_id?: string | null
          payment_method?: string | null
          quantity?: number | null
          shipping_amount?: number | null
          status: string
          store_id?: string | null
          tax_amount?: number | null
          tokens_amount?: number | null
          total_amount?: number
          transaction_id?: string | null
          unit_of_money?: string | null
          unit_purchased?: string | null
          updated_at?: string
          user_email?: string | null
          user_id_tokeniza?: string | null
          user_wallet_id?: string | null
          was_paid?: boolean | null
        }
        Update: {
          address_id?: string | null
          asset_id?: string | null
          created_at?: string
          data_atualizacao?: string | null
          data_criacao?: string
          data_expiracao?: string | null
          external_id?: string | null
          has_cashback?: boolean | null
          id?: string
          id_empresa?: string
          id_externo?: string
          indication_reward_status?: string | null
          is_nft_buy?: boolean | null
          is_ticket_buy?: boolean | null
          is_token_buy?: boolean | null
          items?: Json | null
          nft_id?: string | null
          package_id?: string | null
          payment_method?: string | null
          quantity?: number | null
          shipping_amount?: number | null
          status?: string
          store_id?: string | null
          tax_amount?: number | null
          tokens_amount?: number | null
          total_amount?: number
          transaction_id?: string | null
          unit_of_money?: string | null
          unit_purchased?: string | null
          updated_at?: string
          user_email?: string | null
          user_id_tokeniza?: string | null
          user_wallet_id?: string | null
          was_paid?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "tokeniza_venda_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      user_empresa: {
        Row: {
          created_at: string | null
          id: string
          id_empresa: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          id_empresa: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          id_empresa?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "user_empresa_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "direcao" | "trafego" | "sdr"
      canal_origem: "META" | "GOOGLE" | "ORGANICO" | "OUTRO"
      categoria_acao: "A" | "B" | "C"
      origem_lead: "PAGO" | "ORGANICO" | "INDICACAO" | "LISTA" | "MANUAL"
      perfil_usuario: "TRAFEGO" | "SDR_COMERCIAL" | "DIRECAO" | "ADMIN"
      plataforma_midia: "META" | "GOOGLE"
      rede_social:
        | "INSTAGRAM"
        | "FACEBOOK"
        | "LINKEDIN"
        | "TIKTOK"
        | "YOUTUBE"
        | "TWITTER"
      resultado_hipotese: "VALIDADA" | "REFUTADA" | "INCONCLUSIVA"
      status_acao: "PENDENTE" | "APROVADA" | "REPROVADA" | "EXECUTADA"
      status_aprovacao: "APROVADA" | "REPROVADA"
      status_relatorio: "EM_EDICAO" | "PRONTO" | "VALIDADO"
      tipo_aprendizado: "CRIATIVO" | "PUBLICO" | "OFERTA" | "FUNIL" | "OUTRO"
      tipo_criativo: "VIDEO" | "IMAGEM" | "CARROSSEL" | "OUTRO"
      tipo_integracao:
        | "META_ADS"
        | "GOOGLE_ADS"
        | "PIPEDRIVE"
        | "TOKENIZA"
        | "MAUTIC"
        | "NOTION"
        | "METRICOOL"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "direcao", "trafego", "sdr"],
      canal_origem: ["META", "GOOGLE", "ORGANICO", "OUTRO"],
      categoria_acao: ["A", "B", "C"],
      origem_lead: ["PAGO", "ORGANICO", "INDICACAO", "LISTA", "MANUAL"],
      perfil_usuario: ["TRAFEGO", "SDR_COMERCIAL", "DIRECAO", "ADMIN"],
      plataforma_midia: ["META", "GOOGLE"],
      rede_social: [
        "INSTAGRAM",
        "FACEBOOK",
        "LINKEDIN",
        "TIKTOK",
        "YOUTUBE",
        "TWITTER",
      ],
      resultado_hipotese: ["VALIDADA", "REFUTADA", "INCONCLUSIVA"],
      status_acao: ["PENDENTE", "APROVADA", "REPROVADA", "EXECUTADA"],
      status_aprovacao: ["APROVADA", "REPROVADA"],
      status_relatorio: ["EM_EDICAO", "PRONTO", "VALIDADO"],
      tipo_aprendizado: ["CRIATIVO", "PUBLICO", "OFERTA", "FUNIL", "OUTRO"],
      tipo_criativo: ["VIDEO", "IMAGEM", "CARROSSEL", "OUTRO"],
      tipo_integracao: [
        "META_ADS",
        "GOOGLE_ADS",
        "PIPEDRIVE",
        "TOKENIZA",
        "MAUTIC",
        "NOTION",
        "METRICOOL",
      ],
    },
  },
} as const
