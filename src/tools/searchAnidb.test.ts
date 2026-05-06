import { join } from "node:path"

import { describe, expect, test, vi } from "vitest"

import { parseAnidbAnimeXml, parseDdgAnidbResults } from "./searchAnidb.js"

// Real responses captured by scripts/seedAnidbFixtures.ts. Re-run that
// script to refresh when AniDB or DDG changes their response shape.
//
// vitest.setup.ts mocks node:fs globally with memfs, so use vi.importActual
// to read the on-disk fixtures at module init.
const realFs = await vi.importActual<typeof import("node:fs")>("node:fs")
const FIXTURES_DIR = join(import.meta.dirname, "__fixtures__", "anidb")
const loadFixture = (rel: string): string => (
  realFs.readFileSync(join(FIXTURES_DIR, rel), "utf8")
)

describe(parseDdgAnidbResults.name, () => {
  test("parses real DDG search HTML and extracts aid + name pairs", () => {
    const html = loadFixture("search/81e314aa64abb2ae.html")
    const results = parseDdgAnidbResults(html)

    // Sanity floor — DDG can change the count, but a real "fate zero"
    // search returns more than a handful of valid /anime/<aid> hits.
    expect(results.length).toBeGreaterThanOrEqual(5)

    // Every result has a positive aid and a non-empty name.
    for (const r of results) {
      expect(r.aid).toBeGreaterThan(0)
      expect(r.name.length).toBeGreaterThan(0)
    }

    // Aids are unique (parser dedupes).
    const aids = results.map((r) => r.aid)
    expect(new Set(aids).size).toBe(aids.length)

    // The trailing " - Anime - AniDB" suffix should be stripped from names.
    for (const r of results) {
      expect(r.name).not.toMatch(/\s+-\s+Anime\s+-\s+AniDB\s*$/i)
    }

    // The query was "fate zero" — at least one Fate-named result should appear.
    expect(results.some((r) => /fate/i.test(r.name))).toBe(true)
  })

  test("ignores non-/anime/<digits> URLs (search lists, sub-routes)", () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fanidb.net%2Fanime%2F3348%2Frelation%2Fgraph">
        Fate/Stay Night - Relations
      </a>
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fanidb.net%2Fanime%2F%3Fadb.search%3DK">
        Anime List - Letter f - AniDB
      </a>
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fanidb.net%2Fanime%2F3348">
        Fate/Stay Night - Anime - AniDB
      </a>
    `
    expect(parseDdgAnidbResults(html)).toEqual([
      { aid: 3348, name: "Fate/Stay Night" },
    ])
  })

  test("decodes HTML entities in names", () => {
    const html = `
      <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fanidb.net%2Fanime%2F1234">
        Show Title &amp; Friends&#x27; Adventure - Anime - AniDB
      </a>
    `
    expect(parseDdgAnidbResults(html)).toEqual([
      { aid: 1234, name: "Show Title & Friends' Adventure" },
    ])
  })

  test("returns empty array when no result anchors found", () => {
    expect(parseDdgAnidbResults("<html><body>No results</body></html>")).toEqual([])
  })

  test("ignores anchors that lack a uddg redirect param", () => {
    const html = `
      <a class="result__a" href="https://example.com/some/page">
        Example Page
      </a>
    `
    expect(parseDdgAnidbResults(html)).toEqual([])
  })
})

describe(parseAnidbAnimeXml.name, () => {
  test("parses a real anime payload (aid 7206) into the expected shape", () => {
    const xml = loadFixture("anime/7206.xml")
    const result = parseAnidbAnimeXml(xml)

    expect(result).not.toBeNull()
    expect(result!.aid).toBe(7206)
    expect(result!.titles.length).toBeGreaterThan(0)
    expect(result!.episodes.length).toBeGreaterThan(0)

    // Every title has a language and a non-empty value.
    for (const t of result!.titles) {
      expect(t.lang.length).toBeGreaterThan(0)
      expect(t.value.length).toBeGreaterThan(0)
      expect(["main", "synonym", "short", "official"]).toContain(t.type)
    }

    // Every episode has a string epno and one of the known type codes.
    for (const ep of result!.episodes) {
      expect(typeof ep.epno).toBe("string")
      expect(ep.epno.length).toBeGreaterThan(0)
      expect([1, 2, 3, 4, 5, 6]).toContain(ep.type)
      // Optional fields when present should be the expected types.
      if (ep.airdate !== undefined) expect(typeof ep.airdate).toBe("string")
      if (ep.length !== undefined) expect(typeof ep.length).toBe("number")
    }
  })

  test("aid 11370 includes both regular (type 1) and O-prefixed (type 6) episodes", () => {
    const xml = loadFixture("anime/11370.xml")
    const result = parseAnidbAnimeXml(xml)

    expect(result).not.toBeNull()
    expect(result!.aid).toBe(11370)

    const regulars = result!.episodes.filter((ep) => ep.type === 1)
    const others = result!.episodes.filter((ep) => ep.type === 6)

    expect(regulars.length).toBeGreaterThan(0)
    expect(others.length).toBeGreaterThan(0)

    // Regular episodes have plain numeric epno; type-6 epno starts with "O".
    for (const ep of regulars) expect(ep.epno).toMatch(/^\d+$/)
    for (const ep of others) expect(ep.epno).toMatch(/^O/i)
  })

  test("preserves multi-language episode titles", () => {
    const xml = loadFixture("anime/7206.xml")
    const result = parseAnidbAnimeXml(xml)
    // A real episode payload has at least one title with a language tag.
    const someEpisode = result!.episodes[0]
    expect(someEpisode.titles.length).toBeGreaterThan(0)
    expect(someEpisode.titles.every((t) => t.lang.length > 0)).toBe(true)
  })

  test("handles episodes with missing optional fields", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <anime id="100">
        <titles>
          <title xml:lang="x-jat" type="main">X</title>
        </titles>
        <episodes>
          <episode>
            <epno type="1">1</epno>
          </episode>
        </episodes>
      </anime>
    `
    const result = parseAnidbAnimeXml(xml)
    expect(result?.episodes[0]).toEqual({
      airdate: undefined,
      epno: "1",
      length: undefined,
      titles: [],
      type: 1,
    })
  })

  test("returns null when XML has no <anime> root (e.g., AniDB error response)", () => {
    expect(parseAnidbAnimeXml("<error>banned</error>")).toBeNull()
  })
})
