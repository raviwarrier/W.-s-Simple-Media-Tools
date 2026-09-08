import React, { useState } from 'react';
import { AudibleFetcherState, AudibleBookResult, ModuleId } from '../../types';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  BookOpen,
  Headphones,
  Copy,
  Check,
  Globe,
  Clock,
  Calendar,
  Sparkles,
  ExternalLink,
  FileText,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Send,
  Info,
  Layers,
  AlertCircle,
} from 'lucide-react';

interface AudibleFetcherModuleProps {
  state: AudibleFetcherState;
  onChange: (updater: (prev: AudibleFetcherState) => AudibleFetcherState) => void;
  onNavigateToAudiobookTranscriber?: (bookTitle: string, authorName: string) => void;
  isDarkMode: boolean;
}

const REGION_OPTIONS = [
  { code: 'us', label: 'United States (.com)', flag: '🇺🇸' },
  { code: 'uk', label: 'United Kingdom (.co.uk)', flag: '🇬🇧' },
  { code: 'ca', label: 'Canada (.ca)', flag: '🇨🇦' },
  { code: 'au', label: 'Australia (.com.au)', flag: '🇦🇺' },
  { code: 'de', label: 'Germany (.de)', flag: '🇩🇪' },
  { code: 'fr', label: 'France (.fr)', flag: '🇫🇷' },
  { code: 'jp', label: 'Japan (.co.jp)', flag: '🇯🇵' },
  { code: 'it', label: 'Italy (.it)', flag: '🇮🇹' },
  { code: 'in', label: 'India (.in)', flag: '🇮🇳' },
  { code: 'es', label: 'Spain (.es)', flag: '🇪🇸' },
];

const PRESET_SEARCHES = [
  { title: 'God Delusion', author: 'Richard Dawkins' },
  { title: 'Guns, Germs and Steel', author: 'Jared Diamond' },
  { title: 'The Holographic Universe', author: 'Michael Talbot' },
  { title: 'The Invention of Yesterday', author: 'Tamim Ansary' },
];

