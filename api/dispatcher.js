import { handleWebsite } from "./engines/website.js";
import { handleApp } from "./engines/app.js";
import { handleGame } from "./engines/game.js";
import { handleJobs } from "./engines/jobs.js";
import { handleMedia } from "./engines/media.js";
import { handleIdeas } from "./engines/ideas.js";
import { handleChat } from "./engines/chat.js";

export function detectIntent(text, selection) {
  if (selection?.kind) return selection.kind;

  const value = String(text || "").toLowerCase();

  if (/\b(website|web site|webpage|web page|landing page|online store|e-?commerce|business site|portfolio site|barber|salon|restaurant|hotel|church website|real estate site|booking site)\b/.test(value)) return "website";
  if (/\b(build|create|make|design|develop)\b[\s\S]{0,70}\b(app|application|mobile app|web app)\b|\b(app|application)\b[\s\S]{0,70}\b(build|create|make|design|develop)\b/.test(value)) return "app";
  if (/\b(game|driving game|racing game|platformer|3d game|2d game|playable game)\b/.test(value)) return "game";
  if (/\b(remote job|remote work|job opening|find.{0,20}job|jobs hiring|job application|work from home job)\b/.test(value)) return "jobs";
  if (/\b(image|picture|photo|illustration|character reference|draw|generate an image)\b/.test(value)) return "image";
  if (/\b(video|image.to.video|edit.{0,20}video|video idea|animate this)\b/.test(value)) return "video";
  if (/\b(youtube|niche|channel idea|video ideas|content ideas)\b/.test(value)) return "ideas";

  return "chat";
}

export async function dispatch(ctx) {
  const intent = detectIntent(ctx.message, ctx.selection);
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

  return (engines[intent] || handleChat)({ ...ctx, intent });
}
