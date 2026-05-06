import { platform } from "node:os"

import puppeteer from "puppeteer"
import {
  from,
  map,
  mergeMap,
  type Observable,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"

export type DvdCompareResult = {
  id: number
  title: string
  year: string
}

const DVDCOMPARE_BASE = "https://www.dvdcompare.net"

const launchBrowser = () => (
  puppeteer.launch({
    args: platform() === "win32" ? [] : ["--no-sandbox"],
    headless: true,
  })
)

export const findDvdCompareResults = (
  searchTerm: string,
): Observable<DvdCompareResult[]> => (
  from(launchBrowser())
  .pipe(
    mergeMap((browser) => (
      from(browser.newPage())
      .pipe(
        mergeMap((page) => (
          from(
            page.goto(
              `${DVDCOMPARE_BASE}/search.php?search=${encodeURIComponent(searchTerm)}&stype=contains&t=film`
            )
          )
          .pipe(
            mergeMap(async () => {
              const results = await page.evaluate(() => {
                const links = Array.from(
                  document.querySelectorAll('a[href*="film.php?fid="]')
                )
                return links.map((link) => {
                  const href = (link as HTMLAnchorElement).href
                  const fidMatch = href.match(/fid=(\d+)/)
                  const id = fidMatch ? Number(fidMatch[1]) : 0
                  const text = (link.textContent || "").trim()
                  const yearMatch = text.match(/\((\d{4})\)/)
                  return {
                    id,
                    title: text.replace(/\s*\(\d{4}\)\s*$/, "").trim(),
                    year: yearMatch?.[1] ?? "",
                  }
                }).filter((r) => r.id > 0)
              })

              await browser.close()

              return results as DvdCompareResult[]
            }),
          )
        )),
      )
    )),
    catchNamedError(findDvdCompareResults),
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
