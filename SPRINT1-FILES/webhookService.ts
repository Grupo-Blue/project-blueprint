/**
 * Webhook Service - SGT
 * 
 * Responsável por disparar webhooks para sistemas externos (CRM, etc.)
 * quando eventos importantes acontecem no SGT (lead criado, atualizado, etc.)
 */

export interface WebhookPayload {
  evento_tipo: 'LEAD_NOVO' | 'LEAD_ATUALIZADO' | 'LEAD_ENRIQUECIDO';
  empresa: 'BLUE' | 'TOKENIZA';
  lead_id: string;
  dados: {
    nome?: string | null;
    email?: string | null;
    telefone?: string | null;
    empresa?: string | null;
    origem?: string;
    campanha?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    [key: string]: any;
  };
  timestamp: string;
}

export interface WebhookResponse {
  success: boolean;
  lead_id: string;
  classificacao?: {
    temperatura: string;
    icp: string;
    persona: string;
    score: number;
    prioridade: number;
  };
  cadencia_iniciada?: {
    cadence_id: string;
    proxima_mensagem: string;
  };
  error?: string;
}

/**
 * Mapeia ID da empresa do SGT para nome usado no CRM
 */
function mapearEmpresaParaCRM(idEmpresa: string): 'BLUE' | 'TOKENIZA' {
  // TODO: Ajustar mapeamento conforme IDs reais das empresas no banco
  // Por enquanto, usar lógica simples baseada no ID
  
  // Exemplos de IDs que podem existir:
  // - Se contém "blue" → BLUE
  // - Se contém "tokeniza" → TOKENIZA
  // - Default: BLUE
  
  const idLower = idEmpresa.toLowerCase();
  
  if (idLower.includes('tokeniza')) {
    return 'TOKENIZA';
  }
  
  return 'BLUE';
}

/**
 * Dispara webhook para o CRM quando um lead novo é criado
 */
export async function dispararWebhookCRM(
  leadId: string,
  leadData: {
    id_empresa: string;
    nome_lead?: string | null;
    email?: string | null;
    telefone?: string | null;
    empresa?: string | null;
    origem_tipo?: string;
    origem_referencia?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  },
  eventoTipo: 'LEAD_NOVO' | 'LEAD_ATUALIZADO' | 'LEAD_ENRIQUECIDO' = 'LEAD_NOVO'
): Promise<WebhookResponse | null> {
  
  // URL do webhook do CRM (via variável de ambiente)
  const webhookUrl = import.meta.env.VITE_CRM_WEBHOOK_URL;
  const webhookToken = import.meta.env.VITE_CRM_WEBHOOK_TOKEN;

  if (!webhookUrl) {
    console.warn('⚠️ CRM_WEBHOOK_URL não configurada. Webhook não será enviado.');
    return null;
  }

  if (!webhookToken) {
    console.warn('⚠️ CRM_WEBHOOK_TOKEN não configurada. Webhook não será enviado.');
    return null;
  }

  const payload: WebhookPayload = {
    evento_tipo: eventoTipo,
    empresa: mapearEmpresaParaCRM(leadData.id_empresa),
    lead_id: leadId,
    dados: {
      nome: leadData.nome_lead,
      email: leadData.email,
      telefone: leadData.telefone,
      empresa: leadData.empresa,
      origem: leadData.origem_tipo || 'MANUAL',
      campanha: leadData.origem_referencia || undefined,
      utm_source: leadData.utm_source || undefined,
      utm_medium: leadData.utm_medium || undefined,
      utm_campaign: leadData.utm_campaign || undefined,
      utm_content: leadData.utm_content || undefined,
      utm_term: leadData.utm_term || undefined,
    },
    timestamp: new Date().toISOString()
  };

  console.log('📤 Disparando webhook para CRM:', {
    evento: eventoTipo,
    lead_id: leadId,
    empresa: payload.empresa,
    url: webhookUrl
  });

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookToken}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CRM webhook failed: ${response.status} - ${errorText}`);
    }

    const result: WebhookResponse = await response.json();
    
    console.log('✅ Webhook CRM enviado com sucesso:', {
      lead_id: leadId,
      classificacao: result.classificacao,
      cadencia: result.cadencia_iniciada
    });

    return result;
    
  } catch (error) {
    console.error('❌ Erro ao enviar webhook para CRM:', error);
    
    // Não falha a operação de criação do lead
    // Apenas loga o erro e continua
    
    // TODO: Implementar retry com fila (opcional)
    // Por enquanto, apenas tentamos uma vez
    
    return {
      success: false,
      lead_id: leadId,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

/**
 * Dispara webhooks em lote (usado na importação de múltiplos leads)
 */
export async function dispararWebhooksCRMLote(
  leads: Array<{
    id_lead: string;
    id_empresa: string;
    nome_lead?: string | null;
    email?: string | null;
    telefone?: string | null;
    empresa?: string | null;
    origem_tipo?: string;
    origem_referencia?: string | null;
    utm_source?: string | null;
    utm_medium?: string | null;
    utm_campaign?: string | null;
    utm_content?: string | null;
    utm_term?: string | null;
  }>,
  eventoTipo: 'LEAD_NOVO' | 'LEAD_ATUALIZADO' = 'LEAD_NOVO'
): Promise<void> {
  
  console.log(`📦 Disparando ${leads.length} webhooks para CRM em lote...`);
  
  // Dispara em paralelo (máximo 10 por vez para não sobrecarregar)
  const batchSize = 10;
  
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(lead => 
        dispararWebhookCRM(lead.id_lead, lead, eventoTipo)
      )
    );
    
    // Pequeno delay entre batches para não sobrecarregar
    if (i + batchSize < leads.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`✅ Todos os ${leads.length} webhooks foram processados`);
}

/**
 * Hook para testar a conexão com o webhook do CRM
 */
export async function testarConexaoCRM(): Promise<boolean> {
  const webhookUrl = import.meta.env.VITE_CRM_WEBHOOK_URL;
  const webhookToken = import.meta.env.VITE_CRM_WEBHOOK_TOKEN;

  if (!webhookUrl || !webhookToken) {
    console.error('❌ Variáveis de ambiente não configuradas');
    return false;
  }

  try {
    // Envia payload de teste
    const testPayload: WebhookPayload = {
      evento_tipo: 'LEAD_NOVO',
      empresa: 'BLUE',
      lead_id: 'test-' + Date.now(),
      dados: {
        nome: 'Lead de Teste',
        email: 'teste@exemplo.com',
        telefone: '+5511999999999',
        origem: 'TESTE'
      },
      timestamp: new Date().toISOString()
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${webhookToken}`
      },
      body: JSON.stringify(testPayload)
    });

    if (!response.ok) {
      throw new Error(`Status: ${response.status}`);
    }

    console.log('✅ Conexão com CRM testada com sucesso');
    return true;
    
  } catch (error) {
    console.error('❌ Falha ao testar conexão com CRM:', error);
    return false;
  }
}
