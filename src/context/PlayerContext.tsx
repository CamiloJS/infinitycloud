'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { InfinityItem } from '@/types';
import { adapterRegistry } from '@/lib/adapters/registry';

interface PlayerContextType {
  currentTrack: InfinityItem | null;
  isPlaying: boolean;
  queue: InfinityItem[];
  currentIndex: number;
  volume: number;
  currentTime: number;
  duration: number;
  isMuted: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isShuffled: boolean;
  isSoundCloud: boolean;
  soundCloudEmbedUrl: string | null;

  playTrack: (item: InfinityItem, newQueue?: InfinityItem[]) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  addToQueue: (item: InfinityItem) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  closePlayer: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextTrackRef = useRef<() => void>(() => {});

  const [currentTrack, setCurrentTrack] = useState<InfinityItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [queue, setQueue] = useState<InfinityItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [volume, setVolumeState] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [isShuffled, setIsShuffled] = useState<boolean>(false);

  // SoundCloud support
  const isSoundCloud = currentTrack?.provider === 'soundcloud';
  const soundCloudEmbedUrl = isSoundCloud && currentTrack
    ? adapterRegistry.getEmbedUrl(currentTrack)
    : null;

  // State refs for persistent audio listeners
  const repeatModeRef = useRef<'off' | 'all' | 'one'>(repeatMode);
  const queueRef = useRef<InfinityItem[]>(queue);
  const currentIndexRef = useRef<number>(currentIndex);
  const isShuffledRef = useRef<boolean>(isShuffled);
  const currentTrackRef = useRef<InfinityItem | null>(currentTrack);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isShuffledRef.current = isShuffled;
  }, [isShuffled]);

  // Initialize audio element ONCE
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextTrackRef.current();
      }
    };

    const onError = (e: any) => {
      console.warn('Audio playback error:', e);
      // Auto-fallback: If direct stream failed, try proxying through /api/proxy/media!
      const current = currentTrackRef.current;
      if (current && audioRef.current) {
        const rawUrl = current.metadata?.s3Url || current.url;
        if (rawUrl && !audioRef.current.src.includes('/api/proxy/media')) {
          const proxiedUrl = `/api/proxy/media?url=${encodeURIComponent(rawUrl)}`;
          audioRef.current.src = proxiedUrl;
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          return;
        }
      }
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

  const playTrack = (item: InfinityItem, newQueue?: InfinityItem[]) => {
    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(i => i.id === item.id);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      if (!queue.some(i => i.id === item.id)) {
        setQueue(prev => [...prev, item]);
        setCurrentIndex(queue.length);
      } else {
        const idx = queue.findIndex(i => i.id === item.id);
        setCurrentIndex(idx);
      }
    }

    setCurrentTrack(item);

    if (item.provider !== 'soundcloud') {
      const audio = audioRef.current;
      if (audio) {
        const itemUrl = String(item.url || '');
        const isNotion = item.provider === 'notion' ||
          itemUrl.includes('notion.so') ||
          itemUrl.includes('notion.site') ||
          itemUrl.includes('notion.com') ||
          Boolean(item.metadata?.isNotionAudio);

        const isAudioFile = (url?: string) => {
          if (!url) return false;
          const clean = url.trim();
          const l = clean.toLowerCase();
          const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac|opus|weba|wma|aiff|m4b)($|\?|&|#|\/|\s|"|'|`)/i;
          return AUDIO_EXT.test(clean) || AUDIO_EXT.test(l) || l.includes('prod-files-secure.s3') || l.includes('file.notion.so') || l.includes('amazonaws.com') || l.includes('/audio');
        };

        const targetStreamUrl = item.metadata?.s3Url || item.url;
        // If Notion item lacks direct s3 audio stream, extract on-demand from page
        if (isNotion && !isAudioFile(targetStreamUrl)) {
          fetch('/api/notion/extract-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.metadata?.originalUrl || item.url })
          })
            .then(r => r.json())
            .then(data => {
              const aud = (data.foundAudio && data.audio) ? data.audio : (data.audios || [])[0];
              if (aud?.url) {
                const streamUrl = `/api/proxy/media?url=${encodeURIComponent(aud.url)}`;
                audio.src = streamUrl;
                audio.volume = isMuted ? 0 : volume;
                audio.play().then(() => setIsPlaying(true)).catch(() => {});
                setCurrentTrack(prev => prev ? {
                  ...prev,
                  thumbnailUrl: aud.coverUrl || prev.thumbnailUrl,
                  metadata: {
                    ...prev.metadata,
                    s3Url: aud.url,
                    notionBlockId: aud.notionBlockId,
                    isNotionAudio: true
                  }
                } : null);
              }
            })
            .catch(err => console.warn('Could not extract Notion audio on-demand:', err));
          return;
        }

        const audioSrc = adapterRegistry.getDirectUrl(item);
        audio.src = audioSrc;
        audio.volume = isMuted ? 0 : volume;
        audio.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.warn('Playback failed, trying proxy fallback:', err);
          const rawUrl = item.metadata?.s3Url || item.url;
          if (rawUrl && !audio.src.includes('/api/proxy/media')) {
            audio.src = `/api/proxy/media?url=${encodeURIComponent(rawUrl)}`;
            audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
        });
      }
    } else {
      // SoundCloud embed plays within widget
      setIsPlaying(true);
    }
  };

  const togglePlayPause = () => {
    if (!currentTrack) return;

    if (isSoundCloud) {
      setIsPlaying(prev => !prev);
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Playback failed:', err);
      });
    }
  };

  const nextTrack = () => {
    const curQueue = queueRef.current;
    if (curQueue.length === 0) return;

    let nextIdx = currentIndexRef.current + 1;
    if (isShuffledRef.current && curQueue.length > 1) {
      do {
        nextIdx = Math.floor(Math.random() * curQueue.length);
      } while (nextIdx === currentIndexRef.current);
    } else if (nextIdx >= curQueue.length) {
      if (repeatModeRef.current === 'all') {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    setCurrentIndex(nextIdx);
    playTrack(curQueue[nextIdx]);
  };

  useEffect(() => {
    nextTrackRef.current = nextTrack;
  });

  const prevTrack = () => {
    const curQueue = queueRef.current;
    if (curQueue.length === 0) return;

    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    let prevIdx = currentIndexRef.current - 1;
    if (prevIdx < 0) {
      prevIdx = curQueue.length - 1;
    }

    setCurrentIndex(prevIdx);
    playTrack(curQueue[prevIdx]);
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (audio && !isNaN(seconds)) {
      audio.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setVolume = (vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const toggleShuffle = () => {
    setIsShuffled(prev => !prev);
  };

  const addToQueue = (item: InfinityItem) => {
    setQueue(prev => [...prev, item]);
  };

  const removeFromQueue = (index: number) => {
    setQueue(prev => prev.filter((_, i) => i !== index));
    if (index === currentIndex && queue.length > 1) {
      nextTrack();
    } else if (index < currentIndex) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const clearQueue = () => {
    setQueue([]);
    setCurrentIndex(-1);
    setCurrentTrack(null);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  };

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
    setCurrentTrack(null);
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        queue,
        currentIndex,
        volume,
        currentTime,
        duration,
        isMuted,
        repeatMode,
        isShuffled,
        isSoundCloud,
        soundCloudEmbedUrl,
        playTrack,
        togglePlayPause,
        nextTrack,
        prevTrack,
        seekTo,
        setVolume,
        toggleMute,
        toggleRepeat,
        toggleShuffle,
        addToQueue,
        removeFromQueue,
        clearQueue,
        closePlayer
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer debe ser usado dentro de un PlayerProvider');
  }
  return context;
}
