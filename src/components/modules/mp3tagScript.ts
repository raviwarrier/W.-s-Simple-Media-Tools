export const MP3TAG_SRC_CODE = `#######################################################################
# Release Notes
# v2026-09-08
# - Enhanced with Audible/Audnex logic parity from Simple Media Tools:
#   * Added SUBTITLE extraction (from data-test="product-subtitle" or subtitleLabel).
#   * Added TITLE (mirrors ALBUM for standard tag players).
#   * Added ARTIST (mirrors ALBUMARTIST for universal player/library support).
#   * Added SERIES and SERIES-PART (clean numeric extraction from seriesLabel).
#   * Added NARRATOR tag (mirrors COMPOSER for Audiobookshelf, Plex, and Smart AudioBook).
#   * Added GENRE extraction (from categoriesLabel multi-genre list).
#   * Added ISBN extraction (from JSON-LD or page text).
#   * Enhanced COVERURL to strip Amazon CDN thumbnail limits (._SL500_ -> full high-res).
#   * Added DESCRIPTION tag (mirrors COMMENT for podcast/audiobook readers).
#   * Preserved rock-solid index search and robust cleanups.
#######################################################################

[Name]=Audible.com#Search by Album
[BasedOn]=https://www.audible.com
[Encoding]=utf-8
[UserAgent]=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36
[WordSeparator]=+
[Timeout]=20

# Search fields (Mp3tag requires the double "||" separator)
[SearchBy]=Album||%album%||keywords=%s
[SearchBy]=ASIN||%asin%||keywords=%s
[SearchBy]=Album + Author||%album% %artist%||keywords=%s

# Search and detail URLs
[IndexUrl]=https://www.audible.com/search?ipRedirectOverride=true&overrideBaseCountry=true&language=en_US&keywords=%s
[AlbumUrl]=%_url%

# Columns in the search dialog
[IndexFormat]=%_url%|%ALBUM%|%ALBUMARTIST%|%ASIN%|%DURATION%|%YEAR%|%LANGUAGE%

#######################################################################
# I N D E X
#######################################################################
[ParserScriptIndex]
gotoline 1
unspace
findline "aria-label=\\"Search results\\"" 1 1
if "aria-label=\\"Search results\\""
\tjoinuntil "</main>"
endif

regexpreplace "\\s\\s+" " "
replace "> <" "><"

set "i" "0"
while "<a href=\\"/pd/" 200
\tfindinline "href=\\"/pd/"
\tif "href=\\"/pd/"
\t\tmovechar 6
\t\toutputto "_url"
\t\tsay "https://www.audible.com/pd/"
\t\tsayuntil "\\""

\t\tmoveline 0
\t\tjoinuntil "</li>"
\t\toutputto "_block"
\t\tsayrest

\t\toutputto "ASIN"
\t\tsayoutput "_block"
\t\tSayRegexp "(?i)(?<=data-asin=\\")[A-Z0-9]{10}"

\t\toutputto "ALBUM"
\t\tsayoutput "_block"
\t\tSayRegexp "(?<=aria-hidden=\\"true\\">)[^<]+(?=<)"
\t\tifnotregexp "(?<=aria-hidden=\\"true\\">)[^<]+(?=<)"
\t\t\toutputto "ALBUM"
\t\t\tsayoutput "_block"
\t\t\tSayRegexp "(?<=alt=\\")[^\\"]+(?=\\")"
\t\t\tifnotregexp "(?<=alt=\\")[^\\"]+(?=\\")"
\t\t\t\toutputto "ALBUM"
\t\t\t\tsayoutput "_block"
\t\t\t\tSayRegexp "(?<=title=\\")[^\\"]+(?=\\")"
\t\t\tendif
\t\tendif

\t\toutputto "ALBUMARTIST"
\t\tsayoutput "_block"
\t\tSayRegexp "(?<=authorLabel.*?>).*?(?=</li>)"
\t\tregexpreplace "</?[^><]+>" ""
\t\tunspace
\t\tregexpreplace "  +" " "
\t\tregexpreplace "^.*By:\\\\s*" ""
\t\tregexpreplace "\\\\s*Narrated by:.*$" ""

\t\toutputto "DURATION"
\t\tsayoutput "_block"
\t\tSayRegexp "(?<=runtimeLabel.*?bc-color-secondary\\">)[^<]+"

\t\toutputto "YEAR"
\t\tsayoutput "_block"
\t\tSayRegexp "(?<=Release date:.*?>).*?(?=<)"
\t\tregexpreplace ".*?(\\\\d{4}).*" "$1"

\t\toutputto "LANGUAGE"
\t\tsayoutput "_block"
\t\tSayRegexp "(?<=languageLabel.*?>)[^<]+"

\t\toutputto ""
\t\tsayoutput "_url"
\t\tsay "|"
\t\tsayoutput "ALBUM"
\t\tsay "|"
\t\tsayoutput "ALBUMARTIST"
\t\tsay "|"
\t\tsayoutput "ASIN"
\t\tsay "|"
\t\tsayoutput "DURATION"
\t\tsay "|"
\t\tsayoutput "YEAR"
\t\tsay "|"
\t\tsayoutput "LANGUAGE"
\t\tsaynewline
\telse
\t\tbreak
\tendif
endwhile

#######################################################################
# A L B U M
#######################################################################
[ParserScriptAlbum]
gotoline 1
unspace
regexpreplace "\\s\\s+" " "
replace "> <" "><"

# ----- Title
outputto "ALBUM"
findline "data-test=\\"product-title\\"" 1 1
if "data-test=\\"product-title\\""
\tfindinline ">"
\tsayuntil "<"
else
\tgotoline 1
\tfindline "<h1" 1 1
\tfindinline ">"
\tsayuntil "<"
endif

# Also set TITLE to match ALBUM
outputto "TITLE"
sayoutput "ALBUM"

# ----- Subtitle
outputto "SUBTITLE"
gotoline 1
findline "data-test=\\"product-subtitle\\"" 1 1
if "data-test=\\"product-subtitle\\""
\tfindinline ">"
\tsayuntil "<"
else
\tgotoline 1
\tfindline "subtitleLabel" 1 1
\tif "subtitleLabel"
\t\tfindinline ">"
\t\tsayuntil "<"
\telse
\t\tsay ""
\tendif
endif

# ----- Albumartist (Authors)
outputto "ALBUMARTIST"
gotoline 1
findline "authorLabel" 1 1
if "authorLabel"
\tmoveline 3 1
\tjoinuntil "</li>"
\tregexpreplace "</?[^><]+>" ""
\tunspace
\tregexpreplace "  +" " "
\tregexpreplace "^.*By:\\\\s*" ""
\tregexpreplace "\\\\s*Narrated by:.*$" ""
\tsayrest
else
\tgotoline 1
\tfindline ">By " 1 1
\tif ">By "
\t\tfindinline ">By "
\t\tsayuntil "<"
\t\tregexpreplace "\\\\s*Narrated by:.*$" ""
\telse
\t\tsay ""
\tendif
endif

# Standard ARTIST tag
outputto "ARTIST"
sayoutput "ALBUMARTIST"

# ----- ASIN
outputto "ASIN"
gotoline 1
findline "data-asin=\\"" 1 1
if "data-asin=\\""
\tSayRegexp "(?i)(?<=data-asin=\\")[A-Z0-9]{10}"
else
\tgotoline 1
\tfindline "\\"asin\\":" 1 1
\tif "\\"asin\\":"
\t\tSayRegexp "(?i)(?<=\\\\"asin\\\\":\\\\")[A-Z0-9]{10}"
\telse
\t\tsay ""
\tendif
endif

# ----- Series & Series-Part
outputto "SERIES"
gotoline 1
findline "seriesLabel" 1 1
if "seriesLabel"
\tmoveline 3 1
\tjoinuntil "</li>"
\toutputto "_seriesraw"
\tsayrest

\toutputto "SERIES"
\tsayoutput "_seriesraw"
\tregexpreplace "^.*?<a[^>]*>" ""
\tregexpreplace "</a>.*$" ""
\tregexpreplace "</?[^><]+>" ""
\tunspace

\toutputto "SERIES-PART"
\tsayoutput "_seriesraw"
\tregexpreplace "</?[^><]+>" ""
\tunspace
\tSayRegexp "\\\\d+(\\\\.\\\\d+)?"
else
\tsay ""
endif

# ----- Composer & Narrator
outputto "COMPOSER"
gotoline 1
findline "narratorLabel" 1 1
if "narratorLabel"
\tmoveline 3 1
\tjoinuntil "</li>"
\tregexpreplace "</?[^><]+>" ""
\tunspace
\tregexpreplace "  +" " "
\tregexpreplace "^.*Narrated by:\\\\s*" ""
\tregexpreplace "\\\\s*By:.*$" ""
\tsayrest
else
\tgotoline 1
\tfindline "Narrated by" 1 1
\tif "Narrated by"
\t\tjoinuntil "</li>"
\t\tregexpreplace "</?[^><]+>" ""
\tunspace
\t\tregexpreplace "  +" " "
\t\tregexpreplace "^.*Narrated by:\\\\s*" ""
\t\tregexpreplace "\\\\s*By:.*$" ""
\tsayrest
\telse
\t\tsay ""
\tendif
endif

outputto "NARRATOR"
sayoutput "COMPOSER"

# ----- Genres / Categories
outputto "GENRE"
gotoline 1
findline "categoriesLabel" 1 1
if "categoriesLabel"
\tmoveline 3 1
\tjoinuntil "</li>"
\tregexpreplace "</?[^><]+>" ", "
\tregexpreplace "^.*Categories:\\\\s*" ""
\tregexpreplace "^\\\\s*,\\\\s*" ""
\tregexpreplace "\\\\s*,\\\\s*$" ""
\tregexpreplace "\\\\s*,(\\\\s*,)+" ", "
\tunspace
\tsayrest
else
\tsay ""
endif

# ----- Cover Image (upgrade to full resolution)
outputto "COVERURL"
gotoline 1
findline "data-test=\\"hero-image\\"" 1 1
if "data-test=\\"hero-image\\""
\tfindinline "src=\\""
\tmovechar 5
\tsayuntil "\\""
else
\tgotoline 1
\tfindline "property=\\"og:image\\"" 1 1
\tif "property=\\"og:image\\""
\t\tfindinline "content=\\""
\t\tmovechar 9
\tsayuntil "\\""
\telse
\t\tsay ""
\tendif
endif
regexpreplace "\\\\._S[SL]\\\\d+_\\\\." "."

# ----- Year
outputto "YEAR"
gotoline 1
findline "Release date:" 1 1
if "Release date:"
\tfindinline ">"
\tSayRegexp "\\\\d{4}"
else
\tgotoline 1
\tfindline "datePublished" 1 1
\tif "datePublished"
\t\tSayRegexp "\\\\d{4}"
\telse
\t\tsay ""
\tendif
endif

# ----- ISBN
outputto "ISBN"
gotoline 1
findline "\\"isbn\\":" 1 1
if "\\"isbn\\":"
\tSayRegexp "(?<=\\\\"isbn\\\\":\\\\")[0-9X-]+"
else
\tgotoline 1
\tfindline "ISBN:" 1 1
\tif "ISBN:"
\t\tSayRegexp "[0-9]{13}|[0-9]{10}"
\telse
\t\tsay ""
\tendif
endif

# ----- Language
outputto "LANGUAGE"
gotoline 1
findline "languageLabel" 1 1
if "languageLabel"
\tmoveline 3 1
\tfindinline ">"
\tsayuntil "<"
else
\tsay ""
endif

# ----- Publisher
outputto "PUBLISHER"
gotoline 1
findline "publisherLabel" 1 1
if "publisherLabel"
\tmoveline 3 1
\tfindinline ">"
\tsayuntil "<"
else
\tgotoline 1
\tfindline "©" 1 1
\tif "©"
\t\tmovechar 3
\t\tsayuntil "<"
\telse
\t\tsay ""
\tendif
endif

# ----- Description / Summary
outputto "COMMENT"
gotoline 1
findline "Publisher's Summary" 1 1
if "Publisher's Summary"
\tfindline "<span" 1 1
\tjoinuntil "</span>"
\tregexpreplace "</?[^><]+>" ""
\tunspace
\tregexpreplace "  +" " "
\tsayrest
else
\tgotoline 1
\tfindline "name=\\"description\\"" 1 1
\tif "name=\\"description\\""
\t\tfindinline "content=\\""
\t\tmovechar 9
\t\tsayuntil "\\""
\telse
\t\tsay ""
\tendif
endif

outputto "DESCRIPTION"
sayoutput "COMMENT"

# ----- Rating (rough)
outputto "RATING WMP"
gotoline 1
findline "aria-label=\\"Rating\\"" 1 1
if "aria-label=\\"Rating\\""
\tfindinline ">"
\tSayRegexp "\\\\d(\\\\.\\\\d)?"
else
\tsay "0.0"
endif

# ----- iTunes Audiobook Flags
outputto "ITUNESMEDIATYPE"
say "Audiobook"
outputto "ITUNESGAPLESS"
say "1"`;
