import { WorkerQueue } from "./worker-queue"
import { MemoryLedger } from "./memory"
import { sanitizeExpressions } from "./expression"
import { defaultJarvisConfig } from "./config"

type Task = { title: string; instruction: string; agent?: string; model?: { providerID: string; modelID: string } }
const base = process.env.OPENCODE_URL ?? "http://127.0.0.1:4096"
const host = process.env.JARVIS_HOST ?? "127.0.0.1"
const port = Number(process.env.JARVIS_PORT ?? "4317")
const token = process.env.JARVIS_TOKEN
const memory = new MemoryLedger(process.env.JARVIS_DB ?? "./.jarvis/state.sqlite")
const sessionMap = new Map<string,string>()
let brainSessionId: string | undefined
let brainBusy = false
const clients = new Set<ReadableStreamDefaultController<string>>()
const broadcast = (event: unknown) => {
  const line = "data: " + JSON.stringify(event) + "\n\n"
  for (const client of clients) try {client.enqueue(line)} catch {clients.delete(client)}
}
async function api(path: string, method = "GET", payload?: unknown): Promise<any> {
  const headers: Record<string,string> = {"content-type":"application/json"}
  if (process.env.OPENCODE_SERVER_PASSWORD) {
    headers.authorization = "Basic " + btoa("opencode:"+process.env.OPENCODE_SERVER_PASSWORD)
  }
  const res=await fetch(base+path,{method,headers,body:payload===undefined?undefined:JSON.stringify(payload)})
  if (!res.ok) throw new Error(`OpenCode ${method} ${path}: HTTP ${res.status} ${(await res.text()).slice(0,240)}`)
  if (res.status===204) return null
  return res.json()
}
// Dedicated conversational session. Never reuses worker sessions.
async function talkToBrain(text: string): Promise<string> {
  if (brainBusy) throw new Error("Jarvis brain is processing another turn")
  brainBusy=true
  try {
    if (!brainSessionId) {
      const session=await api("/session","POST",{title:"Jarvis - conversation"})
      brainSessionId=session.id ?? session.data?.id
      if (!brainSessionId) throw new Error("OpenCode did not return a brain session ID")
    }
    const profile=memory.profile()
    const cards=memory.search(text,3).map(({title,goal,outcome})=>({title,goal,outcome}))
    const system="You are Jarvis, a concise, capable human-like assistant and coordinator. Answer directly in 1-3 sentences unless detail requested. Do not claim to start worker jobs: only the separate worker controls do that. Be explicit about what is incomplete. No audio. User profile: "+JSON.stringify(profile)+". Relevant work: "+JSON.stringify(cards)
    const payload={
      system,
      parts:[{type:"text",text}],
      model:{
        providerID:defaultJarvisConfig.brain.model.split("/")[0],
        modelID:defaultJarvisConfig.brain.model.split("/").slice(1).join("/")
      }
    }
    const result=await api(`/session/${encodeURIComponent(brainSessionId)}/message`,"POST",payload)
    const parts=result?.parts??result?.data?.parts??[]
    const direct=parts.filter((p:any)=>p.type==="text").map((p:any)=>p.text).join("\n")
    const messages=direct?undefined:await api(`/session/${encodeURIComponent(brainSessionId)}/message`)
    const last=Array.isArray(messages)?messages.at(-1):undefined
    const answer=sanitizeExpressions(direct || (last?.parts??[]).filter((p:any)=>p.type==="text").map((p:any)=>p.text).join("\n")).text
    if (!answer) throw new Error("Brain returned no text")
    return answer
  } finally { brainBusy=false }
}
const queue=new WorkerQueue<Task>(defaultJarvisConfig.maxSessions,async (work,signal)=>{
  const task=work.input
  const created=await api("/session","POST",{title:task.title})
  const sid=created.id ?? created.data?.id
  if (!sid) throw new Error("OpenCode session-create response has no ID; check server API version")
  sessionMap.set(work.id,sid)
  memory.upsert({sessionId:sid,title:task.title,goal:task.instruction,keywords:task.title,state:"running",outcome:"",files:"",updatedAt:Date.now()})
  broadcast({type:"session",workId:work.id,sessionId:sid})
  try {
    await api(`/session/${encodeURIComponent(sid)}/message`,"POST",{
      parts:[{type:"text",text:task.instruction}],...(task.agent?{agent:task.agent}:{}),
      ...(task.model?{model:task.model}:{})
    })
    if (signal.aborted) return
    const messages=await api(`/session/${encodeURIComponent(sid)}/message`)
    const last=Array.isArray(messages)?messages.at(-1):undefined
    const raw=(last?.parts??[]).filter((p:any)=>p.type==="text").map((p:any)=>p.text).join("\n")
    const answer=sanitizeExpressions(raw).text
    memory.upsert({sessionId:sid,title:task.title,goal:task.instruction,keywords:task.title,state:"done",outcome:answer.slice(0,1000),files:"",updatedAt:Date.now()})
    broadcast({type:"result",workId:work.id,sessionId:sid,answer})
  } catch(error) {
    memory.upsert({sessionId:sid,title:task.title,goal:task.instruction,keywords:task.title,state:"failed",outcome:String(error),files:"",updatedAt:Date.now()})
    throw error
  }
})
queue.subscribe(e=>broadcast({type:"worker",event:e.type,work:e.work}))
function json(data:unknown,status=200):Response {
  return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}})
}
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jarvis | OpenCode</title><style>
:root{font-family:system-ui;color:#ffdfb0;background:#090a10}body{margin:0}main{max-width:1050px;margin:auto;padding:24px}
h1{font-size:25px;letter-spacing:5px;text-align:center}small{color:#b89c7c}
.layout{display:grid;grid-template-columns:1fr 300px;gap:24px}
.orb{width:230px;height:230px;border-radius:50%;margin:20px auto 28px;
background:radial-gradient(circle at 40% 36%,#fff8d1 0%,#ffb347 7%,#c8510c 23%,#26100b 48%,transparent 65%);
box-shadow:0 0 35px #f66d13,0 0 100px #d85a2144,inset 0 0 50px #ffb347;
animation:breathe 3s ease-in-out infinite alternate}
@keyframes breathe{from{transform:scale(.96);filter:brightness(.8)}to{transform:scale(1.04);filter:brightness(1.25)}}
section{background:#13151e;border:1px solid #50341c;border-radius:14px;padding:18px}
textarea,input{box-sizing:border-box;background:#0c0e15;color:#ffe3be;border:1px solid #794a26;border-radius:9px;padding:12px;width:100%;font:inherit}textarea{height:100px;resize:vertical}
button{background:#cc661c;color:white;border:0;border-radius:9px;padding:12px 20px;cursor:pointer}
.card{border-bottom:1px solid #413228;padding:12px 0;word-break:break-word}
pre{white-space:pre-wrap;max-height:310px;overflow:auto;color:#e4c8a8}
@media(max-width:730px){.layout{grid-template-columns:1fr}}
</style></head><body><main><h1>J A R V I S</h1><div class="orb" aria-label="Jarvis orange orb"></div>
<div class="layout"><section><h2>Talk to Jarvis</h2><p><small>Brain conversation is separate from workers. Requires configured OpenCode Zen credentials.</small></p><textarea id="chat" placeholder="Message Jarvis"></textarea><p><button id="talk">Send message</button></p><div id="chatlog" aria-live="polite"></div><hr><h2>Delegate a task</h2><p><small>Text-only prototype · 4 concurrent worker slots · OpenCode API adapter</small></p>
<input id="title" placeholder="Task title" value="Explore this project"><p></p><textarea id="instruction" placeholder="Tell Jarvis what to delegate"></textarea>
<p><button id="send">Start worker</button></p><div id="result" aria-live="polite"></div></section>
<section><h2>Workers</h2><div id="workers"></div></section></div></main>
<script>
const jobs=new Map(),workerList=document.querySelector('#workers'),log=document.querySelector('#result');
function render(){workerList.replaceChildren();for(const job of jobs.values()){let p=document.createElement('div');p.className='card';p.textContent=job.input.title+' — '+job.state;workerList.append(p)}}
const events=new EventSource('/events');events.onmessage=e=>{let data=JSON.parse(e.data);if(data.type==='worker'){jobs.set(data.work.id,data.work);render()}if(data.type==='result'){let p=document.createElement('pre');p.textContent=data.answer;log.prepend(p)}}
document.querySelector('#talk').onclick=async()=>{
const text=document.querySelector('#chat').value;if(!text.trim())return;
const panel=document.querySelector('#chatlog'),line=document.createElement('pre');line.textContent='You: '+text;panel.append(line);
try{const res=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text})});const data=await res.json();const reply=document.createElement('pre');reply.textContent=res.ok?'Jarvis: '+data.answer:'Error: '+data.error;panel.append(reply);}catch(e){const reply=document.createElement('pre');reply.textContent=String(e);panel.append(reply)}
};
document.querySelector('#send').onclick=async()=>{const title=document.querySelector('#title').value,instruction=document.querySelector('#instruction').value;if(!instruction.trim())return;
const res=await fetch('/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,instruction})});let data=await res.json();if(!res.ok){log.textContent=data.error;return}log.textContent='Queued: '+data.id}
fetch('/api/tasks').then(r=>r.json()).then(x=>{for(const j of x)jobs.set(j.id,j);render()})
</script></body></html>`
Bun.serve({
  hostname:host,port,
  async fetch(req) {
    const url=new URL(req.url)
    if(token && req.headers.get("authorization")!==`Bearer ${token}`) return json({error:"Unauthorized"},401)
    if(url.pathname==="/"&&req.method==="GET") return new Response(html,{headers:{"content-type":"text/html; charset=utf-8"}})
    if(url.pathname==="/health") return json({ok:true,version:"0.2.0-alpha.1",backend:base,active:queue.activeCount,queued:queue.queuedCount})
    if(url.pathname==="/events") return new Response(new ReadableStream<string>({start(c){clients.add(c);c.enqueue(": connected\n\n")},cancel(){/* disconnected listeners are removed on next event */}}),{headers:{"content-type":"text/event-stream","cache-control":"no-cache"}})
    if(url.pathname==="/api/chat"&&req.method==="POST") {
      try {
        const body=await req.json() as {text?:string}
        if(typeof body.text!=="string" || !body.text.trim() || body.text.length>12000) return json({error:"Text required (1-12000 chars)"},400)
        const answer=await talkToBrain(body.text.trim())
        return json({answer, sessionId:brainSessionId})
      } catch(error){return json({error:String(error)},503)}
    }
    if(url.pathname==="/api/tasks"&&req.method==="GET") return json(queue.snapshot())
    if(url.pathname==="/api/tasks"&&req.method==="POST"){
      try{
        const data=await req.json() as Task
        if(!data?.instruction?.trim()||data.instruction.length>20000) return json({error:"Invalid instruction"},400)
        const id=crypto.randomUUID()
        return json(queue.enqueue({id,input:{title:(data.title||"Untitled").slice(0,120),instruction:data.instruction,agent:data.agent,model:data.model}}),202)
      }catch(e){return json({error:String(e)},400)}
    }
    if(url.pathname==="/api/memory"&&req.method==="GET") return json(memory.search(url.searchParams.get("q")||""))
    if(url.pathname.startsWith("/api/tasks/")&&req.method==="DELETE"){
      const id=url.pathname.split("/").at(-1)!
      const sid=sessionMap.get(id)
      const cancelled=queue.cancel(id)
      if(sid) void api(`/session/${encodeURIComponent(sid)}/abort`,"POST").catch(()=>{})
      return json({cancelled})
    }
    return json({error:"Not found"},404)
  }
})
console.log(`Jarvis prototype http://${host}:${port} → OpenCode ${base}`)
