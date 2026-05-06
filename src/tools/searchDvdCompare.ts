import { platform } from "node:os"

import puppeteer from "puppeteer"
import {
  from,
  map,
  mergeMap,
  type Observable,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"

export type DvdCompareVariant = "DVD" | "Blu-ray" | "Blu-ray 4K"

// User-facing label. The internal value stays "Blu-ray 4K" because that's
// the literal token DVDCompare.net uses in its HTML; we only relabel it
// for display.
export const displayDvdCompareVariant = (
  variant: DvdCompareVariant,
): string => (
  variant === "Blu-ray 4K" ? "UHD Blu-ray" : variant
)

export type DvdCompareResult = {
  baseTitle: string
  id: number
  variant: DvdCompareVariant
  year: string
}

export type DvdCompareRelease = {
  hash: string
  label: string
}

const DVDCOMPARE_BASE = "https://www.dvdcompare.net"

const launchBrowser = () => (
  puppeteer.launch({
    args: platform() === "win32" ? [] : ["--no-sandbox"],
    headless: true,
  })
)

const decodeHtmlEntities = (text: string): string => (
  text
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&#0?39;/g, "'")
  .replace(/&#0?34;/g, "\"")
)

export const parseDvdCompareTitleText = (
  text: string,
  id: number,
): DvdCompareResult => {
  const fullMatch = text.match(/^(.+?)(?:\s*\((Blu-ray 4K|Blu-ray)\))?\s*\((\d{4})\)\s*$/)

  if (!fullMatch) {
    return { id, baseTitle: text, variant: "DVD", year: "" }
  }

  const [, base, variantToken, year] = fullMatch
  const variant: DvdCompareVariant = (
    variantToken === "Blu-ray 4K"
    ? "Blu-ray 4K"
    : variantToken === "Blu-ray"
    ? "Blu-ray"
    : "DVD"
  )

  return { id, baseTitle: base.trim(), variant, year }
}

export const parseDvdCompareSearchHtml = (
  html: string,
): DvdCompareResult[] => {
  const linkPattern = /<a[^>]+href=["'][^"']*film\.php\?fid=(\d+)[^"']*["'][^>]*>([^<]+)<\/a>/g
  const results: DvdCompareResult[] = []
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(html)) !== null) {
    const id = Number(match[1])
    if (id <= 0) continue
    const text = decodeHtmlEntities(match[2]).trim()
    results.push(parseDvdCompareTitleText(text, id))
  }

  return results
}

export const findDvdCompareResults = (
  searchTerm: string,
): Observable<DvdCompareResult[]> => (
  from((async () => {
    const formData = new URLSearchParams({
      param: searchTerm,
      searchtype: "text",
    })
    const response = await fetch(
      `${DVDCOMPARE_BASE}/comparisons/search.php`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      },
    )
    const html = await response.text()

    // DVDCompare redirects search.php to a specific film.php page when
    // there's only one match. fetch follows the redirect by default, so
    // the final response.url points at the film. Treat that as a single
    // search result so the builder UI can fast-path through the variant
    // step into the release picker.
    const redirectMatch = response.url.match(/film\.php\?fid=(\d+)/)
    if (redirectMatch) {
      const fid = Number(redirectMatch[1])
      const filmInfo = parseDvdCompareFilmTitle(html, fid)
      if (filmInfo) return [filmInfo]
      return [{ baseTitle: "", id: fid, variant: "DVD" as const, year: "" }]
    }

    return parseDvdCompareSearchHtml(html)
  })())
)

const stripTagsAndCollapse = (html: string): string => (
  decodeHtmlEntities(html.replace(/<[^>]+>/g, " "))
  .replace(/\s+/g, " ")
  .trim()
)

