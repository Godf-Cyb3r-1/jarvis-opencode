import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { createHash } from "node:crypto"
export type MachineCapabilities={
 os:string;display:boolean;browser:string|null;players:string[];
 runtimes:Record<string,string|null>;mcpTools:string[];workers:string[];
 canSpawnWorker:boolean;canRunShell:boolean;canOpenBrowser:boolean;
 hasInternet:boolean|null; roots:string[];checkedAt:number;signature:string
}
let cached:MachineCapabilities|undefined
function command(bin:string,args:string[],timeout=700):string|null {
 try {
  const r=spawnSync(bin,args,{encoding:"utf8",timeout,windowsHide:true,stdio:["ignore","pipe","ignore"]})
  return r.status===0?r.stdout.trim().slice(0,500):null
 } catch {return null}
}
export function probeCapabilities(input:{tools?:readonly string[];workers?:readonly string[];roots?:string[];refresh?:boolean}={}):MachineCapabilities {
 const now=Date.now()
 const tools=[...input.tools??[]],workers=[...input.workers??[]]
 if(!input.refresh&&cached&&now-cached.checkedAt<60_000 &&
   cached.mcpTools.join("|")===tools.filter(x=>/mcp|browser_tabs_|ui_click/i.test(x)).join("|")&&
   cached.workers.join("|")===workers.join("|"))return cached
 const windows=process.platform==="win32"
 const found=(c:string)=>windows?command("where.exe",[c])!==null:command("which",[c])!==null
 const apps=["vlc","mpv",...(windows?["wmplayer"]:[])]
 const players=apps.filter(found)
 const browser=windows
  ? command("reg.exe",["query","HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice","/v","ProgId"])?.split(/\s{2,}/).at(-1)??null
  : command("xdg-settings",["get","default-web-browser"])??null
 const runtimes:Record<string,string|null>={}
 for(const app of ["powershell","pwsh","python","python3","node","git","ffmpeg","yt-dlp","7z"])
  runtimes[app]=found(app)?(windows?command("where.exe",[app])?.split("\n")[0]??null:command("which",[app])):null
 const display=windows||!!(process.env.DISPLAY||process.env.WAYLAND_DISPLAY)
 const mcpTools=tools.filter(x=>/mcp|browser_tabs_|ui_click/i.test(x))
 const roots=input.roots??[process.cwd()]
 const schema={
  os:process.platform,display,browser,players,runtimes,mcpTools,workers,
  canSpawnWorker:tools.includes("session_create"),canRunShell:true,
  canOpenBrowser:display&&(windows||found("xdg-open")),hasInternet:null,
  roots,checkedAt:now,signature:"",
 }
 schema.signature=createHash("sha256").update(JSON.stringify({...schema,checkedAt:0,signature:""})).digest("hex").slice(0,20)
 cached=schema
 return schema
}
export function firstPersonCapabilities(cap:MachineCapabilities){
 return [
  "[Verified system body facts]",
  "My OS: "+cap.os+"; graphical display: "+cap.display+"; default browser: "+(cap.browser??"not probed"),
  "My installed players: "+(cap.players.join(", ")||"none detected"),
  "My system commands: "+Object.entries(cap.runtimes).filter(([,path])=>!!path).map(([k])=>k).join(", "),
  "My worker agents: "+cap.workers.join(", ")+"; can delegate: "+cap.canSpawnWorker,
  "My active UI/MCP tool names: "+cap.mcpTools.join(", "),
  "My filesystem roots: "+cap.roots.join(", "),
  "Internet reachability is unverified until a real request succeeds.",
  "Tools, workers and shell programs are my operational hands. Verify an action before claiming completion.",
  "[/Verified system body facts]",
 ].join("\n")
}
