export const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

export function normalizeYouTubeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!['youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const id = host === 'youtu.be' ? parts[0]
      : url.pathname === '/watch' ? url.searchParams.get('v')
      : ['shorts', 'live', 'embed'].includes(parts[0] ?? '') ? parts[1] : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? `https://www.youtube.com/watch?v=${id}` : null;
  } catch { return null; }
}

export function videoFileError(file: Pick<File, 'type' | 'name' | 'size'>): string | null {
  if (file.size === 0) return 'Este arquivo está vazio.';
  if (!file.type.startsWith('video/') && !(file.type === '' && /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(file.name))) {
    return 'Escolha um arquivo de vídeo.';
  }
  if (file.size > MAX_VIDEO_SIZE) return 'O vídeo precisa ter no máximo 500 MB.';
  return null;
}