export const parseDvdCompareReleasesHtml = (
  html: string,
): DvdCompareRelease[] => {
  // Each release is rendered as:
  //   <input type="checkbox" name="N" ...> <a href="#N">label <span>[year]</span></a>
  // Lookaheads make this attribute-order agnostic; we still require a digit-only
  // name so the hidden "sel" input and the submit button get filtered out.
  const pattern = /<input(?=[^>]*\btype=["']checkbox["'])(?=[^>]*\bname=["'](\d+)["'])[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/g
  const releases: DvdCompareRelease[] = []
  let match: RegExpExecArray | null

  while ((match = pattern.exec(html)) !== null) {
    const hash = match[1]
    const label = stripTagsAndCollapse(match[2])
    releases.push({ hash, label })
  }

  return releases
}

export type DvdCompareReleasesDebug = {
  checkboxCount: number
  htmlLength: number
  httpStatus: number
  pageTitle: string
  snippet: string
  url: string
}

export type DvdCompareReleasesResult = {
  debug: DvdCompareReleasesDebug
  releases: DvdCompareRelease[]
}

const buildReleasesDebug = (
  url: string,
  httpStatus: number,
  html: string,
): DvdCompareReleasesDebug => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const pageTitle = (
    titleMatch
    ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, " ").trim()
    : ""
  )
  const checkboxCount = (
    html.match(/<input[^>]*\btype=["']checkbox["']/gi)
    ?? []
  ).length

  // Snippet around the form (or first 600 chars if no form is found)
  const formIndex = html.indexOf("film.php")
  const start = formIndex >= 0 ? Math.max(0, formIndex - 100) : 0
  const snippet = html.slice(start, start + 800)

  return {
    checkboxCount,
    htmlLength: html.length,
    httpStatus,
    pageTitle,
    snippet,
    url,
  }
}

export const listDvdCompareReleases = (
  dvdCompareId: number,
): Observable<DvdCompareReleasesResult> => (
  from((async () => {
    const url = `${DVDCOMPARE_BASE}/comparisons/film.php?fid=${dvdCompareId}&sel=on`
    const response = await fetch(url)
    const html = await response.text()
    const releases = parseDvdCompareReleasesHtml(html)
    const debug = buildReleasesDebug(url, response.status, html)

    if (releases.length === 0) {
      console.info(
        "[listDvdCompareReleases] no releases parsed",
        JSON.stringify({
          url,
          httpStatus: debug.httpStatus,
          htmlLength: debug.htmlLength,
          pageTitle: debug.pageTitle,
          checkboxCount: debug.checkboxCount,
        }),
      )
    }

    return { debug, releases }
  })())
)

export const parseDvdCompareFilmTitle = (
  html: string,
  fid: number,
): DvdCompareResult | null => {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!titleMatch) return null
  const titleText = (
    decodeHtmlEntities(titleMatch[1])
    .replace(/^DVD\s*Compare\s*[-:]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
  )
  if (!titleText) return null
  const parsed = parseDvdCompareTitleText(titleText, fid)
  // If no year was extracted, treat the title as unparseable.
  return parsed.year ? parsed : null
}

export const lookupDvdCompareFilm = (
  dvdCompareId: number,
): Observable<{ name: string } | null> => (
  from((async () => {
    const response = await fetch(
      `${DVDCOMPARE_BASE}/comparisons/film.php?fid=${dvdCompareId}`
    )
    const html = await response.text()
    const result = parseDvdCompareFilmTitle(html, dvdCompareId)
    if (!result) return null
    const variantSuffix = (
      result.variant !== "DVD"
      ? ` (${displayDvdCompareVariant(result.variant)})`
      : ""
    )
    const yearSuffix = result.year ? ` (${result.year})` : ""
    return { name: `${result.baseTitle}${variantSuffix}${yearSuffix}` }
  })())
  .pipe(
    catchNamedError(lookupDvdCompareFilm),
  )
)

export const lookupDvdCompareRelease = (
  dvdCompareId: number,
  hash: string,
): Observable<{ label: string } | null> => (
  from((async () => {
    const response = await fetch(
      `${DVDCOMPARE_BASE}/comparisons/film.php?fid=${dvdCompareId}&sel=on`
    )
    const html = await response.text()
    const releases = parseDvdCompareReleasesHtml(html)
    const matched = releases.find((r) => r.hash === String(hash))
    return matched ? { label: matched.label } : null
  })())
  .pipe(
    catchNamedError(lookupDvdCompareRelease),
  )
)

export const searchDvdCompare = ({
  url,
}: {
  url: string,
}): (
  Observable<
    string
  >
) => (
  from(launchBrowser())
  .pipe(
    mergeMap((
      browser,
    ) => (
      from(
        browser
        .newPage()
      )
      .pipe(
        mergeMap((
          page,
        ) => (
          from(
            page
            .goto(
              url
              .replace(
                /(.+)(#.+)/,
                `$1&sel=on$2`
              )
            )
          )
          .pipe(
            // mergeMap(async () => {
            //   const uncheckAllElementHandler = (
            //     await (
            //       page
            //       .$(
            //         '[href$="&sel=on"]'
            //       )
            //     )
            //   )

            //   if (!uncheckAllElementHandler) {
            //     throw "No 'Uncheck All' button."
            //   }

            //   await (
            //     uncheckAllElementHandler
            //     .click()
            //   )

            //   await (
            //     page
            //     .waitForNavigation()
            //   )
            // }),
            mergeMap(async () => {
              const releasePackagesFormElementHandler = (
                await (
                  page
                  .$(
                    'form[action^="film.php"]'
                  )
                )
              )

              if (!releasePackagesFormElementHandler) {
                throw "No release packages to choose from."
              }

              const urlHash = (
                (
                  new URL(
                    url
                  )
                  .hash
                  .replace(
                    /#(.+)/,
                    "$1",
                  )
                )
                || "1"
              )

              const releasePackageCheckboxElementHandler = (
                await (
                  releasePackagesFormElementHandler
                  .$(
                    `input[type="checkbox"][name="${urlHash}"]`
                  )
                )
              )

              if (!releasePackageCheckboxElementHandler) {
                throw "Incorrect or no release package selected."
              }

              await (
                releasePackageCheckboxElementHandler
                .click()
              )

              await (
                releasePackagesFormElementHandler
                .$(
                  '[type="submit"]'
                )
                .then((
                  submitButtonElementHandler
                ) => (
                  submitButtonElementHandler
                  ?.click()
                ))
              )

              await (
                page
                .waitForNavigation()
              )
            }),
            mergeMap(async () => {
              const extrasElementHandler = (
                await (
                  page
                  .$$(
                    'xpath/.//div[contains(@class, "label") and contains(text(), "Extras")]'
                  )
                )
              )

              if (
                (
                  extrasElementHandler
                  .length
                )
                === 0
              ) {
                throw "No extras for this release."
              }

              return (
                extrasElementHandler
                [0]
                .evaluate((
                  element,
                ) => (
                  (
                    element
                    ?.parentElement
                    ?.querySelector(
                      '.description'
                    )
                    ?.textContent
                  )
                  || (
                    element
                    ?.parentElement
                    ?.parentElement
                    ?.querySelector(
                      '.description'
                    )
                    ?.textContent
                  )
                  || ""
                ))
              )
            }),
            mergeMap((
              extrasText,
            ) => (
              from(
                browser
                .close()
              )
              .pipe(
                map(() => (
                  extrasText
                ))
              )
            )),
          )
        )),
      )
    )),
    catchNamedError(
      searchDvdCompare
    ),
  )
)
