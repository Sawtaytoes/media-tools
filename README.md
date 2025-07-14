# Media File Tools

## Special Features File Naming

This package renames a folder of ripped disc special features using timecodes from [dvdcompare.net](https://dvdcompare.net).

### Installation

You'll need Python 3, Node.js, and Yarn.

```sh
pip install -r installed_packages.txt --target .venv
yarn install
yarn dlx @yarnpkg/sdks vscode
```

### Update

```sh
yarn set version stable
```

### Usage

```sh
yarn media --help
```

### Compile for Windows

This command creates an executable for Windows:

```sh
yarn sea
```

## Demo Media File Naming

Rename demo media files with the correct video and audio codecs used by inspecting each individual file.

This is useful when bringing down a load of demo files which may or may not be correctly named.

Demo files need their names done a certain way. Once that's done, this library can take over the rest.

Examples of demo filenames:

- Movie Demo ➡️ `Ford v Ferrari (2019) [1st Miles Race] {FHD 2.39 SDR & DTS-ES MA Matrix 6.1}`
- Movie Demo ➡️ `Ford v Ferrari (2019) [Broken Brakes] {4K HDR10 & Dolby Atmos TrueHD}`
- Music Video ➡️ `Pink Floyd - The Dark Side Of The Moon - Any Colour You Like {FHD SDR & Dolby Atmos TrueHD}`
- Music Video ➡️ `Queen - I Want It All {SD SDR & DTS 96-24 5.1}`
- Technology Demo ➡️ `[Dolby] Argon {SD SDR & Dolby Digital 5.1}`
- Technology Demo ➡️ `[LG] Cymatic Jazz {4K HLG & AAC 2.0}`

### Usage

```sh
yarn nameDemoFiles FOLDER_LOCATION
```

- `FOLDER_LOCATION`: The absolute path of the directory with your demo media.

#### EXAMPLE

```sh
yarn nameDemoFiles 'G:\Movie-Demos'
```

## Anime File Naming

Rename anime media files ripped from discs.

### Usage

> Many anime come on multiple disc, so it requires a bit of manual work to get this setup.

Make sure you only put episodes in this directory and that, when ordered alphabetically, they're in episode-order. Then the tool can take over the rest of the work.

```sh
yarn start FOLDER_LOCATION SEASON_NUMBER SEARCH_TERM
```

- `FOLDER_LOCATION`: The absolute path of the directory with your demo media.
- `SEASON_NUMBER` (optional & default `1`): If you do use Seasons, this should be set to the correct season number. With Absolute Series Scanner and HamaTV, they usually want `1` because they uses Collections rather than actual Seasons.
- `SEARCH_TERM` (optional): Optional helper text if the filename can't be matched. This is useful when the list of 10 anime doesn't include the one you're renaming.

#### EXAMPLE

```sh
yarn start 'G:\Disc-Rips\One Punch Man- Season 2 Disc 1'
```
