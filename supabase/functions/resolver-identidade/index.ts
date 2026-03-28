import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IdentifierInput {
  type: string;
  value: string;
  confidence?: number;
}

interface ResolveRequest {
  id_empresa: string;
  identifiers: IdentifierInput[];
  source: string;
  lead_data?: Record<string, any>; // optional data to create/update lead
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body: ResolveRequest = await req.json();
    const { id_empresa, identifiers, source, lead_data } = body;

    if (!id_empresa || !identifiers || identifiers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'id_empresa and identifiers required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter valid identifiers (non-empty values)
    const validIds = identifiers.filter(i => i.value && i.value.trim() !== '');
    if (validIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No valid identifiers provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Identity] Resolving ${validIds.length} identifiers from ${source} for empresa ${id_empresa}`);

    // 1. Look up existing matches in identity_graph
    const matchedLeadIds = new Set<string>();
    const existingEntries: Record<string, { id: string; id_lead: string | null }> = {};

    for (const ident of validIds) {
      const { data } = await supabase
        .from('identity_graph')
        .select('id, id_lead')
        .eq('identifier_type', ident.type)
        .eq('identifier_value', ident.value.toLowerCase().trim())
        .maybeSingle();

      if (data) {
        existingEntries[`${ident.type}:${ident.value}`] = data;
        if (data.id_lead) {
          matchedLeadIds.add(data.id_lead);
        }
      }
    }

    let resolvedLeadId: string | null = null;

    // 2. Determine the resolved lead
    if (matchedLeadIds.size === 1) {
      // Single match — use it
      resolvedLeadId = Array.from(matchedLeadIds)[0];
      console.log(`[Identity] Single match found: ${resolvedLeadId}`);
    } else if (matchedLeadIds.size > 1) {
      // Multiple matches — pick the oldest lead as canonical
      const leadIds = Array.from(matchedLeadIds);
      const { data: leads } = await supabase
        .from('lead')
        .select('id_lead, data_criacao')
        .in('id_lead', leadIds)
        .order('data_criacao', { ascending: true })
        .limit(1);

      resolvedLeadId = leads?.[0]?.id_lead || leadIds[0];
      console.log(`[Identity] Multiple matches (${leadIds.length}), canonical: ${resolvedLeadId}`);

      // Update all identity entries pointing to non-canonical leads
      for (const nonCanonicalId of leadIds.filter(id => id !== resolvedLeadId)) {
        await supabase
          .from('identity_graph')
          .update({ id_lead: resolvedLeadId, last_seen_at: new Date().toISOString() })
          .eq('id_lead', nonCanonicalId)
          .eq('id_empresa', id_empresa);

        // Mark non-canonical leads as merged
        await supabase
          .from('lead')
          .update({ merged: true, merged_into: resolvedLeadId })
          .eq('id_lead', nonCanonicalId);

        console.log(`[Identity] Merged lead ${nonCanonicalId} → ${resolvedLeadId}`);
      }
    } else {
      // No match found — check if we have strong identifiers (email/phone/cpf) to create a lead
      const strongIds = validIds.filter(i => ['email', 'phone', 'cpf'].includes(i.type));

      if (strongIds.length > 0 || lead_data) {
        // Try to find existing lead by email/phone in the lead table directly
        const emailId = validIds.find(i => i.type === 'email');
        const phoneId = validIds.find(i => i.type === 'phone');

        if (emailId) {
          const { data } = await supabase
            .from('lead')
            .select('id_lead')
            .eq('id_empresa', id_empresa)
            .ilike('email', emailId.value)
            .limit(1);
          if (data?.[0]) resolvedLeadId = data[0].id_lead;
        }

        if (!resolvedLeadId && phoneId) {
          const digits = phoneId.value.replace(/\D/g, '');
          if (digits.length >= 10) {
            const { data } = await supabase
              .from('lead')
              .select('id_lead')
              .eq('id_empresa', id_empresa)
              .or(`telefone.eq.${digits},telefone.eq.+55${digits}`)
              .limit(1);
            if (data?.[0]) resolvedLeadId = data[0].id_lead;
          }
        }

        if (resolvedLeadId) {
          console.log(`[Identity] Found existing lead via direct lookup: ${resolvedLeadId}`);
        }
      }
      // If still no match and only weak identifiers (cookie, session), leave id_lead null (anonymous)
    }

    // 3. Upsert all identifiers into identity_graph
    const now = new Date().toISOString();
    for (const ident of validIds) {
      const key = `${ident.type}:${ident.value}`;
      const normalizedValue = ident.value.toLowerCase().trim();

      if (existingEntries[key]) {
        // Update existing entry
        const updates: Record<string, any> = {
          last_seen_at: now,
          source,
        };
        if (resolvedLeadId && !existingEntries[key].id_lead) {
          updates.id_lead = resolvedLeadId;
        } else if (resolvedLeadId && existingEntries[key].id_lead !== resolvedLeadId) {
          updates.id_lead = resolvedLeadId;
        }
        await supabase
          .from('identity_graph')
          .update(updates)
          .eq('id', existingEntries[key].id);
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('identity_graph')
          .insert({
            id_lead: resolvedLeadId,
            id_empresa,
            identifier_type: ident.type,
            identifier_value: normalizedValue,
            confidence: ident.confidence ?? 1.0,
            first_seen_at: now,
            last_seen_at: now,
            source,
          });

        if (error) {
          // Unique constraint violation — another request beat us, update instead
          if (error.code === '23505') {
            await supabase
              .from('identity_graph')
              .update({ id_lead: resolvedLeadId, last_seen_at: now, source })
              .eq('identifier_type', ident.type)
              .eq('identifier_value', normalizedValue);
          } else {
            console.error(`[Identity] Error inserting ${ident.type}:`, error);
          }
        }
      }
    }

    // 4. If we resolved to a lead and there were anonymous entries linked to same identifiers, 
    //    do transitive merge: find all anonymous entries sharing any cookie/session with this lead
    if (resolvedLeadId) {
      // Find all identifiers for this lead
      const { data: allMyIds } = await supabase
        .from('identity_graph')
        .select('identifier_type, identifier_value')
        .eq('id_lead', resolvedLeadId)
        .eq('id_empresa', id_empresa);

      // For each cookie/session, find anonymous entries and claim them
      const sessionTypes = ['cookie_id', 'session_id', 'fbp', 'device_id'];
      for (const myId of (allMyIds || [])) {
        if (sessionTypes.includes(myId.identifier_type)) {
          // Find other identifiers with same cookie but no lead (anonymous)
          // This is the transitive merge
          const { data: anonymousEntries } = await supabase
            .from('identity_graph')
            .select('id')
            .eq('identifier_type', myId.identifier_type)
            .eq('identifier_value', myId.identifier_value)
            .is('id_lead', null);

          if (anonymousEntries && anonymousEntries.length > 0) {
            await supabase
              .from('identity_graph')
              .update({ id_lead: resolvedLeadId, last_seen_at: now })
              .in('id', anonymousEntries.map(e => e.id));

            console.log(`[Identity] Transitive merge: claimed ${anonymousEntries.length} anonymous entries via ${myId.identifier_type}`);
          }
        }
      }
    }

    const totalEntries = validIds.length;
    const action = resolvedLeadId ? 'resolved' : 'anonymous';

    console.log(`[Identity] Result: ${action}, lead=${resolvedLeadId}, entries=${totalEntries}`);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        id_lead: resolvedLeadId,
        identifiers_processed: totalEntries,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Identity] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
