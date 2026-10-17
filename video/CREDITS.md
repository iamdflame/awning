# Credits and licenses

Every third-party file in the film, where it came from and under which license. The files are not in the repository (the licenses cover using them in the film, not redistributing them on their own); `npm run assets` downloads the exact files listed in `assets.json`, and refuses a Mixkit clip whose page no longer shows the Free license.

## Stock footage (vo-02, "small businesses")

The b-roll illustrates small businesses in general. The people in it are not Awning users and none of it is Ridge Roast; every product shot in the film is the real product.

| In the film | Clip | Author | License |
|---|---|---|---|
| `stock/roast.mp4` | [Person roasting coffee beans](https://mixkit.co/free-stock-video/person-roasting-coffee-beans-4676/) | Mixkit (no individual creator credited on the page) | [Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree) |
| `stock/market.mp4` | [Slow motion video of a fruit and veggie stand](https://mixkit.co/free-stock-video/slow-motion-video-of-a-fruit-and-veggie-stand-991/) | Mixkit (no individual creator credited) | Mixkit Stock Video Free License |
| `stock/bike.mp4` | [Man maintaining a motorcycle](https://mixkit.co/free-stock-video/man-maintaining-a-motorcycle-41935/) | Mixkit (no individual creator credited) | Mixkit Stock Video Free License |
| `stock/pottery.mp4` | [A female ceramic artist working](https://mixkit.co/free-stock-video/a-female-ceramic-artist-working-1975/) | Mixkit (no individual creator credited) | Mixkit Stock Video Free License |
| `stock/shutter.mp4` | [Barista cleaning a coffee machine](https://mixkit.co/free-stock-video/barista-cleaning-a-coffee-machine-817/) | Mixkit (no individual creator credited) | Mixkit Stock Video Free License |

The Mixkit Stock Video Free License allows commercial and non-commercial use, including social media posts, online marketing and broadcast; attribution is not required. Mixkit also has a *Restricted* license (non-commercial only): many Mixkit clips (including its bike-repair, shop-sign and roaster-drum clips) are under it, so none of those are used.

**Not found:** a market stall in West Africa under a license we can use. Mixkit has none; Pexels and Pixabay block scripted downloads without an API key. To use one (for example from [Pexels](https://www.pexels.com/license/), free for commercial use, no attribution required), download the 1080p file yourself, save it as `public/stock/market.mp4`, and replace the `market` row here and in `assets.json` with its URL and author.

## Music

| Track | Author | License |
|---|---|---|
| [Music and Life](https://assets.mixkit.co/music/852/852.mp3) (listed on [Mixkit, Happy](https://mixkit.co/free-stock-music/mood/happy/)) | Michael Ramir C. | [Mixkit Stock Music Free License](https://mixkit.co/license/#musicFree) |

Allowed: social media video posts, online marketing ads, YouTube videos, podcasts. Not allowed: CDs/DVDs, TV and radio broadcast, video games, remixing it into a music-only track. If YouTube shows a claim, forward it to team@mixkit.co. A track the founder adds as `public/audio/music.mp3` replaces it automatically (list it here).

## Sound effects

All from Mixkit under the [Mixkit Sound Effects Free License](https://mixkit.co/license/#sfxFree) (commercial use, film and broadcast allowed; not to be redistributed on their own).

| In the film | Sound |
|---|---|
| `audio/sfx/print.wav` (receipts printing) | Vintage dot printing (1371) |
| `audio/sfx/chime.wav` (PayBox approvals) | Confirmation tone (2867) |
| `audio/sfx/pop.wav` (+5.00, tags) | Bubble pop up alert notification (2357) |
| `audio/sfx/cloth.wav` (the canopy) | Cloth slide out (1898) |
| `audio/sfx/type.wav` (the sentence being typed) | Typing on an electronic device (1376) |
| `audio/sfx/bell.wav` (the shop opens) | Service bell (931) |

## Type

All from [Google Fonts](https://github.com/google/fonts) under the [SIL Open Font License 1.1](https://openfontlicense.org): Archivo (Omnibus-Type) and Martian Mono (Evil Martians), Awning's own faces; Alfa Slab One, Big Shoulders Display, Young Serif, Shrikhand, Rubik Mono One, Gloock, Bagel Fat One and Work Sans, the storefronts' faces on the street.

## Everything else

- **Narration:** the founder's own voice (an ElevenLabs clone the founder made and generated, `scripts/generate-voice.mjs`). The Windows text-to-speech scratch voice (`npm run scratch-voice`) is only for timing and never ships.
- **Captions:** timed with whisper.cpp (`@remotion/install-whisper-cpp`, MIT) on the final takes, worded from the script.
- **Product footage:** filmed from awning.sh and ridgeroast.shop with Playwright (`npm run capture`): the landing, /for-agents, /directory, /live and the live storefront. The agent scenes are the founder's own screen recordings (`public/rec/`: owner1.mp4, buyer.mp4, owner2.mp4), cut with `edl.json`.
- **BaseScan:** one screenshot of the sale's public transaction page (basescan.org, `0x893b3f…9e7651`), shown as the on-chain record it is; the page's third-party ads are hidden, nothing of the transaction is changed.
- **Logo, palette, the street, receipts and every drawn object:** Awning's own design (`design/`).
