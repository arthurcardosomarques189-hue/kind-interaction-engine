import { describe, expect, it } from 'vitest';
import { MAX_VIDEO_SIZE, normalizeYouTubeUrl, videoFileError } from '../lib/cortes-video-input';

describe('Video sources', () => {
  it('accepts watch, short and mobile YouTube links', () => {
    for (const url of ['https://youtu.be/abcdefghijk', 'https://m.youtube.com/watch?v=abcdefghijk', 'https://www.youtube.com/shorts/abcdefghijk']) {
      expect(normalizeYouTubeUrl(url)).toBe('https://www.youtube.com/watch?v=abcdefghijk');
    }
  });
  it('rejects non-video and impersonating YouTube links', () => {
    for (const url of ['https://youtube.com/', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://youtube.com/watch?v=abc', 'http://youtu.be/abcdefghijk']) {
      expect(normalizeYouTubeUrl(url)).toBeNull();
    }
  });
  it('accepts video files and empty MIME type with a known extension', () => {
    expect(videoFileError({ name: 'sample.mp4', type: '', size: 1024 })).toBeNull();
    expect(videoFileError({ name: 'sample.webm', type: 'video/webm', size: 1024 })).toBeNull();
    expect(videoFileError({ name: 'sample.txt', type: 'text/plain', size: 1024 })).not.toBeNull();
  });
  it('preserves the 500 MB boundary', () => {
    expect(MAX_VIDEO_SIZE).toBe(524288000);
    expect(videoFileError({ name: 'sample.mp4', type: 'video/mp4', size: 524288000 })).toBeNull();
    expect(videoFileError({ name: 'sample.mp4', type: 'video/mp4', size: 524288001 })).not.toBeNull();
  });
  it('rejects empty files', () => {
    expect(videoFileError({ name: 'sample.mp4', type: 'video/mp4', size: 0 })).not.toBeNull();
  });
});