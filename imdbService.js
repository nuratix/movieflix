// ----------------------------------------------------
// FREE IMDb API SERVICE (WEB & APK SUPPORTED)
// Fetches real IMDb Rating, Actresses/Actors with photos, Director, and Meta
// Multi-source resilient with in-memory & AsyncStorage caching
// ----------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const IMDB_CACHE_PREFIX = '@movieflix_imdb_cache_v3:';
const inMemoryCache = new Map();
const actorPhotoCache = new Map();

// Helper to route requests without CORS headers through the serverless proxy on web
function safeFetchUrl(url) {
  if (Platform.OS === 'web' && url.includes('media-imdb.com')) {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

const API_BASE = (process.env.EXPO_PUBLIC_API_BASE || (Platform.OS === 'web' ? '' : 'https://movieflix-pi-six.vercel.app')).trim().replace(/\/+$/, '');

// Clean title for search (removes year, parentheticals, S1/E1, resolution tags)
export function sanitizeTitle(rawTitle) {
  if (!rawTitle || typeof rawTitle !== 'string') return '';
  return rawTitle
    .replace(/\s*\(\d{4}\)/g, '') // remove (2024)
    .replace(/\s*\[.*?\]/g, '') // remove [Hindi]
    .replace(/\s*\(.*?\)/g, '') // remove (Hindi Dubbed)
    .replace(/\s*Season\s*\d+/gi, '')
    .replace(/\s*S\d+/gi, '')
    .replace(/\s*(4k|1080p|720p|hd|fhd|uhd|cam|web-dl|rip)/gi, '')
    .replace(/[🔥💓✨⭐]/g, '')
    .trim();
}

/**
 * Fetch portrait photo for an actor from free public APIs (TVMaze / IMDb)
 * @param {string} actorName
 * @returns {Promise<string|null>}
 */
export async function fetchActorPhoto(actorName) {
  if (!actorName || typeof actorName !== 'string') return null;
  const key = actorName.trim().toLowerCase();
  if (actorPhotoCache.has(key)) {
    return actorPhotoCache.get(key);
  }

  // 1. Try TVMaze People Search (fast & high quality)
  try {
    const res = await fetch(`https://api.tvmaze.com/search/people?q=${encodeURIComponent(actorName.trim())}`);
    if (res.ok) {
      const data = await res.json();
      const img = data?.[0]?.person?.image?.medium || data?.[0]?.person?.image?.original || null;
      if (img) {
        actorPhotoCache.set(key, img);
        return img;
      }
    }
  } catch (e) {}

  // 2. Try IMDb Suggestion Search
  try {
    const cleanQ = key.replace(/[^a-z0-9]/g, '');
    if (cleanQ) {
      const res = await fetch(safeFetchUrl(`https://v3.sg.media-imdb.com/suggestion/x/${cleanQ}.json`));
      if (res.ok) {
        const data = await res.json();
        const img = data?.d?.[0]?.i?.imageUrl || null;
        if (img) {
          actorPhotoCache.set(key, img);
          return img;
        }
      }
    }
  } catch (e) {}

  actorPhotoCache.set(key, null);
  return null;
}

/**
 * Fetch movie/show info from Free IMDb APIs with cast photos and character roles
 * @param {string} title - Movie or Series name
 * @param {string} [year] - Optional release year
 * @returns {Promise<{ rating: string|null, votes: string|null, actors: Array<{name: string, character: string, image: string|null}>, director: string|null, rated: string|null, plot: string|null, imdbId: string|null }>}
 */
export async function getImdbData(title, year = '') {
  const clean = sanitizeTitle(title);
  if (!clean) return null;

  const cacheKey = clean.toLowerCase();

  // 1. Check in-memory cache
  if (inMemoryCache.has(cacheKey)) {
    return inMemoryCache.get(cacheKey);
  }

  // 2. Check AsyncStorage cache
  try {
    const cachedStr = await AsyncStorage.getItem(`${IMDB_CACHE_PREFIX}${cacheKey}`);
    if (cachedStr) {
      const parsed = JSON.parse(cachedStr);
      inMemoryCache.set(cacheKey, parsed);
      return parsed;
    }
  } catch (e) {
    // Ignore storage read error
  }

  let finalResult = null;
  let tvMazeCast = null;

  // 3. Query TVMaze API in parallel or first for rich Cast with character roles & images
  try {
    const tvUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(clean)}&embed=cast`;
    const tvRes = await fetch(tvUrl);
    if (tvRes.ok) {
      const tvData = await tvRes.json();
      if (tvData) {
        const rawCast = tvData._embedded?.cast || [];
        if (rawCast.length > 0) {
          tvMazeCast = rawCast.map((c) => ({
            name: c.person?.name || '',
            character: c.character?.name || '',
            image: c.person?.image?.medium || c.person?.image?.original || null,
          })).filter((c) => Boolean(c.name));
        }

        finalResult = {
          rating: tvData.rating?.average ? String(tvData.rating.average) : null,
          votes: null,
          actors: tvMazeCast || [],
          director: null,
          genre: Array.isArray(tvData.genres) ? tvData.genres.join(', ') : null,
          rated: null,
          plot: tvData.summary ? tvData.summary.replace(/<[^>]+>/g, '').trim() : null,
          imdbId: tvData.externals?.imdb ? tvData.externals.imdb : null,
          year: tvData.premiered ? String(tvData.premiered).split('-')[0] : null,
          source: 'tvmaze',
        };
      }
    }
  } catch (e) {
    // Continue to OMDB
  }

  // 4. Query Server-side OMDB API Proxy (Secure server-side keys with CDN caching)
  try {
    let url = `${API_BASE}/api/imdb?t=${encodeURIComponent(clean)}`;
    if (year && String(year).length === 4) {
      url += `&y=${year}`;
    }

    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.Response === 'True') {
        const rawActorNames =
          data.Actors && data.Actors !== 'N/A'
            ? data.Actors.split(',').map((a) => a.trim()).filter(Boolean)
            : [];

        const omdbRating = data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null;
        const omdbVotes = data.imdbVotes && data.imdbVotes !== 'N/A' ? data.imdbVotes : null;
        const omdbDirector = data.Director && data.Director !== 'N/A' ? data.Director : null;
        const omdbPlot = data.Plot && data.Plot !== 'N/A' ? data.Plot : null;

        let castToUse = tvMazeCast && tvMazeCast.length > 0 ? tvMazeCast : null;
        if (!castToUse && rawActorNames.length > 0) {
          castToUse = rawActorNames.map((name) => ({
            name,
            character: '',
            image: null,
          }));
        }

        finalResult = {
          rating: omdbRating || finalResult?.rating || null,
          votes: omdbVotes || finalResult?.votes || null,
          actors: castToUse || finalResult?.actors || [],
          director: omdbDirector || finalResult?.director || null,
          genre: data.Genre && data.Genre !== 'N/A' ? data.Genre : finalResult?.genre || null,
          rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : finalResult?.rated || null,
          plot: omdbPlot || finalResult?.plot || null,
          imdbId: data.imdbID || finalResult?.imdbId || null,
          year: data.Year || finalResult?.year || null,
          source: 'imdb',
        };
      }
    }
  } catch (err) {
    // Continue to fallback
  }

  // 5. Fallback: Official IMDb suggestion API (Public, free)
  if (!finalResult || (!finalResult.rating && (!finalResult.actors || finalResult.actors.length === 0))) {
    try {
      const q = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (q) {
        const imdbUrl = safeFetchUrl(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(q)}.json`);
        const res = await fetch(imdbUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.d) && data.d.length > 0) {
            const entry = data.d.find((item) => item.qid === 'movie' || item.qid === 'tvSeries' || item.q === 'feature') || data.d[0];
            if (entry) {
              const rawStars = entry.s || '';
              const starNames = rawStars.split(',').map((a) => a.trim()).filter(Boolean);
              const suggestActors = starNames.map((name) => ({
                name,
                character: '',
                image: null,
              }));

              finalResult = {
                rating: finalResult?.rating || null,
                votes: finalResult?.votes || null,
                actors: (finalResult?.actors && finalResult.actors.length > 0) ? finalResult.actors : suggestActors,
                director: finalResult?.director || null,
                genre: finalResult?.genre || null,
                rated: finalResult?.rated || null,
                plot: finalResult?.plot || null,
                imdbId: finalResult?.imdbId || (entry.id || null),
                year: entry.y ? String(entry.y) : (finalResult?.year || null),
                source: 'imdb_suggest',
              };
            }
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  // 6. Enrich any actors missing photos (e.g. from OMDB or IMDb suggestion)
  if (finalResult && Array.isArray(finalResult.actors) && finalResult.actors.length > 0) {
    const enriched = await Promise.all(
      finalResult.actors.slice(0, 15).map(async (act) => {
        if (typeof act === 'string') {
          const img = await fetchActorPhoto(act);
          return { name: act, character: '', image: img };
        }
        if (!act.image) {
          const img = await fetchActorPhoto(act.name);
          return { ...act, image: img };
        }
        return act;
      })
    );
    finalResult.actors = enriched;
  }

  if (finalResult) {
    inMemoryCache.set(cacheKey, finalResult);
    try {
      AsyncStorage.setItem(`${IMDB_CACHE_PREFIX}${cacheKey}`, JSON.stringify(finalResult)).catch(() => {});
    } catch (e) {}
  }

  return finalResult;
}
