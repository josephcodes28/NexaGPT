import {callGemini,clean} from "../_shared.js";
export async function handleIdeas(ctx){
 const brief=clean(ctx.message,6000);
 const prompt=`Help develop YouTube channel niches and video ideas. User request: ${brief}\nGive 8 specific niche/video directions. For each include audience, content angle, sample video titles and practical production difficulty. Avoid promising income or guaranteed virality.`;
 const text=await callGemini(prompt);
 return {reply:text};
}