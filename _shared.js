export function send(res,status,data){return res.status(status).json(data);}
export function clean(value,max=12000){return typeof value==="string"?value.trim().slice(0,max):"";}
export function parseJson(text,fallback=null){try{return JSON.parse(text)}catch{return fallback}}
export async function callGemini(prompt,{json=false,images=[]}={}) {
  const key=process.env.GEMINI_API_KEY;
  if(!key) throw new Error("GEMINI_API_KEY is not configured yet. Add it in Vercel Project Settings → Environment Variables.");
  const model=process.env.GEMINI_MODEL||"gemini-2.5-flash";
  const parts=[{text:prompt},...images.map(i=>({inline_data:{mime_type:i.type,data:i.data.split(",")[1]||""}}))];
  const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts}],generationConfig:{temperature:0.7,maxOutputTokens:8192,...(json?{responseMimeType:"application/json"}:{})}}),signal:AbortSignal.timeout(55000)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error?.message||`Gemini request failed (${response.status})`);
  return body.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("")||"";
}
export function response(res,status,data){return res.status(status).json(data);}
export function normalizeHistory(history=[]){return Array.isArray(history)?history.slice(-12).map(x=>({role:x.role==="assistant"?"assistant":"user",content:clean(x.content||x.text,4000)})):[];}
