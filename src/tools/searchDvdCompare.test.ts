import { describe, expect, test } from "vitest"

import {
  displayDvdCompareVariant,
  parseDvdCompareFilmTitle,
  parseDvdCompareReleasesHtml,
  parseDvdCompareSearchHtml,
  parseDvdCompareTitleText,
} from "./searchDvdCompare.js"

describe(parseDvdCompareTitleText.name, () => {
  test("parses bare title with year as DVD variant", () => {
    expect(parseDvdCompareTitleText("Soldier (1998)", 123))
    .toEqual({
      id: 123,
      baseTitle: "Soldier",
      variant: "DVD",
      year: "1998",
    })
  })

  test("extracts Blu-ray variant from parenthetical token", () => {
    expect(parseDvdCompareTitleText("Soldier (Blu-ray) (1998)", 124))
    .toEqual({
      id: 124,
      baseTitle: "Soldier",
      variant: "Blu-ray",
      year: "1998",
    })
  })

  test("extracts Blu-ray 4K variant from parenthetical token", () => {
    expect(parseDvdCompareTitleText("Soldier (Blu-ray 4K) (1998)", 125))
    .toEqual({
      id: 125,
      baseTitle: "Soldier",
      variant: "Blu-ray 4K",
      year: "1998",
    })
  })

  test("falls back to raw text and DVD when no year in parentheses", () => {
    expect(parseDvdCompareTitleText("Some Random String", 200))
    .toEqual({
      id: 200,
      baseTitle: "Some Random String",
      variant: "DVD",
      year: "",
    })
  })

  test("preserves multi-word titles before the variant token", () => {
    expect(parseDvdCompareTitleText("The Lord of the Rings (Blu-ray) (2001)", 300))
    .toEqual({
      id: 300,
      baseTitle: "The Lord of the Rings",
      variant: "Blu-ray",
      year: "2001",
    })
  })
})

describe(parseDvdCompareSearchHtml.name, () => {
  test("returns an empty array for empty HTML", () => {
    expect(parseDvdCompareSearchHtml(""))
    .toEqual([])
  })

  test("returns an empty array when no film links are present", () => {
    expect(parseDvdCompareSearchHtml('<html><body><a href="/about.php">About</a></body></html>'))
    .toEqual([])
  })

  test("extracts a single film link", () => {
    const html = `<a href="film.php?fid=12345">Soldier (1998)</a>`

    expect(parseDvdCompareSearchHtml(html))
    .toEqual([
      {
        id: 12345,
        baseTitle: "Soldier",
        variant: "DVD",
        year: "1998",
      },
    ])
  })

  test("extracts all variants of a film and preserves order", () => {
    const html = `
      <a href="film.php?fid=1001">Soldier (1998)</a>
      <a href="film.php?fid=1002">Soldier (Blu-ray) (1998)</a>
      <a href="film.php?fid=1003">Soldier (Blu-ray 4K) (1998)</a>
    `

    expect(parseDvdCompareSearchHtml(html))
    .toEqual([
      { id: 1001, baseTitle: "Soldier", variant: "DVD", year: "1998" },
      { id: 1002, baseTitle: "Soldier", variant: "Blu-ray", year: "1998" },
      { id: 1003, baseTitle: "Soldier", variant: "Blu-ray 4K", year: "1998" },
    ])
  })

  test("decodes common HTML entities in titles", () => {
    const html = `<a href="film.php?fid=42">Tom &amp; Jerry (Blu-ray) (1992)</a>`

    expect(parseDvdCompareSearchHtml(html))
    .toEqual([
      {
        id: 42,
        baseTitle: "Tom & Jerry",
        variant: "Blu-ray",
        year: "1992",
      },
    ])
  })

  test("ignores non-film anchor tags interleaved with film links", () => {
    const html = `
      <a href="/about.php">About</a>
      <a href="film.php?fid=7">Movie A (2020)</a>
      <a href="search.php">Search</a>
      <a href="film.php?fid=8">Movie B (2021)</a>
    `

    expect(parseDvdCompareSearchHtml(html))
    .toEqual([
      { id: 7, baseTitle: "Movie A", variant: "DVD", year: "2020" },
      { id: 8, baseTitle: "Movie B", variant: "DVD", year: "2021" },
    ])
  })

  test("handles single-quoted href attributes", () => {
    const html = `<a href='film.php?fid=99'>Quoted (2010)</a>`

    expect(parseDvdCompareSearchHtml(html))
    .toEqual([
      { id: 99, baseTitle: "Quoted", variant: "DVD", year: "2010" },
    ])
  })

  test("filters out fid=0 entries", () => {
    const html = `
      <a href="film.php?fid=0">Bogus (2000)</a>
      <a href="film.php?fid=5">Real (2005)</a>
    `

    expect(parseDvdCompareSearchHtml(html))
    .toEqual([
      { id: 5, baseTitle: "Real", variant: "DVD", year: "2005" },
    ])
  })
})

