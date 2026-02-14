

## Fix: Preview Links and Video Playback in Creative Cards

### Problems Identified

1. **fb.me links require Facebook login** -- The `url_preview` column stores short links like `https://fb.me/30EbJs6wJ6gM6fK` which redirect to Meta's ad preview page. Without an active Facebook session, these links show a login wall.
2. **Video criativos show tiny thumbnails** -- For VIDEO type creatives, `url_midia` stores a 64x64 pixel thumbnail JPG from Meta CDN (note `p64x64` in the URL params), not the actual video. The image expand dialog just shows this low-res image.

### Solution

#### 1. New database column: `url_video`
Add a `url_video TEXT` column to the `criativo` table to store actual video source URLs separately from the thumbnail.

#### 2. Update edge function: `atualizar-preview-criativos`
Instead of only fetching `preview_shareable_link` (which gives fb.me links), also fetch the creative's actual assets via the Meta Graph API:
- For ads, request fields: `preview_shareable_link,creative{thumbnail_url,object_story_spec,asset_feed_spec}`
- Use `thumbnail_url` as a higher-quality `url_midia` replacement
- For VIDEO creatives, fetch the video source URL via `/{video_id}?fields=source` and store in `url_video`
- Build a public Ad Library link as fallback for `url_preview`: `https://www.facebook.com/ads/library/?id={ad_id}` (works without login)

#### 3. Update edge function: `recuperar-previews-apify`
The Apify scraper already captures `snapshot.videos[].video_hd_url` and `video_sd_url`. Update to store these in the new `url_video` column instead of discarding them.

#### 4. Frontend: Smart media rendering
In both `CriativoRankingCard` and `CriativoDetalhesModal`:
- When `tipo === 'VIDEO'` and `url_video` exists, render a `<video>` element with controls, `playsInline`, and `muted` for autoplay
- Use `url_midia` as the video `poster` (thumbnail)
- In the expand dialog, show the video player at full size instead of a static image
- Replace the "Ver no Facebook" button link to use the public Ad Library URL when the fb.me link is detected

### Technical Details

**Database migration:**
```sql
ALTER TABLE public.criativo ADD COLUMN url_video TEXT;
```

**Meta Graph API call change (atualizar-preview-criativos):**
```
GET /{ad_id}?fields=preview_shareable_link,creative{thumbnail_url,video_id}
```
Then for video creatives:
```
GET /{video_id}?fields=source
```

**Public Ad Library URL format (no login required):**
```
https://www.facebook.com/ads/library/?id={ad_id_externo}
```

**Frontend video component pattern:**
```tsx
{tipo === 'VIDEO' && url_video ? (
  <video src={url_video} poster={url_midia} controls playsInline muted
         className="w-full h-auto rounded-lg" />
) : (
  <img src={url_midia} ... />
)}
```

### Files Changed
- **Migration**: Add `url_video` column
- **`supabase/functions/atualizar-preview-criativos/index.ts`**: Fetch thumbnail + video source from Graph API; generate Ad Library links
- **`supabase/functions/recuperar-previews-apify/index.ts`**: Store video URLs in `url_video`
- **`src/components/campanhas/CriativoRankingCard.tsx`**: Video playback in expand dialog; Ad Library link fallback
- **`src/components/dashboard/CriativoDetalhesModal.tsx`**: Video player for VIDEO type; fix preview button link
