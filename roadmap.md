# CORTES AI — full suite roadmap

## Current repair
- [x] Resolve preview compilation errors without weakening owner permissions.

## Current request
- [ ] Apply LED-green accents.
- [ ] Verify and repair file upload and YouTube import with real processing.

## Implemented foundation
- AI cuts, transcription, clip scoring, upload and vertical export.
- YouTube ingestion contract and private project storage.
- Projects, history/library, credits, billing schema and owner admin.
- Pro/Studio language entitlement: 350 languages.
- Full-suite data foundation for AI content, media jobs, dubbing, social publishing, analytics, brand kits and templates.
- Real AI title/hook/description/hashtag generation Edge Function using the server-side OpenAI secret.

## Remaining external integrations
1. Dubbing provider and verified language catalog.
2. AI image/video provider with async jobs.
3. Twitch, Kick and Google Drive authorized ingestion.
4. Social OAuth/publishing APIs and app approvals.
5. Social analytics APIs.
6. Payment gateway and verified webhook.
7. Public API, quotas and documentation.

## Definition of done
A module is live only after database migration, Edge Function deployment, required provider secrets, an end-to-end test and failure/refund verification.

## Rights and safety
Only process media the user is authorized to use. Never bypass DRM, paywalls, private access controls or platform protections.
