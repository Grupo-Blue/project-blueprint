#!/bin/bash

# Script para aplicar as mudanças da Sprint 1 (SGT → CRM Webhook)

set -e

echo "🚀 Aplicando mudanças da Sprint 1: SGT → CRM Webhook"
echo ""

# 1. Copiar webhookService.ts
echo "📝 1. Criando src/lib/webhookService.ts..."
cp SPRINT1-FILES/webhookService.ts src/lib/webhookService.ts
echo "   ✅ Arquivo criado"
echo ""

# 2. Modificar ImportarLeadsModal.tsx
echo "⚠️  2. ImportarLeadsModal.tsx precisa ser modificado MANUALMENTE"
echo "   - Abra: src/components/leads/ImportarLeadsModal.tsx"
echo "   - Siga o diff em: SPRINT1-FILES/ImportarLeadsModal.DIFF.md"
echo "   - Pressione ENTER quando terminar..."
read

# 3. Atualizar .env.example
echo "📝 3. Atualizando .env.example..."
if ! grep -q "VITE_CRM_WEBHOOK_URL" .env.example; then
  cat >> .env.example << 'EOF'

# ==============================================
# INTEGRAÇÃO CRM (SGT → CRM Webhook)
# ==============================================
VITE_CRM_WEBHOOK_URL=https://crm.blueconsult.com.br/functions/v1/sgt-webhook
VITE_CRM_WEBHOOK_TOKEN=seu-token-seguro-aqui
EOF
  echo "   ✅ Variáveis adicionadas ao .env.example"
else
  echo "   ⏭️  .env.example já contém as variáveis"
fi
echo ""

# 4. Criar .env se não existir
if [ ! -f .env ]; then
  echo "📝 4. Criando .env (copie .env.example e configure)..."
  cp .env.example .env
  echo "   ⚠️  IMPORTANTE: Edite .env e configure o token real!"
  echo "   - VITE_CRM_WEBHOOK_TOKEN=seu-token-real-aqui"
else
  echo "⏭️  4. .env já existe. Adicione manualmente:"
  echo "   VITE_CRM_WEBHOOK_URL=https://crm.blueconsult.com.br/functions/v1/sgt-webhook"
  echo "   VITE_CRM_WEBHOOK_TOKEN=seu-token-aqui"
fi
echo ""

# 5. Git add
echo "📦 5. Preparando commit..."
git add src/lib/webhookService.ts
git add src/components/leads/ImportarLeadsModal.tsx
git add .env.example
echo "   ✅ Arquivos adicionados ao stage"
echo ""

# 6. Git status
echo "📊 Status do Git:"
git status
echo ""

# 7. Instruções finais
echo "✅ Mudanças aplicadas com sucesso!"
echo ""
echo "🚀 Próximos passos:"
echo "   1. Revisar as mudanças: git diff --staged"
echo "   2. Commitar: git commit -m 'feat: integração SGT → CRM webhook (Sprint 1)'"
echo "   3. Criar branch: git checkout -b feature/sprint1-sgt-crm-webhook"
echo "   4. Push: git push origin feature/sprint1-sgt-crm-webhook"
echo "   5. Abrir PR no GitHub"
echo ""
