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
      alerta_automatico: {
        Row: {
          acionavel: boolean | null
          created_at: string
          descricao: string | null
          id_acao: string | null
          id_alerta: string
          id_empresa: string
          metadados: Json | null
          resolvido: boolean | null
          resolvido_em: string | null
          resolvido_por: string | null
          severidade: string
          tipo: string
          titulo: string
          updated_at: string
          visualizado: boolean | null
        }
        Insert: {
          acionavel?: boolean | null
          created_at?: string
          descricao?: string | null
          id_acao?: string | null
          id_alerta?: string
          id_empresa: string
          metadados?: Json | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade: string
          tipo: string
          titulo: string
          updated_at?: string
          visualizado?: boolean | null
        }
        Update: {
          acionavel?: boolean | null
          created_at?: string
          descricao?: string | null
          id_acao?: string | null
          id_alerta?: string
          id_empresa?: string
          metadados?: Json | null
          resolvido?: boolean | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          severidade?: string
          tipo?: string
          titulo?: string
          updated_at?: string
          visualizado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "alerta_automatico_id_acao_fkey"
            columns: ["id_acao"]
            isOneToOne: false
            referencedRelation: "acao"
            referencedColumns: ["id_acao"]
          },
          {
            foreignKeyName: "alerta_automatico_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
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
      automacao_execucao_log: {
        Row: {
          acoes_executadas: Json | null
          condicoes_atendidas: Json | null
          created_at: string
          duracao_ms: number | null
          erro: string | null
          id: string
          id_automacao: string
          sucesso: boolean
        }
        Insert: {
          acoes_executadas?: Json | null
          condicoes_atendidas?: Json | null
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          id_automacao: string
          sucesso: boolean
        }
        Update: {
          acoes_executadas?: Json | null
          condicoes_atendidas?: Json | null
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          id_automacao?: string
          sucesso?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "automacao_execucao_log_id_automacao_fkey"
            columns: ["id_automacao"]
            isOneToOne: false
            referencedRelation: "automacao_workflow"
            referencedColumns: ["id"]
          },
        ]
      }
      automacao_workflow: {
        Row: {
          acoes: Json
          ativo: boolean | null
          condicoes: Json
          created_at: string
          descricao: string | null
          id: string
          id_empresa: string | null
          nome: string
          total_erros: number | null
          total_execucoes: number | null
          total_sucessos: number | null
          trigger_type: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          acoes: Json
          ativo?: boolean | null
          condicoes: Json
          created_at?: string
          descricao?: string | null
          id?: string
          id_empresa?: string | null
          nome: string
          total_erros?: number | null
          total_execucoes?: number | null
          total_sucessos?: number | null
          trigger_type: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          acoes?: Json
          ativo?: boolean | null
          condicoes?: Json
          created_at?: string
          descricao?: string | null
          id?: string
          id_empresa?: string | null
          nome?: string
          total_erros?: number | null
          total_execucoes?: number | null
          total_sucessos?: number | null
          trigger_type?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacao_workflow_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
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
          conversoes: number | null
          created_at: string
          data: string
          fonte_conversoes: string | null
          id_campanha: string
          id_metricas_dia: string
          impressoes: number
          leads: number
          valor_conversao: number | null
          verba_investida: number
        }
        Insert: {
          cliques?: number
          conversoes?: number | null
          created_at?: string
          data: string
          fonte_conversoes?: string | null
          id_campanha: string
          id_metricas_dia?: string
          impressoes?: number
          leads?: number
          valor_conversao?: number | null
          verba_investida?: number
        }
        Update: {
          cliques?: number
          conversoes?: number | null
          created_at?: string
          data?: string
          fonte_conversoes?: string | null
          id_campanha?: string
          id_metricas_dia?: string
          impressoes?: number
          leads?: number
          valor_conversao?: number | null
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
      concorrente_anuncio: {
        Row: {
          ad_id_externo: string | null
          concorrente_nome: string
          created_at: string
          data_detectado: string
          data_inicio_veiculo: string | null
          id: string
          id_empresa: string
          impressoes_estimadas: number | null
          metadados: Json | null
          plataforma: string
          status: string
          texto_corpo: string | null
          titulo: string | null
          updated_at: string
          url_destino: string | null
          url_midia: string | null
        }
        Insert: {
          ad_id_externo?: string | null
          concorrente_nome: string
          created_at?: string
          data_detectado?: string
          data_inicio_veiculo?: string | null
          id?: string
          id_empresa: string
          impressoes_estimadas?: number | null
          metadados?: Json | null
          plataforma?: string
          status?: string
          texto_corpo?: string | null
          titulo?: string | null
          updated_at?: string
          url_destino?: string | null
          url_midia?: string | null
        }
        Update: {
          ad_id_externo?: string | null
          concorrente_nome?: string
          created_at?: string
          data_detectado?: string
          data_inicio_veiculo?: string | null
          id?: string
          id_empresa?: string
          impressoes_estimadas?: number | null
          metadados?: Json | null
          plataforma?: string
          status?: string
          texto_corpo?: string | null
          titulo?: string | null
          updated_at?: string
          url_destino?: string | null
          url_midia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "concorrente_anuncio_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      concorrente_config: {
        Row: {
          ativo: boolean
          created_at: string
          facebook_page_name: string | null
          google_advertiser_id: string | null
          id: string
          id_empresa: string
          linkedin_page_url: string | null
          nome_concorrente: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          facebook_page_name?: string | null
          google_advertiser_id?: string | null
          id?: string
          id_empresa: string
          linkedin_page_url?: string | null
          nome_concorrente: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          facebook_page_name?: string | null
          google_advertiser_id?: string | null
          id?: string
          id_empresa?: string
          linkedin_page_url?: string | null
          nome_concorrente?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "concorrente_config_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
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
      demanda_campanha: {
        Row: {
          contexto_ia: Json | null
          created_at: string | null
          criativos: Json | null
          data_fim: string | null
          data_inicio: string | null
          data_verificacao: string | null
          descricao: string | null
          google_extensoes: string[] | null
          google_palavras_chave: string[] | null
          google_palavras_negativas: string[] | null
          google_tipo_campanha:
            | Database["public"]["Enums"]["tipo_campanha_google"]
            | null
          google_tipo_correspondencia: string | null
          id_campanha_criada: string | null
          id_criador: string
          id_demanda: string
          id_empresa: string
          id_executor: string | null
          landing_pages: string[] | null
          meta_genero: string | null
          meta_idade_max: number | null
          meta_idade_min: number | null
          meta_interesses: string[] | null
          meta_localizacoes: string[] | null
          meta_objetivo: string | null
          meta_posicionamentos: string[] | null
          meta_publico_alvo: string | null
          meta_tipo_campanha:
            | Database["public"]["Enums"]["tipo_campanha_meta"]
            | null
          observacoes_executor: string | null
          plataforma: Database["public"]["Enums"]["plataforma_ads"]
          prioridade: Database["public"]["Enums"]["prioridade_demanda"] | null
          resultado_verificacao: string | null
          status: Database["public"]["Enums"]["status_demanda"] | null
          sugerida_por_ia: boolean | null
          teste_ab_paginas: boolean | null
          titulo: string
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          verba_diaria: number | null
          verba_total: number | null
          verificada: boolean | null
        }
        Insert: {
          contexto_ia?: Json | null
          created_at?: string | null
          criativos?: Json | null
          data_fim?: string | null
          data_inicio?: string | null
          data_verificacao?: string | null
          descricao?: string | null
          google_extensoes?: string[] | null
          google_palavras_chave?: string[] | null
          google_palavras_negativas?: string[] | null
          google_tipo_campanha?:
            | Database["public"]["Enums"]["tipo_campanha_google"]
            | null
          google_tipo_correspondencia?: string | null
          id_campanha_criada?: string | null
          id_criador: string
          id_demanda?: string
          id_empresa: string
          id_executor?: string | null
          landing_pages?: string[] | null
          meta_genero?: string | null
          meta_idade_max?: number | null
          meta_idade_min?: number | null
          meta_interesses?: string[] | null
          meta_localizacoes?: string[] | null
          meta_objetivo?: string | null
          meta_posicionamentos?: string[] | null
          meta_publico_alvo?: string | null
          meta_tipo_campanha?:
            | Database["public"]["Enums"]["tipo_campanha_meta"]
            | null
          observacoes_executor?: string | null
          plataforma: Database["public"]["Enums"]["plataforma_ads"]
          prioridade?: Database["public"]["Enums"]["prioridade_demanda"] | null
          resultado_verificacao?: string | null
          status?: Database["public"]["Enums"]["status_demanda"] | null
          sugerida_por_ia?: boolean | null
          teste_ab_paginas?: boolean | null
          titulo: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          verba_diaria?: number | null
          verba_total?: number | null
          verificada?: boolean | null
        }
        Update: {
          contexto_ia?: Json | null
          created_at?: string | null
          criativos?: Json | null
          data_fim?: string | null
          data_inicio?: string | null
          data_verificacao?: string | null
          descricao?: string | null
          google_extensoes?: string[] | null
          google_palavras_chave?: string[] | null
          google_palavras_negativas?: string[] | null
          google_tipo_campanha?:
            | Database["public"]["Enums"]["tipo_campanha_google"]
            | null
          google_tipo_correspondencia?: string | null
          id_campanha_criada?: string | null
          id_criador?: string
          id_demanda?: string
          id_empresa?: string
          id_executor?: string | null
          landing_pages?: string[] | null
          meta_genero?: string | null
          meta_idade_max?: number | null
          meta_idade_min?: number | null
          meta_interesses?: string[] | null
          meta_localizacoes?: string[] | null
          meta_objetivo?: string | null
          meta_posicionamentos?: string[] | null
          meta_publico_alvo?: string | null
          meta_tipo_campanha?:
            | Database["public"]["Enums"]["tipo_campanha_meta"]
            | null
          observacoes_executor?: string | null
          plataforma?: Database["public"]["Enums"]["plataforma_ads"]
          prioridade?: Database["public"]["Enums"]["prioridade_demanda"] | null
          resultado_verificacao?: string | null
          status?: Database["public"]["Enums"]["status_demanda"] | null
          sugerida_por_ia?: boolean | null
          teste_ab_paginas?: boolean | null
          titulo?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          verba_diaria?: number | null
          verba_total?: number | null
          verificada?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "demanda_campanha_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
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
      empresa_metricas_dia: {
        Row: {
          cac: number | null
          cpl: number | null
          created_at: string | null
          data: string
          id_empresa: string
          id_metricas_dia: string
          leads_pagos: number | null
          leads_total: number | null
          levantadas: number | null
          mqls: number | null
          reunioes: number | null
          ticket_medio: number | null
          tipo_negocio: string
          updated_at: string | null
          valor_vendas: number | null
          vendas: number | null
          verba_investida: number | null
        }
        Insert: {
          cac?: number | null
          cpl?: number | null
          created_at?: string | null
          data: string
          id_empresa: string
          id_metricas_dia?: string
          leads_pagos?: number | null
          leads_total?: number | null
          levantadas?: number | null
          mqls?: number | null
          reunioes?: number | null
          ticket_medio?: number | null
          tipo_negocio?: string
          updated_at?: string | null
          valor_vendas?: number | null
          vendas?: number | null
          verba_investida?: number | null
        }
        Update: {
          cac?: number | null
          cpl?: number | null
          created_at?: string | null
          data?: string
          id_empresa?: string
          id_metricas_dia?: string
          leads_pagos?: number | null
          leads_total?: number | null
          levantadas?: number | null
          mqls?: number | null
          reunioes?: number | null
          ticket_medio?: number | null
          tipo_negocio?: string
          updated_at?: string | null
          valor_vendas?: number | null
          vendas?: number | null
          verba_investida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_metricas_dia_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
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
      empresa_stape_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          id_empresa: string
          meta_capi_token: string | null
          meta_pixel_id: string | null
          stape_account_api_key: string | null
          stape_container_api_key: string | null
          stape_container_id: string | null
          stape_container_url: string | null
          stape_region: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          id_empresa: string
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          stape_account_api_key?: string | null
          stape_container_api_key?: string | null
          stape_container_id?: string | null
          stape_container_url?: string | null
          stape_region?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          id_empresa?: string
          meta_capi_token?: string | null
          meta_pixel_id?: string | null
          stape_account_api_key?: string | null
          stape_container_api_key?: string | null
          stape_container_id?: string | null
          stape_container_url?: string | null
          stape_region?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresa_stape_config_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: true
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
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
          id_empresa: string
          id_integracao: string
          tipo: Database["public"]["Enums"]["tipo_integracao"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          config_json: Json
          created_at?: string
          id_empresa: string
          id_integracao?: string
          tipo: Database["public"]["Enums"]["tipo_integracao"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          config_json?: Json
          created_at?: string
          id_empresa?: string
          id_integracao?: string
          tipo?: Database["public"]["Enums"]["tipo_integracao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_integracao_empresa"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      irpf_alimentando: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          id: string
          id_declaracao: string
          nome: string
          tipo_relacao: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          id_declaracao: string
          nome: string
          tipo_relacao?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          id_declaracao?: string
          nome?: string
          tipo_relacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_alimentando_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_atividade_rural: {
        Row: {
          area_explorada: number | null
          area_total: number | null
          created_at: string | null
          despesa_custeio: number | null
          despesa_depreciacao: number | null
          despesa_investimentos: number | null
          despesas_outras: number | null
          endereco: string | null
          id: string
          id_declaracao: string
          inscricao_nirf: string | null
          localizacao: string | null
          nome_imovel: string | null
          prejuizo_compensar: number | null
          receita_producao_animal: number | null
          receita_producao_vegetal: number | null
          receita_produtos_agroindustriais: number | null
          receita_venda_bens: number | null
          receitas_outras: number | null
          resultado_bruto: number | null
          resultado_tributavel: number | null
          tipo_exploracao: string | null
          total_despesas: number | null
          total_receitas: number | null
        }
        Insert: {
          area_explorada?: number | null
          area_total?: number | null
          created_at?: string | null
          despesa_custeio?: number | null
          despesa_depreciacao?: number | null
          despesa_investimentos?: number | null
          despesas_outras?: number | null
          endereco?: string | null
          id?: string
          id_declaracao: string
          inscricao_nirf?: string | null
          localizacao?: string | null
          nome_imovel?: string | null
          prejuizo_compensar?: number | null
          receita_producao_animal?: number | null
          receita_producao_vegetal?: number | null
          receita_produtos_agroindustriais?: number | null
          receita_venda_bens?: number | null
          receitas_outras?: number | null
          resultado_bruto?: number | null
          resultado_tributavel?: number | null
          tipo_exploracao?: string | null
          total_despesas?: number | null
          total_receitas?: number | null
        }
        Update: {
          area_explorada?: number | null
          area_total?: number | null
          created_at?: string | null
          despesa_custeio?: number | null
          despesa_depreciacao?: number | null
          despesa_investimentos?: number | null
          despesas_outras?: number | null
          endereco?: string | null
          id?: string
          id_declaracao?: string
          inscricao_nirf?: string | null
          localizacao?: string | null
          nome_imovel?: string | null
          prejuizo_compensar?: number | null
          receita_producao_animal?: number | null
          receita_producao_vegetal?: number | null
          receita_produtos_agroindustriais?: number | null
          receita_venda_bens?: number | null
          receitas_outras?: number | null
          resultado_bruto?: number | null
          resultado_tributavel?: number | null
          tipo_exploracao?: string | null
          total_despesas?: number | null
          total_receitas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_atividade_rural_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_atividade_rural_rebanho: {
        Row: {
          abates: number | null
          compras: number | null
          created_at: string | null
          id: string
          id_atividade_rural: string
          mortes: number | null
          nascimentos: number | null
          quantidade_final: number | null
          quantidade_inicial: number | null
          tipo_animal: string | null
          valor_medio_cabeca: number | null
          valor_total: number | null
          vendas: number | null
        }
        Insert: {
          abates?: number | null
          compras?: number | null
          created_at?: string | null
          id?: string
          id_atividade_rural: string
          mortes?: number | null
          nascimentos?: number | null
          quantidade_final?: number | null
          quantidade_inicial?: number | null
          tipo_animal?: string | null
          valor_medio_cabeca?: number | null
          valor_total?: number | null
          vendas?: number | null
        }
        Update: {
          abates?: number | null
          compras?: number | null
          created_at?: string | null
          id?: string
          id_atividade_rural?: string
          mortes?: number | null
          nascimentos?: number | null
          quantidade_final?: number | null
          quantidade_inicial?: number | null
          tipo_animal?: string | null
          valor_medio_cabeca?: number | null
          valor_total?: number | null
          vendas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_atividade_rural_rebanho_id_atividade_rural_fkey"
            columns: ["id_atividade_rural"]
            isOneToOne: false
            referencedRelation: "irpf_atividade_rural"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_bem_direito: {
        Row: {
          atualizou_valor_imovel_lei_14973: boolean | null
          banco_agencia: string | null
          banco_codigo: string | null
          banco_conta: string | null
          banco_nome: string | null
          banco_tipo_conta: string | null
          cnpj_instituicao: string | null
          codigo_bem: string
          codigo_descricao: string | null
          conta_pagamento: boolean | null
          cpf_dependente: string | null
          cpf_titular: string | null
          created_at: string | null
          credito_cpf_cnpj_devedor: string | null
          credito_data_concessao: string | null
          credito_nome_devedor: string | null
          credito_parcelas_recebidas: number | null
          credito_parcelas_totais: number | null
          credito_valor_original: number | null
          credito_valor_parcela: number | null
          cripto_aplicacao_financeira: boolean | null
          cripto_autocustodiante: boolean | null
          cripto_codigo: string | null
          cripto_exchange: string | null
          cripto_imposto_pago_exterior: number | null
          cripto_irrf_brasil: number | null
          cripto_lucro_prejuizo: number | null
          cripto_lucros_dividendos: boolean | null
          cripto_quantidade: number | null
          cripto_tipo: string | null
          cripto_valor_recebido: number | null
          discriminacao: string
          fii_cnpj: string | null
          fii_nome: string | null
          fii_quantidade_cotas: number | null
          ganho_capital_pago_ate_16_12: number | null
          grupo_codigo: string
          grupo_descricao: string | null
          id: string
          id_declaracao: string
          imovel_area_total: number | null
          imovel_cartorio: string | null
          imovel_data_aquisicao: string | null
          imovel_endereco: string | null
          imovel_forma_aquisicao: string | null
          imovel_inscricao_iptu: string | null
          imovel_matricula: string | null
          imovel_tipo: string | null
          investimento_cnpj_administradora: string | null
          investimento_nome_fundo: string | null
          investimento_tipo: string | null
          numero_bem: number
          pais_codigo: string | null
          pais_nome: string | null
          participacao_cnpj: string | null
          participacao_data_constituicao: string | null
          participacao_percentual: number | null
          participacao_quantidade: number | null
          participacao_razao_social: string | null
          participacao_registro: string | null
          participacao_tipo: string | null
          pertence_a: string | null
          valor_ano_anterior: number | null
          valor_ano_atual: number | null
          veiculo_ano_fabricacao: number | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          veiculo_renavam: string | null
          veiculo_tipo: string | null
        }
        Insert: {
          atualizou_valor_imovel_lei_14973?: boolean | null
          banco_agencia?: string | null
          banco_codigo?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          cnpj_instituicao?: string | null
          codigo_bem: string
          codigo_descricao?: string | null
          conta_pagamento?: boolean | null
          cpf_dependente?: string | null
          cpf_titular?: string | null
          created_at?: string | null
          credito_cpf_cnpj_devedor?: string | null
          credito_data_concessao?: string | null
          credito_nome_devedor?: string | null
          credito_parcelas_recebidas?: number | null
          credito_parcelas_totais?: number | null
          credito_valor_original?: number | null
          credito_valor_parcela?: number | null
          cripto_aplicacao_financeira?: boolean | null
          cripto_autocustodiante?: boolean | null
          cripto_codigo?: string | null
          cripto_exchange?: string | null
          cripto_imposto_pago_exterior?: number | null
          cripto_irrf_brasil?: number | null
          cripto_lucro_prejuizo?: number | null
          cripto_lucros_dividendos?: boolean | null
          cripto_quantidade?: number | null
          cripto_tipo?: string | null
          cripto_valor_recebido?: number | null
          discriminacao: string
          fii_cnpj?: string | null
          fii_nome?: string | null
          fii_quantidade_cotas?: number | null
          ganho_capital_pago_ate_16_12?: number | null
          grupo_codigo: string
          grupo_descricao?: string | null
          id?: string
          id_declaracao: string
          imovel_area_total?: number | null
          imovel_cartorio?: string | null
          imovel_data_aquisicao?: string | null
          imovel_endereco?: string | null
          imovel_forma_aquisicao?: string | null
          imovel_inscricao_iptu?: string | null
          imovel_matricula?: string | null
          imovel_tipo?: string | null
          investimento_cnpj_administradora?: string | null
          investimento_nome_fundo?: string | null
          investimento_tipo?: string | null
          numero_bem: number
          pais_codigo?: string | null
          pais_nome?: string | null
          participacao_cnpj?: string | null
          participacao_data_constituicao?: string | null
          participacao_percentual?: number | null
          participacao_quantidade?: number | null
          participacao_razao_social?: string | null
          participacao_registro?: string | null
          participacao_tipo?: string | null
          pertence_a?: string | null
          valor_ano_anterior?: number | null
          valor_ano_atual?: number | null
          veiculo_ano_fabricacao?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_renavam?: string | null
          veiculo_tipo?: string | null
        }
        Update: {
          atualizou_valor_imovel_lei_14973?: boolean | null
          banco_agencia?: string | null
          banco_codigo?: string | null
          banco_conta?: string | null
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          cnpj_instituicao?: string | null
          codigo_bem?: string
          codigo_descricao?: string | null
          conta_pagamento?: boolean | null
          cpf_dependente?: string | null
          cpf_titular?: string | null
          created_at?: string | null
          credito_cpf_cnpj_devedor?: string | null
          credito_data_concessao?: string | null
          credito_nome_devedor?: string | null
          credito_parcelas_recebidas?: number | null
          credito_parcelas_totais?: number | null
          credito_valor_original?: number | null
          credito_valor_parcela?: number | null
          cripto_aplicacao_financeira?: boolean | null
          cripto_autocustodiante?: boolean | null
          cripto_codigo?: string | null
          cripto_exchange?: string | null
          cripto_imposto_pago_exterior?: number | null
          cripto_irrf_brasil?: number | null
          cripto_lucro_prejuizo?: number | null
          cripto_lucros_dividendos?: boolean | null
          cripto_quantidade?: number | null
          cripto_tipo?: string | null
          cripto_valor_recebido?: number | null
          discriminacao?: string
          fii_cnpj?: string | null
          fii_nome?: string | null
          fii_quantidade_cotas?: number | null
          ganho_capital_pago_ate_16_12?: number | null
          grupo_codigo?: string
          grupo_descricao?: string | null
          id?: string
          id_declaracao?: string
          imovel_area_total?: number | null
          imovel_cartorio?: string | null
          imovel_data_aquisicao?: string | null
          imovel_endereco?: string | null
          imovel_forma_aquisicao?: string | null
          imovel_inscricao_iptu?: string | null
          imovel_matricula?: string | null
          imovel_tipo?: string | null
          investimento_cnpj_administradora?: string | null
          investimento_nome_fundo?: string | null
          investimento_tipo?: string | null
          numero_bem?: number
          pais_codigo?: string | null
          pais_nome?: string | null
          participacao_cnpj?: string | null
          participacao_data_constituicao?: string | null
          participacao_percentual?: number | null
          participacao_quantidade?: number | null
          participacao_razao_social?: string | null
          participacao_registro?: string | null
          participacao_tipo?: string | null
          pertence_a?: string | null
          valor_ano_anterior?: number | null
          valor_ano_atual?: number | null
          veiculo_ano_fabricacao?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_renavam?: string | null
          veiculo_tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_bem_direito_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_declaracao: {
        Row: {
          ano_calendario: number
          arquivo_origem: string | null
          celular_ddd: string | null
          celular_numero: string | null
          cpf: string
          cpf_conjuge: string | null
          created_at: string | null
          data_importacao: string | null
          data_nascimento: string | null
          doenca_grave_ou_deficiencia: boolean | null
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_complemento: string | null
          endereco_logradouro: string | null
          endereco_municipio: string | null
          endereco_numero: string | null
          endereco_uf: string | null
          erro_processamento: string | null
          exercicio: number
          id: string
          id_cliente_notion: string | null
          id_empresa: string
          id_lead: string | null
          natureza_ocupacao_codigo: string | null
          natureza_ocupacao_descricao: string | null
          nome_conjuge: string | null
          nome_contribuinte: string
          numero_recibo_anterior: string | null
          ocupacao_principal_codigo: string | null
          ocupacao_principal_descricao: string | null
          possui_atividade_rural: boolean | null
          possui_conjuge: boolean | null
          resultado_atividade_rural: number | null
          status_processamento: string | null
          telefone_ddd: string | null
          telefone_numero: string | null
          tipo_declaracao: string | null
          updated_at: string | null
        }
        Insert: {
          ano_calendario: number
          arquivo_origem?: string | null
          celular_ddd?: string | null
          celular_numero?: string | null
          cpf: string
          cpf_conjuge?: string | null
          created_at?: string | null
          data_importacao?: string | null
          data_nascimento?: string | null
          doenca_grave_ou_deficiencia?: boolean | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          erro_processamento?: string | null
          exercicio: number
          id?: string
          id_cliente_notion?: string | null
          id_empresa: string
          id_lead?: string | null
          natureza_ocupacao_codigo?: string | null
          natureza_ocupacao_descricao?: string | null
          nome_conjuge?: string | null
          nome_contribuinte: string
          numero_recibo_anterior?: string | null
          ocupacao_principal_codigo?: string | null
          ocupacao_principal_descricao?: string | null
          possui_atividade_rural?: boolean | null
          possui_conjuge?: boolean | null
          resultado_atividade_rural?: number | null
          status_processamento?: string | null
          telefone_ddd?: string | null
          telefone_numero?: string | null
          tipo_declaracao?: string | null
          updated_at?: string | null
        }
        Update: {
          ano_calendario?: number
          arquivo_origem?: string | null
          celular_ddd?: string | null
          celular_numero?: string | null
          cpf?: string
          cpf_conjuge?: string | null
          created_at?: string | null
          data_importacao?: string | null
          data_nascimento?: string | null
          doenca_grave_ou_deficiencia?: boolean | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_complemento?: string | null
          endereco_logradouro?: string | null
          endereco_municipio?: string | null
          endereco_numero?: string | null
          endereco_uf?: string | null
          erro_processamento?: string | null
          exercicio?: number
          id?: string
          id_cliente_notion?: string | null
          id_empresa?: string
          id_lead?: string | null
          natureza_ocupacao_codigo?: string | null
          natureza_ocupacao_descricao?: string | null
          nome_conjuge?: string | null
          nome_contribuinte?: string
          numero_recibo_anterior?: string | null
          ocupacao_principal_codigo?: string | null
          ocupacao_principal_descricao?: string | null
          possui_atividade_rural?: boolean | null
          possui_conjuge?: boolean | null
          resultado_atividade_rural?: number | null
          status_processamento?: string | null
          telefone_ddd?: string | null
          telefone_numero?: string | null
          tipo_declaracao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_declaracao_id_cliente_notion_fkey"
            columns: ["id_cliente_notion"]
            isOneToOne: false
            referencedRelation: "cliente_notion"
            referencedColumns: ["id_cliente"]
          },
          {
            foreignKeyName: "irpf_declaracao_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
          {
            foreignKeyName: "irpf_declaracao_id_lead_fkey"
            columns: ["id_lead"]
            isOneToOne: false
            referencedRelation: "lead"
            referencedColumns: ["id_lead"]
          },
        ]
      }
      irpf_demonstrativo_lei_14754: {
        Row: {
          base_calculo: number | null
          created_at: string | null
          ganho_prejuizo: number | null
          id: string
          id_bem: string | null
          id_declaracao: string
          imposto_devido: number | null
          imposto_pago_brasil: number | null
          imposto_pago_exterior: number | null
          numero_bem: number | null
          prejuizo_a_compensar: number | null
          prejuizo_ano_anterior: number | null
          saldo: number | null
          tipo: string | null
        }
        Insert: {
          base_calculo?: number | null
          created_at?: string | null
          ganho_prejuizo?: number | null
          id?: string
          id_bem?: string | null
          id_declaracao: string
          imposto_devido?: number | null
          imposto_pago_brasil?: number | null
          imposto_pago_exterior?: number | null
          numero_bem?: number | null
          prejuizo_a_compensar?: number | null
          prejuizo_ano_anterior?: number | null
          saldo?: number | null
          tipo?: string | null
        }
        Update: {
          base_calculo?: number | null
          created_at?: string | null
          ganho_prejuizo?: number | null
          id?: string
          id_bem?: string | null
          id_declaracao?: string
          imposto_devido?: number | null
          imposto_pago_brasil?: number | null
          imposto_pago_exterior?: number | null
          numero_bem?: number | null
          prejuizo_a_compensar?: number | null
          prejuizo_ano_anterior?: number | null
          saldo?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_demonstrativo_lei_14754_id_bem_fkey"
            columns: ["id_bem"]
            isOneToOne: false
            referencedRelation: "irpf_bem_direito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irpf_demonstrativo_lei_14754_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_dependente: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          id: string
          id_declaracao: string
          nome: string
          tipo_dependencia_codigo: string | null
          tipo_dependencia_descricao: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          id_declaracao: string
          nome: string
          tipo_dependencia_codigo?: string | null
          tipo_dependencia_descricao?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          id?: string
          id_declaracao?: string
          nome?: string
          tipo_dependencia_codigo?: string | null
          tipo_dependencia_descricao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_dependente_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_divida_onus: {
        Row: {
          codigo: string
          codigo_descricao: string | null
          created_at: string | null
          credor_cpf_cnpj: string | null
          credor_nome: string | null
          data_contratacao: string | null
          discriminacao: string
          garantia: string | null
          id: string
          id_bem_vinculado: string | null
          id_declaracao: string
          natureza_divida: string | null
          numero_divida: number | null
          prazo_meses: number | null
          situacao_ano_anterior: number | null
          situacao_ano_atual: number | null
          taxa_juros: number | null
          valor_original: number | null
          valor_pago_no_ano: number | null
          vinculada_atividade_rural: boolean | null
        }
        Insert: {
          codigo: string
          codigo_descricao?: string | null
          created_at?: string | null
          credor_cpf_cnpj?: string | null
          credor_nome?: string | null
          data_contratacao?: string | null
          discriminacao: string
          garantia?: string | null
          id?: string
          id_bem_vinculado?: string | null
          id_declaracao: string
          natureza_divida?: string | null
          numero_divida?: number | null
          prazo_meses?: number | null
          situacao_ano_anterior?: number | null
          situacao_ano_atual?: number | null
          taxa_juros?: number | null
          valor_original?: number | null
          valor_pago_no_ano?: number | null
          vinculada_atividade_rural?: boolean | null
        }
        Update: {
          codigo?: string
          codigo_descricao?: string | null
          created_at?: string | null
          credor_cpf_cnpj?: string | null
          credor_nome?: string | null
          data_contratacao?: string | null
          discriminacao?: string
          garantia?: string | null
          id?: string
          id_bem_vinculado?: string | null
          id_declaracao?: string
          natureza_divida?: string | null
          numero_divida?: number | null
          prazo_meses?: number | null
          situacao_ano_anterior?: number | null
          situacao_ano_atual?: number | null
          taxa_juros?: number | null
          valor_original?: number | null
          valor_pago_no_ano?: number | null
          vinculada_atividade_rural?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_divida_onus_id_bem_vinculado_fkey"
            columns: ["id_bem_vinculado"]
            isOneToOne: false
            referencedRelation: "irpf_bem_direito"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "irpf_divida_onus_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_doacao: {
        Row: {
          candidato: string | null
          cargo: string | null
          codigo: string | null
          cpf_cnpj_beneficiario: string | null
          created_at: string | null
          id: string
          id_declaracao: string
          nome_beneficiario: string | null
          partido: string | null
          tipo: string
          valor: number | null
        }
        Insert: {
          candidato?: string | null
          cargo?: string | null
          codigo?: string | null
          cpf_cnpj_beneficiario?: string | null
          created_at?: string | null
          id?: string
          id_declaracao: string
          nome_beneficiario?: string | null
          partido?: string | null
          tipo: string
          valor?: number | null
        }
        Update: {
          candidato?: string | null
          cargo?: string | null
          codigo?: string | null
          cpf_cnpj_beneficiario?: string | null
          created_at?: string | null
          id?: string
          id_declaracao?: string
          nome_beneficiario?: string | null
          partido?: string | null
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_doacao_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_evolucao_patrimonial: {
        Row: {
          bens_ano_anterior: number | null
          bens_ano_atual: number | null
          created_at: string | null
          dividas_ano_anterior: number | null
          dividas_ano_atual: number | null
          id: string
          id_declaracao: string
          patrimonio_liquido_anterior: number | null
          patrimonio_liquido_atual: number | null
          variacao_bens: number | null
          variacao_dividas: number | null
          variacao_patrimonial: number | null
        }
        Insert: {
          bens_ano_anterior?: number | null
          bens_ano_atual?: number | null
          created_at?: string | null
          dividas_ano_anterior?: number | null
          dividas_ano_atual?: number | null
          id?: string
          id_declaracao: string
          patrimonio_liquido_anterior?: number | null
          patrimonio_liquido_atual?: number | null
          variacao_bens?: number | null
          variacao_dividas?: number | null
          variacao_patrimonial?: number | null
        }
        Update: {
          bens_ano_anterior?: number | null
          bens_ano_atual?: number | null
          created_at?: string | null
          dividas_ano_anterior?: number | null
          dividas_ano_atual?: number | null
          id?: string
          id_declaracao?: string
          patrimonio_liquido_anterior?: number | null
          patrimonio_liquido_atual?: number | null
          variacao_bens?: number | null
          variacao_dividas?: number | null
          variacao_patrimonial?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_evolucao_patrimonial_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_fundo_imobiliario: {
        Row: {
          base_calculo: number | null
          beneficiario: string | null
          created_at: string | null
          id: string
          id_declaracao: string
          imposto_devido: number | null
          irrf: number | null
          mes: number
          resultado_liquido: number | null
        }
        Insert: {
          base_calculo?: number | null
          beneficiario?: string | null
          created_at?: string | null
          id?: string
          id_declaracao: string
          imposto_devido?: number | null
          irrf?: number | null
          mes: number
          resultado_liquido?: number | null
        }
        Update: {
          base_calculo?: number | null
          beneficiario?: string | null
          created_at?: string | null
          id?: string
          id_declaracao?: string
          imposto_devido?: number | null
          irrf?: number | null
          mes?: number
          resultado_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_fundo_imobiliario_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_ganho_capital: {
        Row: {
          created_at: string | null
          custo_aquisicao_atualizado: number | null
          data_alienacao: string | null
          data_aquisicao: string | null
          descricao_bem: string | null
          ganho_capital: number | null
          id: string
          id_declaracao: string
          imposto_devido: number | null
          imposto_pago: number | null
          taxa_cambio_alienacao: number | null
          taxa_cambio_aquisicao: number | null
          tipo_moeda: string | null
          tipo_operacao: string | null
          valor_alienacao: number | null
          valor_aquisicao: number | null
          valor_moeda_original: number | null
        }
        Insert: {
          created_at?: string | null
          custo_aquisicao_atualizado?: number | null
          data_alienacao?: string | null
          data_aquisicao?: string | null
          descricao_bem?: string | null
          ganho_capital?: number | null
          id?: string
          id_declaracao: string
          imposto_devido?: number | null
          imposto_pago?: number | null
          taxa_cambio_alienacao?: number | null
          taxa_cambio_aquisicao?: number | null
          tipo_moeda?: string | null
          tipo_operacao?: string | null
          valor_alienacao?: number | null
          valor_aquisicao?: number | null
          valor_moeda_original?: number | null
        }
        Update: {
          created_at?: string | null
          custo_aquisicao_atualizado?: number | null
          data_alienacao?: string | null
          data_aquisicao?: string | null
          descricao_bem?: string | null
          ganho_capital?: number | null
          id?: string
          id_declaracao?: string
          imposto_devido?: number | null
          imposto_pago?: number | null
          taxa_cambio_alienacao?: number | null
          taxa_cambio_aquisicao?: number | null
          tipo_moeda?: string | null
          tipo_operacao?: string | null
          valor_alienacao?: number | null
          valor_aquisicao?: number | null
          valor_moeda_original?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_ganho_capital_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_imposto_pago: {
        Row: {
          codigo: string
          created_at: string | null
          descricao: string
          diferenca_limite_legal: number | null
          id: string
          id_declaracao: string
          imposto_devido_com_rendimentos_exterior: number | null
          imposto_devido_sem_rendimentos_exterior: number | null
          valor: number | null
        }
        Insert: {
          codigo: string
          created_at?: string | null
          descricao: string
          diferenca_limite_legal?: number | null
          id?: string
          id_declaracao: string
          imposto_devido_com_rendimentos_exterior?: number | null
          imposto_devido_sem_rendimentos_exterior?: number | null
          valor?: number | null
        }
        Update: {
          codigo?: string
          created_at?: string | null
          descricao?: string
          diferenca_limite_legal?: number | null
          id?: string
          id_declaracao?: string
          imposto_devido_com_rendimentos_exterior?: number | null
          imposto_devido_sem_rendimentos_exterior?: number | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_imposto_pago_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_outras_informacoes: {
        Row: {
          created_at: string | null
          depositos_judiciais_imposto: number | null
          doacoes_partidos_politicos: number | null
          id: string
          id_declaracao: string
          imposto_devido_ganhos_capital: number | null
          imposto_devido_ganhos_moeda_estrangeira: number | null
          imposto_devido_renda_variavel: number | null
          imposto_diferido_ganhos_capital: number | null
          imposto_pagar_ganho_moeda_especie: number | null
          imposto_pago_ganhos_capital: number | null
          imposto_pago_ganhos_moeda_estrangeira: number | null
          imposto_pago_renda_variavel: number | null
          irrf_lei_11033_informado: number | null
          rendimentos_exigibilidade_suspensa: number | null
          rendimentos_isentos_nao_tributaveis: number | null
          rendimentos_tributacao_exclusiva: number | null
        }
        Insert: {
          created_at?: string | null
          depositos_judiciais_imposto?: number | null
          doacoes_partidos_politicos?: number | null
          id?: string
          id_declaracao: string
          imposto_devido_ganhos_capital?: number | null
          imposto_devido_ganhos_moeda_estrangeira?: number | null
          imposto_devido_renda_variavel?: number | null
          imposto_diferido_ganhos_capital?: number | null
          imposto_pagar_ganho_moeda_especie?: number | null
          imposto_pago_ganhos_capital?: number | null
          imposto_pago_ganhos_moeda_estrangeira?: number | null
          imposto_pago_renda_variavel?: number | null
          irrf_lei_11033_informado?: number | null
          rendimentos_exigibilidade_suspensa?: number | null
          rendimentos_isentos_nao_tributaveis?: number | null
          rendimentos_tributacao_exclusiva?: number | null
        }
        Update: {
          created_at?: string | null
          depositos_judiciais_imposto?: number | null
          doacoes_partidos_politicos?: number | null
          id?: string
          id_declaracao?: string
          imposto_devido_ganhos_capital?: number | null
          imposto_devido_ganhos_moeda_estrangeira?: number | null
          imposto_devido_renda_variavel?: number | null
          imposto_diferido_ganhos_capital?: number | null
          imposto_pagar_ganho_moeda_especie?: number | null
          imposto_pago_ganhos_capital?: number | null
          imposto_pago_ganhos_moeda_estrangeira?: number | null
          imposto_pago_renda_variavel?: number | null
          irrf_lei_11033_informado?: number | null
          rendimentos_exigibilidade_suspensa?: number | null
          rendimentos_isentos_nao_tributaveis?: number | null
          rendimentos_tributacao_exclusiva?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_outras_informacoes_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_pagamento_deducao: {
        Row: {
          beneficiario: string | null
          codigo: string
          cpf_cnpj_beneficiario: string | null
          created_at: string | null
          descricao_codigo: string | null
          id: string
          id_declaracao: string
          nome_beneficiario: string | null
          parcela_nao_dedutivel: number | null
          valor_pago: number | null
        }
        Insert: {
          beneficiario?: string | null
          codigo: string
          cpf_cnpj_beneficiario?: string | null
          created_at?: string | null
          descricao_codigo?: string | null
          id?: string
          id_declaracao: string
          nome_beneficiario?: string | null
          parcela_nao_dedutivel?: number | null
          valor_pago?: number | null
        }
        Update: {
          beneficiario?: string | null
          codigo?: string
          cpf_cnpj_beneficiario?: string | null
          created_at?: string | null
          descricao_codigo?: string | null
          id?: string
          id_declaracao?: string
          nome_beneficiario?: string | null
          parcela_nao_dedutivel?: number | null
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_pagamento_deducao_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_renda_variavel: {
        Row: {
          base_calculo_comum: number | null
          base_calculo_daytrade: number | null
          beneficiario: string | null
          created_at: string | null
          id: string
          id_declaracao: string
          imposto_devido_comum: number | null
          imposto_devido_daytrade: number | null
          irrf_comum: number | null
          irrf_daytrade: number | null
          mes: number
          prejuizo_comum_anterior: number | null
          prejuizo_daytrade_anterior: number | null
          resultado_comum_futuros: number | null
          resultado_comum_mercado_vista: number | null
          resultado_comum_opcoes: number | null
          resultado_comum_outros: number | null
          resultado_daytrade_futuros: number | null
          resultado_daytrade_mercado_vista: number | null
          resultado_daytrade_opcoes: number | null
          resultado_daytrade_outros: number | null
          total_operacoes_comuns: number | null
          total_operacoes_daytrade: number | null
        }
        Insert: {
          base_calculo_comum?: number | null
          base_calculo_daytrade?: number | null
          beneficiario?: string | null
          created_at?: string | null
          id?: string
          id_declaracao: string
          imposto_devido_comum?: number | null
          imposto_devido_daytrade?: number | null
          irrf_comum?: number | null
          irrf_daytrade?: number | null
          mes: number
          prejuizo_comum_anterior?: number | null
          prejuizo_daytrade_anterior?: number | null
          resultado_comum_futuros?: number | null
          resultado_comum_mercado_vista?: number | null
          resultado_comum_opcoes?: number | null
          resultado_comum_outros?: number | null
          resultado_daytrade_futuros?: number | null
          resultado_daytrade_mercado_vista?: number | null
          resultado_daytrade_opcoes?: number | null
          resultado_daytrade_outros?: number | null
          total_operacoes_comuns?: number | null
          total_operacoes_daytrade?: number | null
        }
        Update: {
          base_calculo_comum?: number | null
          base_calculo_daytrade?: number | null
          beneficiario?: string | null
          created_at?: string | null
          id?: string
          id_declaracao?: string
          imposto_devido_comum?: number | null
          imposto_devido_daytrade?: number | null
          irrf_comum?: number | null
          irrf_daytrade?: number | null
          mes?: number
          prejuizo_comum_anterior?: number | null
          prejuizo_daytrade_anterior?: number | null
          resultado_comum_futuros?: number | null
          resultado_comum_mercado_vista?: number | null
          resultado_comum_opcoes?: number | null
          resultado_comum_outros?: number | null
          resultado_daytrade_futuros?: number | null
          resultado_daytrade_mercado_vista?: number | null
          resultado_daytrade_opcoes?: number | null
          resultado_daytrade_outros?: number | null
          total_operacoes_comuns?: number | null
          total_operacoes_daytrade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_renda_variavel_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_rendimento: {
        Row: {
          beneficiario: string | null
          categoria: string
          cnpj_fonte: string | null
          codigo_rendimento: string | null
          contribuicao_previdenciaria: number | null
          cpf_beneficiario: string | null
          cpf_fonte: string | null
          created_at: string | null
          decimo_terceiro_salario: number | null
          descricao_tipo: string | null
          id: string
          id_declaracao: string
          imposto_retido_fonte: number | null
          irrf_decimo_terceiro: number | null
          nome_beneficiario: string | null
          nome_fonte: string | null
          valor_rendimento: number | null
        }
        Insert: {
          beneficiario?: string | null
          categoria: string
          cnpj_fonte?: string | null
          codigo_rendimento?: string | null
          contribuicao_previdenciaria?: number | null
          cpf_beneficiario?: string | null
          cpf_fonte?: string | null
          created_at?: string | null
          decimo_terceiro_salario?: number | null
          descricao_tipo?: string | null
          id?: string
          id_declaracao: string
          imposto_retido_fonte?: number | null
          irrf_decimo_terceiro?: number | null
          nome_beneficiario?: string | null
          nome_fonte?: string | null
          valor_rendimento?: number | null
        }
        Update: {
          beneficiario?: string | null
          categoria?: string
          cnpj_fonte?: string | null
          codigo_rendimento?: string | null
          contribuicao_previdenciaria?: number | null
          cpf_beneficiario?: string | null
          cpf_fonte?: string | null
          created_at?: string | null
          decimo_terceiro_salario?: number | null
          descricao_tipo?: string | null
          id?: string
          id_declaracao?: string
          imposto_retido_fonte?: number | null
          irrf_decimo_terceiro?: number | null
          nome_beneficiario?: string | null
          nome_fonte?: string | null
          valor_rendimento?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_rendimento_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      irpf_resumo_tributario: {
        Row: {
          aliquota_efetiva: number | null
          banco_agencia: string | null
          banco_codigo: string | null
          banco_conta: string | null
          banco_tipo_conta: string | null
          base_calculo: number | null
          carne_leao_dependentes: number | null
          carne_leao_titular: number | null
          contrib_previdencia_complementar: number | null
          contrib_previdencia_oficial: number | null
          contrib_previdencia_rra: number | null
          created_at: string | null
          deducao_dependentes: number | null
          deducao_incentivo: number | null
          despesas_instrucao: number | null
          despesas_medicas: number | null
          id: string
          id_declaracao: string
          imposto_a_pagar: number | null
          imposto_a_restituir: number | null
          imposto_complementar: number | null
          imposto_devido: number | null
          imposto_devido_apos_deducao: number | null
          imposto_devido_rra: number | null
          imposto_pago_exterior: number | null
          irrf_dependentes: number | null
          irrf_lei_11033: number | null
          irrf_rra: number | null
          irrf_titular: number | null
          livro_caixa: number | null
          numero_quotas: number | null
          pensao_alimenticia_escritura: number | null
          pensao_alimenticia_judicial: number | null
          pensao_alimenticia_rra: number | null
          rend_acumulado_dependentes: number | null
          rend_acumulado_titular: number | null
          rend_pf_exterior_dependentes: number | null
          rend_pf_exterior_titular: number | null
          rend_pj_dependentes: number | null
          rend_pj_titular: number | null
          resultado_atividade_rural: number | null
          tipo_tributacao: string | null
          total_deducoes: number | null
          total_imposto_devido: number | null
          total_imposto_pago: number | null
          total_rendimentos_tributaveis: number | null
          valor_quota: number | null
        }
        Insert: {
          aliquota_efetiva?: number | null
          banco_agencia?: string | null
          banco_codigo?: string | null
          banco_conta?: string | null
          banco_tipo_conta?: string | null
          base_calculo?: number | null
          carne_leao_dependentes?: number | null
          carne_leao_titular?: number | null
          contrib_previdencia_complementar?: number | null
          contrib_previdencia_oficial?: number | null
          contrib_previdencia_rra?: number | null
          created_at?: string | null
          deducao_dependentes?: number | null
          deducao_incentivo?: number | null
          despesas_instrucao?: number | null
          despesas_medicas?: number | null
          id?: string
          id_declaracao: string
          imposto_a_pagar?: number | null
          imposto_a_restituir?: number | null
          imposto_complementar?: number | null
          imposto_devido?: number | null
          imposto_devido_apos_deducao?: number | null
          imposto_devido_rra?: number | null
          imposto_pago_exterior?: number | null
          irrf_dependentes?: number | null
          irrf_lei_11033?: number | null
          irrf_rra?: number | null
          irrf_titular?: number | null
          livro_caixa?: number | null
          numero_quotas?: number | null
          pensao_alimenticia_escritura?: number | null
          pensao_alimenticia_judicial?: number | null
          pensao_alimenticia_rra?: number | null
          rend_acumulado_dependentes?: number | null
          rend_acumulado_titular?: number | null
          rend_pf_exterior_dependentes?: number | null
          rend_pf_exterior_titular?: number | null
          rend_pj_dependentes?: number | null
          rend_pj_titular?: number | null
          resultado_atividade_rural?: number | null
          tipo_tributacao?: string | null
          total_deducoes?: number | null
          total_imposto_devido?: number | null
          total_imposto_pago?: number | null
          total_rendimentos_tributaveis?: number | null
          valor_quota?: number | null
        }
        Update: {
          aliquota_efetiva?: number | null
          banco_agencia?: string | null
          banco_codigo?: string | null
          banco_conta?: string | null
          banco_tipo_conta?: string | null
          base_calculo?: number | null
          carne_leao_dependentes?: number | null
          carne_leao_titular?: number | null
          contrib_previdencia_complementar?: number | null
          contrib_previdencia_oficial?: number | null
          contrib_previdencia_rra?: number | null
          created_at?: string | null
          deducao_dependentes?: number | null
          deducao_incentivo?: number | null
          despesas_instrucao?: number | null
          despesas_medicas?: number | null
          id?: string
          id_declaracao?: string
          imposto_a_pagar?: number | null
          imposto_a_restituir?: number | null
          imposto_complementar?: number | null
          imposto_devido?: number | null
          imposto_devido_apos_deducao?: number | null
          imposto_devido_rra?: number | null
          imposto_pago_exterior?: number | null
          irrf_dependentes?: number | null
          irrf_lei_11033?: number | null
          irrf_rra?: number | null
          irrf_titular?: number | null
          livro_caixa?: number | null
          numero_quotas?: number | null
          pensao_alimenticia_escritura?: number | null
          pensao_alimenticia_judicial?: number | null
          pensao_alimenticia_rra?: number | null
          rend_acumulado_dependentes?: number | null
          rend_acumulado_titular?: number | null
          rend_pf_exterior_dependentes?: number | null
          rend_pf_exterior_titular?: number | null
          rend_pj_dependentes?: number | null
          rend_pj_titular?: number | null
          resultado_atividade_rural?: number | null
          tipo_tributacao?: string | null
          total_deducoes?: number | null
          total_imposto_devido?: number | null
          total_imposto_pago?: number | null
          total_rendimentos_tributaveis?: number | null
          valor_quota?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "irpf_resumo_tributario_id_declaracao_fkey"
            columns: ["id_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
          },
        ]
      }
      landingpage_analise: {
        Row: {
          analise_texto: string | null
          created_at: string
          data_analise: string
          id: string
          id_empresa: string
          insights: Json
          padroes_identificados: Json
          recomendacoes: Json
          top_performers: Json
        }
        Insert: {
          analise_texto?: string | null
          created_at?: string
          data_analise?: string
          id?: string
          id_empresa: string
          insights?: Json
          padroes_identificados?: Json
          recomendacoes?: Json
          top_performers?: Json
        }
        Update: {
          analise_texto?: string | null
          created_at?: string
          data_analise?: string
          id?: string
          id_empresa?: string
          insights?: Json
          padroes_identificados?: Json
          recomendacoes?: Json
          top_performers?: Json
        }
        Relationships: [
          {
            foreignKeyName: "landingpage_analise_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      landingpage_config: {
        Row: {
          categoria: string
          created_at: string | null
          descricao: string | null
          evento_conversao: string | null
          id: string
          id_empresa: string
          ignorar_conversao: boolean | null
          updated_at: string | null
          url_pattern: string
        }
        Insert: {
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          evento_conversao?: string | null
          id?: string
          id_empresa: string
          ignorar_conversao?: boolean | null
          updated_at?: string | null
          url_pattern: string
        }
        Update: {
          categoria?: string
          created_at?: string | null
          descricao?: string | null
          evento_conversao?: string | null
          id?: string
          id_empresa?: string
          ignorar_conversao?: boolean | null
          updated_at?: string | null
          url_pattern?: string
        }
        Relationships: [
          {
            foreignKeyName: "landingpage_config_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      landingpage_conteudo: {
        Row: {
          created_at: string
          ctas: string[] | null
          id: string
          id_empresa: string
          meta_description: string | null
          palavras_chave: string[] | null
          primeiro_paragrafo: string | null
          subtitulos_h2: string[] | null
          titulo_h1: string | null
          ultima_extracao: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          ctas?: string[] | null
          id?: string
          id_empresa: string
          meta_description?: string | null
          palavras_chave?: string[] | null
          primeiro_paragrafo?: string | null
          subtitulos_h2?: string[] | null
          titulo_h1?: string | null
          ultima_extracao?: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          ctas?: string[] | null
          id?: string
          id_empresa?: string
          meta_description?: string | null
          palavras_chave?: string[] | null
          primeiro_paragrafo?: string | null
          subtitulos_h2?: string[] | null
          titulo_h1?: string | null
          ultima_extracao?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "landingpage_conteudo_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      landingpage_metricas: {
        Row: {
          bounce_rate: number | null
          categoria: string | null
          conversoes: number
          created_at: string
          data: string
          id: string
          id_empresa: string
          ignorar_analise: boolean | null
          pageviews: number
          sessoes: number
          taxa_conversao: number | null
          tempo_medio_segundos: number | null
          updated_at: string
          url: string
          usuarios: number
        }
        Insert: {
          bounce_rate?: number | null
          categoria?: string | null
          conversoes?: number
          created_at?: string
          data: string
          id?: string
          id_empresa: string
          ignorar_analise?: boolean | null
          pageviews?: number
          sessoes?: number
          taxa_conversao?: number | null
          tempo_medio_segundos?: number | null
          updated_at?: string
          url: string
          usuarios?: number
        }
        Update: {
          bounce_rate?: number | null
          categoria?: string | null
          conversoes?: number
          created_at?: string
          data?: string
          id?: string
          id_empresa?: string
          ignorar_analise?: boolean | null
          pageviews?: number
          sessoes?: number
          taxa_conversao?: number | null
          tempo_medio_segundos?: number | null
          updated_at?: string
          url?: string
          usuarios?: number
        }
        Relationships: [
          {
            foreignKeyName: "landingpage_metricas_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      lead: {
        Row: {
          chatblue_atendido_por_ia: boolean | null
          chatblue_departamento: string | null
          chatblue_prioridade: string | null
          chatblue_protocolo: string | null
          chatblue_sla_violado: boolean | null
          chatblue_tempo_resolucao_seg: number | null
          chatblue_ticket_id: string | null
          chatwoot_agente_atual: string | null
          chatwoot_contact_id: number | null
          chatwoot_conversas_total: number | null
          chatwoot_inbox: string | null
          chatwoot_mensagens_total: number | null
          chatwoot_status_atendimento: string | null
          chatwoot_tempo_resposta_medio: number | null
          chatwoot_ultima_conversa: string | null
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
          ga4_bounce_rate: number | null
          ga4_categoria_jornada: string | null
          ga4_engajamento_score: number | null
          ga4_landing_page: string | null
          ga4_sessoes: number | null
          ga4_tempo_site_segundos: number | null
          id_cliente_notion: string | null
          id_criativo: string | null
          id_empresa: string
          id_irpf_declaracao: string | null
          id_lead: string
          id_lead_externo: string | null
          id_mautic_contact: string | null
          irpf_aliquota_efetiva: number | null
          irpf_ano_mais_recente: number | null
          irpf_complexidade_declaracao: string | null
          irpf_faixa_patrimonial: string | null
          irpf_imposto_pagar: number | null
          irpf_imposto_restituir: number | null
          irpf_patrimonio_liquido: number | null
          irpf_perfil_investidor: string | null
          irpf_possui_atividade_rural: boolean | null
          irpf_possui_cripto: boolean | null
          irpf_possui_empresas: boolean | null
          irpf_possui_imoveis: boolean | null
          irpf_possui_investimentos: boolean | null
          irpf_qtd_empresas: number | null
          irpf_qtd_imoveis: number | null
          irpf_renda_anual: number | null
          irpf_tipos_cripto: string[] | null
          irpf_total_bens: number | null
          irpf_total_dividas: number | null
          irpf_valor_cripto: number | null
          irpf_valor_investimentos: number | null
          is_mql: boolean
          lead_pago: boolean | null
          levantou_mao: boolean
          linkedin_cargo: string | null
          linkedin_conexoes: number | null
          linkedin_empresa: string | null
          linkedin_senioridade: string | null
          linkedin_setor: string | null
          linkedin_ultima_atualizacao: string | null
          linkedin_url: string | null
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
          motivo_perda: string | null
          nome_lead: string | null
          organizacao: string | null
          origem_campanha: string | null
          origem_canal: Database["public"]["Enums"]["canal_origem"] | null
          origem_tipo: Database["public"]["Enums"]["origem_lead"] | null
          pipeline_id: string | null
          proprietario_id: string | null
          proprietario_nome: string | null
          reuniao_realizada: boolean
          stage_atual: string | null
          stape_client_id: string | null
          stape_eventos: Json | null
          stape_fbc: string | null
          stape_fbp: string | null
          stape_first_visit: string | null
          stape_gclid: string | null
          stape_ip_address: string | null
          stape_last_activity: string | null
          stape_paginas_visitadas: Json | null
          stape_referrer: string | null
          stape_session_id: string | null
          stape_tempo_total_segundos: number | null
          stape_user_agent: string | null
          telefone: string | null
          tem_reuniao: boolean
          tempo_primeira_resposta_seg: number | null
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
          webhook_enviado_em: string | null
        }
        Insert: {
          chatblue_atendido_por_ia?: boolean | null
          chatblue_departamento?: string | null
          chatblue_prioridade?: string | null
          chatblue_protocolo?: string | null
          chatblue_sla_violado?: boolean | null
          chatblue_tempo_resolucao_seg?: number | null
          chatblue_ticket_id?: string | null
          chatwoot_agente_atual?: string | null
          chatwoot_contact_id?: number | null
          chatwoot_conversas_total?: number | null
          chatwoot_inbox?: string | null
          chatwoot_mensagens_total?: number | null
          chatwoot_status_atendimento?: string | null
          chatwoot_tempo_resposta_medio?: number | null
          chatwoot_ultima_conversa?: string | null
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
          ga4_bounce_rate?: number | null
          ga4_categoria_jornada?: string | null
          ga4_engajamento_score?: number | null
          ga4_landing_page?: string | null
          ga4_sessoes?: number | null
          ga4_tempo_site_segundos?: number | null
          id_cliente_notion?: string | null
          id_criativo?: string | null
          id_empresa: string
          id_irpf_declaracao?: string | null
          id_lead?: string
          id_lead_externo?: string | null
          id_mautic_contact?: string | null
          irpf_aliquota_efetiva?: number | null
          irpf_ano_mais_recente?: number | null
          irpf_complexidade_declaracao?: string | null
          irpf_faixa_patrimonial?: string | null
          irpf_imposto_pagar?: number | null
          irpf_imposto_restituir?: number | null
          irpf_patrimonio_liquido?: number | null
          irpf_perfil_investidor?: string | null
          irpf_possui_atividade_rural?: boolean | null
          irpf_possui_cripto?: boolean | null
          irpf_possui_empresas?: boolean | null
          irpf_possui_imoveis?: boolean | null
          irpf_possui_investimentos?: boolean | null
          irpf_qtd_empresas?: number | null
          irpf_qtd_imoveis?: number | null
          irpf_renda_anual?: number | null
          irpf_tipos_cripto?: string[] | null
          irpf_total_bens?: number | null
          irpf_total_dividas?: number | null
          irpf_valor_cripto?: number | null
          irpf_valor_investimentos?: number | null
          is_mql?: boolean
          lead_pago?: boolean | null
          levantou_mao?: boolean
          linkedin_cargo?: string | null
          linkedin_conexoes?: number | null
          linkedin_empresa?: string | null
          linkedin_senioridade?: string | null
          linkedin_setor?: string | null
          linkedin_ultima_atualizacao?: string | null
          linkedin_url?: string | null
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
          motivo_perda?: string | null
          nome_lead?: string | null
          organizacao?: string | null
          origem_campanha?: string | null
          origem_canal?: Database["public"]["Enums"]["canal_origem"] | null
          origem_tipo?: Database["public"]["Enums"]["origem_lead"] | null
          pipeline_id?: string | null
          proprietario_id?: string | null
          proprietario_nome?: string | null
          reuniao_realizada?: boolean
          stage_atual?: string | null
          stape_client_id?: string | null
          stape_eventos?: Json | null
          stape_fbc?: string | null
          stape_fbp?: string | null
          stape_first_visit?: string | null
          stape_gclid?: string | null
          stape_ip_address?: string | null
          stape_last_activity?: string | null
          stape_paginas_visitadas?: Json | null
          stape_referrer?: string | null
          stape_session_id?: string | null
          stape_tempo_total_segundos?: number | null
          stape_user_agent?: string | null
          telefone?: string | null
          tem_reuniao?: boolean
          tempo_primeira_resposta_seg?: number | null
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
          webhook_enviado_em?: string | null
        }
        Update: {
          chatblue_atendido_por_ia?: boolean | null
          chatblue_departamento?: string | null
          chatblue_prioridade?: string | null
          chatblue_protocolo?: string | null
          chatblue_sla_violado?: boolean | null
          chatblue_tempo_resolucao_seg?: number | null
          chatblue_ticket_id?: string | null
          chatwoot_agente_atual?: string | null
          chatwoot_contact_id?: number | null
          chatwoot_conversas_total?: number | null
          chatwoot_inbox?: string | null
          chatwoot_mensagens_total?: number | null
          chatwoot_status_atendimento?: string | null
          chatwoot_tempo_resposta_medio?: number | null
          chatwoot_ultima_conversa?: string | null
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
          ga4_bounce_rate?: number | null
          ga4_categoria_jornada?: string | null
          ga4_engajamento_score?: number | null
          ga4_landing_page?: string | null
          ga4_sessoes?: number | null
          ga4_tempo_site_segundos?: number | null
          id_cliente_notion?: string | null
          id_criativo?: string | null
          id_empresa?: string
          id_irpf_declaracao?: string | null
          id_lead?: string
          id_lead_externo?: string | null
          id_mautic_contact?: string | null
          irpf_aliquota_efetiva?: number | null
          irpf_ano_mais_recente?: number | null
          irpf_complexidade_declaracao?: string | null
          irpf_faixa_patrimonial?: string | null
          irpf_imposto_pagar?: number | null
          irpf_imposto_restituir?: number | null
          irpf_patrimonio_liquido?: number | null
          irpf_perfil_investidor?: string | null
          irpf_possui_atividade_rural?: boolean | null
          irpf_possui_cripto?: boolean | null
          irpf_possui_empresas?: boolean | null
          irpf_possui_imoveis?: boolean | null
          irpf_possui_investimentos?: boolean | null
          irpf_qtd_empresas?: number | null
          irpf_qtd_imoveis?: number | null
          irpf_renda_anual?: number | null
          irpf_tipos_cripto?: string[] | null
          irpf_total_bens?: number | null
          irpf_total_dividas?: number | null
          irpf_valor_cripto?: number | null
          irpf_valor_investimentos?: number | null
          is_mql?: boolean
          lead_pago?: boolean | null
          levantou_mao?: boolean
          linkedin_cargo?: string | null
          linkedin_conexoes?: number | null
          linkedin_empresa?: string | null
          linkedin_senioridade?: string | null
          linkedin_setor?: string | null
          linkedin_ultima_atualizacao?: string | null
          linkedin_url?: string | null
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
          motivo_perda?: string | null
          nome_lead?: string | null
          organizacao?: string | null
          origem_campanha?: string | null
          origem_canal?: Database["public"]["Enums"]["canal_origem"] | null
          origem_tipo?: Database["public"]["Enums"]["origem_lead"] | null
          pipeline_id?: string | null
          proprietario_id?: string | null
          proprietario_nome?: string | null
          reuniao_realizada?: boolean
          stage_atual?: string | null
          stape_client_id?: string | null
          stape_eventos?: Json | null
          stape_fbc?: string | null
          stape_fbp?: string | null
          stape_first_visit?: string | null
          stape_gclid?: string | null
          stape_ip_address?: string | null
          stape_last_activity?: string | null
          stape_paginas_visitadas?: Json | null
          stape_referrer?: string | null
          stape_session_id?: string | null
          stape_tempo_total_segundos?: number | null
          stape_user_agent?: string | null
          telefone?: string | null
          tem_reuniao?: boolean
          tempo_primeira_resposta_seg?: number | null
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
          webhook_enviado_em?: string | null
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
            foreignKeyName: "lead_id_irpf_declaracao_fkey"
            columns: ["id_irpf_declaracao"]
            isOneToOne: false
            referencedRelation: "irpf_declaracao"
            referencedColumns: ["id"]
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
      lead_webhook_log: {
        Row: {
          created_at: string | null
          evento: string
          id: string
          id_lead: string | null
          id_webhook_destino: string | null
          payload: Json
          resposta: string | null
          status: string
          status_code: number | null
          tentativas: number | null
        }
        Insert: {
          created_at?: string | null
          evento: string
          id?: string
          id_lead?: string | null
          id_webhook_destino?: string | null
          payload: Json
          resposta?: string | null
          status: string
          status_code?: number | null
          tentativas?: number | null
        }
        Update: {
          created_at?: string | null
          evento?: string
          id?: string
          id_lead?: string | null
          id_webhook_destino?: string | null
          payload?: Json
          resposta?: string | null
          status?: string
          status_code?: number | null
          tentativas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_webhook_log_id_lead_fkey"
            columns: ["id_lead"]
            isOneToOne: false
            referencedRelation: "lead"
            referencedColumns: ["id_lead"]
          },
          {
            foreignKeyName: "lead_webhook_log_id_webhook_destino_fkey"
            columns: ["id_webhook_destino"]
            isOneToOne: false
            referencedRelation: "webhook_destino"
            referencedColumns: ["id"]
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
      mautic_segmento_empresa: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          id_empresa: string
          segmento_mautic_id: number
          segmento_mautic_nome: string
          threshold_score: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          id_empresa: string
          segmento_mautic_id: number
          segmento_mautic_nome: string
          threshold_score?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          id_empresa?: string
          segmento_mautic_id?: number
          segmento_mautic_nome?: string
          threshold_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mautic_segmento_empresa_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      merge_ignorado: {
        Row: {
          created_at: string | null
          email: string
          id: string
          id_empresa: string
          ignorado_por: string
          motivo: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          id_empresa: string
          ignorado_por: string
          motivo?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          id_empresa?: string
          ignorado_por?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merge_ignorado_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      meta_comercial: {
        Row: {
          ano: number
          created_at: string
          id: string
          id_empresa: string
          indice_sazonal: number | null
          mes: number
          meta_leads: number | null
          meta_receita: number | null
          meta_vendas: number | null
          tipo_negocio: string
          updated_at: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          id_empresa: string
          indice_sazonal?: number | null
          mes: number
          meta_leads?: number | null
          meta_receita?: number | null
          meta_vendas?: number | null
          tipo_negocio?: string
          updated_at?: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          id_empresa?: string
          indice_sazonal?: number | null
          mes?: number
          meta_leads?: number | null
          meta_receita?: number | null
          meta_vendas?: number | null
          tipo_negocio?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_comercial_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      metricas_atendimento: {
        Row: {
          created_at: string | null
          dados_departamentos: Json | null
          data: string
          id: string
          id_empresa: string
          nps_score: number | null
          sla_compliance: number | null
          tempo_resolucao_medio_seg: number | null
          tempo_resposta_medio_seg: number | null
          tickets_ia: number | null
          tickets_pendentes: number | null
          tickets_resolvidos: number | null
          tickets_sla_violado: number | null
          tickets_total: number | null
        }
        Insert: {
          created_at?: string | null
          dados_departamentos?: Json | null
          data: string
          id?: string
          id_empresa: string
          nps_score?: number | null
          sla_compliance?: number | null
          tempo_resolucao_medio_seg?: number | null
          tempo_resposta_medio_seg?: number | null
          tickets_ia?: number | null
          tickets_pendentes?: number | null
          tickets_resolvidos?: number | null
          tickets_sla_violado?: number | null
          tickets_total?: number | null
        }
        Update: {
          created_at?: string | null
          dados_departamentos?: Json | null
          data?: string
          id?: string
          id_empresa?: string
          nps_score?: number | null
          sla_compliance?: number | null
          tempo_resolucao_medio_seg?: number | null
          tempo_resposta_medio_seg?: number | null
          tickets_ia?: number | null
          tickets_pendentes?: number | null
          tickets_resolvidos?: number | null
          tickets_sla_violado?: number | null
          tickets_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metricas_atendimento_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      pipedrive_activity: {
        Row: {
          add_time: string | null
          assigned_to_user_id: string | null
          assigned_to_user_name: string | null
          created_at: string
          done: boolean | null
          due_date: string | null
          due_time: string | null
          duration: number | null
          id: string
          id_activity_externo: string
          id_deal_externo: string | null
          id_empresa: string
          id_lead_externo: string | null
          id_person_externo: string | null
          marked_as_done_time: string | null
          note: string | null
          subject: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          add_time?: string | null
          assigned_to_user_id?: string | null
          assigned_to_user_name?: string | null
          created_at?: string
          done?: boolean | null
          due_date?: string | null
          due_time?: string | null
          duration?: number | null
          id?: string
          id_activity_externo: string
          id_deal_externo?: string | null
          id_empresa: string
          id_lead_externo?: string | null
          id_person_externo?: string | null
          marked_as_done_time?: string | null
          note?: string | null
          subject?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          add_time?: string | null
          assigned_to_user_id?: string | null
          assigned_to_user_name?: string | null
          created_at?: string
          done?: boolean | null
          due_date?: string | null
          due_time?: string | null
          duration?: number | null
          id?: string
          id_activity_externo?: string
          id_deal_externo?: string | null
          id_empresa?: string
          id_lead_externo?: string | null
          id_person_externo?: string | null
          marked_as_done_time?: string | null
          note?: string | null
          subject?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_activity_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      pipedrive_note: {
        Row: {
          add_time: string | null
          content: string | null
          created_at: string
          id: string
          id_deal_externo: string | null
          id_empresa: string
          id_lead_externo: string | null
          id_note_externo: string
          id_person_externo: string | null
          pinned_to_deal: boolean | null
          pinned_to_person: boolean | null
          update_time: string | null
          updated_at: string
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          add_time?: string | null
          content?: string | null
          created_at?: string
          id?: string
          id_deal_externo?: string | null
          id_empresa: string
          id_lead_externo?: string | null
          id_note_externo: string
          id_person_externo?: string | null
          pinned_to_deal?: boolean | null
          pinned_to_person?: boolean | null
          update_time?: string | null
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          add_time?: string | null
          content?: string | null
          created_at?: string
          id?: string
          id_deal_externo?: string | null
          id_empresa?: string
          id_lead_externo?: string | null
          id_note_externo?: string
          id_person_externo?: string | null
          pinned_to_deal?: boolean | null
          pinned_to_person?: boolean | null
          update_time?: string | null
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipedrive_note_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
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
      registro_otimizacao: {
        Row: {
          created_at: string
          descricao: string
          id_empresa: string | null
          id_registro: string
          id_usuario: string
          impacto_resultado: string | null
          plataforma: Database["public"]["Enums"]["plataforma_otimizacao"]
          semana_referencia: string
          tags: string[] | null
          tipo_otimizacao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id_empresa?: string | null
          id_registro?: string
          id_usuario: string
          impacto_resultado?: string | null
          plataforma?: Database["public"]["Enums"]["plataforma_otimizacao"]
          semana_referencia: string
          tags?: string[] | null
          tipo_otimizacao: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id_empresa?: string | null
          id_registro?: string
          id_usuario?: string
          impacto_resultado?: string | null
          plataforma?: Database["public"]["Enums"]["plataforma_otimizacao"]
          semana_referencia?: string
          tags?: string[] | null
          tipo_otimizacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registro_otimizacao_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
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
      relatorio_agendado: {
        Row: {
          ativo: boolean | null
          created_at: string
          cron_expression: string
          descricao: string | null
          destinatarios: string[]
          formato: string | null
          id: string
          id_empresa: string | null
          nome: string
          proximo_envio: string | null
          query_template: Json
          tipo: string
          total_envios: number | null
          total_erros: number | null
          ultimo_envio: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          cron_expression: string
          descricao?: string | null
          destinatarios: string[]
          formato?: string | null
          id?: string
          id_empresa?: string | null
          nome: string
          proximo_envio?: string | null
          query_template: Json
          tipo: string
          total_envios?: number | null
          total_erros?: number | null
          ultimo_envio?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          cron_expression?: string
          descricao?: string | null
          destinatarios?: string[]
          formato?: string | null
          id?: string
          id_empresa?: string | null
          nome?: string
          proximo_envio?: string | null
          query_template?: Json
          tipo?: string
          total_envios?: number | null
          total_erros?: number | null
          ultimo_envio?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_agendado_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
      }
      relatorio_envio_log: {
        Row: {
          created_at: string
          destinatarios_enviados: string[] | null
          duracao_envio_ms: number | null
          duracao_geracao_ms: number | null
          erro: string | null
          id: string
          id_relatorio: string
          sucesso: boolean
          tamanho_arquivo_bytes: number | null
          url_arquivo: string | null
        }
        Insert: {
          created_at?: string
          destinatarios_enviados?: string[] | null
          duracao_envio_ms?: number | null
          duracao_geracao_ms?: number | null
          erro?: string | null
          id?: string
          id_relatorio: string
          sucesso: boolean
          tamanho_arquivo_bytes?: number | null
          url_arquivo?: string | null
        }
        Update: {
          created_at?: string
          destinatarios_enviados?: string[] | null
          duracao_envio_ms?: number | null
          duracao_geracao_ms?: number | null
          erro?: string | null
          id?: string
          id_relatorio?: string
          sucesso?: boolean
          tamanho_arquivo_bytes?: number | null
          url_arquivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relatorio_envio_log_id_relatorio_fkey"
            columns: ["id_relatorio"]
            isOneToOne: false
            referencedRelation: "relatorio_agendado"
            referencedColumns: ["id"]
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
          ano: number | null
          aprendizado_resumo: string | null
          created_at: string
          data_fechamento: string | null
          id_empresa: string
          id_relatorio: string
          id_semana: string | null
          mes: number | null
          status: Database["public"]["Enums"]["status_relatorio"]
          texto_comparacao: string | null
          updated_at: string
        }
        Insert: {
          ano?: number | null
          aprendizado_resumo?: string | null
          created_at?: string
          data_fechamento?: string | null
          id_empresa: string
          id_relatorio?: string
          id_semana?: string | null
          mes?: number | null
          status?: Database["public"]["Enums"]["status_relatorio"]
          texto_comparacao?: string | null
          updated_at?: string
        }
        Update: {
          ano?: number | null
          aprendizado_resumo?: string | null
          created_at?: string
          data_fechamento?: string | null
          id_empresa?: string
          id_relatorio?: string
          id_semana?: string | null
          mes?: number | null
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
      stape_evento: {
        Row: {
          client_id: string
          created_at: string | null
          custom_data: Json | null
          event_name: string
          event_timestamp: string | null
          fbc: string | null
          fbp: string | null
          gclid: string | null
          id: string
          id_empresa: string | null
          id_lead: string | null
          ip_address: string | null
          page_title: string | null
          page_url: string | null
          session_id: string | null
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          client_id: string
          created_at?: string | null
          custom_data?: Json | null
          event_name: string
          event_timestamp?: string | null
          fbc?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          id_empresa?: string | null
          id_lead?: string | null
          ip_address?: string | null
          page_title?: string | null
          page_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string | null
          custom_data?: Json | null
          event_name?: string
          event_timestamp?: string | null
          fbc?: string | null
          fbp?: string | null
          gclid?: string | null
          id?: string
          id_empresa?: string | null
          id_lead?: string | null
          ip_address?: string | null
          page_title?: string | null
          page_url?: string | null
          session_id?: string | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stape_evento_id_lead_fkey"
            columns: ["id_lead"]
            isOneToOne: false
            referencedRelation: "lead"
            referencedColumns: ["id_lead"]
          },
        ]
      }
      tendencia_mercado: {
        Row: {
          categorias: string[] | null
          created_at: string
          data_publicacao: string | null
          empresas_relacionadas: string[] | null
          fonte: string
          id: string
          relevancia_score: number | null
          resumo: string | null
          titulo: string
          updated_at: string
          url: string
        }
        Insert: {
          categorias?: string[] | null
          created_at?: string
          data_publicacao?: string | null
          empresas_relacionadas?: string[] | null
          fonte: string
          id?: string
          relevancia_score?: number | null
          resumo?: string | null
          titulo: string
          updated_at?: string
          url: string
        }
        Update: {
          categorias?: string[] | null
          created_at?: string
          data_publicacao?: string | null
          empresas_relacionadas?: string[] | null
          fonte?: string
          id?: string
          relevancia_score?: number | null
          resumo?: string | null
          titulo?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
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
      webhook_destino: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          eventos: string[] | null
          headers: Json | null
          id: string
          id_empresa: string | null
          nome: string
          updated_at: string | null
          url: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          eventos?: string[] | null
          headers?: Json | null
          id?: string
          id_empresa?: string | null
          nome: string
          updated_at?: string | null
          url: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          eventos?: string[] | null
          headers?: Json | null
          id?: string
          id_empresa?: string | null
          nome?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_destino_id_empresa_fkey"
            columns: ["id_empresa"]
            isOneToOne: false
            referencedRelation: "empresa"
            referencedColumns: ["id_empresa"]
          },
        ]
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
      user_has_irpf_atividade_rural_access: {
        Args: { _id_atividade_rural: string }
        Returns: boolean
      }
      user_has_irpf_declaracao_access: {
        Args: { _id_declaracao: string }
        Returns: boolean
      }
      user_has_irpf_empresa_access: {
        Args: { _id_empresa: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "direcao" | "trafego" | "sdr"
      canal_origem: "META" | "GOOGLE" | "ORGANICO" | "OUTRO" | "WHATSAPP"
      categoria_acao: "A" | "B" | "C"
      origem_lead: "PAGO" | "ORGANICO" | "INDICACAO" | "LISTA" | "MANUAL"
      perfil_usuario: "TRAFEGO" | "SDR_COMERCIAL" | "DIRECAO" | "ADMIN"
      plataforma_ads: "META" | "GOOGLE"
      plataforma_midia: "META" | "GOOGLE"
      plataforma_otimizacao: "META" | "GOOGLE" | "AMBAS" | "GERAL"
      prioridade_demanda: "ALTA" | "MEDIA" | "BAIXA"
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
      status_demanda:
        | "PENDENTE"
        | "EM_EXECUCAO"
        | "EXECUTADA"
        | "VERIFICADA"
        | "REJEITADA"
      status_relatorio: "EM_EDICAO" | "PRONTO" | "VALIDADO"
      tipo_aprendizado: "CRIATIVO" | "PUBLICO" | "OFERTA" | "FUNIL" | "OUTRO"
      tipo_campanha_google:
        | "SEARCH"
        | "DISPLAY"
        | "PERFORMANCE_MAX"
        | "VIDEO"
        | "SHOPPING"
      tipo_campanha_meta:
        | "CONVERSAO"
        | "TRAFEGO"
        | "LEAD_GEN"
        | "AWARENESS"
        | "ENGAJAMENTO"
      tipo_criativo: "VIDEO" | "IMAGEM" | "CARROSSEL" | "OUTRO"
      tipo_integracao:
        | "META_ADS"
        | "GOOGLE_ADS"
        | "PIPEDRIVE"
        | "TOKENIZA"
        | "MAUTIC"
        | "NOTION"
        | "METRICOOL"
        | "CHATWOOT"
        | "GA4"
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
      canal_origem: ["META", "GOOGLE", "ORGANICO", "OUTRO", "WHATSAPP"],
      categoria_acao: ["A", "B", "C"],
      origem_lead: ["PAGO", "ORGANICO", "INDICACAO", "LISTA", "MANUAL"],
      perfil_usuario: ["TRAFEGO", "SDR_COMERCIAL", "DIRECAO", "ADMIN"],
      plataforma_ads: ["META", "GOOGLE"],
      plataforma_midia: ["META", "GOOGLE"],
      plataforma_otimizacao: ["META", "GOOGLE", "AMBAS", "GERAL"],
      prioridade_demanda: ["ALTA", "MEDIA", "BAIXA"],
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
      status_demanda: [
        "PENDENTE",
        "EM_EXECUCAO",
        "EXECUTADA",
        "VERIFICADA",
        "REJEITADA",
      ],
      status_relatorio: ["EM_EDICAO", "PRONTO", "VALIDADO"],
      tipo_aprendizado: ["CRIATIVO", "PUBLICO", "OFERTA", "FUNIL", "OUTRO"],
      tipo_campanha_google: [
        "SEARCH",
        "DISPLAY",
        "PERFORMANCE_MAX",
        "VIDEO",
        "SHOPPING",
      ],
      tipo_campanha_meta: [
        "CONVERSAO",
        "TRAFEGO",
        "LEAD_GEN",
        "AWARENESS",
        "ENGAJAMENTO",
      ],
      tipo_criativo: ["VIDEO", "IMAGEM", "CARROSSEL", "OUTRO"],
      tipo_integracao: [
        "META_ADS",
        "GOOGLE_ADS",
        "PIPEDRIVE",
        "TOKENIZA",
        "MAUTIC",
        "NOTION",
        "METRICOOL",
        "CHATWOOT",
        "GA4",
      ],
    },
  },
} as const
