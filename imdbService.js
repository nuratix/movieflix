// ----------------------------------------------------
// FREE IMDb API SERVICE (WEB & APK SUPPORTED)
// Fetches real IMDb Rating, Actresses/Actors, Director, and Meta
// Multi-source resilient with in-memory & AsyncStorage caching
// ----------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

const IMDB_CACHE_PREFIX = '@movieflix_imdb_cache_v2:';
const inMemoryCache = new Map();

// Free public OMDB keys pool
const OMDB_KEYS = ['trilogy', '2b21cd75', '852233f0'];

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
 * Fetch movie/show info from Free IMDb APIs
 * @param {string} title - Movie or Series name
 * @param {string} [year] - Optional release year
 * @returns {Promise<{ rating: string|null, votes: string|null, actors: string[], director: string|null, rated: string|null, plot: string|null, imdbId: string|null }>}
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

  // 3. Query OMDB API (Real IMDb ratings and actors)
  for (const apiKey of OMDB_KEYS) {
    try {
      let url = `https://www.omdbapi.com/?t=${encodeURIComponent(clean)}&apikey=${apiKey}`;
      if (year && String(year).length === 4) {
        url += `&y=${year}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data && data.Response === 'True') {
          const actors = data.Actors && data.Actors !== 'N/A'
            ? data.Actors.split(',').map((a) => a.trim()).filter(Boolean)
            : [];

          finalResult = {
            rating: data.imdbRating && data.imdbRating !== 'N/A' ? data.imdbRating : null,
            votes: data.imdbVotes && data.imdbVotes !== 'N/A' ? data.imdbVotes : null,
            actors: actors,
            director: data.Director && data.Director !== 'N/A' ? data.Director : null,
            genre: data.Genre && data.Genre !== 'N/A' ? data.Genre : null,
            rated: data.Rated && data.Rated !== 'N/A' ? data.Rated : null,
            plot: data.Plot && data.Plot !== 'N/A' ? data.Plot : null,
            imdbId: data.imdbID || null,
            source: 'imdb',
          };
          break;
        }
      }
    } catch (err) {
      // Try next
    }
  }

  // 4. Fallback A: TVMaze API (100% Free, no key needed, great for TV shows / series)
  if (!finalResult || !finalResult.rating || finalResult.actors.length === 0) {
    try {
      const tvUrl = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(clean)}&embed=cast`;
      const tvRes = await fetch(tvUrl);
      if (tvRes.ok) {
        const tvData = await tvRes.json();
        if (tvData) {
          const castList = (tvData._embedded?.cast || [])
            .map((c) => c.person?.name)
            .filter(Boolean)
            .slice(0, 6);

          finalResult = {
            rating: finalResult?.rating || (tvData.rating?.average ? String(tvData.rating.average) : null),
            votes: finalResult?.votes || null,
            actors: finalResult?.actors?.length ? finalResult.actors : castList,
            director: finalResult?.director || null,
            genre: finalResult?.genre || (Array.isArray(tvData.genres) ? tvData.genres.join(', ') : null),
            rated: finalResult?.rated || null,
            plot: finalResult?.plot || (tvData.summary ? tvData.summary.replace(/<[^>]+>/g, '') : null),
            imdbId: finalResult?.imdbId || (tvData.externals?.imdb ? tvData.externals.imdb : null),
            source: 'tvmaze',
          };
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  // 5. Fallback B: Official IMDb suggestion API (Public, free)
  if (!finalResult || finalResult.actors.length === 0) {
    try {
      const q = clean.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (q) {
        const imdbUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(q)}.json`;
        const res = await fetch(imdbUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.d) && data.d.length > 0) {
            const entry = data.d.find((item) => item.qid === 'movie' || item.qid === 'tvSeries' || item.q === 'feature') || data.d[0];
            if (entry) {
              const rawStars = entry.s || '';
              const actors = rawStars.split(',').map((a) => a.trim()).filter(Boolean);

              finalResult = {
                rating: finalResult?.rating || null,
                votes: finalResult?.votes || null,
                actors: finalResult?.actors?.length ? finalResult.actors : actors,
                director: finalResult?.director || null,
                genre: finalResult?.genre || null,
                rated: finalResult?.rated || null,
                plot: finalResult?.plot || null,
                imdbId: finalResult?.imdbId || (entry.id || null),
                year: entry.y ? String(entry.y) : null,
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

  if (finalResult) {
    inMemoryCache.set(cacheKey, finalResult);
    try {
      AsyncStorage.setItem(`${IMDB_CACHE_PREFIX}${cacheKey}`, JSON.stringify(finalResult)).catch(() => {});
    } catch (e) {}
  }

  return finalResult;
}
