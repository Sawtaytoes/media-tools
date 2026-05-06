import { runMkvPropEdit } from "./runMkvPropEdit.js"

// Writes the MKV segment-level "title" property (the one Plex/Emby/Jellyfin
// surface in the file metadata, distinct from per-track "name" attributes).
// `--edit info` selects the global SegmentInformation element; passing an
// empty string for `title=` would *clear* the field, so this helper bails
// when the caller passes an empty title rather than silently wiping it.
export const setMkvSegmentTitleMkvPropEdit = ({
  filePath,
  title,
}: {
  filePath: string
  title: string
}) => (
  runMkvPropEdit({
    args: [
      "--edit",
      "info",

      "--set",
      `title=${title}`,
    ],
    filePath,
  })
)
