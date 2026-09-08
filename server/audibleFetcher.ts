/**
 * ============================================================================
 * Attribution & GPL-3.0 Licensing Notice
 * ============================================================================
 * This code is derived and adapted from Audiobookshelf:
 * Repository: https://github.com/advplyr/audiobookshelf
 * Authors: advplyr and the Audiobookshelf community
 * License: GNU General Public License v3.0 (GPL-3.0)
 *
 * WHAT WAS CHANGED AND WHY:
 * ----------------------------------------------------------------------------
 * 1. Converted the class-based `Audible` structure into a clean, standalone
 *    exportable function `fetchBookDetails({ title, author, region = 'us', timeout = 10000 })`
 *    for frictionless integration without class instantiations.
 * 2. Stripped out ALL logging (`Logger.debug`, `Logger.error`, console statements)
 *    so the module runs purely as a quiet library without polluting standard output.
 * 3. Removed all ASIN checking/validation (`isValidASIN`) entirely. The search
 *    focuses directly on searching by `title` and optional `author`.
 * 4. Added robust error handling: returns an empty array `[]` on top-level
 *    failures, timeouts, or DNS issues. Individual Audnex lookups are isolated
 *    so that a single failed ASIN won't fail the entire search batch.
 * 5. Maintained the original `cleanResult` and `cleanSeriesSequence` parsing
 *    to preserve accurate series numbering, genres, tags, and duration formatting.
 * ============================================================================
 */

import axios from 'axios';

export interface BookSeries {
  series: string;
  sequence: string;
}

export interface CleanedBookDetails {
  title: string;
  subtitle: string | null;
  author: string | null;
  narrator: string | null;
  publisher: string | null;
  publishedYear: string | null;
  description: string | null;
  cover: string | null;
  asin: string | null;
  isbn: string | null;
  genres: string[] | null;
  tags: string[] | null;
  series: BookSeries[] | null;
  language: string | null;
  duration: number; // in minutes
  region: string | null;
  rating: number | null;
  abridged: boolean;
}

export interface FetchBookDetailsOptions {
  title: string;
  author?: string;
  region?: string;
  timeout?: number;
}

export const REGION_MAP: Record<string, string> = {
  us: '.com',
  ca: '.ca',
  uk: '.co.uk',
  au: '.com.au',
  fr: '.fr',
  de: '.de',
  jp: '.co.jp',
  it: '.it',
  in: '.in',
  es: '.es',
};

/**
 * Normalizes sequence formatting from Audible (e.g. "Book 1", "2.5, Special Edition" -> "1", "2.5")
 */
export function cleanSeriesSequence(seriesName: string, sequence: string): string {
  if (!sequence) return '';
  const numberFound = sequence.match(/\.\d+|\d+(?:\.\d+)?/);
  return numberFound ? numberFound[0] : sequence;
}

/**
 * Standardizes raw metadata into the cleaned book object structure
 */
export function cleanResult(item: any): CleanedBookDetails {
  const {
    title,
    subtitle,
    asin,
    authors,
    narrators,
    publisherName,
    summary,
    releaseDate,
    image,
    genres,
    seriesPrimary,
    seriesSecondary,
    language,
    runtimeLengthMin,
    formatType,
    isbn,
  } = item || {};

  const series: BookSeries[] = [];
  if (seriesPrimary && seriesPrimary.name) {
    series.push({
      series: seriesPrimary.name,
      sequence: cleanSeriesSequence(seriesPrimary.name, seriesPrimary.position || ''),
    });
  }
  if (seriesSecondary && seriesSecondary.name) {
    series.push({
      series: seriesSecondary.name,
      sequence: cleanSeriesSequence(seriesSecondary.name, seriesSecondary.position || ''),
    });
  }

  let genresCleaned: string[] = [];
  let tagsCleaned: string[] = [];

  if (genres && Array.isArray(genres)) {
    genresCleaned = Array.from(
      new Set(genres.filter((g: any) => g && g.type === 'genre').map((g: any) => g.name))
    );
    tagsCleaned = Array.from(
      new Set(genres.filter((g: any) => g && g.type === 'tag').map((g: any) => g.name))
    );
  }

  const durationNum = Number(runtimeLengthMin);

  return {
    title: title || '',
    subtitle: subtitle || null,
    author: Array.isArray(authors) ? authors.map((a: any) => a?.name).filter(Boolean).join(', ') : null,
    narrator: Array.isArray(narrators) ? narrators.map((n: any) => n?.name).filter(Boolean).join(', ') : null,
    publisher: publisherName || null,
    publishedYear: releaseDate && typeof releaseDate === 'string' ? releaseDate.split('-')[0] : null,
    description: summary || null,
    cover: image || null,
    asin: asin || null,
    isbn: isbn || null,
    genres: genresCleaned.length > 0 ? genresCleaned : null,
    tags: tagsCleaned.length > 0 ? tagsCleaned : null,
    series: series.length > 0 ? series : null,
    language:
      typeof language === 'string' && language.length > 0
        ? language.charAt(0).toUpperCase() + language.slice(1)
        : null,
    duration: !isNaN(durationNum) && durationNum > 0 ? durationNum : 0,
    region: item?.region || null,
    rating: typeof item?.rating === 'number' ? item.rating : null,
    abridged: formatType === 'abridged',
  };
}

