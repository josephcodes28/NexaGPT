/*
 * NexaGPT shared helpers: Gemini primary, Groq automatic text fallback.
 * Uses the existing Vercel GROQ_API_KEY. Never hardcode API keys.
 */
export function send(res,status,data){return res.status(status).json(data)}
export function clean(value,max=12000){return typeof value==="string"?value.trim().slice(0,max):""}
export function parseJson(text,fallback=null){
 if(typeof text!=="string")return fallback;
 const s=text.trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/,"");
 try{return JSON.parse(s)}catch{}
 const a=s.indexOf("{"),b=s.lastIndexOf("}");
 if(a>=0&&b>a){try{return JSON.parse(s.slice(a,b+1))}catch{}}
 return fallback;
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const temporary=e=>[408,409,425,429,500,502,503,504].includes(e?.status)||e?.name==="TimeoutError"||e?.name==="AbortError";

async function gemini(prompt,{json,images,maxOutputTokens}){
 const key=process.env.GEMINI_API_KEY;
 if(!key){const e=new Error("GEMINI_API_KEY is not configured.");e.status=401;throw e}
 const model=process.env.GEMINI_MODEL||"gemini-2.5-flash";
 const parts=[{text:String(prompt||"")}];
 for(const im of images.slice(0,3)){
  if(!im?.data||!im?.type)continue;
  const data=im.data.includes(",")?im.data.split(",")[1]:im.data;
  if(data)parts.push({inline_data:{mime_type:im.type,data}});
 }
 const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:.65,maxOutputTokens,...(json?{responseMimeType:"application/json"}:{})}}),
  signal:AbortSignal.timeout(45000)
 });
 const body=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(body?.error?.message||`Gemini request failed (${r.status}).`);e.status=r.status;throw e}
 const out=body?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("").trim();
 if(!out){const e=new Error("Gemini returned an empty response.");e.status=502;throw e}
 return out;
}
async function groq(prompt,{json,images,maxOutputTokens}){
 const key=process.env.GROQ_API_KEY;
 if(!key){const e=new Error("Gemini is overloaded and GROQ_API_KEY was not found in this Vercel deployment.");e.status=503;throw e}
 if(images.length)throw new Error("Gemini is unavailable. This Groq fallback currently handles text requests, not image attachments.");
 const model=process.env.GROQ_MODEL||"openai/gpt-oss-120b";
 const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
  method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
  body:JSON.stringify({model,messages:[{role:"user",content:String(prompt||"")}],temperature:.65,max_tokens:Math.min(Math.max(maxOutputTokens,1024),16384),...(json?{response_format:{type:"json_object"}}:{})}),
  signal:AbortSignal.timeout(45000)
 });
 const body=await r.json().catch(()=>({}));
 if(!r.ok){const e=new Error(body?.error?.message||`Groq request failed (${r.status}).`);e.status=r.status;throw e}
 const out=body?.choices?.[0]?.message?.content;
 if(typeof out!=="string"||!out.trim())throw new Error("Groq returned an empty response.");
 return out.trim();
}
export async function callGemini(prompt,{json=false,images=[],maxOutputTokens=16384}={}){
 const opts={json,images:Array.isArray(images)?images:[],maxOutputTokens};
 let error;
 try{return await gemini(prompt,opts)}catch(e){error=e}
 if(temporary(error)){
  await pause(1000);
  try{return await gemini(prompt,opts)}catch(e){error=e}
 }
 if(temporary(error)||error?.status===401){
  try{return await groq(prompt,opts)}catch(e){
   throw new Error(`Gemini failed: ${error?.message||"unavailable"}. Groq fallback failed: ${e?.message||"unknown error"}.`);
  }
 }
 throw new Error(error?.message||"AI provider request failed.");
}
export function response(res,status,data){return res.status(status).json(data)}
export function normalizeHistory(history=[]){
 return Array.isArray(history)?history.slice(-12).map(x=>({role:x?.role==="assistant"?"assistant":"user",content:clean(x?.content||x?.text,4000)})).filter(x=>x.content):[];
}
