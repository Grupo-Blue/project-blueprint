-- Normaliza telefones existentes para formato E.164 brasileiro padrão (+55DDNNNNNNNNN)
-- Adiciona 9º dígito quando ausente (telefones com 10 dígitos após remover 55)

UPDATE lead 
SET telefone = 
  CASE 
    -- Já está no formato correto (+55 + 11 dígitos)
    WHEN telefone ~ '^\+55\d{11}$' THEN telefone
    
    -- Formato sem +, com 55 e 11 dígitos (5561999999999) → +5561999999999
    WHEN regexp_replace(telefone, '\D', '', 'g') ~ '^55\d{11}$' 
    THEN '+' || regexp_replace(telefone, '\D', '', 'g')
    
    -- Formato com 11 dígitos sem 55 (61999999999) → +5561999999999
    WHEN length(regexp_replace(telefone, '\D', '', 'g')) = 11 
         AND regexp_replace(telefone, '\D', '', 'g') !~ '^55'
    THEN '+55' || regexp_replace(telefone, '\D', '', 'g')
    
    -- Formato com 55 mas só 10 dígitos após (5561-8 dígitos) → precisa adicionar 9
    WHEN regexp_replace(telefone, '\D', '', 'g') ~ '^55\d{10}$'
    THEN '+55' || 
         substring(regexp_replace(telefone, '\D', '', 'g'), 3, 2) || 
         '9' || 
         substring(regexp_replace(telefone, '\D', '', 'g'), 5)
    
    -- Formato com 10 dígitos sem 55 (6199999999) → adiciona 9 após DDD
    WHEN length(regexp_replace(telefone, '\D', '', 'g')) = 10
    THEN '+55' || 
         substring(regexp_replace(telefone, '\D', '', 'g'), 1, 2) || 
         '9' || 
         substring(regexp_replace(telefone, '\D', '', 'g'), 3)
    
    -- Mantém original se não se encaixa em nenhum padrão
    ELSE telefone
  END,
  updated_at = now()
WHERE telefone IS NOT NULL
  AND telefone !~ '^\+55\d{11}$'; -- Não atualiza os que já estão corretos