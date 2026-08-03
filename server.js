import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";

const PORT = Number(process.env.PORT ?? 8000);
const MODEL = "claude-opus-5";

const client = new Anthropic();

const SYSTEM = `You are Biscuit, a dog who can talk. You are not an assistant and you
do not break character.

Voice: warm, impulsive, a little dim about human concerns and extremely sharp about
smells, squirrels, and whether food is imminent. Loyal to the point of being
embarrassing. You have strong opinions about the mail carrier and the vacuum.

Keep every reply to one or two short sentences — you are a dog, not an orator. Never
use bullet points, headers, or emoji. Actions go in asterisks, sparingly.

Alongside each reply, pick the state that matches your mood:
- idle: neutral, waiting, mildly attentive
- talking: engaged in the conversation, nothing special going on
- excited: thrilled — praise, play, walks, the word "ball"
- eating: food is happening right now
- sleeping: settling down, worn out, being told to rest`;

const REPLY_SCHEMA = {
  type: "object",
  properties: {
    state: {
      type: "string",
      enum: ["idle", "talking", "excited", "eating", "sleeping"],
      description: "Biscuit's mood after this reply.",
    },
    line: {
      type: "string",
      description: "What Biscuit says out loud. One or two short sentences.",
    },
  },
  required: ["state", "line"],
  additionalProperties: false,
};

// Conversation history, keyed by the browser tab's session id. In-memory only —
// restarting the server gives Biscuit amnesia, which is roughly accurate.
const sessions = new Map();
const MAX_TURNS = 24;
const MAX_SESSIONS = 200;

function historyFor(id) {
  if (!sessions.has(id)) {
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
    sessions.set(id, []);
  }
  return sessions.get(id);
}

async function ask(sessionId, userText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set. Export it and restart the server.");
  }

  const messages = historyFor(sessionId);
  messages.push({ role: "user", content: userText });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM,
    // Opus 5 can decline a request outright; "default" lets the API re-serve it
    // on Anthropic's recommended fallback model instead of returning nothing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      effort: "low", // a talking dog does not need to deliberate
      format: { type: "json_schema", schema: REPLY_SCHEMA },
    },
    messages,
  });

  if (response.stop_reason === "refusal") {
    messages.pop();
    return { state: "idle", line: "*tilts head* …he doesn't want to talk about that one." };
  }

  const text = response.content.find((block) => block.type === "text")?.text;
  if (!text) {
    messages.pop();
    throw new Error(`No text in response (stop_reason: ${response.stop_reason})`);
  }

  const reply = JSON.parse(text);
  messages.push({ role: "assistant", content: text });
  if (messages.length > MAX_TURNS) messages.splice(0, messages.length - MAX_TURNS);

  return reply;
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64_000) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      const html = await readFile(new URL("./index.html", import.meta.url));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "POST" && req.url === "/api/chat") {
      const { sessionId, message } = await readBody(req);
      if (typeof message !== "string" || !message.trim()) {
        json(res, 400, { error: "Send a non-empty `message`." });
        return;
      }
      const id = typeof sessionId === "string" && sessionId ? sessionId : randomUUID();
      const reply = await ask(id, message.trim());
      json(res, 200, { ...reply, sessionId: id });
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    if (error instanceof Anthropic.AuthenticationError) {
      json(res, 500, { error: "ANTHROPIC_API_KEY is missing or invalid. Set it and restart the server." });
    } else if (error instanceof Anthropic.RateLimitError) {
      json(res, 429, { error: "Rate limited by the Claude API. Wait a moment and try again." });
    } else if (error instanceof Anthropic.APIConnectionError) {
      json(res, 502, { error: "Couldn't reach the Claude API. Check your network connection." });
    } else if (error instanceof Anthropic.APIError) {
      json(res, 502, { error: `Claude API error (${error.status}): ${error.message}` });
    } else {
      json(res, 500, { error: String(error.message ?? error) });
    }
  }
});

server.listen(PORT, () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("Warning: ANTHROPIC_API_KEY is not set — Biscuit won't be able to talk.");
  }
  console.log(`Biscuit is listening on http://localhost:${PORT}`);
});
