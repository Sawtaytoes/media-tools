import { createHash } from "node:crypto"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { XMLParser } from "fast-xml-parser"
import { from, map, type Observable } from "rxjs"

import type { AnidbAnime, AnidbEpisodeType, AnidbTitleType } from "../types/anidb.js"
import { catchNamedError } from "./catchNamedError.js"
import { getAnimeXml } from "./anidbApi.js"
import { getAnidbCacheDir } from "./getAnidbCacheDir.js"

// AniDB HTTP API client identifiers — public, not secrets. Tied to the
// software registered at https://anidb.net/software/3767 (display name
// "Disc File Namer"). Bump CLIENT_VER when you re-register a new version
// on AniDB to track API usage against the matching release.
const CLIENT = "mediatools"
const CLIENT_VER = "1"

const SEARCH_CACHE_DIR = join(getAnidbCacheDir(), "search")
const SEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000

// AniDB.net is fronted by Cloudflare's interactive challenge, so we can't
// hit anidb.net directly — neither the search page nor the daily titles
// dump are reachable from a non-browser client. DuckDuckGo's HTML-only
// endpoint indexes anidb.net/anime/<aid> pages and returns the aid in the
// result link, which is enough to power a name-based picker.
const UA = (
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
  + "AppleWebKit/537.36 (KHTML, like Gecko) "
  + "Chrome/130.0.0.0 Safari/537.36"
)

export type AnidbResult = {
  aid: number,
  name: string,
}

const cacheKey = (query: string): string => (
  createHash("sha1").update(query.toLowerCase().trim()).digest("hex").slice(0, 16)
)

const fetchDdg = async (query: string): Promise<string> => {
  const path = join(SEARCH_CACHE_DIR, `${cacheKey(query)}.html`)
  try {
    const s = await stat(path)
    if (Date.now() - s.mtimeMs < SEARCH_TTL_MS) return readFile(path, "utf8")
  }
  catch { /* miss */ }

  await mkdir(SEARCH_CACHE_DIR, { recursive: true })
  const url = (
    `https://html.duckduckgo.com/html/`
    + `?q=${encodeURIComponent(`${query} site:anidb.net/anime`)}`
  )
  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) throw new Error(`DDG search failed: ${res.status}`)
  const html = await res.text()
  await writeFile(path, html, "utf8")
  return html
}

// DDG anchors look like:
//   <a ... class="result__a" href="//duckduckgo.com/l/?uddg=<urlencoded>&...">Title</a>
// We decode the uddg target, keep only anidb.net/anime/<digits> URLs (filtering
// out search-list pages and sub-routes like /relation/graph), and extract aid
// + display title from the link text.
export const parseDdgAnidbResults = (html: string): AnidbResult[] => {
  const linkPattern = /<a\b[^>]*\bclass="[^"]*\bresult__a\b[^"]*"[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi
  const aidPattern = /^https?:\/\/anidb\.net\/anime\/(\d+)\/?$/i

  const seen = new Set<number>()
  const results: AnidbResult[] = []

  let match: RegExpExecArray | null
  while ((match = linkPattern.exec(html)) !== null) {
    const [, rawHref, rawText] = match
    const ddgMatch = rawHref.match(/[?&](?:amp;)?uddg=([^&]+)/i)
    if (!ddgMatch) continue

    const target = decodeURIComponent(ddgMatch[1])
    const aidMatch = target.match(aidPattern)
    if (!aidMatch) continue

    const aid = Number(aidMatch[1])
    if (!aid || seen.has(aid)) continue
    seen.add(aid)

    const name = (
      rawText
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+-\s+Anime\s+-\s+AniDB\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim()
    )
    if (name) results.push({ aid, name })
  }

  return results
}

export const searchAnidb = (
  searchTerm: string,
): Observable<AnidbResult[]> => (
  from(fetchDdg(searchTerm))
  .pipe(
    map(parseDdgAnidbResults),
    catchNamedError(searchAnidb),
  )
)

const xmlParser = new XMLParser({
  attributeNamePrefix: "",
  ignoreAttributes: false,
  textNodeName: "value",
})

const toArray = <T>(v: T | T[] | undefined): T[] => (
  v == null ? [] : Array.isArray(v) ? v : [v]
)

export const parseAnidbAnimeXml = (xml: string): AnidbAnime | null => {
  const root = (xmlParser.parse(xml) as { anime?: any }).anime
  if (!root) return null

  const titles = (
    toArray<any>(root.titles?.title)
    .map((t) => ({
      lang: String(t["xml:lang"] ?? ""),
      type: String(t.type ?? "synonym") as AnidbTitleType,
      value: typeof t === "string" ? t : String(t.value ?? ""),
    }))
  )

  const episodes = (
    toArray<any>(root.episodes?.episode)
    .map((ep) => ({
      airdate: ep.airdate ? String(ep.airdate) : undefined,
      epno: typeof ep.epno === "string" ? ep.epno : String(ep.epno?.value ?? ""),
      length: ep.length != null ? Number(ep.length) : undefined,
      titles: (
        toArray<any>(ep.title)
        .map((t) => ({
          lang: String(t["xml:lang"] ?? ""),
          value: typeof t === "string" ? t : String(t.value ?? ""),
        }))
      ),
      type: Number(ep.epno?.type ?? 1) as AnidbEpisodeType,
    }))
  )

  return { aid: Number(root.id), episodes, titles }
}

export const lookupAnidbById = (
  aid: number,
): Observable<AnidbAnime | null> => (
  from(getAnimeXml(aid, { client: CLIENT, clientver: CLIENT_VER }))
  .pipe(
    map(parseAnidbAnimeXml),
    catchNamedError(lookupAnidbById),
  )
)
