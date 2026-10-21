# Sound effects

Sound is enabled for new visitors. A saved preference in localStorage takes
precedence. The controller synthesizes several short effects with the Web Audio
API; those effects do not need audio files. Missing optional recordings are
handled gracefully.

## Synthesized in the browser

| Trigger | Effect |
| --- | --- |
| `drawTap` | Soft wooden tap when fortune drawing starts |
| `revealChime` | Gentle bell chime when the fortune is revealed |
| `woodFish` | Warm confirmation tap for 顺天命 |
| `meritChime` | Bright, ascending reward chime for 功德 +3226 |
| `paperPlace` | Subtle wooden click when adding a task |
| `taskComplete` | Short two-note wooden completion sound |

## Optional recordings still required

Place optional recordings here using these exact names. Missing files will not
prevent the app from working.

| File | Used for | Status |
| --- | --- | --- |
| `fortune-rattle.mp3` | Bamboo/wooden fortune sticks shaking during draw | Missing |
| `paper-slide.mp3` | Fortune paper sliding out | Missing |
| `paper-ignition.mp3` | Burning ignition | Missing |
| `fire-crackle-loop.mp3` | Fire sound during burning | Missing |
| `nezha-voice.mp3` | User-provided Nezha voice line | Installed |

The Nezha voice line was supplied by the site owner and is included at
`public/sounds/nezha-voice.mp3`. The other file triggers remain optional.