/**
 * Searches the Audible Catalog API and enriches each result with Audnex metadata.
 * Returns an empty array `[]` on network error, invalid input, or timeout.
 */
export async function fetchBookDetails({
  title,
  author,
  region = 'us',
  timeout = 10000,
}: FetchBookDetailsOptions): Promise<CleanedBookDetails[]> {
  if (!title || typeof title !== 'string' || !title.trim()) {
    return [];
  }

  const safeTimeout = typeof timeout === 'number' && timeout > 0 ? timeout : 10000;
  const normalizedRegion = typeof region === 'string' ? region.toLowerCase().trim() : 'us';
  const tld = REGION_MAP[normalizedRegion] || '.com';

  try {
    const queryObj: Record<string, string> = {
      num_results: '10',
      products_sort_by: 'Relevance',
      title: title.trim(),
    };
    if (author && typeof author === 'string' && author.trim()) {
      queryObj.author = author.trim();
    }

    const queryString = new URLSearchParams(queryObj).toString();
    const catalogUrl = `https://api.audible${tld}/1.0/catalog/products?${queryString}`;

    const catalogResponse = await axios.get(catalogUrl, { timeout: safeTimeout });
    const products = catalogResponse?.data?.products;

    if (!Array.isArray(products) || products.length === 0) {
      return [];
    }

    // Fetch full metadata via Audnex for each ASIN
    const bookPromises = products
      .filter((p: any) => Boolean(p?.asin))
      .map(async (product: any) => {
        try {
          const regionQuery = normalizedRegion ? `?region=${encodeURIComponent(normalizedRegion)}` : '';
          const asinUrl = `https://api.audnex.us/books/${encodeURIComponent(product.asin.toUpperCase())}${regionQuery}`;
          const res = await axios.get(asinUrl, { timeout: safeTimeout });
          return res?.data?.asin ? res.data : null;
        } catch {
          // Gracefully ignore individual lookup timeouts/errors
          return null;
        }
      });

    const audnexResults = await Promise.all(bookPromises);

    return audnexResults
      .filter(Boolean)
      .map(cleanResult)
      .filter((b) => Boolean(b && b.title));
  } catch {
    // Return empty array on failure or timeout
    return [];
  }
}

export default fetchBookDetails;

// ============================================================================
// Quick, Runnable Usage Example
// Run with: npx tsx server/audibleFetcher.ts
// ============================================================================
if (process.argv[1] && process.argv[1].endsWith('audibleFetcher.ts')) {
  (async () => {
    console.log('Running fetchBookDetails example...');
    const books = await fetchBookDetails({
      title: 'Project Hail Mary',
      author: 'Andy Weir',
      region: 'us',
      timeout: 10000,
    });

    if (books.length > 0) {
      console.log(`Found ${books.length} book(s):`);
      console.log(JSON.stringify(books[0], null, 2));
    } else {
      console.log('No books found or request timed out.');
    }
  })();
}
