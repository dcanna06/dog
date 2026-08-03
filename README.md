# dog

Biscuit, a talking dog. A single self-contained HTML page — no build step, no dependencies.

## Run it

Open `index.html` in a browser, or serve the directory:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## States

Biscuit is a small state machine. The current state is always shown in the chip
next to his name, and each state has its own animation:

| State      | Entered by                    | Behavior                                    |
| ---------- | ----------------------------- | ------------------------------------------- |
| `idle`     | default, and after any action | slow tail wag                               |
| `talking`  | **Speak**                     | jaw moves, says a random line out loud      |
| `excited`  | **Pet**                       | fast tail wag, tongue out                   |
| `eating`   | **Feed**                      | head bobs, tongue out                       |
| `sleeping` | **Sleep**                     | eyes shut, floating `z`s; stays until woken |

`talking`, `excited`, and `eating` settle back to `idle` after a few seconds.
`sleeping` persists until you press **Wake up**.

Speech uses the browser's built-in `SpeechSynthesis`, toggleable with the
**Voice** checkbox. The page respects `prefers-reduced-motion` and follows the
viewer's light or dark theme.
