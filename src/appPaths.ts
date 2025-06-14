import { platform } from "node:os"

const isWindows = platform() === 'win32'

/** @see https://github.com/bbc/audio-offset-finder */
// export const audioOffsetFinderPath = ".venv/bin/audio-offset-finder" .// This local version doesn't run for whatever reason.
export const audioOffsetFinderPath = "audio-offset-finder"

// 7.0.2-essentials_build
export const ffmpegPath = (
  isWindows
  ? "assets/ffmpeg/bin/ffmpeg.exe"
  : "ffmpeg"
)

// MediaInfo_CLI_25.03_Windows_x64
export const mediaInfoPath = (
  isWindows
  ? "assets/mediainfo/MediaInfo.exe"
  : "mediainfo"
)

// mkvtoolnix-64-bit-91.0
export const mkvExtractPath = (
  isWindows
  ? "assets/mkvtoolnix/mkvextract.exe"
  : "mkvextract"
)

// mkvtoolnix-64-bit-91.0
export const mkvMergePath = (
  isWindows
  ? "assets/mkvtoolnix/mkvmerge.exe"
  : "mkvmerge"
)

// mkvtoolnix-64-bit-91.0
export const mkvPropEditPath = (
  isWindows
  ? "assets/mkvtoolnix/mkvpropedit.exe"
  : "mkvpropedit"
)
