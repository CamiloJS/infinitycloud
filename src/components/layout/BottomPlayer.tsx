'use client';

import React, { useState } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  Repeat, 
  Repeat1, 
  Shuffle, 
  ListMusic, 
  X, 
  Music,
  ExternalLink
} from 'lucide-react';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function BottomPlayer() {
  const {
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
    togglePlayPause,
    nextTrack,
    prevTrack,
    seekTo,
    setVolume,
    toggleMute,
    toggleRepeat,
    toggleShuffle,
    removeFromQueue,
    clearQueue,
    playTrack,
    closePlayer
  } = usePlayer();

  const [showQueue, setShowQueue] = useState<boolean>(false);

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      {/* Queue Modal / Drawer */}
      {showQueue && (
        <div className="fixed bottom-24 right-4 z-40 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-4 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ListMusic size={18} className="text-violet-500" />
              <span className="font-semibold text-sm text-slate-800 dark:text-white">
                Cola de reproducción ({queue.length})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={clearQueue}
                className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
              >
                Limpiar
              </button>
              <button
                onClick={() => setShowQueue(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto mt-2 space-y-1 divide-y divide-slate-100 dark:divide-slate-800/50">
            {queue.map((track, idx) => {
              const isCurrent = idx === currentIndex;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                    isCurrent
                      ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 font-medium'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <button
                    onClick={() => playTrack(track)}
                    className="flex items-center gap-2.5 truncate text-left flex-1"
                  >
                    <span className="w-4 text-center text-slate-400 text-[10px]">{idx + 1}</span>
                    <span className="truncate">{track.name}</span>
                  </button>

                  <button
                    onClick={() => removeFromQueue(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500 shrink-0"
                    title="Quitar"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Persistent Bar */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-2xl transition-all select-none">
        {/* Progress Bar (interactive) */}
        {!isSoundCloud && (
          <div
            className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 hover:h-2 transition-all cursor-pointer group relative"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = clickX / rect.width;
              seekTo(ratio * duration);
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 relative transition-all"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Track Info */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 max-w-[130px] sm:max-w-[220px] md:max-w-xs">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 overflow-hidden">
              {currentTrack.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentTrack.thumbnailUrl}
                  alt={currentTrack.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music size={20} className="text-violet-500" />
              )}
            </div>

            <div className="truncate">
              <div className="font-medium text-xs md:text-sm text-slate-800 dark:text-white truncate">
                {currentTrack.name}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="capitalize">{currentTrack.provider}</span>
                {!isSoundCloud && duration > 0 && (
                  <>
                    <span>•</span>
                    <span className="font-mono">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center: Controls (Native or SoundCloud iframe) */}
          {isSoundCloud && soundCloudEmbedUrl ? (
            <div className="flex-1 max-w-md h-12">
              <iframe
                src={soundCloudEmbedUrl}
                width="100%"
                height="100%"
                allow="autoplay"
                className="rounded-lg border-0"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleShuffle}
                  className={`p-1.5 rounded-lg transition-colors hidden sm:block ${
                    isShuffled
                      ? 'text-violet-500 dark:text-violet-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title="Aleatorio"
                >
                  <Shuffle size={16} />
                </button>

                <button
                  onClick={prevTrack}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Anterior"
                >
                  <SkipBack size={18} />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                  title={isPlaying ? 'Pausar' : 'Reproducir'}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>

                <button
                  onClick={nextTrack}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Siguiente"
                >
                  <SkipForward size={18} />
                </button>

                <button
                  onClick={toggleRepeat}
                  className={`p-1.5 rounded-lg transition-colors hidden sm:block ${
                    repeatMode !== 'off'
                      ? 'text-violet-500 dark:text-violet-400'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                  }`}
                  title={`Repetición: ${repeatMode}`}
                >
                  {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                </button>
              </div>
            </div>
          )}

          {/* Right: Volume & Queue */}
          <div className="flex items-center gap-3">
            {!isSoundCloud && (
              <div className="hidden md:flex items-center gap-2">
                <button
                  onClick={toggleMute}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-20 accent-violet-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg"
                />
              </div>
            )}

            <button
              onClick={() => setShowQueue(prev => !prev)}
              className={`p-2 rounded-lg transition-colors ${
                showQueue
                  ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title="Cola de reproducción"
            >
              <ListMusic size={18} />
            </button>

            <a
              href={currentTrack.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors hidden sm:block"
              title="Abrir original"
            >
              <ExternalLink size={16} />
            </a>

            <button
              onClick={closePlayer}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Cerrar reproductor"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
