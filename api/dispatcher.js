import {handleWebsite} from "./engines/website.js";
import {handleApp} from "./engines/app.js";
import {handleGame} from "./engines/game.js";
import {handleJobs} from "./engines/jobs.js";
import {handleMedia} from "./engines/media.js";
import {handleIdeas} from "./engines/ideas.js";
import {handleChat} from "./engines/chat.js";
export function detectIntent(text,selection){
 if(selection?.kind)return selection.kind;
 const s=(text||"").toLowerCase();
 if(/\b(barber|salon|restaurant|hotel|church|real estate|fashion|business website|website|landing page|portfolio site)\b/.test(s))return "website";
 if(/\b(build|create|make|design)\b.*\b(app|application|mobile app)\b/.test(s))return "app";
 if(/\b(game|driving game|racing game|platformer|3d game|2d game)\b/.test(s))return "game";
 if(/\b(remote job|remote work|job opening|find.*job|apply.*job|job application)\b/.test(s))return "jobs";
 if(/\b(image|picture|photo|illustration|character reference)\b/.test(s))return "image";
 if(/\b(video|image.to.video|edit.*video|video idea)\b/.test(s))return "video";
 if(/\b(youtube|niche|channel idea|video ideas)\b/.test(s))return "ideas";
 return "chat";
}
export async function dispatch(ctx){
 const intent=detectIntent(ctx.message,ctx.selection);
 const engines={website:handleWebsite,app:handleApp,game:handleGame,jobs:handleJobs,image:handleMedia,video:handleMedia,ideas:handleIdeas,chat:handleChat};
 return (engines[intent]||handleChat)({...ctx,intent});
}