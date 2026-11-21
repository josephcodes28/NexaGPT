(() => {
"use strict";
const $ = (s, r=document) => r.querySelector(s);
const STORE = "nexagpt_conversations_v2";
let conversations = JSON.parse(localStorage.getItem(STORE) || "[]");
let activeId = conversations[0]?.id || crypto.randomUUID();
let attachments = [];
let busy = false;
const messagesEl=$("#chatMessages"), input=$("#brainInput"), send=$("#sendBtn");
function persist(){localStorage.setItem(STORE,JSON.stringify(conversations));renderHistory();}
function active(){let c=conversations.find(x=>x.id===activeId);if(!c){c={id:activeId,title:"New conversation",messages:[],updated:Date.now()};conversations.unshift(c);}return c;}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400);}
function renderHistory(){const q=$("#searchChats").value.toLowerCase();$("#historyList").innerHTML=conversations.filter(c=>c.title.toLowerCase().includes(q)).slice(0,40).map(c=>`<button class="history-item ${c.id===activeId?"active":""}" data-id="${c.id}">${esc(c.title)}</button>`).join("");$("#chatCount").textContent=conversations.length;}
function render(){const c=active();messagesEl.innerHTML="";if(!c.messages.length){messagesEl.innerHTML=$("#welcome").outerHTML;wireSuggestions();return;}c.messages.forEach((m,i)=>{const el=document.createElement("article");el.className="message "+(m.role==="user"?"user":"assistant");el.innerHTML=`<div class="message-avatar">${m.role==="user"?"Y":"N"}</div><div class="message-body"><div class="message-role">${m.role==="user"?"You":"NexaGPT"}</div><div class="message-text">${esc(m.content)}</div><div class="message-extra"></div></div>`;messagesEl.append(el);if(m.concepts?.length)renderConcepts(el.querySelector(".message-extra"),m.concepts,m.originalPrompt||"");if(m.artifact)renderArtifact(el.querySelector(".message-extra"),m.artifact);});scrollBottom();renderHistory();}
function wireSuggestions(){messagesEl.querySelectorAll("[data-prompt]").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.prompt;sendMessage();}));}
function scrollBottom(){const sc=$("#chatScrollArea");sc.scrollTop=sc.scrollHeight;}
function add(role,content,extra={}){const c=active();c.messages.push({role,content,...extra});c.updated=Date.now();if(c.title==="New conversation"&&role==="user")c.title=content.slice(0,42);persist();render();}
function renderConcepts(host,concepts,original){const grid=document.createElement("div");grid.className="concept-grid";concepts.forEach((c,i)=>{const card=document.createElement("div");card.className="concept-card";card.innerHTML=`<span class="concept-number">CONCEPT ${i+1}</span><strong>${esc(c.title)}</strong><p>${esc(c.description)}</p><button class="primary-btn">Choose this design</button>`;card.querySelector("button").onclick=()=>sendSelection(original,c);grid.append(card);});host.append(grid);}
function renderArtifact(host,a){if(window.NexaProjectRenderer?.mount){window.NexaProjectRenderer.mount(host,a);return;}const box=document.createElement("div");box.className="artifact";box.innerHTML=`<h3>${esc(a.title||"Generated project")}</h3><p>${esc(a.summary||"Project files created.")}</p>`;host.append(box);}
async function callBrain(payload){const r=await fetch("/api/brain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({error:"The server returned an invalid response."}));if(!r.ok)throw new Error(data.error||`Request failed (${r.status})`);return data;}
async function sendSelection(original,concept){add("user",`I choose concept: ${concept.title}`);await request({message:original,selection:concept,history:active().messages.slice(0,-1).map(m=>({role:m.role,content:m.content}))});}
async function sendMessage(){if(busy)return;const message=input.value.trim();if(!message&&!attachments.length)return;input.value="";const files=attachments.slice();attachments=[];$("#attachmentStrip").hidden=true;add("user",message||"Please analyse the attached image.");await request({message,attachments:files,history:active().messages.slice(0,-1).map(m=>({role:m.role,content:m.content})),settings:{webSearch:$("#webSearch").checked}});}
async function request(payload){busy=true;send.disabled=true;const typing=document.createElement("div");typing.className="typing";typing.textContent="NexaGPT is thinking…";messagesEl.append(typing);scrollBottom();try{const data=await callBrain(payload);typing.remove();add("assistant",data.reply||"The task finished.",{concepts:data.concepts||null,originalPrompt:payload.message,artifact:data.artifact||null});}catch(e){typing.remove();add("assistant",`I couldn't complete that request: ${e.message}`);}finally{busy=false;send.disabled=false;}}
$("#chatForm").addEventListener("submit",e=>{e.preventDefault();sendMessage();});
input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}});
$("#newChat").onclick=()=>{activeId=crypto.randomUUID();conversations.unshift({id:activeId,title:"New conversation",messages:[],updated:Date.now()});persist();render();};
$("#historyList").onclick=e=>{const b=e.target.closest("[data-id]");if(b){activeId=b.dataset.id;render();}};
$("#searchChats").oninput=renderHistory;
$("#fileInput").onchange=async e=>{const f=e.target.files[0];if(!f)return;if(!f.type.startsWith("image/")){toast("Only image attachments are enabled in this build.");return;}if(f.size>5*1024*1024){toast("Image must be 5 MB or smaller.");return;}const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f);});attachments.push({name:f.name,type:f.type,data});$("#attachmentList").innerHTML=attachments.map(a=>`<span class="attachment-chip">${esc(a.name)}</span>`).join("");$("#attachmentStrip").hidden=false;e.target.value="";};
$("#clearAttachment").onclick=()=>{attachments=[];$("#attachmentStrip").hidden=true;};
$("#openSidebar").onclick=()=>{$("#sidebar").classList.add("open");$("#sidebarScrim").classList.add("show");};
$("#closeSidebar").onclick=$("#sidebarScrim").onclick=()=>{$("#sidebar").classList.remove("open");$("#sidebarScrim").classList.remove("show");};
$("#themeToggle").onclick=()=>{const light=document.documentElement.dataset.theme!=="light";document.documentElement.dataset.theme=light?"light":"dark";localStorage.setItem("nexagpt_theme",light?"light":"dark");};
document.documentElement.dataset.theme=localStorage.getItem("nexagpt_theme")||"dark";
document.querySelectorAll("[data-panel]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-panel]").forEach(x=>x.classList.toggle("active",x===b));if(b.dataset.panel==="assistant"){$("#chatView").hidden=false;$("#workspaceView").hidden=true;}else{$("#chatView").hidden=true;$("#workspaceView").hidden=false;$("#workspaceContent").innerHTML=`<h1>${esc(b.textContent.trim())}</h1><div class="workspace-card">Use the main chat to ask NexaGPT to create or find something. This workspace section is reserved for saved ${esc(b.dataset.panel)} results as those storage integrations are connected.</div>`;}});
function sendSelection(original,concept){add("user",`Selected: ${concept.title}`);request({message:original,selection:concept,history:active().messages.slice(0,-1).map(m=>({role:m.role,content:m.content}))});}
function init(){render();wireSuggestions();}
init();
})();