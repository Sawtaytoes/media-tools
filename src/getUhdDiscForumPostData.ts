import { platform } from "node:os"
import puppeteer from "puppeteer"
import {
  from,
  map,
  mergeMap,
  type Observable,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { processUhdDiscForumPost } from "./processUhdDiscForumPost.cherrio.js"

export type UhdDiscForumPostItem = {
  movieName: string
  publisher?: string
  reasons?: string[]
}

export type UhdDiscForumPostSection = {
  sectionTitle: string
}

export type UhdDiscForumPostGroup = {
  items: UhdDiscForumPostItem[]
  title: string
}

export const getParentText = (
  element: HTMLElement,
) => {
  const clonedElement = (
    element
    .cloneNode(
      true
    ) as (
      HTMLElement
    )
  )

  Array
  .from(
    clonedElement
    .children
  )
  .forEach((
    childElement,
  ) => {
    clonedElement
    .removeChild(
      childElement
    )
  })

  return (
    clonedElement
    .textContent
  )
}

export const uhdDiscForumPostId = "739745"

export const getUhdDiscForumPostData = (): (
  Observable<
    UhdDiscForumPostGroup[]
  >
) => (
  from(
    puppeteer
    .launch({
      args: (
        platform() === "win32"
        ? []
        : ["--no-sandbox"] // TODO; Remove this with a better solution: https://stackoverflow.com/a/53975412/1624862.
      ),
      headless: true,
    })
  )
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
              // "https://www.criterionforum.org/forum/viewtopic.php?t=17181#p739745"
              `https://www.criterionforum.org/forum/viewtopic.php?p=${uhdDiscForumPostId}#p${uhdDiscForumPostId}`
            )
          )
          .pipe(
            mergeMap(async () => {
              const forumPostContentHandler = (
                await (
                  page
                  .$(
                    `#post_content${uhdDiscForumPostId} > .content`
                  )
                )
              )

              if (!forumPostContentHandler) {
                throw "No forum post available."
              }

              const formPostContent = (
                await (
                  forumPostContentHandler
                  .evaluate((
                    element,
                  ) => (
                    (
                      element
                      ?.innerHTML
                    )
                    || ""
                  ))
                )
              )

              return (
                processUhdDiscForumPost(
                  formPostContent
                )
              )
            }),
            mergeMap((
              uhdDiscForumPostGroups,
            ) => (
              from(
                browser
                .close()
              )
              .pipe(
                map(() => (
                  uhdDiscForumPostGroups
                ))
              )
            )),
          )
        )),
      )
    )),
    catchNamedError(
      getUhdDiscForumPostData
    ),
  )
)
