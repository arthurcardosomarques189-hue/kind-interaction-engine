import { supabase } from '@/integrations/supabase/client';

const CHUNK_SIZE = 6 * 1024 * 1024;

function encodeMetadata(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function getStorageEndpoint() {
  const url = import.meta.env['VITE_SUPABASE_URL'] as string;
  const parsed = new URL(url);
  const projectRef = parsed.hostname.split('.')[0];
  return 'https://' + projectRef + '.storage.supabase.co/storage/v1/upload/resumable';
}

export async function uploadCortesVideoResumable(
  path: string,
  file: File,
  onProgress?: (progress: number) => void,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sua sessão expirou. Entre novamente para enviar o vídeo.');
  }

  const endpoint = getStorageEndpoint();
  const metadata = [
    'bucketName ' + encodeMetadata('cortes-videos'),
    'objectName ' + encodeMetadata(path),
    'contentType ' + encodeMetadata(file.type || 'video/mp4'),
    'cacheControl ' + encodeMetadata('3600'),
  ].join(',');

  const createResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      apikey: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string,
      Authorization: 'Bearer ' + session.access_token,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(file.size),
      'Upload-Metadata': metadata,
      'x-upsert': 'false',
    },
  });

  if (!createResponse.ok) {
    const detail = await createResponse.text().catch(() => '');
    throw new Error(
      'Não foi possível iniciar o upload do vídeo.' +
        (detail ? ' ' + detail : ''),
    );
  }

  const location = createResponse.headers.get('Location');
  if (!location) throw new Error('O armazenamento não retornou a URL de upload.');

  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + CHUNK_SIZE, file.size));

    const patchResponse = await fetch(location, {
      method: 'PATCH',
      headers: {
        apikey: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string,
        Authorization: 'Bearer ' + session.access_token,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': String(offset),
        'Content-Type': 'application/offset+octet-stream',
      },
      body: chunk,
    });

    if (!patchResponse.ok) {
      const detail = await patchResponse.text().catch(() => '');
      throw new Error(
        'O upload foi interrompido. Tente novamente.' +
          (detail ? ' ' + detail : ''),
      );
    }

    const nextOffset = Number(patchResponse.headers.get('Upload-Offset'));
    if (!Number.isFinite(nextOffset) || nextOffset <= offset) {
      throw new Error('O armazenamento não confirmou o avanço do upload.');
    }

    offset = nextOffset;
    onProgress?.(Math.round((offset / file.size) * 100));
  }

  return { path, size: file.size };
}
