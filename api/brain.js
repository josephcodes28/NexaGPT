import {dispatch} from "./dispatcher.js";
import {clean,normalizeHistory,send} from "./_shared.js";
export default async function handler(req,res){
 if(req.method!=="POST")return send(res,405,{error:"Use POST."});
 try{
  const body=req.body||{};
  const message=clean(body.message,12000);
  const selection=body.selection&&typeof body.selection==="object"?body.selection:null;
  const history=normalizeHistory(body.history);
  const attachments=Array.isArray(body.attachments)?body.attachments.slice(0,3):[];
  if(!message&&!attachments.length)return send(res,400,{error:"Please describe what you want NexaGPT to do."});
  const result=await dispatch({message,selection,history,attachments,settings:body.settings||{}});
  return send(res,200,{success:true,...result});
 }catch(error){return send(res,500,{success:false,error:error.message||"Unexpected server error."});}
}