# YouTube ingestion for CORTES AI

The CORTES AI dashboard now accepts a YouTube URL in **Novo projeto → YouTube**.

## Important

Only process videos that the account owner has permission to use. This integration does not bypass DRM, paywalls, private access controls, or other restrictions.

## Provider contract

The Supabase Edge Function `import-youtube-cortes` uses the server-side secret:

`YOUTUBE_INGEST_URL`

It sends:

```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "maxFileSizeBytes": 25165824,
  "requestedFormat": "mp4"
}
```

The provider must return JSON containing a temporary downloadable video URL:

```json
{
  "download_url": "https://...",
  "file_name": "video.mp4",
  "mime_type": "video/mp4",
  "title": "Video title"
}
```

The function then stores the video in the private `cortes-videos` bucket and starts the existing transcription/cut pipeline.

## Deploy

After configuring the provider endpoint as a Supabase secret, deploy:

```powershell
supabase.cmd functions deploy import-youtube-cortes --project-ref mgaqcyztnjftwtribkfd
supabase.cmd functions deploy transcribe-cortes --project-ref mgaqcyztnjftwtribkfd
```

The provider itself must comply with YouTube's applicable terms and permissions. Do not put provider credentials in frontend code.
