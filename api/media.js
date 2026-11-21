import {clean} from "../_shared.js";
export async function handleMedia(ctx){
 const action=ctx.intent==="video"?"video generation or editing":"image generation or editing";
 const provider=process.env.MEDIA_PROVIDER_URL;
 if(!provider)return {reply:`I understand you want ${action}. The workflow module is in place, including support for prompts and reference-image context, but actual media rendering needs a connected image/video provider. Add the provider endpoint and secret later; I won't pretend a file has been generated.`,status:"provider_not_connected"};
 return {reply:`A media provider endpoint is configured, but its request/response contract must be implemented and verified before this engine can safely submit jobs.`,status:"provider_adapter_pending"};
}