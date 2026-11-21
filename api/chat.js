import {callGemini,clean,normalizeHistory} from "../_shared.js";
export async function handleChat(ctx){
 const history=normalizeHistory(ctx.history).map(x=>`${x.role}: ${x.content}`).join("\n");
 const prompt=`You are NexaGPT, a capable and honest AI assistant and digital worker. Understand natural language. Ask a concise clarifying question only when necessary. Never claim actions, searches, uploads, applications, deployments, generated files or integrations happened unless they actually did. If asked to build a website, app or game, route to the matching engine instead of merely explaining.\nConversation:\n${history}\nUser: ${clean(ctx.message,12000)}`;
 return {reply:await callGemini(prompt)};
}