describe(parseDvdCompareReleasesHtml.name, () => {
  test("returns an empty array for empty HTML", () => {
    expect(parseDvdCompareReleasesHtml(""))
    .toEqual([])
  })

  test("parses each <input> + sibling <a> as a separate release", () => {
    // Real-world HTML sample from a DVDCompare film page.
    const html = `<p>
        <input type="checkbox" name="1" checked=""> <a href="#1">Blu-ray ALL America - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type="checkbox" name="2" checked=""> <a href="#2">Blu-ray ALL Canada - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type="checkbox" name="3" checked=""> <a href="#3">Blu-ray ALL United Kingdom - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br>
        <br>
        <input type="hidden" name="sel" value="on">
        <input type="submit" name="submit" value="Apply Filter">
    </p>`

    expect(parseDvdCompareReleasesHtml(html))
    .toEqual([
      { hash: "1", label: "Blu-ray ALL America - Arrow Films - Limited Edition [2026]" },
      { hash: "2", label: "Blu-ray ALL Canada - Arrow Films - Limited Edition [2026]" },
      { hash: "3", label: "Blu-ray ALL United Kingdom - Arrow Films - Limited Edition [2026]" },
    ])
  })

  test("ignores hidden and submit inputs (non-numeric names)", () => {
    const html = `
      <input type="hidden" name="sel" value="on">
      <input type="checkbox" name="1"> <a href="#1">Only Real Release</a>
      <input type="submit" name="submit" value="Apply Filter">
    `

    expect(parseDvdCompareReleasesHtml(html))
    .toEqual([
      { hash: "1", label: "Only Real Release" },
    ])
  })

  test("decodes HTML entities and collapses whitespace inside labels", () => {
    const html = `<input type="checkbox" name="7"> <a href="#7">Tom &amp; Jerry  Special  Edition</a>`

    expect(parseDvdCompareReleasesHtml(html))
    .toEqual([
      { hash: "7", label: "Tom & Jerry Special Edition" },
    ])
  })

  test("matches checkboxes with reversed attribute order (name before type)", () => {
    const html = `<input name="9" type="checkbox" checked=""> <a href="#9">Reversed Attribute Order</a>`

    expect(parseDvdCompareReleasesHtml(html))
    .toEqual([
      { hash: "9", label: "Reversed Attribute Order" },
    ])
  })

  test("parses the unselected film page format (unquoted attrs, no <a> wrapping the label)", () => {
    // Real-world HTML from the unchecked view of a DVDCompare film page —
    // attributes are unquoted, the label sits directly after <input>, and a
    // stray closing </a> is left in the markup.
    const html = `<form action="film.php?fid=74759" method="post">
        <a href="film.php?fid=74759">Check/Show All</a><br>
        <a href="film.php?fid=74759&sel=on">Uncheck/Hide All</a><p>

        <input type=checkbox name=1> Blu-ray ALL America - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type=checkbox name=2> Blu-ray ALL Canada - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br><input type=checkbox name=3> Blu-ray ALL United Kingdom - Arrow Films - Limited Edition <span class="disc-release-year">[2026]</span></a><br>
        <br>
        <input type=hidden name=sel value=on>
        <input type=submit name=submit value="Apply Filter">
      </form>`

    expect(parseDvdCompareReleasesHtml(html))
    .toEqual([
      { hash: "1", label: "Blu-ray ALL America - Arrow Films - Limited Edition [2026]" },
      { hash: "2", label: "Blu-ray ALL Canada - Arrow Films - Limited Edition [2026]" },
      { hash: "3", label: "Blu-ray ALL United Kingdom - Arrow Films - Limited Edition [2026]" },
    ])
  })
})

