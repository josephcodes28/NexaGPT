import {callGemini,parseJson,clean} from "../_shared.js";
export async function handleGame(ctx){
 const brief=clean(ctx.message,9000);
 if(!ctx.selection){
  const p=`You are a game concept designer. Game request: ${brief}\nReturn JSON {"concepts":[{"id":"game-1","title":"...","description":"...","designBrief":"...","dimension":"2D or 3D","mechanics":["..."],"controls":["..."]}]} exactly five distinct game concepts relevant to the requested genre. Include a mix of suitable 2D/3D approaches where appropriate.`;
  const d=parseJson(await callGemini(p,{json:true}),null);if(!d?.concepts?.length)throw new Error("Could not create game concepts.");
  return {reply:"Here are five game directions tailored to your idea. Choose one; I'll generate a playable browser prototype with keyboard and touch controls where suitable.",concepts:d.concepts.slice(0,5).map((x,i)=>({...x,id:x.id||`game-${i+1}`,kind:"game"}))};
 }
 const p=`Build a playable browser game prototype. Request: ${brief}\nSelected game: ${ctx.selection.title}. Design: ${ctx.selection.designBrief||ctx.selection.description}. Dimension: ${ctx.selection.dimension||"choose suitable"}. Mechanics: ${JSON.stringify(ctx.selection.mechanics||[])}.\nReturn JSON: {"projectName":"...","summary":"...","indexHtml":"...","styleCss":"...","scriptJs":"...","controls":["..."]}. It must actually run in a browser, include a visible game area, start/restart controls, score or progress when appropriate, keyboard controls and mobile touch controls. For a 3D game use WebGL/Three.js from a reputable public CDN only if available; provide a graceful fallback and state that it is a prototype. Never claim Play Store publishing or hosting has occurred.`;
 const d=parseJson(await callGemini(p,{json:true}),null);if(!d?.indexHtml||!d?.styleCss||!d?.scriptJs)throw new Error("Game generation did not return all files.");
 return {reply:`Your playable ${d.projectName||"game"} prototype is ready. Use the preview controls to test it and open fullscreen.`,artifact:{type:"game",title:d.projectName||"Game prototype",summary:d.summary,files:{html:d.indexHtml,css:d.styleCss,js:d.scriptJs},features:d.controls||[]}};
}