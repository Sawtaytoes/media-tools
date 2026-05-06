import { platform } from "node:os"
import { chromium } from "playwright"
import {
  from,
  type Observable,
} from "rxjs"

import { catchNamedError } from "./catchNamedError.js"
import { processUhdDiscForumPost } from "../app-commands/processUhdDiscForumPost.cherrio.js"

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

export const getUhdDiscForumPostData = (): Observable<UhdDiscForumPostGroup[]> => (
  from((async () => {
    const browser = await chromium.launch({
      args: platform() === "win32" ? [] : ["--no-sandbox"],
      headless: true,
    })
    try {
      const page = await browser.newPage()
      await page.goto(
        `https://www.criterionforum.org/forum/viewtopic.php?p=${uhdDiscForumPostId}#p${uhdDiscForumPostId}`,
      )

      const forumPostContent = page.locator(
        `#post_content${uhdDiscForumPostId} > .content`,
      )
      if ((await forumPostContent.count()) === 0) {
        throw new Error("No forum post available.")
      }

      const html = await forumPostContent.evaluate((element) => element.innerHTML)
      return processUhdDiscForumPost(html)
    }
    finally {
      await browser.close()
    }
  })())
  .pipe(
    catchNamedError(getUhdDiscForumPostData),
  )
)
