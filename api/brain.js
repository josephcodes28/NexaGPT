/**
 * NexaGPT Central Brain V1
 *
 * One conversational entry point that decides which existing engine should
 * handle a request. It preserves the existing chat, website and content APIs.
 *
 * Route this endpoint at /api/brain.
 */

import chatHandler from "./chat.js";
import websiteHandler from "./website.js";
import contentHandler from "./content.js";

const MAX_MESSAGE_LENGTH = 12000;
const MAX_HISTORY_ITEMS = 20;

function cleanText(value, max = MAX_MESSAGE_LENGTH) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function sendJSON(res, status, data) {
  if (typeof res.status === "function") res.status(status);
  else res.statusCode = status;

  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }

  if (typeof res.json === "function") return res.json(data);
  return res.end(JSON.stringify(data));
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.slice(-MAX_HISTORY_ITEMS).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: cleanText(item?.content, 6000)
  })).filter((item) => item.content);
}

/**
 * Run an existing Vercel API handler internally without making an HTTP request.
 * Supports handlers that finish with res.json(data) or res.end(JSON.stringify(data)).
 */
async function invokeHandler(handler, body) {
  let statusCode = 200;
  let responseData = null;
  let responseText = "";

  const mockRes = {
    status(code) {
      statusCode = Number(code) || 200;
      return this;
    },
    setHeader() {
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    end(value) {
      responseText = value == null ? "" : String(value);
      if (responseData == null && responseText) {
        try { responseData = JSON.parse(responseText); } catch { responseData = { text: responseText }; }
      }
      return this;
    }
  };

  const mockReq = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body
  };

  await handler(mockReq, mockRes);

  if (responseData == null) {
    responseData = responseText ? { text: responseText } : {};
  }

  return { statusCode, data: responseData };
}

function lastAssistantMessage(history) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === "assistant") return history[index].content;
  }
  return "";
}

function lastUserMessage(history) {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].role === "user") return history[index].content;
  }
  return "";
}

function classifyRequest(message, history) {
  const text = message.toLowerCase();
  const previousAssistant = lastAssistantMessage(history).toLowerCase();
  const previousUser = lastUserMessage(history).toLowerCase();

  const websiteTerms =
    /\b(website|web site|webpage|web page|landing page|online store|e[- ]?commerce|portfolio site|business site|restaurant site|booking site)\b/i;
  const websiteAction =
    /\b(build|create|make|generate|design|develop|code|改|update|redesign|improve|edit|change|add|remove|fix)\b/i;
  const contentTerms =
    /\b(caption|blog post|article|email|newsletter|ad copy|advert copy|social media post|content calendar|video script|youtube script|product description|press release|proposal|write-up)\b/i;
  const contentAction =
    /\b(write|create|draft|generate|make|rewrite|improve|edit|polish|prepare|compose)\b/i;
  const followUp =
    /^(and |also |now |please )?(change|add|remove|make|update|improve|edit|fix|rewrite|continue|do that|make it|use )\b/i.test(text) ||
    /\b(change the colour|change the color|add a section|make it responsive|make it better)\b/i.test(text);

  const priorWasWebsite = websiteTerms.test(previousUser) ||
    /\b(website|webpage|html|css|javascript|landing page|online store)\b/i.test(previousAssistant);
  const priorWasContent = contentTerms.test(previousUser) ||
    /\b(caption|article|blog post|content draft|video script)\b/i.test(previousAssistant);

  // Keep a clear explicit request for a website above generic writing requests.
  if (websiteTerms.test(text) && (websiteAction.test(text) || /\b(my business|for my|for a)\b/i.test(text))) {
    return { capability: "website", reason: "explicit_website_request" };
  }
  if (followUp && priorWasWebsite) {
    return { capability: "website", reason: "website_follow_up" };
  }
  if (contentTerms.test(text) && contentAction.test(text)) {
    return { capability: "content", reason: "explicit_content_request" };
  }
  if (followUp && priorWasContent) {
    return { capability: "content", reason: "content_follow_up" };
  }

  return { capability: "chat", reason: "general_conversation" };
}

