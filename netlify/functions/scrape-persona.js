/**
 * AlwayZ — scrape-persona.js
 * Netlify serverless function
 *
 * Accepts multiple URLs, fetches each server-side (bypasses CORS),
 * strips HTML to readable text, then passes all content to Claude
 * which extracts structured persona signals in one consolidated pass.
 *
 * POST /api/scrape-persona
 * Body: { urls: string[] }
 * Returns: { persona: PersonaSignals, sources: SourceMeta[] }
 */

const https = require("https");
const http = require("http");
const { URL } = require("url");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Fetch a URL with a browser-like user-agent.
 * Follows up to 3 redirects. Returns raw HTML string.
 */
function fetchUrl(rawUrl, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return reject(new Error(`Invalid URL: ${rawUrl}`));
    }

    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
      },
      timeout: 12000,
    };

    const req = lib.request(options, (res) => {
      // Handle redirects
      if (
        [301, 302, 303, 307, 308].includes(res.statusCode) &&
        res.headers.location &&
        redirectsLeft > 0
      ) {
        const next = res.headers.location.startsWith("http")
          ? res.headers.location
          : `${parsed.protocol}//${parsed.hostname}${res.headers.location}`;
        return resolve(fetchUrl(next, redirectsLeft - 1));
      }

      if (res.statusCode < 200 || res.statusCode >= 400) {
        return reject(
          new Error(`HTTP ${res.statusCode} for ${rawUrl}`)
        );
      }

      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${rawUrl}`));
    });
    req.on("error", reject);
    req.end();
  });
}

/**
 * Strip HTML tags and collapse whitespace to plain readable text.
 * Also removes scripts, styles, nav, footer, and cookie banners
 * so Claude sees signal-rich content only.
 */
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Call Anthropic Claude API.
 * Returns the text content of the first message block.
 */
function callClaude(systemPrompt, userMessage) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body),
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          if (data.error) return reject(new Error(data.error.message));
          const text = (data.content || [])
            .filter((b) => b.type === "text")
            .map((b) => b.text)
            .join("");
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
      res.on("error", reject);
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Claude API timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a compassionate AI assistant helping grieving families build accurate, meaningful digital personas of loved ones who have passed away.

You will receive scraped text from one or more web pages (obituaries, social profiles, memorial pages, LinkedIn profiles, news features, etc.). Your job is to extract persona-building signals and return them as a single JSON object.

IMPORTANT RULES:
- Only extract what is explicitly present or strongly implied — never fabricate
- If a field has no evidence, return an empty array or null
- Consolidate signals from ALL sources into one unified persona
- Preserve real phrases and quotes verbatim when found — these are gold
- Infer speaking style from vocabulary and sentence patterns when possible
- Be sensitive: this content relates to a deceased person

Return ONLY valid JSON — no markdown fences, no preamble, no explanation.

JSON schema:
{
  "name": "string | null — full name if found",
  "relationship_clues": ["string"] — roles/relationships mentioned (e.g. 'devoted father', 'retired nurse')",
  "personality_traits": ["string"] — adjectives and character traits (e.g. 'warm', 'fiercely funny', 'stubborn in the best way')",
  "speaking_style": "string | null — description of how they communicated (e.g. 'direct and witty, never wasted words', 'told long meandering stories that always had a point')",
  "favorite_sayings": ["string"] — exact quoted phrases, expressions, or verbal tics",
  "topics_they_loved": ["string"] — subjects, hobbies, passions they frequently discussed",
  "people_they_loved": ["string"] — names of family members, friends mentioned",
  "life_stories": ["string"] — specific anecdotes, memories, or life events worth preserving",
  "values": ["string"] — what they believed in, stood for, cared about deeply",
  "career_identity": "string | null — how they defined themselves professionally or in service",
  "humor_style": "string | null — how/if they used humor",
  "sources_used": ["string"] — brief label for each source processed (e.g. 'Obituary', 'LinkedIn', 'Facebook profile')
}`;

// ─── Lambda handler ───────────────────────────────────────────────────────────

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  let urls = [];
  try {
    const body = JSON.parse(event.body || "{}");
    urls = Array.isArray(body.urls) ? body.urls : [];
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  // Validate
  urls = urls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter((u) => u.startsWith("http"));

  if (urls.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "No valid URLs provided" }),
    };
  }

  if (urls.length > 6) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Maximum 6 URLs per request" }),
    };
  }

  // ── Fetch all URLs in parallel ──────────────────────────────────────────────
  const fetchResults = await Promise.allSettled(urls.map(fetchUrl));

  const sources = [];
  const textBlocks = [];

  fetchResults.forEach((result, i) => {
    const url = urls[i];
    const label = (() => {
      try {
        return new URL(url).hostname.replace("www.", "");
      } catch {
        return url;
      }
    })();

    if (result.status === "fulfilled") {
      const text = htmlToText(result.value);
      // Truncate each source to ~4000 chars to keep total context manageable
      const truncated = text.length > 4000 ? text.slice(0, 4000) + "…" : text;
      textBlocks.push(`=== SOURCE: ${label} ===\n${truncated}`);
      sources.push({ url, label, status: "ok", chars: text.length });
    } else {
      sources.push({
        url,
        label,
        status: "error",
        error: result.reason?.message || "Unknown error",
      });
    }
  });

  if (textBlocks.length === 0) {
    return {
      statusCode: 422,
      headers,
      body: JSON.stringify({
        error: "All URLs failed to load",
        sources,
      }),
    };
  }

  // ── Call Claude ─────────────────────────────────────────────────────────────
  let rawJson;
  try {
    const userMessage =
      `Extract persona signals from the following ${textBlocks.length} source(s):\n\n` +
      textBlocks.join("\n\n");

    rawJson = await callClaude(SYSTEM_PROMPT, userMessage);
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: "Claude extraction failed",
        detail: err.message,
        sources,
      }),
    };
  }

  // ── Parse Claude's JSON response ────────────────────────────────────────────
  let persona;
  try {
    // Strip any accidental markdown fences just in case
    const clean = rawJson
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    persona = JSON.parse(clean);
  } catch {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({
        error: "Failed to parse Claude response as JSON",
        raw: rawJson,
        sources,
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ persona, sources }),
  };
};
