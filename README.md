# copyright bypass skip

skips the silence some soundcloud uploads put in songs to get past copyright detection (like a minute of nothing before the song actually starts)

works as a [soundcloud-rpc](https://github.com/richardhbtz/soundcloud-rpc) plugin and as a browser extension for chrome, edge, brave and firefox

## how it works

every soundcloud track has a waveform and padded silence is just a flat line of zeros in it. when a track comes up it grabs the waveform, finds any flat part thats 5s or longer and jumps past it. silence at the end skips to the next track

## install

### soundcloud-rpc

1. download `copyright-bypass-skip.js` from [releases](../../releases/latest)
2. in soundcloud-rpc press F1, go to plugins, click open plugins folder and drop the file in (dont rename it)
3. click refresh plugins and turn it on

settings are at the top of the file

### chrome / edge / brave

1. download `copyright-bypass-skip-extension.zip` from [releases](../../releases/latest) and unzip it
2. go to `chrome://extensions` and turn on developer mode
3. click load unpacked and pick the unzipped folder

### firefox

needs firefox 140 or newer

1. download and unzip `copyright-bypass-skip-extension.zip`
2. go to `about:debugging#/runtime/this-firefox` and click load temporary add-on
3. pick `manifest.json` from the folder (firefox removes it again when you restart)

## settings

click the extension icon, or edit the top of the plugin file

| setting | default | |
| --- | --- | --- |
| `skipLeading` | on | skip silence at the start |
| `skipMiddle` | on | skip silence in the middle |
| `skipTrailing` | on | skip silence at the end and go to the next track |
| `minSilenceSeconds` | 5 | shorter silence than this gets left alone |
| `silenceLevel` | 2 | waveform bars go from 0 to 140, anything at or below this counts as silence. raise it if a song is padded with quiet noise instead of silence |
| `showToast` | on | show a "Skipped 1:01 of silence" message |

if soundcloud changes their site this might break until its updated

## building

needs node 18+, no dependencies

```bash
npm run build
```

puts the plugin in `dist/copyright-bypass-skip.js` and the extension in `dist/extension/`

## license

[MIT](LICENSE)
