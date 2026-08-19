import React, { useEffect, useState } from 'react';
import { ExternalLink, Play, Youtube } from 'lucide-react';
import { fetchRecipeVideos } from '../lib/api';
import type { YoutubeVideo } from '../types';

/**
 * 레시피 영상 섹션.
 *
 * AI는 "무엇을" 만들지 정하고, 영상은 "어떻게" 만드는지 보여준다.
 * 재생은 유튜브 공식 임베드(개인정보 강화 도메인)로 하고,
 * 채널명과 원본 링크를 항상 함께 노출해 원저작자에게 트래픽이 가게 한다.
 */

function formatViews(count: number): string {
  if (count >= 10_000) return `조회수 ${Math.floor(count / 10_000)}만회`;
  if (count >= 1_000) return `조회수 ${Math.floor(count / 1_000)}천회`;
  return `조회수 ${count.toLocaleString()}회`;
}

function VideoCard({ video }: { video: YoutubeVideo }) {
  const [playing, setPlaying] = useState(false);
  const watchUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  if (playing) {
    return (
      <div className="rounded-xl overflow-hidden border border-surface-variant bg-black">
        <div className="relative w-full aspect-video">
          <iframe
            // nocookie 도메인이라 재생 전까지 추적 쿠키가 심어지지 않는다
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
        <div className="p-3 bg-white space-y-1">
          <p className="text-sm font-semibold text-on-surface line-clamp-2">{video.title}</p>
          <a
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-on-surface-variant hover:text-primary inline-flex items-center gap-1"
          >
            {video.channelTitle} <ExternalLink size={11} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-surface-variant bg-white">
      {/* 클릭하기 전에는 iframe을 만들지 않는다 — 목록 로딩이 훨씬 빠르다 */}
      <button
        onClick={() => setPlaying(true)}
        aria-label={`${video.title} 재생`}
        className="relative w-full aspect-video bg-surface-container-high group"
      >
        {video.thumbnail && (
          <img src={video.thumbnail} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/35 transition-colors">
          <span className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
            <Play size={24} className="text-error ml-1" fill="currentColor" />
          </span>
        </span>
        {video.duration && (
          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-xs font-medium">
            {video.duration}
          </span>
        )}
      </button>
      <div className="p-3 space-y-1">
        <p className="text-sm font-semibold text-on-surface line-clamp-2 leading-snug">{video.title}</p>
        <p className="text-xs text-on-surface-variant">
          {video.channelTitle}
          {video.viewCount > 0 && ` · ${formatViews(video.viewCount)}`}
        </p>
      </div>
    </div>
  );
}

export default function RecipeVideos({ title }: { title: string }) {
  const [videos, setVideos] = useState<YoutubeVideo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!title) return;
    setVideos(null);
    fetchRecipeVideos(title).then((result) => {
      if (!cancelled) setVideos(result);
    });
    return () => { cancelled = true; };
  }, [title]);

  // 아직 로딩 중
  if (videos === null) {
    return (
      <section className="space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Youtube size={20} className="text-error" /> 영상으로 보기
        </h2>
        <div className="grid gap-3 animate-pulse" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-surface-variant overflow-hidden bg-white">
              <div className="w-full aspect-video bg-surface-container-high" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-surface-container-high rounded w-3/4" />
                <div className="h-3 bg-surface-container-high rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  // 키 미설정이나 검색 실패면 조용히 숨긴다 — 부가 기능이 화면을 어지럽히면 안 된다
  if (videos.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Youtube size={20} className="text-error" /> 영상으로 보기
        </h2>
        <a
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} 레시피`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary font-semibold inline-flex items-center gap-1 shrink-0"
        >
          더보기 <ExternalLink size={11} />
        </a>
      </div>
      <p className="text-xs text-outline">
        유튜브 크리에이터의 영상이에요. 채널명을 누르면 원본으로 이동합니다.
      </p>
      <div className="grid gap-3">
        {videos.map((video) => (
          <VideoCard key={video.videoId} video={video} />
        ))}
      </div>
    </section>
  );
}
