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
/** 캐시 스키마가 바뀌면 올린다 — 옛 캐시가 자동으로 무효화된다 */
const CACHE_VERSION = 'v2';
/**
 * search.list는 결과 개수와 무관하게 100 유닛이다.
 * 그래서 후보를 넉넉히 받아 우리 기준으로 다시 정렬하는 편이 공짜로 이득이다.
 */
const CANDIDATE_COUNT = 25;
const RETURN_COUNT = 6;

export interface YoutubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  /** "12:34" 형태. 알 수 없으면 빈 문자열 */
  duration: string;
  viewCount: number;
  /** 이 영상이 위로 올라온 이유. 없으면 빈 문자열 */
  reason: string;
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
  return createHash('sha256')
    .update(`${CACHE_VERSION}:${normalizeQuery(query)}`)
    .digest('hex')
    .slice(0, 32);
}

/** ISO 8601 재생시간을 초로. 파싱 실패 시 0 */
function durationSeconds(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/**
 * 같은 요리의 영상끼리는 재료가 거의 같다. 그래서 여기서 재료는 기준이 아니고,
 * "믿을 만한가(조회수) · 보기 좋은 길이인가 · 정말 그 요리인가"로 고른다.
 */
function scoreVideo(
  video: { title: string; viewCount: number; durationSec: number },
  dishTokens: string[],
): number {
  // 조회수는 편차가 커서 로그로 누른다 (1000만 회 ≈ 1.0)
  const views = Math.min(1, Math.log10(video.viewCount + 1) / 7);

  // 60초 미만은 쇼츠라 조리법을 못 따라가고, 30분 넘으면 브이로그인 경우가 많다
  const sec = video.durationSec;
  let duration: number;
  if (sec === 0) duration = 0.5;
  else if (sec < 90) duration = 0.1;
  else if (sec <= 240) duration = 0.8;
  else if (sec <= 900) duration = 1;
  else if (sec <= 1800) duration = 0.6;
  else duration = 0.2;

  // 제목에 요리 이름이 실제로 들어 있는가 (엉뚱한 영상 걸러내기)
  const lowerTitle = video.title.toLowerCase();
  const matched = dishTokens.filter((t) => lowerTitle.includes(t)).length;
  const titleMatch = dishTokens.length === 0 ? 0.5 : matched / dishTokens.length;

  return 0.4 * views + 0.3 * duration + 0.3 * titleMatch;
}

function reasonFor(video: { viewCount: number; durationSec: number }, rank: number): string {
  if (video.viewCount >= 1_000_000) return '조회수 100만+';
  if (video.durationSec > 0 && video.durationSec <= 600 && video.viewCount >= 50_000) {
    return '짧고 인기 있어요';
  }
  if (rank === 0) return '가장 볼만해요';
  return '';
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
      maxResults: String(CANDIDATE_COUNT),
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
    const detailMap = new Map<string, { duration: string; durationSec: number; viewCount: number }>();
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
            durationSec: durationSeconds(item.contentDetails?.duration),
            viewCount: Number(item.statistics?.viewCount ?? 0),
          });
        }
      }
    } catch (e) {
      console.error('[youtube] videos 상세 조회 실패 (메타데이터 없이 진행):', e);
    }

    // 요리 이름에서 검색용 접미사를 뺀 토큰 (제목 일치 판정용)
    const dishTokens = normalizeQuery(query)
      .replace(/레시피|만들기|만드는\s*법/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2);

    const candidates = (search.items ?? [])
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
          durationSec: extra?.durationSec ?? 0,
          viewCount: extra?.viewCount ?? 0,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    const videos: YoutubeVideo[] = candidates
      .map((v) => ({ v, score: scoreVideo(v, dishTokens) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, RETURN_COUNT)
      .map(({ v }, rank) => ({
        videoId: v.videoId,
        title: v.title,
        channelTitle: v.channelTitle,
        thumbnail: v.thumbnail,
        duration: v.duration,
        viewCount: v.viewCount,
        reason: reasonFor(v, rank),
      }));

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
