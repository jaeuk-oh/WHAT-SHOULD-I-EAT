import { createHash } from 'node:crypto';
import { getAdminDb } from './_admin.js';

/**
 * 유튜브 레시피 영상 검색 (YouTube Data API v3).
 *
 * 합법성 메모: 공식 API로 메타데이터만 가져오고, 재생은 공식 iframe 임베드로 한다.
 * 자막·대본을 긁어 텍스트로 복제하지 않는다 — 그건 ToS 위반이다.
 * 영상은 항상 채널명과 원본 링크를 함께 노출해 원저작자에게 트래픽이 가게 한다.
 *
 * 할당량: 무료 10,000 유닛/일. search.list가 100 유닛이라 하루 100회가 전부다.
 * 그래서 쿼리 단위 캐시가 선택이 아니라 필수다.
 */

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const VIDEOS_URL = 'https://www.googleapis.com/youtube/v3/videos';
const CACHE_COLLECTION = 'youtubeCache';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RESULTS = 6;

export interface YoutubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  /** "12:34" 형태. 알 수 없으면 빈 문자열 */
  duration: string;
  viewCount: number;
}

interface SearchResponse {
  items?: { id?: { videoId?: string }; snippet?: Record<string, any> }[];
}

interface VideosResponse {
  items?: {
    id?: string;
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string };
  }[];
}

/** 같은 뜻의 검색어가 캐시를 각각 잡아먹지 않게 정규화한다. */
function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function cacheKey(query: string): string {
  return createHash('sha256').update(normalizeQuery(query)).digest('hex').slice(0, 32);
}

/** ISO 8601 재생시간(PT1H2M3S)을 "1:02:03" 으로 바꾼다. */
function formatDuration(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return '';
  const [h, min, s] = [Number(m[1] ?? 0), Number(m[2] ?? 0), Number(m[3] ?? 0)];
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
}

async function readCache(key: string): Promise<YoutubeVideo[] | null> {
  const db = getAdminDb();
  if (!db) return null;
  try {
    const snap = await db.collection(CACHE_COLLECTION).doc(key).get();
    if (!snap.exists) return null;
    const data = snap.data();
    const fetchedAt = (data?.fetchedAt as { toMillis?: () => number } | undefined)?.toMillis?.();
    if (!fetchedAt || Date.now() - fetchedAt > CACHE_TTL_MS) return null;
    return (data?.videos as YoutubeVideo[]) ?? null;
  } catch (e) {
    console.error('[youtube] 캐시 조회 실패:', e);
    return null;
  }
}

async function writeCache(key: string, query: string, videos: YoutubeVideo[]): Promise<void> {
  const db = getAdminDb();
  if (!db) return;
  try {
    await db.collection(CACHE_COLLECTION).doc(key).set({
      query: normalizeQuery(query),
      videos,
      fetchedAt: new Date(),
    });
  } catch (e) {
    // 캐시 실패가 기능 실패가 되면 안 된다
    console.error('[youtube] 캐시 저장 실패:', e);
  }
}

/**
 * 레시피 영상을 찾는다. 캐시에 있으면 API 할당량을 쓰지 않는다.
 * API 키가 없거나 호출이 실패하면 빈 배열을 돌려준다 — 이 기능 때문에 화면이 죽으면 안 된다.
 */
export async function searchRecipeVideos(query: string): Promise<YoutubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const key = cacheKey(query);
  const cached = await readCache(key);
  if (cached) return cached;

  try {
    const searchParams = new URLSearchParams({
      part: 'snippet',
      q: normalizeQuery(query),
      type: 'video',
      maxResults: String(MAX_RESULTS),
      // 한국 요리 영상을 우선 노출한다
      regionCode: 'KR',
      relevanceLanguage: 'ko',
      // 임베드가 막힌 영상은 앱 안에서 재생할 수 없으므로 제외한다
      videoEmbeddable: 'true',
      safeSearch: 'moderate',
      key: apiKey,
    });

    const searchRes = await fetch(`${SEARCH_URL}?${searchParams}`);
    if (!searchRes.ok) {
      console.error('[youtube] search 실패:', searchRes.status, await searchRes.text().catch(() => ''));
      return [];
    }
    const search = (await searchRes.json()) as SearchResponse;

    const ids = (search.items ?? [])
      .map((item) => item.id?.videoId)
      .filter((id): id is string => typeof id === 'string');
    if (ids.length === 0) return [];

    // 재생시간·조회수는 videos.list에만 있다 (1 유닛으로 저렴하다)
    const detailMap = new Map<string, { duration: string; viewCount: number }>();
    try {
      const videosRes = await fetch(
        `${VIDEOS_URL}?${new URLSearchParams({
          part: 'contentDetails,statistics',
          id: ids.join(','),
          key: apiKey,
        })}`,
      );
      if (videosRes.ok) {
        const detail = (await videosRes.json()) as VideosResponse;
        for (const item of detail.items ?? []) {
          if (!item.id) continue;
          detailMap.set(item.id, {
            duration: formatDuration(item.contentDetails?.duration),
            viewCount: Number(item.statistics?.viewCount ?? 0),
          });
        }
      }
    } catch (e) {
      console.error('[youtube] videos 상세 조회 실패 (메타데이터 없이 진행):', e);
    }

    const videos: YoutubeVideo[] = (search.items ?? [])
      .map((item) => {
        const videoId = item.id?.videoId;
        if (!videoId) return null;
        const snippet = item.snippet ?? {};
        const extra = detailMap.get(videoId);
        return {
          videoId,
          // API가 &amp; 같은 HTML 엔티티를 그대로 준다
          title: decodeEntities(String(snippet.title ?? '')),
          channelTitle: decodeEntities(String(snippet.channelTitle ?? '')),
          thumbnail: String(
            snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? '',
          ),
          duration: extra?.duration ?? '',
          viewCount: extra?.viewCount ?? 0,
        };
      })
      .filter((v): v is YoutubeVideo => v !== null);

    await writeCache(key, query, videos);
    return videos;
  } catch (e) {
    console.error('[youtube] 검색 실패:', e);
    return [];
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}
