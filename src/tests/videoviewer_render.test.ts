import { describe, it, expect } from 'vitest';
import React from 'react';
import { isValidDirectVideoStream } from '@/components/viewers/VideoViewer';
import { canDownloadItem, getDownloadFilename } from '@/lib/utils/download';
import { adapterRegistry } from '@/lib/adapters/registry';
import { YouTubeAdapter } from '@/lib/adapters/youtube';
import { VimeoAdapter } from '@/lib/adapters/vimeo';
import { ViewerErrorBoundary } from '@/components/common/ViewerErrorBoundary';
import { InfinityItem } from '@/types';

describe('VideoViewer logic and edge cases', () => {
  const notionItem: InfinityItem = {
    id: 'test_notion_item',
    userId: 'user_123',
    name: 'Black Widow',
    url: 'https://camilojaimes.notion.site/Black-Widow-5ade5ea5587a42929beb5582a1ef1f1f',
    provider: 'notion',
    category: 'videos',
    isFavorite: false,
    isTrash: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    metadata: {
      originalUrl: 'https://camilojaimes.notion.site/Black-Widow-5ade5ea5587a42929beb5582a1ef1f1f'
    }
  };

  it('correctly handles Notion URL without direct stream', () => {
    expect(isValidDirectVideoStream(notionItem.url)).toBe(false);
    expect(canDownloadItem(notionItem)).toBe(true);
  });

  it('correctly validates s3 and file.notion.so video streams', () => {
    const s3Url = 'https://file.notion.so/f/f/b6a591da-c4cc-488a-9b82-199b719df9fa/2e536a3d-5b6d-4161-b89d-a50da132ebc9/Black_Widow.mp4?table=block&id=2e44480d-8beb-4e03-a600-b479433e8a85';
    expect(isValidDirectVideoStream(s3Url)).toBe(true);
  });

  it('safely handles null, undefined, and non-string in isValidDirectVideoStream', () => {
    expect(isValidDirectVideoStream(null)).toBe(false);
    expect(isValidDirectVideoStream(undefined)).toBe(false);
    expect(isValidDirectVideoStream('')).toBe(false);
    expect(isValidDirectVideoStream(123 as any)).toBe(false);
    expect(isValidDirectVideoStream({} as any)).toBe(false);
  });

  it('evaluates embed and direct urls safely without throwing for notion item', () => {
    const resolvedVideo = String(notionItem.metadata?.s3Url || notionItem.url || '');
    const itemUrl = String(notionItem.url || '');
    
    const isYoutube = (
      itemUrl.includes('youtube.com') ||
      itemUrl.includes('youtu.be') ||
      resolvedVideo.includes('youtube.com') ||
      resolvedVideo.includes('youtu.be')
    );
    expect(isYoutube).toBe(false);

    const isVimeo = (
      itemUrl.includes('vimeo.com') ||
      resolvedVideo.includes('vimeo.com')
    );
    expect(isVimeo).toBe(false);

    const embedUrl = adapterRegistry.getEmbedUrl({ ...notionItem, url: resolvedVideo });
    expect(embedUrl).toBeNull();

    const directUrl = adapterRegistry.getDirectUrl(notionItem);
    expect(directUrl).toBeDefined();

    const urlLower = resolvedVideo.toLowerCase();
    const isVideoExt = (
      urlLower.endsWith('.mp4') ||
      urlLower.endsWith('.webm') ||
      urlLower.endsWith('.mov') ||
      urlLower.endsWith('.m4v') ||
      urlLower.endsWith('.ogv')
    );
    expect(isVideoExt).toBe(false);
  });

  it('derives getDerivedStateFromError in ViewerErrorBoundary cleanly', () => {
    const err = new Error('Simulated modal error');
    const state = ViewerErrorBoundary.getDerivedStateFromError(err);
    expect(state.hasError).toBe(true);
    expect(state.error).toBe(err);
  });
});
