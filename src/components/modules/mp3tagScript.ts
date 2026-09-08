export const MP3TAG_SRC_CODE = `# ###################################################################
# Mp3tag Web Source for Audible.com using Audible Catalog API
#
# Search by: Album, ASIN, Title, Author + Title
# Fully standalone, self-contained (no external .inc or .settings required)
#
# Tags populated:
#   - ALBUM, TITLE, SUBTITLE
#   - ARTIST, ALBUMARTIST (Authors)
#   - COMPOSER, NARRATOR (Narrators)
#   - SERIES, SERIES-PART, CONTENTGROUP, ALBUMSORT
#   - SHOWMOVEMENT, MOVEMENTNAME, MOVEMENT
#   - GENRE (Hierarchical Category Ladders)
#   - PUBLISHER, YEAR, RELEASETIME
#   - COMMENT, DESCRIPTION (Clean HTML-stripped summary)
#   - COVERURL (High-res 2400x2400 / 1000px master artwork)
#   - ASIN, ISBN, LANGUAGE, FORMAT
#   - RATING, RATING WMP
#   - ITUNESMEDIATYPE ("Audiobook"), ITUNESGAPLESS ("1")
#   - WWWAUDIOFILE, WWW (Direct Audible product link)
# ###################################################################

[Name]=Audible.com#Search by Album
[BasedOn]=https://api.audible.com
[IndexUrl]=https://api.audible.com/1.0/catalog/products?response_groups=contributors,media,product_desc,product_attrs,product_extended_attrs,series&image_sizes=500&num_results=25&products_sort_by=Relevance&%s
[AlbumUrl]=https://api.audible.com/1.0/catalog/products/
[WordSeparator]=+
[Encoding]=url-utf-8
[UserAgent]=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36
[Timeout]=25

# Search options
[SearchBy]=Album||%album%||keywords=%s
[SearchBy]=ASIN||%asin%||keywords=%s
[SearchBy]=Title||%title%||keywords=%s
[SearchBy]=Author + Title||%artist% %album%||keywords=%s
[SearchBy]=Album + Author||%album% %artist%||keywords=%s

# Result columns in Mp3tag search dialog
[IndexFormat]=%_url%|%Album%|%Author%|%Narrator%|%ASIN%|%Duration%|%Year%|%Language%

# -------------------------------------------------------------------
# PARSER SCRIPT: Search Results Index
# -------------------------------------------------------------------
[ParserScriptIndex]
replace "|" "$verticalBar()"
json "ON" "current"
json_select "total_results"
IfNot "0"
    json_foreach "products"
        # 1. %_url% (Appended to [AlbumUrl] for detailed metadata)
        json_select "asin"
        SayRest
        Say "?response_groups=category_ladders,contributors,media,product_desc,product_attrs,product_extended_attrs,rating,series,product_details&image_sizes=2400,1000,700,500"
        Say "|"

        # 2. %Album%
        json_select "title"
        RegexpReplace "(.*?) \\(Narrated by .*" "$1"
        SayRest
        Say "|"

        # 3. %Author%
        OutputTo "AUTHORS"
        json_foreach "authors"
            json_select "name"
            IfNot ""
                IfOutput "AUTHORS"
                    Say ", "
                EndIf
                SayRest
            EndIf
        json_foreach_end
        OutputTo "Output"
        SayOutput "AUTHORS"
        Set "AUTHORS"
        SayRest
        Say "|"

        # 4. %Narrator%
        OutputTo "NARRATORS"
        json_foreach "narrators"
            json_select "name"
            IfNot ""
                IfOutput "NARRATORS"
                    Say ", "
                EndIf
                SayRest
            EndIf
        json_foreach_end
        OutputTo "Output"
        SayOutput "NARRATORS"
        Set "NARRATORS"
        SayRest
        Say "|"

        # 5. %ASIN%
        json_select "asin"
        SayRest
        Say "|"

        # 6. %Duration%
        json_select "runtime_length_min"
        SayDuration "m" 1
        Say "|"

        # 7. %Year%
        json_select "release_date"
        SayNChars 4
        Say "|"

        # 8. %Language%
        json_select "language"
        SayFormat "$caps(%_current%)"
        SayNewLine
    json_foreach_end
EndIf

# -------------------------------------------------------------------
# PARSER SCRIPT: Detailed Book Metadata
# -------------------------------------------------------------------
[ParserScriptAlbum]
replace "|" "$verticalBar()"
json "ON" "current"
json_select_object "product"

# Cover Artwork: extracts highest resolution available (up to 2400x2400)
OutputTo "coverurl"
json_select_object "product_images"
json_select "2400"
IfNot ""
    SayRest
Else
    json_select "1000"
    IfNot ""
        SayRest
    Else
        json_select "700"
        IfNot ""
            SayRest
        Else
            json_select "500"
            SayRest
        EndIf
    EndIf
EndIf
json_unselect_object

# ASIN
OutputTo "ASIN"
json_select "asin"
SayRest

# Title & Album
OutputTo "ALBUM"
json_select "title"
RegexpReplace "(.*?) \\(Narrated by .*" "$1"
SayRest

OutputTo "TITLE"
SayOutput "ALBUM"

# Subtitle
OutputTo "SUBTITLE"
json_select "subtitle"
SayRest

# Authors / Album Artists
OutputTo "ALBUMARTIST"
json_foreach "authors"
    json_select "name"
    IfNot ""
        IfOutput "ALBUMARTIST"
            Say ", "
        EndIf
        SayRest
    EndIf
json_foreach_end

OutputTo "ARTIST"
SayOutput "ALBUMARTIST"

# Narrators / Composers (populated for both COMPOSER and NARRATOR tags)
OutputTo "COMPOSER"
json_foreach "narrators"
    json_select "name"
    IfNot ""
        IfOutput "COMPOSER"
            Say ", "
        EndIf
        SayRest
    EndIf
json_foreach_end

OutputTo "NARRATOR"
SayOutput "COMPOSER"

# Series, Book Number & Movement Sorting
json_select_many_count "series"
IfNot ""
    OutputTo "SERIES"
    json_select_array "series" 1
    json_select "title"
    SayRest
    OutputTo "SERIES-PART"
    json_select "sequence"
    SayRest
    json_unselect_object

    OutputTo "SHOWMOVEMENT"
    Say "1"
    OutputTo "MOVEMENTNAME"
    SayOutput "SERIES"
    OutputTo "MOVEMENT"
    SayOutput "SERIES-PART"

    OutputTo "CONTENTGROUP"
    SayOutput "SERIES"
    IfOutput "SERIES-PART"
        Say ", Book #"
        SayOutput "SERIES-PART"
    EndIf

    OutputTo "ALBUMSORT"
    SayOutput "SERIES"
    IfOutput "SERIES-PART"
        Say " "
        SayOutput "SERIES-PART"
    EndIf
    Say " - "
    SayOutput "ALBUM"
Else
    IfNotOutput "SUBTITLE"
        OutputTo "ALBUMSORT"
        SayOutput "ALBUM"
    Else
        OutputTo "ALBUMSORT"
        SayOutput "ALBUM"
        Say " - "
        SayOutput "SUBTITLE"
    EndIf
EndIf

# Genres & Categories (Category Ladders)
OutputTo "GENRE"
json_foreach "category_ladders"
    IfOutput "GENRE"
        Say ", "
    EndIf
    json_select_many "ladder" "name" " / "
    SayRest
json_foreach_end

# Rating (Audible community rating)
OutputTo "RATING"
json_select_object "rating"
json_select_object "overall_distribution"
json_select "display_average_rating"
SayRest
json_unselect_object
json_unselect_object

OutputTo "RATING WMP"
SayOutput "RATING"

# Description & Summary (Strips HTML tags and normalizes spaces)
OutputTo "COMMENT"
json_select "publisher_summary"
KillTag "*"
Unspace
RegexpReplace "  +" " "
Replace " ," ","
SayRest

OutputTo "DESCRIPTION"
SayOutput "COMMENT"

# Publisher
OutputTo "PUBLISHER"
json_select "publisher_name"
SayRest

# Year & Release Date
OutputTo "YEAR"
json_select "release_date"
SayNChars 4

OutputTo "RELEASETIME"
json_select "release_date"
SayRest

# ISBN
OutputTo "ISBN"
json_select "isbn"
SayRest

# Format (Unabridged, Abridged, Original Recording)
OutputTo "FORMAT"
json_select "format_type"
SayFormat "$caps(%_current%)"

# Language
OutputTo "LANGUAGE"
json_select "language"
SayFormat "$caps(%_current%)"

# Copyright
OutputTo "COPYRIGHT"
json_select "copyright"
SayRest

# Apple Books & iTunes standard tags
OutputTo "ITUNESMEDIATYPE"
Say "Audiobook"

OutputTo "ITUNESGAPLESS"
Say "1"

# Web Product URLs
OutputTo "WWWAUDIOFILE"
Say "https://www.audible.com/pd/"
SayOutput "ASIN"

OutputTo "WWW"
SayOutput "WWWAUDIOFILE"

json_unselect_object
json "OFF"
`;
