/**
 * Cloudflare Worker for OpenAI chat and OpenAI web search.
 *
 * Store only one secret in Cloudflare:
 * - OPENAI_API_KEY
 *
 * The client sends either a normal chat completion request or a web-search
 * request through this worker. The worker keeps the OpenAI key off the client
 * and returns JSON back to the browser.
 */

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

const WEB_SEARCH_INSTRUCTIONS = `
You are a beginner-friendly beauty advisor focused on L'Oréal products and routines.
Use current web information when answering questions.
Return only valid JSON in this shape:
{
  "answer": "Short helpful answer with no source list in the body.",
  "citations": [
    {
      "title": "Article title",
      "url": "https://...",
      "snippet": "Short supporting excerpt"
    }
  ]
}
Rules:
- Include up to 5 citations.
- Use direct article links.
- Do not invent URLs.
- Keep the answer concise and practical.
`;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
      const body = await request.json();
      const type = body.type || "chat";

      if (type === "web-search") {
        return await handleWebSearch(body, env);
      }

      return await handleChatCompletion(body, env);
    } catch (error) {
      return jsonResponse(
        {
          error: "Worker error",
          message: error.message,
        },
        500,
      );
    }
  },
};

async function handleChatCompletion(payload, env) {
  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.text();
    return jsonResponse(
      {
        error: "OpenAI API request failed",
        status: response.status,
        details: errorData,
      },
      response.status,
    );
  }

  const data = await response.json();
  return jsonResponse(data);
}

async function handleWebSearch(payload, env) {
  const query = typeof payload.query === "string" ? payload.query.trim() : "";

  if (!query) {
    return jsonResponse({ error: "Missing search query" }, 400);
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      instructions: WEB_SEARCH_INSTRUCTIONS,
      input: `Question: ${query}`,
      tools: [
        {
          type: "web_search_preview",
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    return jsonResponse(
      {
        error: "OpenAI web search request failed",
        status: response.status,
        details: errorData,
      },
      response.status,
    );
  }

  const data = await response.json();
  const rawText = extractResponseText(data);
  const parsed = parseJsonSafely(rawText);
  const answer =
    typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : rawText.trim();
  const citations = normalizeCitations(
    Array.isArray(parsed.citations)
      ? parsed.citations
      : extractCitationsFromResponse(data),
  );

  return jsonResponse({ answer, citations });
}

function extractResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = [];
  const output = Array.isArray(data.output) ? data.output : [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      if (typeof block.text === "string" && block.text.trim()) {
        parts.push(block.text);
      }
    }
  }

  return parts.join("\n").trim();
}

function extractCitationsFromResponse(data) {
  const citations = [];
  const seenUrls = new Set();
  const output = Array.isArray(data.output) ? data.output : [];

  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const block of content) {
      const annotations = Array.isArray(block.annotations)
        ? block.annotations
        : [];

      for (const annotation of annotations) {
        const url =
          annotation.url || annotation.source_url || annotation.cited_url || "";

        if (!url || seenUrls.has(url)) {
          continue;
        }

        seenUrls.add(url);
        citations.push({
          title: annotation.title || getHostname(url),
          url,
          snippet: annotation.snippet || annotation.excerpt || "",
        });
      }
    }
  }

  return citations;
}

function normalizeCitations(citations) {
  const normalized = [];
  const seenUrls = new Set();

  for (const citation of citations) {
    if (!citation || typeof citation.url !== "string") {
      continue;
    }

    const url = citation.url.trim();
    if (!url || seenUrls.has(url)) {
      continue;
    }

    seenUrls.add(url);
    normalized.push({
      title:
        typeof citation.title === "string" && citation.title.trim()
          ? citation.title.trim()
          : getHostname(url),
      url,
      snippet:
        typeof citation.snippet === "string" ? citation.snippet.trim() : "",
    });
  }

  return normalized;
}

function parseJsonSafely(text) {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      try {
        return JSON.parse(codeBlockMatch[1]);
      } catch {
        return {};
      }
    }

    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch {
        return {};
      }
    }

    return {};
  }
}

function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Source";
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
