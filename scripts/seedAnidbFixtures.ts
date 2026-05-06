// One-off script to seed test fixtures from real AniDB / DDG responses.
//
// Run with:   yarn tsx scripts/seedAnidbFixtures.ts
//
// What it does:
//   1. Calls searchAnidb() once  → triggers a DDG fetch, populates .cache/anidb/search/
//   2. Calls lookupAnidbById() for two aids → populates .cache/anidb/anime/
//   3. Copies the cached responses into src/tools/__fixtures__/anidb/ so unit
//      tests can load real shapes without making network requests.
//
// Re-run when AniDB or DDG changes their response shape, or when adding a
// new fixture.

import { copyFile, mkdir, readdir } from "node:fs/promises"
import { join } from "node:path"

import { firstValueFrom } from "rxjs"

import { getAnidbCacheDir } from "../src/tools/getAnidbCacheDir.js"
import { lookupAnidbById, searchAnidb } from "../src/tools/searchAnidb.js"

const FIXTURES_DIR = join("src", "tools", "__fixtures__", "anidb")
const CACHE_DIR = getAnidbCacheDir()

const SEARCH_QUERY = "fate zero"
// Aids chosen to cover both shape variants in the parser:
//   7206  — small, regular episodes only
//   11370 — has type=6 (O-prefixed) director's-cut episodes alongside regulars
const AIDS = [7206, 11370]

const main = async () => {
  console.log(`> searchAnidb(${JSON.stringify(SEARCH_QUERY)})`)
  const results = await firstValueFrom(searchAnidb(SEARCH_QUERY))
  console.log(`  ${results.length} results, first 3:`, results.slice(0, 3))

  for (const aid of AIDS) {
    console.log(`> lookupAnidbById(${aid})`)
    const anime = await firstValueFrom(lookupAnidbById(aid))
    console.log(`  episodes=${anime?.episodes.length} titles=${anime?.titles.length}`)
  }

  await mkdir(join(FIXTURES_DIR, "anime"), { recursive: true })
  await mkdir(join(FIXTURES_DIR, "search"), { recursive: true })

  for (const aid of AIDS) {
    const src = join(CACHE_DIR, "anime", `${aid}.xml`)
    const dst = join(FIXTURES_DIR, "anime", `${aid}.xml`)
    await copyFile(src, dst)
    console.log(`  copied ${src} → ${dst}`)
  }

  // The DDG search cache uses sha1-derived filenames; pick whatever's there.
  const searchCacheFiles = await readdir(join(CACHE_DIR, "search"))
  for (const file of searchCacheFiles) {
    const src = join(CACHE_DIR, "search", file)
    const dst = join(FIXTURES_DIR, "search", file)
    await copyFile(src, dst)
    console.log(`  copied ${src} → ${dst}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
