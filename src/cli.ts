import yargs from "yargs"
import { hideBin } from "yargs/helpers"

import { changeTrackLanguagesCommand } from "./cli-commands/changeTrackLanguages.js"
import { copyFilesCommand } from "./cli-commands/copyFiles.js"
import { copyOutSubtitlesCommand } from "./cli-commands/copyOutSubtitles.js"
import { fixIncorrectDefaultTracksCommand } from "./cli-commands/fixIncorrectDefaultTracks.js"
import { getAudioOffsetsCommand } from "./cli-commands/getAudioOffsets.js"
import { hasBetterAudioCommand } from "./cli-commands/hasBetterAudio.js"
import { hasBetterVersionCommand } from "./cli-commands/hasBetterVersion.js"
import { hasDuplicateMusicFilesCommand } from "./cli-commands/hasDuplicateMusicFiles.js"
import { hasImaxEnhancedAudioCommand } from "./cli-commands/hasImaxEnhancedAudio.js"
import { hasManyAudioTracksCommand } from "./cli-commands/hasManyAudioTracks.js"
import { hasSurroundSoundCommand } from "./cli-commands/hasSurroundSound.js"
import { hasWrongDefaultTrackCommand } from "./cli-commands/hasWrongDefaultTrack.js"
import { inverseTelecineDiscRipsCommand } from "./cli-commands/inverseTelecineDiscRips.js"
import { isMissingSubtitlesCommand } from "./cli-commands/isMissingSubtitles.js"
import { keepLanguagesCommand } from "./cli-commands/keepLanguages.js"
import { mergeOrderedChaptersCommand } from "./cli-commands/mergeOrderedChapters.js"
import { mergeTracksCommand } from "./cli-commands/mergeTracks.js"
import { moveFilesCommand } from "./cli-commands/moveFiles.js"
import { nameAnimeEpisodesCommand } from "./cli-commands/nameAnimeEpisodes.js"
import { nameSpecialFeaturesCommand } from "./cli-commands/nameSpecialFeatures.js"
import { nameTvShowEpisodesCommand } from "./cli-commands/nameTvShowEpisodes.js"
import { renameDemosCommand } from "./cli-commands/renameDemos.js"
import { renameMovieClipDownloadsCommand } from "./cli-commands/renameMovieClipDownloads.js"
import { reorderTracksCommand } from "./cli-commands/reorderTracks.js"
import { replaceAttachmentsCommand } from "./cli-commands/replaceAttachments.js"
import { replaceFlacWithPcmAudioCommand } from "./cli-commands/replaceFlacWithPcmAudio.js"
import { replaceTracksCommand } from "./cli-commands/replaceTracks.js"
import { setDisplayWidthCommand } from "./cli-commands/setDisplayWidth.js"
import { splitChaptersCommand } from "./cli-commands/splitChapters.js"
import { storeAspectRatioDataCommand } from "./cli-commands/storeAspectRatioData.js"

console
.time(
  "Command Runtime"
)

process
.on(
  "uncaughtException",
  (exception) => {
    console
    .error(
      exception
    )
  },
)

yargs(
  hideBin(
    process
    .argv
  )
)
.scriptName(
  ""
)
.wrap(
  process
  .stdout
  .columns
)
.usage(
  "Usage: $0 <cmd> [args]"
)
.command(changeTrackLanguagesCommand)
.command(copyFilesCommand)
.command(copyOutSubtitlesCommand)
.command(fixIncorrectDefaultTracksCommand)
.command(getAudioOffsetsCommand)
.command(hasBetterAudioCommand)
.command(hasBetterVersionCommand)
.command(hasDuplicateMusicFilesCommand)
.command(hasImaxEnhancedAudioCommand)
.command(hasManyAudioTracksCommand)
.command(hasSurroundSoundCommand)
.command(hasWrongDefaultTrackCommand)
.command(inverseTelecineDiscRipsCommand)
.command(isMissingSubtitlesCommand)
.command(keepLanguagesCommand)
.command(mergeOrderedChaptersCommand)
.command(mergeTracksCommand)
.command(moveFilesCommand)
.command(nameAnimeEpisodesCommand)
.command(nameSpecialFeaturesCommand)
.command(nameTvShowEpisodesCommand)
.command(renameDemosCommand)
.command(renameMovieClipDownloadsCommand)
.command(reorderTracksCommand)
.command(replaceAttachmentsCommand)
.command(replaceFlacWithPcmAudioCommand)
.command(replaceTracksCommand)
.command(setDisplayWidthCommand)
.command(splitChaptersCommand)
.command(storeAspectRatioDataCommand)
.strict()
.argv