export const AudibleFetcherModule: React.FC<AudibleFetcherModuleProps> = ({
  state,
  onChange,
  onNavigateToAudiobookTranscriber,
  isDarkMode,
}) => {
  const { showToast } = useToast();
  const [copiedAsin, setCopiedAsin] = useState<string | null>(null);
  const [copiedJsonIdx, setCopiedJsonIdx] = useState<number | null>(null);
  const [copiedDetailsIdx, setCopiedDetailsIdx] = useState<number | null>(null);
  const [copiedFieldKey, setCopiedFieldKey] = useState<string | null>(null);
  const [copiedAllJson, setCopiedAllJson] = useState(false);
  const [copiedAllText, setCopiedAllText] = useState(false);
  const [expandedDescIdx, setExpandedDescIdx] = useState<number | null>(null);
  const [showMp3tagViewer, setShowMp3tagViewer] = useState(false);
  const [copiedMp3tagScript, setCopiedMp3tagScript] = useState(false);

  const formatDuration = (mins: number) => {
    if (!mins || isNaN(mins)) return 'Unknown duration';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} mins`;
    if (m === 0) return `${h} hrs`;
    return `${h} hrs ${m} mins`;
  };

  const handleCopyField = (key: string, label: string, value: string | null | undefined) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedFieldKey(key);
    showToast({
      type: 'info',
      title: `${label} Copied`,
      message: `Copied ${label.toLowerCase()}: "${value.length > 40 ? value.slice(0, 37) + '...' : value}"`,
      duration: 2500,
    });
    setTimeout(() => setCopiedFieldKey((prev) => (prev === key ? null : prev)), 2000);
  };

  const handleCopyAllBookDetails = (book: AudibleBookResult, index: number) => {
    const cleanDesc = book.description
      ? book.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : 'N/A';
    const genresStr = book.genres && book.genres.length > 0 ? book.genres.join(', ') : 'N/A';

    const lines = [
      `Title: ${book.title || 'N/A'}`,
      book.subtitle ? `Subtitle: ${book.subtitle}` : null,
      `Author: ${book.author || 'N/A'}`,
      `Narrator: ${book.narrator || 'N/A'}`,
      `Year: ${book.publishedYear || 'N/A'}`,
      `Duration: ${formatDuration(book.duration)}`,
      `ASIN: ${book.asin || 'N/A'}`,
      `ISBN: ${book.isbn || 'N/A'}`,
      `Genres: ${genresStr}`,
      `Image Link: ${book.cover || 'N/A'}`,
      `Publisher: ${book.publisher || 'N/A'}`,
      `Description: ${cleanDesc}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedDetailsIdx(index);
    showToast({
      type: 'info',
      title: 'All Book Details Copied',
      message: `Copied formatted details for "${book.title}".`,
      duration: 3000,
    });
    setTimeout(() => setCopiedDetailsIdx(null), 2000);
  };

  const handleCopyAllResultsText = () => {
    if (state.results.length === 0) return;
    const allFormatted = state.results
      .map((book, i) => {
        const cleanDesc = book.description
          ? book.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : 'N/A';
        const genresStr = book.genres && book.genres.length > 0 ? book.genres.join(', ') : 'N/A';
        return [
          `[Book ${i + 1}]`,
          `Title: ${book.title || 'N/A'}`,
          book.subtitle ? `Subtitle: ${book.subtitle}` : null,
          `Author: ${book.author || 'N/A'}`,
          `Narrator: ${book.narrator || 'N/A'}`,
          `Year: ${book.publishedYear || 'N/A'}`,
          `Duration: ${formatDuration(book.duration)}`,
          `ASIN: ${book.asin || 'N/A'}`,
          `ISBN: ${book.isbn || 'N/A'}`,
          `Genres: ${genresStr}`,
          `Image Link: ${book.cover || 'N/A'}`,
          `Publisher: ${book.publisher || 'N/A'}`,
          `Description: ${cleanDesc}`,
        ]
          .filter(Boolean)
          .join('\n');
      })
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(allFormatted);
    setCopiedAllText(true);
    showToast({
      type: 'info',
      title: 'All Details Copied (Text)',
      message: `Copied ${state.results.length} book details as structured text.`,
      duration: 3500,
    });
    setTimeout(() => setCopiedAllText(false), 2000);
  };

  const handleSearch = async (titleToSearch?: string, authorToSearch?: string) => {
    const title = (titleToSearch !== undefined ? titleToSearch : state.title).trim();
    const author = (authorToSearch !== undefined ? authorToSearch : state.author).trim();

    if (!title) {
      onChange((prev) => ({
        ...prev,
        errorMessage: 'Please enter a book or audiobook title to search.',
      }));
      return;
    }

    onChange((prev) => ({
      ...prev,
      title,
      author,
      isSearching: true,
      errorMessage: null,
    }));

    try {
      const response = await fetch('/api/audible-fetcher/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          author: author || undefined,
          region: state.region || 'us',
          timeout: state.timeout || 10000,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to search Audible catalog');
      }

      const books: AudibleBookResult[] = data.books || [];

      onChange((prev) => ({
        ...prev,
        results: books,
        isSearching: false,
        hasSearched: true,
        errorMessage: books.length === 0 ? 'No matching audiobooks found in the Audible catalog.' : null,
      }));

      if (books.length > 0) {
        showToast({
          type: 'success',
          title: 'Audible Search Complete',
          message: `Fetched ${books.length} book details via Audible & Audnex.`,
          duration: 4000,
        });
      }
    } catch (err: any) {
      onChange((prev) => ({
        ...prev,
        isSearching: false,
        hasSearched: true,
        errorMessage: err.message || 'Network request failed',
      }));
      showToast({
        type: 'error',
        title: 'Search Failed',
        message: err.message || 'Failed to query Audible catalog.',
        duration: 5000,
      });
    }
  };

  const handleCopyAsin = (asin: string) => {
    navigator.clipboard.writeText(asin);
    setCopiedAsin(asin);
    showToast({
      type: 'info',
      title: 'ASIN Copied',
      message: `Copied ASIN: ${asin}`,
      duration: 3000,
    });
    setTimeout(() => setCopiedAsin(null), 2000);
  };

  const handleCopyBookJson = (book: AudibleBookResult, index: number) => {
    navigator.clipboard.writeText(JSON.stringify(book, null, 2));
    setCopiedJsonIdx(index);
    showToast({
      type: 'info',
      title: 'Metadata Copied',
      message: `Copied JSON metadata for "${book.title}"`,
      duration: 3000,
    });
    setTimeout(() => setCopiedJsonIdx(null), 2000);
  };

  const handleCopyAllResults = () => {
    if (state.results.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify(state.results, null, 2));
    setCopiedAllJson(true);
    showToast({
      type: 'info',
      title: 'All Results Copied',
      message: `Copied ${state.results.length} book details as formatted JSON.`,
      duration: 3500,
    });
    setTimeout(() => setCopiedAllJson(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Module Banner / Header */}
      <div
        className={`p-5 rounded-lg border transition-all ${
          isDarkMode
            ? 'bg-[#181818] border-[#2c2c2c] text-neutral-200'
            : 'bg-white border-[#e5e5e5] text-neutral-900 shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`p-2.5 rounded-lg ${
                isDarkMode ? 'bg-[#222222] text-[#f3e79a]' : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight">Audible Book Details Fetcher</h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                    isDarkMode
                      ? 'bg-[#242424] border-[#383838] text-[#f3e79a]'
                      : 'bg-amber-50 border-amber-300 text-amber-900'
                  }`}
                >
                  GPL-3.0 Audiobookshelf
                </span>
              </div>
              <p className={`text-xs mt-1 leading-relaxed ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Query the Audible Catalog API and enrich with full Audnex metadata (authors, narrators, duration,
                series, ISBN, tags & covers).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Search Input Controls */}
      <div
        className={`p-5 rounded-lg border transition-all ${
          isDarkMode
            ? 'bg-[#181818] border-[#2c2c2c] text-neutral-200'
            : 'bg-white border-[#e5e5e5] text-neutral-900 shadow-xs'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Title Input */}
          <div className="md:col-span-5 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <span>Book Title</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="input-audible-title"
                placeholder="e.g. Project Hail Mary, Dune, Atomic Habits..."
                value={state.title}
                onChange={(e) => onChange((prev) => ({ ...prev, title: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className={`w-full text-xs px-3 py-2 rounded border focus:outline-hidden transition-colors ${
                  isDarkMode
                    ? 'bg-[#111111] border-[#333333] text-neutral-100 focus:border-[#f3e79a]'
                    : 'bg-[#fafafa] border-[#d4d4d8] text-neutral-900 focus:border-[#ca8a04]'
                }`}
              />
            </div>
          </div>

          {/* Author Input */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Author (Optional)
            </label>
            <input
              type="text"
              id="input-audible-author"
              placeholder="e.g. Andy Weir"
              value={state.author}
              onChange={(e) => onChange((prev) => ({ ...prev, author: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              className={`w-full text-xs px-3 py-2 rounded border focus:outline-hidden transition-colors ${
                isDarkMode
                  ? 'bg-[#111111] border-[#333333] text-neutral-100 focus:border-[#f3e79a]'
                  : 'bg-[#fafafa] border-[#d4d4d8] text-neutral-900 focus:border-[#ca8a04]'
              }`}
            />
          </div>

          {/* Region Select */}
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Region
            </label>
            <select
              id="select-audible-region"
              value={state.region || 'us'}
              onChange={(e) => onChange((prev) => ({ ...prev, region: e.target.value }))}
              className={`w-full text-xs px-2.5 py-2 rounded border focus:outline-hidden transition-colors ${
                isDarkMode
                  ? 'bg-[#111111] border-[#333333] text-neutral-100 focus:border-[#f3e79a]'
                  : 'bg-[#fafafa] border-[#d4d4d8] text-neutral-900 focus:border-[#ca8a04]'
              }`}
            >
              {REGION_OPTIONS.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.flag} {r.code.toUpperCase()} ({r.label.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <div className="md:col-span-2 flex items-end">
            <button
              type="button"
              id="btn-audible-search"
              disabled={state.isSearching}
              onClick={() => handleSearch()}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-colors disabled:opacity-50 ${
                isDarkMode
                  ? 'bg-[#f3e79a] text-black hover:bg-[#e4d683]'
                  : 'bg-[#1a1a1a] text-white hover:bg-black'
              }`}
            >
              {state.isSearching ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Suggestions & Settings */}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[11px] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Try:
            </span>
            {PRESET_SEARCHES.map((preset) => (
              <button
                key={preset.title}
                type="button"
                title={`${preset.title} by ${preset.author}`}
                onClick={() => {
                  onChange((prev) => ({
                    ...prev,
                    title: preset.title,
                    author: preset.author,
                  }));
                  handleSearch(preset.title, preset.author);
                }}
                className={`text-[11px] px-2 py-0.5 rounded border transition-colors ${
                  isDarkMode
                    ? 'bg-[#202020] border-[#303030] text-neutral-300 hover:text-white hover:bg-[#282828]'
                    : 'bg-[#f4f4f5] border-[#e4e4e7] text-neutral-700 hover:text-black hover:bg-[#e4e4e7]'
                }`}
              >
                {preset.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-[11px] ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Timeout:
            </span>
            <select
              value={state.timeout || 10000}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, timeout: parseInt(e.target.value, 10) }))
              }
              className={`text-[11px] px-1.5 py-0.5 rounded border ${
                isDarkMode
                  ? 'bg-[#111111] border-[#333333] text-neutral-300'
                  : 'bg-white border-[#d4d4d8] text-neutral-700'
              }`}
            >
              <option value={5000}>5 sec</option>
              <option value={10000}>10 sec (default)</option>
              <option value={20000}>20 sec</option>
            </select>
          </div>
        </div>

        {/* Error Notice */}
        {state.errorMessage && (
          <div
            className={`mt-3 p-3 rounded text-xs flex items-center gap-2 border ${
              isDarkMode
                ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{state.errorMessage}</span>
          </div>
        )}
      </div>

      {/* Results Section */}
      {state.hasSearched && (
        <div className="space-y-4">
          {/* Results Summary Bar */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                Audible Catalog Results ({state.results.length})
              </h3>
              {state.results.length > 0 && (
                <span
                  className={`text-[11px] font-mono px-2 py-0.2 rounded border ${
                    isDarkMode
                      ? 'bg-[#222222] border-[#333333] text-[#f3e79a]'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}
                >
                  {state.region.toUpperCase()} Store
                </span>
              )}
            </div>

            {state.results.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyAllResultsText}
                  id="btn-copy-all-audible-text"
                  title="Copy all fetched book details as structured text"
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    copiedAllText
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isDarkMode
                      ? 'bg-[#1f1f1f] border-[#333333] text-neutral-300 hover:bg-[#282828]'
                      : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                  }`}
                >
                  {copiedAllText ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FileText className="w-3.5 h-3.5" />}
                  <span>{copiedAllText ? 'All Text Copied!' : 'Copy All (Text)'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyAllResults}
                  id="btn-copy-all-audible-results"
                  title="Copy all fetched books as JSON array"
                  className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-colors ${
                    copiedAllJson
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : isDarkMode
                      ? 'bg-[#1f1f1f] border-[#333333] text-neutral-300 hover:bg-[#282828]'
                      : 'bg-white border-[#d4d4d8] text-neutral-700 hover:bg-[#f4f4f5]'
                  }`}
                >
                  {copiedAllJson ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedAllJson ? 'All JSON Copied!' : 'Copy All (JSON)'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Cards List */}
          {state.results.length === 0 ? (
            <div
              className={`p-10 rounded-lg border text-center transition-all ${
                isDarkMode
                  ? 'bg-[#181818] border-[#2c2c2c] text-neutral-400'
                  : 'bg-white border-[#e5e5e5] text-neutral-500 shadow-xs'
              }`}
            >
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No results found for &ldquo;{state.title}&rdquo;</p>
              <p className="text-xs mt-1 max-w-sm mx-auto">
                Audible may index this title differently or it may be listed under another regional catalog (e.g. UK, Canada).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {state.results.map((book, index) => {
                const isDescExpanded = expandedDescIdx === index;
                const cleanDesc = book.description
                  ? book.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                  : null;

                return (
                  <div
                    key={book.asin || `${book.title}-${index}`}
                    className={`p-5 rounded-lg border transition-all ${
                      isDarkMode
                        ? 'bg-[#181818] border-[#2c2c2c] hover:border-[#3d3d3d]'
                        : 'bg-white border-[#e5e5e5] hover:border-neutral-300 shadow-xs'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-5">
                      {/* Cover Thumbnail & Image Link Copy */}
                      <div className="shrink-0 flex sm:flex-col items-center gap-2 w-24 sm:w-28 relative">
                        {book.cover ? (
                          <div className="relative group/cover z-10 hover:z-50">
                            <img
                              src={book.cover}
                              alt={book.title}
                              referrerPolicy="no-referrer"
                              className="w-24 h-24 sm:w-28 sm:h-28 object-cover rounded shadow-md border border-black/10 transition-transform duration-300 ease-out hover:scale-[2.1] hover:shadow-2xl hover:rounded-md origin-top-left cursor-zoom-in"
                            />
                          </div>
                        ) : (
                          <div
                            className={`w-24 h-24 sm:w-28 sm:h-28 rounded flex flex-col items-center justify-center border ${
                              isDarkMode
                                ? 'bg-[#222222] border-[#333333] text-neutral-500'
                                : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-400'
                            }`}
                          >
                            <BookOpen className="w-8 h-8 mb-1" />
                            <span className="text-[10px] font-mono">No Cover</span>
                          </div>
                        )}

                        {book.cover && (
                          <button
                            type="button"
                            onClick={() => handleCopyField(`${index}-cover`, 'Image Link', book.cover)}
                            title="Copy cover image direct URL"
                            className={`w-full flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[10px] font-mono border transition-colors ${
                              copiedFieldKey === `${index}-cover`
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                : isDarkMode
                                ? 'bg-[#202020] border-[#333333] text-neutral-300 hover:text-white hover:border-[#444444]'
                                : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:text-black hover:border-neutral-300'
                            }`}
                          >
                            {copiedFieldKey === `${index}-cover` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Copied Link</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 opacity-60" />
                                <span>Copy Image Link</span>
                              </>
                            )}
                          </button>
                        )}

                        {book.abridged ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border font-mono bg-rose-500/10 border-rose-500/30 text-rose-400">
                            Abridged
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded border font-mono bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                            Unabridged
                          </span>
                        )}
                      </div>

                      {/* Main Details */}
                      <div className="flex-1 min-w-0 space-y-2.5">
                        {/* Title & Subtitle & Quick Copy Actions */}
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <h4 className="text-base font-semibold leading-snug tracking-tight">
                                {book.title}
                              </h4>
                              <button
                                type="button"
                                title="Copy book title"
                                onClick={() => handleCopyField(`${index}-title`, 'Title', book.title)}
                                className={`p-1 rounded border transition-colors shrink-0 mt-0.5 ${
                                  copiedFieldKey === `${index}-title`
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : isDarkMode
                                    ? 'bg-[#202020] border-[#333333] text-neutral-400 hover:text-white'
                                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-600 hover:text-black'
                                }`}
                              >
                                {copiedFieldKey === `${index}-title` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                title="Copy all details as structured text"
                                onClick={() => handleCopyAllBookDetails(book, index)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                                  copiedDetailsIdx === index
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : isDarkMode
                                    ? 'bg-[#202020] border-[#333333] text-neutral-300 hover:text-white'
                                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-700 hover:text-black'
                                }`}
                              >
                                {copiedDetailsIdx === index ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Details Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 opacity-60" />
                                    <span>Copy All Details</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                title="Copy single book metadata JSON"
                                onClick={() => handleCopyBookJson(book, index)}
                                className={`p-1.5 rounded border transition-colors ${
                                  copiedJsonIdx === index
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : isDarkMode
                                    ? 'bg-[#202020] border-[#333333] text-neutral-400 hover:text-white'
                                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-600 hover:text-black'
                                }`}
                              >
                                {copiedJsonIdx === index ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                          {book.subtitle && (
                            <p className={`text-xs mt-0.5 italic ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}>
                              {book.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Author, Narrator & Series */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {book.author && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>
                                Author:
                              </span>
                              <span className="font-medium">{book.author}</span>
                              <button
                                type="button"
                                title="Copy author name"
                                onClick={() => handleCopyField(`${index}-author`, 'Author', book.author)}
                                className={`p-0.5 px-1.5 rounded border text-[10px] inline-flex items-center gap-0.5 transition-colors ${
                                  copiedFieldKey === `${index}-author`
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : isDarkMode
                                    ? 'bg-[#202020] border-[#333333] text-neutral-400 hover:text-white'
                                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-600 hover:text-black'
                                }`}
                              >
                                {copiedFieldKey === `${index}-author` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 opacity-60" />
                                )}
                              </button>
                            </div>
                          )}
                          {book.narrator && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>
                                Narrator:
                              </span>
                              <span className="font-medium truncate max-w-[200px]">{book.narrator}</span>
                              <button
                                type="button"
                                title="Copy narrator name"
                                onClick={() => handleCopyField(`${index}-narrator`, 'Narrator', book.narrator)}
                                className={`p-0.5 px-1.5 rounded border text-[10px] inline-flex items-center gap-0.5 transition-colors shrink-0 ${
                                  copiedFieldKey === `${index}-narrator`
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : isDarkMode
                                    ? 'bg-[#202020] border-[#333333] text-neutral-400 hover:text-white'
                                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-600 hover:text-black'
                                }`}
                              >
                                {copiedFieldKey === `${index}-narrator` ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5 opacity-60" />
                                )}
                              </button>
                            </div>
                          )}
                          {book.series && book.series.length > 0 && (
                            <div className="sm:col-span-2 flex items-center gap-1.5 flex-wrap">
                              <span className={isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}>
                                Series:
                              </span>
                              {book.series.map((s, si) => (
                                <span
                                  key={si}
                                  className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                                    isDarkMode
                                      ? 'bg-[#222222] border-[#333333] text-[#f3e79a]'
                                      : 'bg-amber-50 border-amber-200 text-amber-900'
                                  }`}
                                >
                                  {s.series} {s.sequence ? `#${s.sequence}` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Metadata Pills (Duration, Year, Publisher, ASIN, ISBN) */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                          <div
                            className={`flex items-center gap-1 px-2 py-1 rounded border font-mono text-[11px] ${
                              isDarkMode
                                ? 'bg-[#202020] border-[#333333] text-neutral-300'
                                : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                            }`}
                          >
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span>{formatDuration(book.duration)}</span>
                          </div>

                          {book.publishedYear && (
                            <button
                              type="button"
                              onClick={() => handleCopyField(`${index}-year`, 'Year', book.publishedYear)}
                              title="Click to copy published year"
                              className={`flex items-center gap-1 px-2 py-1 rounded border font-mono text-[11px] transition-colors ${
                                copiedFieldKey === `${index}-year`
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                  : isDarkMode
                                  ? 'bg-[#202020] border-[#333333] text-neutral-300 hover:border-neutral-400'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              <Calendar className="w-3 h-3 opacity-60" />
                              <span>{book.publishedYear}</span>
                              {copiedFieldKey === `${index}-year` ? (
                                <Check className="w-3 h-3 text-emerald-400 ml-0.5" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-50 ml-0.5" />
                              )}
                            </button>
                          )}

                          {book.asin && (
                            <button
                              type="button"
                              onClick={() => handleCopyField(`${index}-asin`, 'ASIN', book.asin)}
                              title="Click to copy ASIN"
                              className={`flex items-center gap-1 px-2 py-1 rounded border font-mono text-[11px] transition-colors ${
                                copiedFieldKey === `${index}-asin`
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                  : isDarkMode
                                  ? 'bg-[#202020] border-[#333333] text-neutral-300 hover:border-neutral-400'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              <span className="opacity-60">ASIN:</span>
                              <span className="font-semibold">{book.asin}</span>
                              {copiedFieldKey === `${index}-asin` ? (
                                <Check className="w-3 h-3 text-emerald-400 ml-0.5" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-50 ml-0.5" />
                              )}
                            </button>
                          )}

                          {book.isbn && (
                            <button
                              type="button"
                              onClick={() => handleCopyField(`${index}-isbn`, 'ISBN', book.isbn)}
                              title="Click to copy ISBN"
                              className={`flex items-center gap-1 px-2 py-1 rounded border font-mono text-[11px] transition-colors ${
                                copiedFieldKey === `${index}-isbn`
                                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                  : isDarkMode
                                  ? 'bg-[#202020] border-[#333333] text-neutral-300 hover:border-neutral-400'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:border-neutral-400'
                              }`}
                            >
                              <span className="opacity-60">ISBN:</span>
                              <span className="font-semibold">{book.isbn}</span>
                              {copiedFieldKey === `${index}-isbn` ? (
                                <Check className="w-3 h-3 text-emerald-400 ml-0.5" />
                              ) : (
                                <Copy className="w-3 h-3 opacity-50 ml-0.5" />
                              )}
                            </button>
                          )}

                          {book.publisher && (
                            <div
                              className={`px-2 py-1 rounded border text-[11px] truncate max-w-xs ${
                                isDarkMode
                                  ? 'bg-[#202020] border-[#333333] text-neutral-400'
                                  : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                              }`}
                            >
                              {book.publisher}
                            </div>
                          )}
                        </div>

                        {/* Genres & Tags */}
                        {((book.genres && book.genres.length > 0) || (book.tags && book.tags.length > 0)) && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            {book.genres && book.genres.length > 0 && (
                              <>
                                <span className={`text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                  Genres:
                                </span>
                                {book.genres.slice(0, 4).map((g, gi) => (
                                  <span
                                    key={gi}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                      isDarkMode
                                        ? 'bg-[#262626] border-[#383838] text-neutral-300'
                                        : 'bg-neutral-100 border-neutral-200 text-neutral-700'
                                    }`}
                                  >
                                    {g}
                                  </span>
                                ))}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyField(
                                      `${index}-genres`,
                                      'Genres (comma-delimited)',
                                      book.genres!.join(', ')
                                    )
                                  }
                                  title="Copy genres as comma-delimited string (e.g. Science Fiction, Audiobooks)"
                                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${
                                    copiedFieldKey === `${index}-genres`
                                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                      : isDarkMode
                                      ? 'bg-[#202020] border-[#383838] text-neutral-300 hover:text-white hover:border-[#444444]'
                                      : 'bg-white border-[#d4d4d8] text-neutral-700 hover:text-black hover:border-neutral-400'
                                  }`}
                                >
                                  {copiedFieldKey === `${index}-genres` ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span>Copied CSV</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 opacity-60" />
                                      <span>Copy Genres (CSV)</span>
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                            {book.tags?.slice(0, 3).map((t, ti) => (
                              <span
                                key={ti}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                  isDarkMode
                                    ? 'bg-[#202020] border-[#2e2e2e] text-neutral-400'
                                    : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                                }`}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Description */}
                        {cleanDesc && (
                          <div className="pt-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className={`text-[11px] font-medium ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                                Description
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyField(`${index}-desc`, 'Description', cleanDesc)}
                                title="Copy book description text"
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border font-medium transition-colors ${
                                  copiedFieldKey === `${index}-desc`
                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                                    : isDarkMode
                                    ? 'bg-[#202020] border-[#383838] text-neutral-300 hover:text-white'
                                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-600 hover:text-black'
                                }`}
                              >
                                {copiedFieldKey === `${index}-desc` ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span>Description Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 opacity-60" />
                                    <span>Copy Description</span>
                                  </>
                                )}
                              </button>
                            </div>
                            <p
                              className={`text-xs leading-relaxed ${
                                isDescExpanded ? '' : 'line-clamp-2'
                              } ${isDarkMode ? 'text-neutral-400' : 'text-neutral-600'}`}
                            >
                              {cleanDesc}
                            </p>
                            {cleanDesc.length > 180 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedDescIdx(isDescExpanded ? null : index)
                                }
                                className={`text-[11px] font-medium mt-1 flex items-center gap-0.5 ${
                                  isDarkMode ? 'text-[#f3e79a] hover:underline' : 'text-amber-800 hover:underline'
                                }`}
                              >
                                {isDescExpanded ? (
                                  <>
                                    <span>Show less</span>
                                    <ChevronUp className="w-3 h-3" />
                                  </>
                                ) : (
                                  <>
                                    <span>Read full description</span>
                                    <ChevronDown className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div
                          className={`pt-2.5 mt-2 border-t flex flex-wrap items-center justify-between gap-2 ${
                            isDarkMode ? 'border-[#262626]' : 'border-[#f0f0f0]'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            {onNavigateToAudiobookTranscriber && (
                              <button
                                type="button"
                                onClick={() => {
                                  onNavigateToAudiobookTranscriber(
                                    book.title,
                                    book.author || 'Unknown Author'
                                  );
                                  showToast({
                                    type: 'info',
                                    title: 'Sent to Audiobook Transcriber',
                                    message: `Transcriber title set to "${book.title}" by ${book.author || 'Unknown'}.`,
                                    duration: 4000,
                                  });
                                }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
                                  isDarkMode
                                    ? 'bg-[#222222] border-[#383838] text-[#f3e79a] hover:bg-[#2a2a2a]'
                                    : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                                }`}
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Send to Audiobook Transcriber</span>
                              </button>
                            )}

                            {book.asin && (
                              <a
                                href={`https://www.audible.${REGION_OPTIONS.find((r) => r.code === state.region)?.code === 'us' ? 'com' : state.region}/pd/${book.asin}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs border transition-colors ${
                                  isDarkMode
                                    ? 'bg-[#202020] border-[#333333] text-neutral-300 hover:text-white'
                                    : 'bg-[#f4f4f5] border-[#d4d4d8] text-neutral-700 hover:text-black'
                                }`}
                              >
                                <span>Audible Store</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          <div className="text-[11px] font-mono text-neutral-500">
                            Audnex ID: {book.asin}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Attribution Footer */}
      <div
        className={`p-4 rounded-lg border text-xs leading-relaxed flex items-start gap-3 ${
          isDarkMode
            ? 'bg-[#141414] border-[#262626] text-neutral-400'
            : 'bg-[#fafafa] border-[#e5e5e5] text-neutral-600'
        }`}
      >
        <Info className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>Attribution & Open-Source Licensing:</strong> This module is adapted from the{' '}
            <a
              href="https://github.com/advplyr/audiobookshelf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#f3e79a] underline font-medium"
            >
              advplyr/audiobookshelf
            </a>{' '}
            project under the <strong>GNU General Public License v3.0 (GPL-3.0)</strong>.
          </p>
          <p className="text-[11px] opacity-80">
            Modifications include standalone functional refactoring, removal of background loggers, title/author-only
            search querying, and zero-retention in-memory payload rendering.
          </p>
        </div>
      </div>
    </div>
  );
};
