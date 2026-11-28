import { callGemini, parseJson, clean } from "./_shared.js";

const ROUTES = new Set(["website", "app", "game", "jobs", "image", "video", "ideas", "chat"]);
const WEBSITE_TYPES = new Set(["frontend", "backend", "fullstack", "website"]);
const GAME_TYPES = new Set(["2d", "3d", "2d_and_3d", "game"]);
const MEDIA_ACTIONS = new Set(["image_generation", "image_edit", "image_to_video", "video_generation", "video_edit", "video_style_transfer", "video_idea", "media"]);

function fallbackIntent(text = "") {
  const value = String(text).toLowerCase();
  if (/\b(website|web site|webpage|web page|landing page|online store|e-?commerce|business site|portfolio site|barber|salon|restaurant|hotel|church website|real estate site|booking site|frontend|front[- ]end|backend|back[- ]end|full[- ]stack)\b/.test(value)) return "website";
  if (/\b(build|create|make|design|develop)\b[\s\S]{0,70}\b(app|application|mobile app|web app)\b|\b(app|application)\b[\s\S]{0,70}\b(build|create|make|design|develop)\b/.test(value)) return "app";
  if (/\b(game|driving game|racing game|platformer|3d game|2d game|playable game)\b/.test(value)) return "game";
  if (/\b(remote job|remote work|job opening|find.{0,20}job|jobs hiring|job application|work from home job)\b/.test(value)) return "jobs";
  if (/\b(video|clip|footage|image.to.video|edit.{0,30}video|video idea|animate this|3d style)\b/.test(value)) return "video";
  if (/\b(image|picture|photo|illustration|character reference|draw|generate an image|edit this photo)\b/.test(value)) return "image";
  if (/\b(youtube|niche|channel idea|video ideas|content ideas)\b/.test(value)) return "ideas";
  return "chat";
}

function normalizeTask(task, message) {
  const route = ROUTES.has(task?.route) ? task.route : fallbackIntent(message);
  return {
    route,
    websiteType: route === "website" && WEBSITE_TYPES.has(task?.websiteType) ? task.websiteType : (route === "website" ? "website" : null),
    gameType: route === "game" && GAME_TYPES.has(task?.gameType) ? task.gameType : (route === "game" ? "game" : null),
    mediaAction: ["image", "video"].includes(route) && MEDIA_ACTIONS.has(task?.mediaAction) ? task.mediaAction : (["image", "video"].includes(route) ? "media" : null),
    operation: clean(task?.operation, 80) || "create",
    userGoal: clean(task?.userGoal, 1200) || clean(message, 1200),
    requirements: Array.isArray(task?.requirements) ? task.requirements.slice(0, 20).map(x => clean(x, 300)).filter(Boolean) : [],
    constraints: Array.isArray(task?.constraints) ? task.constraints.slice(0, 20).map(x => clean(x, 300)).filter(Boolean) : [],
    needsClarification: Boolean(task?.needsClarification),
    clarificationQuestion: clean(task?.clarificationQuestion, 500),
    unsupportedCapability: clean(task?.unsupportedCapability, 120)
  };
}

export async function understandRequest(ctx) {
  if (ctx.selection?.kind && ROUTES.has(ctx.selection.kind)) {
    return normalizeTask({
      route: ctx.selection.kind,
      operation: "build_selected_concept",
      userGoal: ctx.message,
      requirements: [ctx.selection.title, ctx.selection.designBrief || ctx.selection.description].filter(Boolean)
    }, ctx.message);
  }

  const history = Array.isArray(ctx.history)
    ? ctx.history.slice(-8).map(item => item.role + ": " + clean(item.content, 1200)).join("\n")
    : "";
  const attachmentSummary = (ctx.attachments || []).map(file => ({
    name: clean(file?.name, 120),
    type: clean(file?.type, 80)
  }));

  const prompt = `You are the intent-understanding and task-planning layer for NexaGPT, an AI digital worker.
Interpret meaning, not isolated keywords. Use conversation context to resolve "make it 3D", "edit that", "continue the project", and references to prior work.
Do not claim actions have been performed. Select exactly one route: website, app, game, jobs, image, video, ideas, chat.
websiteType must distinguish frontend (HTML/CSS/browser UI), backend (server/API/database/auth/business logic), fullstack (both), website (general/unspecified).
gameType must distinguish 2d (flat 2D gameplay), 3d (spatial 3D scenes/camera/models), 2d_and_3d, game. A 3D-styled website is not a 3D game.
mediaAction: image_generation, image_edit, image_to_video, video_generation, video_edit, video_style_transfer, video_idea, media. "Turn this image into a video" means image_to_video. "Make this video 3D style" means video_style_transfer.
jobs means finding opportunities or preparing/applying for jobs. ideas means niches/content strategy. Ordinary email writing/sending and client communication route to chat unless a dedicated route exists.
Infer operation: create, edit, transform, find, apply, communicate, remember, continue, explain, other.
Capture explicit requirements and constraints faithfully. If the user asks to remember/continue a project, preserve it as that project, not a new project.
If an attachment is present, treat it as an input asset for edit/transform requests.
For multiple tasks, select the first actionable task and list the remaining tasks as requirements. Ask one question only if a necessary choice cannot be inferred.
Return JSON only:
{"route":"...","websiteType":"frontend|backend|fullstack|website|null","gameType":"2d|3d|2d_and_3d|game|null","mediaAction":"image_generation|image_edit|image_to_video|video_generation|video_edit|video_style_transfer|video_idea|media|null","operation":"...","userGoal":"...","requirements":["..."],"constraints":["..."],"needsClarification":false,"clarificationQuestion":"","unsupportedCapability":""}
Conversation:
${history}
Current request:
${clean(ctx.message, 12000)}
Attachments:
${JSON.stringify(attachmentSummary)}
`;

  try {
    const raw = await callGemini(prompt, { json: true, maxOutputTokens: 1800 });
    const parsed = parseJson(raw, null);
    if (parsed && ROUTES.has(parsed.route)) return normalizeTask(parsed, ctx.message);
  } catch (error) {
    console.warn("NexaGPT request understanding fallback:", error?.message || error);
  }
  return normalizeTask({ route: fallbackIntent(ctx.message) }, ctx.message);
}

import { handleWebsite } from "./engines/website.js";
import { handleApp } from "./engines/app.js";
import { handleGame } from "./engines/game.js";
import { handleJobs } from "./engines/jobs.js";
import { handleMedia } from "./engines/media.js";
import { handleIdeas } from "./engines/ideas.js";
import { handleChat } from "./engines/chat.js";

export function detectIntent(text, selection) {
  if (selection?.kind && ROUTES.has(selection.kind)) return selection.kind;
  return fallbackIntent(text);
}

export async function dispatch(ctx) {
  const task = await understandRequest(ctx);
  if (task.needsClarification && task.clarificationQuestion) {
    return { reply: task.clarificationQuestion, task };
  }
  const engines = {
    website: handleWebsite,
    app: handleApp,
    game: handleGame,
    jobs: handleJobs,
    image: handleMedia,
    video: handleMedia,
    ideas: handleIdeas,
    chat: handleChat
  };
  const engine = engines[task.route] || handleChat;
  const result = await engine({ ...ctx, intent: task.route, task });
  return { ...result, task };
}
