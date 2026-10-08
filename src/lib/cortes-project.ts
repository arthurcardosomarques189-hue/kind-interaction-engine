export type ProjectStatus = 'draft' | 'queued' | 'processing' | 'completed' | 'failed';

export type CortesProject = {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  status: ProjectStatus;
  progress: number;
  createdAt: string;
  videoPath?: string | null;
  errorMessage?: string | null;
  sourceType?: 'upload' | 'youtube';
  sourceUrl?: string | null;
};

export type CortesClip = {
  id: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  score: number;
  videoPath?: string | null;
};

export function createLocalProject(file: File): CortesProject {
  return {
    id: crypto.randomUUID(),
    title: file.name.replace(/\.[^/.]+$/, ''),
    fileName: file.name,
    fileSize: file.size,
    status: 'queued',
    progress: 0,
    createdAt: new Date().toISOString(),
  };
}
