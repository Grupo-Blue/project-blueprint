

# Add "Perdidos com telefone" preset to Export Modal

## What
Add a new preset option `"perdidos"` to the WhatsApp export modal that filters leads with `stage_atual = 'Perdido'` and valid phone numbers.

## Changes — single file: `src/components/leads/ExportarListaModal.tsx`

1. **Update the `Preset` type** (line 18): add `"perdidos"` to the union type.

2. **Add preset to `PRESETS` array** (after line 28): Insert a new entry:
   - Value: `"perdidos"`
   - Label: "Perdidos com telefone"
   - Icon: `UserX` (red tint)
   - Description: "Leads perdidos que possuem telefone"

3. **Add filter logic in the `switch` block** (~line 105): Add a `case "perdidos"` that filters `stage_atual === "Perdido"`. The phone filter is already handled globally by the `exigirTelefone` checkbox (enabled by default), so no extra phone logic needed.

