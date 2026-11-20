
"use strict";

/*
 * NEXAGPT — INTERNAL TOOL DISPATCHER
 *
 * Routes requests to existing capability engines.
 * This module does not make public HTTP requests.
 */

import websiteHandler from "./website.js";
import contentHandler from "./content.js";

function cleanText(value, maxLength = 12000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/*
 * Identify the requested capability.
 * Ordinary conversation remains with the central Brain.
 */

export function classifyRequest(message) {
  const text = cleanText(message).toLowerCase();

  const websitePatterns = [
    /\b(build|create|design|develop|make|generate)\b.{0,100}\b(website|web site|webpage|web page|landing page|online store|e-commerce site)\b/,
    /\b(website|web site|webpage|web page|landing page|online store)\b.{0,100}\b(build|create|design|develop|make)\b/
  ];

  const contentPatterns = [
    /\b(write|create|generate|draft|compose|produce)\b.{0,100}\b(caption|article|blog post|social media post|advertisement|ad copy|video script|story|product description|marketing copy)\b/,
    /\b(caption|article|blog post|social media post|advertisement|ad copy|video script|story|product description)\b.{0,100}\b(write|create|generate|draft)\b/
  ];

  if (websitePatterns.some(pattern => pattern.test(text))) {
    return "website";
  }

  if (contentPatterns.some(pattern => pattern.test(text))) {
    return "content";
  }

  return "chat";
}

/*
 * Create an internal response object compatible
 * with the existing Vercel API handlers.
 */

async function invokeHandler(handler, body) {
  let statusCode = 200;
  let responseData = null;
  let responseEnded = false;

  const response = {
    status(code) {
      statusCode = code;
      return this;
    },

    setHeader() {
      return this;
    },

    json(data) {
      responseData = data;
      responseEnded = true;
      return this;
    },

    end(data) {
      if (typeof data === "string") {
        try {
          responseData = JSON.parse(data);
        } catch {
          responseData = {
            success: false,
            error: "The internal tool returned an invalid response."
          };
        }
      } else {
        responseData = data;
      }

      responseEnded = true;
      return this;
    }
  };

  const request = {
    method: "POST",
    body
  };

  await handler(request, response);

  if (!responseEnded || !responseData) {
    throw new Error(
      "The internal tool did not return a response."
    );
  }

  return {
    status: statusCode,
    data: responseData
  };
}

/*
 * Execute the selected capability.
 */

export async function dispatchCapability(message) {
  const request = cleanText(message);

  if (!request) {
    return {
      handled: false,
      capability: "chat"
    };
  }

  const capability = classifyRequest(request);

  if (capability === "chat") {
    return {
      handled: false,
      capability: "chat"
    };
  }

  let result;

  if (capability === "website") {
    result = await invokeHandler(websiteHandler, {
      action: "generate",
      brief: {
        projectName: "",
        description: request
      }
    });
  }

  if (capability === "content") {
    result = await invokeHandler(contentHandler, {
      action: "generate",
      brief: {
        contentType: "User requested content",
        instructions: request,
        topic: request
      }
    });
  }

  if (!result || !result.data) {
    throw new Error("The requested capability could not be executed.");
  }

  if (result.status < 200 || result.status >= 300) {
    return {
      handled: true,
      success: false,
      capability,
      error:
        result.data.error ||
        "The requested capability could not complete the task."
    };
  }

  return {
    handled: true,
    success: result.data.success === true,
    capability,
    result: result.data
  };
}
