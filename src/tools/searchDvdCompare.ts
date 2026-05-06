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
    return parseDvdCompareSearchHtml(html)
  })())
  .pipe(
    catchNamedError(findDvdCompareResults),
  )
)

export const listDvdCompareReleases = (
  dvdCompareId: number,
): Observable<DvdCompareRelease[]> => (
  from(launchBrowser())
  .pipe(
    mergeMap((browser) => (
      from(browser.newPage())
      .pipe(
        mergeMap((page) => (
          from(
            page.goto(
              `${DVDCOMPARE_BASE}/comparisons/film.php?fid=${dvdCompareId}&sel=on`
            )
          )
          .pipe(
            mergeMap(async () => {
              const releases = await page.evaluate(() => {
                const checkboxes = Array.from(
                  document.querySelectorAll('form[action^="film.php"] input[type="checkbox"]')
                ) as HTMLInputElement[]

                return checkboxes.map((checkbox) => {
                  const hash = checkbox.getAttribute("name") || ""
                  // The label text is usually in a wrapping <label> or in a sibling element.
                  // Try several strategies to find the human-readable release description.
                  let label = ""
                  const wrappingLabel = checkbox.closest("label")
                  if (wrappingLabel) {
                    label = wrappingLabel.textContent?.trim() || ""
                  }
                  if (!label) {
                    // Try parent row text minus the checkbox itself
                    const parent = checkbox.parentElement
                    if (parent) {
                      label = parent.textContent?.trim() || ""
                    }
                  }
                  if (!label) {
                    // Fall back to next sibling text
                    const next = checkbox.nextSibling
                    if (next?.textContent) {
                      label = next.textContent.trim()
                    }
                  }
                  return { hash, label }
                }).filter((r) => r.hash)
              })

              await browser.close()

              return releases as DvdCompareRelease[]
            }),
          )
        )),
      )
    )),
    catchNamedError(listDvdCompareReleases),
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
