
## Fix: Creative Matching in Apify Preview Recovery

### Root Cause Analysis

The investigation revealed **3 fundamental reasons** why zero criativos are being matched:

#### Problem 1: ID Namespace Mismatch
- All 94 pending criativos have `id_anuncio_externo = NULL` -- they only have `id_criativo_externo` (Meta's internal Creative ID, e.g. `1359245165897115`)
- Apify returns `adArchiveID` which is the **Ad Archive ID** -- a completely different identifier
- The code compares `id_criativo_externo` vs `adArchiveID` -- these **never match** because they represent different entities (creative vs. ad archive entry)

#### Problem 2: Text Similarity Compares Different Things
- `descricao` in the database stores the **internal ad/creative name** (e.g. "black-blue-08", "Criativo 06", "ADS-LIVE-IR-CRIPTO-2")
- Apify returns the **public-facing ad copy** (e.g. "Invista em tokenizacao de ativos reais...")
- Jaccard similarity between these will always be near 0 because they are fundamentally different texts

#### Problem 3: Generic Search Terms
- The Apify search uses `empresa.nome` as the Facebook Ads Library query
- "Blue" is extremely generic -- returns 30 unrelated ads from random "Blue" advertisers
- "Tokeniza" returned only 1 result, suggesting the Facebook page name may differ

### Solution

#### 1. Search by Facebook Page ID instead of empresa name
- Add a `page_id_facebook` column to the `conta_anuncio` table (or use an existing field)
- Query the Apify scraper using the page-specific URL: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=BR&view_all_page_id={PAGE_ID}&search_type=page`
- This guarantees all returned ads belong to the correct advertiser

#### 2. Broader matching strategy with multiple fallbacks
Instead of relying on a single match method, use a cascade:
- **Priority 1**: Match Apify `adArchiveID` against the DB `id_anuncio_externo` (for the 198 criativos that have it)
- **Priority 2**: Match Apify `snapshot.link_url` against `url_final` in the DB (landing page URL matching)
- **Priority 3**: Match Apify image/video thumbnail hash against `url_midia` patterns
- **Priority 4**: Text similarity between `descricao` and Apify `snapshot.body_text` + `snapshot.title` (keep as last resort with 0.2 threshold)

#### 3. Fetch ALL ads (not just active) to cover older criativos
- Change `active_status=active` to `active_status=all` in the search URL since many pending criativos may be from paused/completed campaigns

#### 4. Log diagnostic data for debugging
- Log a sample of the Apify response structure (first ad's IDs + text)
- Log each criativo's attempted match fields so we can see why matches fail

### Technical Details

**New column (optional but recommended):**
```sql
ALTER TABLE public.conta_anuncio ADD COLUMN page_id_facebook TEXT;
```

**Apify URL change (page-specific search):**
```
-- Before (generic):
https://www.facebook.com/ads/library/?q=Blue&active_status=active

-- After (page-specific):
https://www.facebook.com/ads/library/?view_all_page_id=123456789&active_status=all&search_type=page
```

**Matching cascade logic:**
```typescript
for (const criativo of group.criativos) {
  const anuncioExterno = criativo.id_anuncio_externo || "";
  const urlFinal = criativo.url_final || "";
  const descricao = criativo.descricao || "";

  for (const ad of results) {
    // P1: ID match (ad ID from Meta API vs Apify archive ID)
    if (anuncioExterno && (ad.adArchiveID === anuncioExterno || ad.adid === anuncioExterno)) {
      bestMatch = ad; break;
    }
    // P2: Landing page URL match
    if (urlFinal && ad.snapshot?.link_url && 
        normalizeUrl(urlFinal).includes(normalizeUrl(ad.snapshot.link_url))) {
      bestMatch = ad; break;
    }
    // P3: Text similarity (last resort)
    // ... existing logic with 0.2 threshold
  }
}
```

**Diagnostic logging:**
```typescript
console.log(`📊 Sample Apify ad: id=${results[0]?.adArchiveID}, pageID=${results[0]?.pageID}, text=${results[0]?.snapshot?.body_text?.substring(0,50)}`);
console.log(`📊 Sample criativo: ext=${criativo.id_criativo_externo}, anuncio=${criativo.id_anuncio_externo}, desc=${criativo.descricao}`);
```

### Files Changed
- **Migration**: Add `page_id_facebook` column to `conta_anuncio`
- **`supabase/functions/recuperar-previews-apify/index.ts`**: 
  - Search by page ID when available, fall back to empresa name
  - Fetch all ads (not just active)
  - Implement multi-priority matching cascade
  - Add `url_final` to the query select
  - Add diagnostic logging
  - Also select `id_anuncio_externo` and `url_final` from the criativos query
