import {callGemini,parseJson,clean} from "../_shared.js";
export async function handleApp(ctx){
 const brief=clean(ctx.message,9000);
 if(!ctx.selection){
  const p=`Act as a senior product designer. App request: ${brief}\nReturn JSON {"concepts":[{"id":"app-1","title":"...","description":"...","designBrief":"...","screens":["..."],"features":["..."]}]} exactly five genuinely different app product/design directions tailored to the request.`;
  const d=parseJson(await callGemini(p,{json:true}),null);if(!d?.concepts?.length)throw new Error("Could not create app concepts.");
  return {reply:"I understand the app you want. Choose one of these five product and interface directions. I'll build the selected frontend app.",concepts:d.concepts.slice(0,5).map((x,i)=>({...x,id:x.id||`app-${i+1}`,kind:"app"}))};
 }
 const p=`Create a working, responsive browser-based app prototype from this request: ${brief}\nSelected direction: ${ctx.selection.title}. ${ctx.selection.designBrief||ctx.selection.description}\nReturn JSON with projectName, summary, indexHtml, styleCss, scriptJs, features. Make navigation and core interactions work locally with sample data. Clearly label simulated data and do not claim a backend, accounts or payments exist.`;
 const d=parseJson(await callGemini(p,{json:true}),null);if(!d?.indexHtml||!d?.styleCss||!d?.scriptJs)throw new Error("App generation did not return all files.");
 return {reply:`Your app prototype, ${d.projectName||""}, is ready to test in the preview.`,artifact:{type:"app",title:d.projectName||"App prototype",summary:d.summary,files:{html:d.indexHtml,css:d.styleCss,js:d.scriptJs},features:d.features||[]}};
}
