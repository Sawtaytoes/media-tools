// AniDB HTTP API response shapes — hand-written from
// https://wiki.anidb.net/HTTP_API_Definition (no OpenAPI exists). Note that
// title `type` is a descriptive string in the actual XML even though the
// docs sometimes refer to numeric IDs; episode `type` IS numeric.
export type AnidbTitleType = "main" | "synonym" | "short" | "official"

// type: 1=regular, 2=special, 3=credit (OP/ED), 4=trailer, 5=parody, 6=other
export type AnidbEpisodeType = 1 | 2 | 3 | 4 | 5 | 6

export type AnidbEpisode = {
  airdate?: string,
  epno: string,
  length?: number,
  titles: { lang: string, value: string }[],
  type: AnidbEpisodeType,
}

export type AnidbAnime = {
  aid: number,
  episodes: AnidbEpisode[],
  titles: { lang: string, type: AnidbTitleType, value: string }[],
}
