# dog

Biscuit, a talking dog wired up to Claude. A tiny Node server holds the API key and
talks to the Claude API; the browser handles the voice and the animation.

## Run it

```sh
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npm start
# then visit http://localhost:8000
```

`PORT` overrides the port. Without a key the page loads and Biscuit tells you the
key is missing.

## How it works

```
browser  ──POST /api/chat──►  server.js  ──messages.create──►  Claude API
   ▲                             │
   └── { state, line } ──────────┘
```

- **The key never reaches the browser.** `server.js` holds it and is the only thing
  that calls Anthropic. The page only ever talks to `/api/chat`.
- **Claude picks the mood, not just the words.** The request uses structured outputs
  (`output_config.format`) with a schema of `{ state, line }`, where `state` is one of
  the five animation states. So the reply and the animation always agree, with no
  keyword-sniffing on our side.
- **Model:** `claude-opus-5` at `effort: "low"` — a dog doesn't need to deliberate,
  and low effort keeps replies fast and cheap. Thinking stays on (the default), which
  avoids the failure modes that come with disabling it.
- **Refusals:** the request opts into `fallbacks: "default"`, so if Claude's safety
  classifiers decline something, the API re-serves it on a fallback model instead of
  returning nothing. A refusal that survives that gets a in-character deflection.
- **Memory:** conversation history lives in `server.js` in a `Map`, keyed per browser
  tab and capped at 24 messages. Restarting the server gives Biscuit amnesia.

## Voice

Anthropic doesn't offer speech APIs, so both directions use the browser's built-in
Web Speech API — no extra key, no extra service:

- **Out:** `SpeechSynthesis` reads Biscuit's replies aloud. Toggle with **Voice**.
- **In:** `SpeechRecognition` behind the 🎤 button. This is Chrome/Edge only today;
  in other browsers the button is disabled and you type instead.

## States

The chip beside his name always shows the current state, and each drives its own
animation:

| State      | Meaning                          | Animation                       |
| ---------- | -------------------------------- | ------------------------------- |
| `idle`     | neutral, waiting                 | slow tail wag                   |
| `talking`  | engaged in conversation          | jaw moves, steady wag           |
| `excited`  | praise, play, walks, "ball"      | fast wag, tongue out            |
| `eating`   | food is happening                | head bobs, tongue out           |
| `sleeping` | settling down                    | eyes shut, floating `z`s        |

**Sleep** is a local toggle and doesn't call the API. Everything else — including the
**Pet**, **Feed**, and **Trick** buttons, which just send canned messages — goes to Claude.

The page respects `prefers-reduced-motion` and follows your light or dark theme.