function buildWebsiteBrief(message, history) {
  const recent = history.slice(-8).map((item) =>
    `${item.role === "assistant" ? "NexaGPT" : "User"}: ${item.content}`
  ).join("\n");

  return [
    "Create or update a complete, professional, responsive website based on this conversation.",
    "Treat the latest user message as the requested change or instruction.",
    "Preserve relevant requirements from earlier messages in the conversation.",
    "",
    "RECENT CONVERSATION:",
    recent || "(No earlier conversation.)",
    "",
    "LATEST REQUEST:",
    message
  ].join("\n");
}

function buildContentBrief(message, history) {
  const recent = history.slice(-8).map((item) =>
    `${item.role === "assistant" ? "NexaGPT" : "User"}: ${item.content}`
  ).join("\n");

  return [
    "Create the requested content. Follow the user's format, audience, tone and constraints.",
    "Use the recent conversation for context and treat the latest message as the current instruction.",
    "",
    "RECENT CONVERSATION:",
    recent || "(No earlier conversation.)",
    "",
    "LATEST REQUEST:",
    message
  ].join("\n");
}

function normalizeWebsiteResult(data) {
  const files = data?.files;
  if (!files || typeof files.html !== "string" ||
      typeof files.css !== "string" || typeof files.js !== "string") {
    return {
      success: false,
      error: data?.error || "The website engine did not return all three website files."
    };
  }

  return {
    success: true,
    reply: data.note ||
      "I've created the website files. Review the generated files below. Tell me what you want changed and I'll work on the next version.",
    artifact: {
      type: "website",
      title: "Website project",
      files: {
        html: files.html,
        css: files.css,
        js: files.js
      }
    },
    provider: data.provider || null,
    model: data.model || null,
    fallbackUsed: Boolean(data.fallbackUsed)
  };
}

function normalizeContentResult(data) {
  const content = data?.content || data?.text || data?.reply ||
    data?.result || data?.output || "";

  if (!content) {
    return {
      success: false,
      error: data?.error || "The content engine did not return generated content."
    };
  }

  return {
    success: true,
    reply: "I've prepared the content. You can review it below and tell me what you'd like changed.",
    artifact: {
      type: "content",
      title: "Created content",
      content: String(content)
    },
    provider: data.provider || null,
    model: data.model || null
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    return sendJSON(res, 405, {
      success: false,
      error: "Only POST requests are supported."
    });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const message = cleanText(body.message);

    if (!message && (!Array.isArray(body.attachments) || body.attachments.length === 0)) {
      return sendJSON(res, 400, {
        success: false,
        error: "Please enter a message or attach an image."
      });
    }

    const history = normalizeHistory(body.history);
    const route = classifyRequest(message, history);

    if (route.capability === "website") {
      const result = await invokeHandler(websiteHandler, {
        action: "generate",
        brief: buildWebsiteBrief(message, history)
      });

      if (result.statusCode < 200 || result.statusCode >= 300 || result.data?.success === false) {
        return sendJSON(res, result.statusCode >= 400 ? result.statusCode : 502, {
          success: false,
          capability: "website",
          error: result.data?.error || "The website engine could not complete this request."
        });
      }

      const normalized = normalizeWebsiteResult(result.data);
      return sendJSON(res, normalized.success ? 200 : 502, {
        ...normalized,
        capability: "website",
        routing: { reason: route.reason }
      });
    }

    if (route.capability === "content") {
      const result = await invokeHandler(contentHandler, {
        action: "generate",
        brief: buildContentBrief(message, history)
      });

      if (result.statusCode < 200 || result.statusCode >= 300 || result.data?.success === false) {
        return sendJSON(res, result.statusCode >= 400 ? result.statusCode : 502, {
          success: false,
          capability: "content",
          error: result.data?.error || "The content engine could not complete this request."
        });
      }

      const normalized = normalizeContentResult(result.data);
      return sendJSON(res, normalized.success ? 200 : 502, {
        ...normalized,
        capability: "content",
        routing: { reason: route.reason }
      });
    }

    // General conversation, reasoning, research and image-understanding requests
    // continue through the existing main chat engine.
    const chatResult = await invokeHandler(chatHandler, {
      ...body,
      message,
      history
    });

    return sendJSON(res, chatResult.statusCode, {
      ...chatResult.data,
      success: chatResult.data?.success !== false,
      capability: "chat",
      routing: { reason: route.reason }
    });
  } catch (error) {
    console.error("[NexaGPT Brain]", error);
    return sendJSON(res, 500, {
      success: false,
      error: "NexaGPT encountered an internal error while processing your request."
    });
  }
}
