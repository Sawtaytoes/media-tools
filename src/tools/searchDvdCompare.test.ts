import { describe, expect, test } from "vitest"

import {
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
