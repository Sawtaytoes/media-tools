import { join, resolve } from "node:path"

// Pure: picks the pre-`resolve()` cache-dir string. Splitting the env
// read from the cwd-sensitive `resolve()` keeps the policy testable
// without env-var or cwd tricks.
export const pickAnidbCacheDirInput = ({
  fromEnv,
}: {
  fromEnv: string | undefined
}): string => fromEnv ?? join(".cache", "anidb")

// Directory where AniDB-related caches live (anime XML payloads and DDG
// search HTML). Defaults to ./.cache/anidb which is gitignored. Override
// with the ANIDB_CACHE_FOLDER env var when running in Docker so the cache
// can live on a mounted volume that survives container restarts.
export const getAnidbCacheDir = (): string =>
  resolve(
    pickAnidbCacheDirInput({
      fromEnv: process.env.ANIDB_CACHE_FOLDER,
    }),
  )