describe(displayDvdCompareVariant.name, () => {
  test("relabels Blu-ray 4K as UHD Blu-ray", () => {
    expect(displayDvdCompareVariant("Blu-ray 4K")).toBe("UHD Blu-ray")
  })

  test("leaves DVD and Blu-ray untouched", () => {
    expect(displayDvdCompareVariant("DVD")).toBe("DVD")
    expect(displayDvdCompareVariant("Blu-ray")).toBe("Blu-ray")
  })
})

describe(parseDvdCompareFilmTitle.name, () => {
  test("returns null when no <title> tag present", () => {
    expect(parseDvdCompareFilmTitle("<html></html>", 100))
    .toBeNull()
  })

  test("returns null when title has no recognizable year", () => {
    expect(parseDvdCompareFilmTitle("<title>Some Random Page</title>", 100))
    .toBeNull()
  })

  test("strips a leading 'DVD Compare:' prefix and parses base+year (DVD)", () => {
    expect(parseDvdCompareFilmTitle("<title>DVD Compare: Soldier (1998)</title>", 12345))
    .toEqual({
      id: 12345,
      baseTitle: "Soldier",
      variant: "DVD",
      year: "1998",
    })
  })

  test("strips a leading 'Rewind @ www.dvdcompare.net - ' prefix from newer pages", () => {
    // The current DVDCompare template renders the page <title> with the
    // "Rewind @ www.dvdcompare.net - " brand prefix instead of the older
    // "DVD Compare:" form. Both must parse cleanly.
    expect(parseDvdCompareFilmTitle(
      "<title>Rewind @ www.dvdcompare.net - Dragon Lord AKA Long xiao ye AKA Dragon Strike AKA Young Master in Love (Blu-ray 4K) (1982)</title>",
      74250,
    )).toEqual({
      id: 74250,
      baseTitle: "Dragon Lord AKA Long xiao ye AKA Dragon Strike AKA Young Master in Love",
      variant: "Blu-ray 4K",
      year: "1982",
    })
  })

  test("extracts Blu-ray variant from the title", () => {
    expect(parseDvdCompareFilmTitle("<title>DVDCompare - Soldier (Blu-ray) (1998)</title>", 12346))
    .toEqual({
      id: 12346,
      baseTitle: "Soldier",
      variant: "Blu-ray",
      year: "1998",
    })
  })

  test("extracts Blu-ray 4K variant from the title", () => {
    expect(parseDvdCompareFilmTitle("<title>DVD Compare: Soldier (Blu-ray 4K) (1998)</title>", 12347))
    .toEqual({
      id: 12347,
      baseTitle: "Soldier",
      variant: "Blu-ray 4K",
      year: "1998",
    })
  })

  test("decodes HTML entities and collapses whitespace inside the title", () => {
    expect(parseDvdCompareFilmTitle("<title>DVD Compare:   Tom &amp; Jerry  (Blu-ray)  (1992)</title>", 99))
    .toEqual({
      id: 99,
      baseTitle: "Tom & Jerry",
      variant: "Blu-ray",
      year: "1992",
    })
  })
})
