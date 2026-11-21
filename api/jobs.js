import {clean} from "../_shared.js";
export async function handleJobs(ctx){
 const query=clean(ctx.message,3000);
 const key=process.env.TAVILY_API_KEY;
 if(!key)return {reply:"The remote-job engine is ready, but live job searching needs TAVILY_API_KEY (or another verified job-search provider) in Vercel. I can still help prepare a truthful CV, cover letter and application answers if you describe the role and share your experience.",status:"provider_not_connected"};
 const response=await fetch("https://api.tavily.com/search",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({api_key:key,query:`current legitimate remote job openings ${query} application official careers page`,search_depth:"advanced",max_results:8,include_answer:true}),signal:AbortSignal.timeout(25000)});
 const data=await response.json();if(!response.ok)throw new Error(data.message||"Job search failed.");
 const jobs=(data.results||[]).map(x=>({title:x.title,url:x.url,summary:x.content,source:new URL(x.url).hostname}));
 return {reply:jobs.length?`I found ${jobs.length} web results to review. Verify the role on the employer's official careers page before applying. I have not submitted any applications.`:"No matching job results were returned. Try a broader job title or location.",jobs};
}