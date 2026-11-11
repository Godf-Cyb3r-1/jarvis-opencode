import { spawn } from "node:child_process"
import { access, readFile, writeFile, readdir, stat, mkdir } from "node:fs/promises"
import { dirname, resolve } from "node:path"

export type PrimitiveName =
  | "shell.run" | "shell.powershell" | "os.openUrl" | "os.openFile" | "os.openApp"
  | "fs.read" | "fs.write" | "fs.list" | "fs.exists"
  | "net.httpGet" | "net.httpPostJson" | "net.download"
  | "proc.list" | "proc.kill" | "proc.isRunning"
  | "window.focus" | "window.list" | "input.sendKeys"
  | "clipboard.read" | "clipboard.write" | "time.sleep" | "time.schedule"
  | "worker.delegate" | "worker.status" | "worker.send" | "worker.interrupt"
export type PrimitiveResult = { ok: boolean; data?: unknown; error?: string; evidence: string[] }
export interface PrimitiveContext {
  onWorker?: (op: PrimitiveName, args: Record<string, unknown>) => Promise<PrimitiveResult>
  onSchedule?: (whenISO: string, note: string) => Promise<PrimitiveResult>
  confirm?: (step: { primitive: PrimitiveName; args: Record<string, unknown> }) => Promise<boolean>
  cwd?: string
}
const ok = (data: unknown, ...evidence: string[]): PrimitiveResult => ({ ok: true, data, evidence })
const fail = (error: unknown): PrimitiveResult => ({ ok: false, error: String(error), evidence: [String(error)] })
const str = (args: Record<string, unknown>, name: string): string => {
  const value = args[name]
  if (typeof value !== "string" || !value.trim()) throw new Error("Missing string argument: " + name)
  return value
}
const number = (args: Record<string, unknown>, name: string, fallback: number) => {
  const value = args[name]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}
const url = (value: string) => {
  const parsed = new URL(value)
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname.includes("."))
    throw new Error("Only public HTTPS URL forms are supported")
  if (/^(?:localhost|127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i.test(parsed.hostname))
    throw new Error("Local/private destinations require a worker with explicit authorization")
  return parsed
}
const run = (program: string, argv: string[], timeoutMs: number, cwd?: string): Promise<PrimitiveResult> =>
  new Promise((done) => {
    const child = spawn(program, argv, { shell: false, windowsHide: true, cwd, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = "", stderr = "", finished = false
    const end = (result: PrimitiveResult) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      done(result)
    }
    const timer = setTimeout(() => { child.kill(); end(fail("Process timeout")) }, Math.min(30_000, Math.max(100, timeoutMs)))
    child.stdout?.on("data", (chunk: Buffer) => { stdout += chunk.toString().slice(0, Math.max(0, 65536 - stdout.length)) })
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString().slice(0, Math.max(0, 65536 - stderr.length)) })
    child.once("error", (error) => end(fail(error)))
    child.once("close", (code) => end({
      ok: code === 0, data: { stdout, stderr, exitCode: code },
      ...(code === 0 ? {} : { error: "Process exited " + code }),
      evidence: ["exitCode=" + code, stdout.slice(0, 512), stderr.slice(0, 512)].filter(Boolean),
    }))
  })

const shellName = (name: string) => !/[\0\r\n]/.test(name) && name.length <= 512
const protectedOps = new Set<PrimitiveName>(["fs.write", "proc.kill", "shell.powershell", "shell.run", "net.httpPostJson", "net.download", "clipboard.write", "input.sendKeys"])
export const isSideEffectful = (name: PrimitiveName) => protectedOps.has(name) || name.startsWith("worker.")
export const isDestructive = (name: PrimitiveName, args: Record<string, unknown>) =>
  name === "proc.kill" || name === "fs.write" && args.mode !== "create" ||
  name === "shell.run" || name === "shell.powershell" ||
  name === "net.httpPostJson" || name === "input.sendKeys"

export async function executePrimitive(name: PrimitiveName, args: Record<string, unknown>, ctx: PrimitiveContext = {}): Promise<PrimitiveResult> {
  try {
    if (isDestructive(name, args) && !(await ctx.confirm?.({ primitive: name, args })))
      return fail("Explicit user confirmation required for " + name)
    const timeout = Math.min(30_000, Math.max(100, number(args, "timeoutMs", 5000)))
    const base = ctx.cwd ?? process.cwd()
    const file = (key: string) => resolve(base, str(args,key))
    if (name === "shell.run") {
      const command = str(args,"cmd")
      const argv = args.args
      if (!shellName(command) || !Array.isArray(argv) || !argv.every(x => typeof x === "string" && shellName(x)))
        throw new Error("shell.run requires a program and safe argv array")
      return run(command, argv as string[], timeout, typeof args.cwd === "string" ? resolve(base, args.cwd) : base)
    }
    if (name === "shell.powershell") {
      if (process.platform !== "win32") return fail("PowerShell primitive requires Windows")
      return run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", str(args,"script")], timeout, base)
    }
    if (name === "os.openUrl") {
      const target = url(str(args, "url")).toString()
      const executable = process.platform === "win32" ? "cmd.exe" : "xdg-open"
      if (process.platform !== "win32" && process.platform !== "linux") return fail("Unsupported desktop OS")
      if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return fail("No graphical display")
      if (/[\r\n\"<>|^]/.test(target)) return fail("URL has unsafe command characters")
      const argv = process.platform === "win32"
        ? ["/d","/s","/c",'start "" "' + target.replace(/%/g,"%%") + '"'] : [target]
      const result = await run(executable, argv, timeout)
      return result.ok ? ok({ url: target, launched: true, playbackVerified: false }, "OS launcher exited successfully, destination unverified") : result
    }
    if (name === "os.openApp" || name === "os.openFile") {
      const target = str(args, name === "os.openApp" ? "nameOrPath" : "path")
      if (!shellName(target)) return fail("Unsafe target")
      const program = process.platform === "win32" ? "explorer.exe" : "xdg-open"
      return run(program, [target], timeout)
    }
    if (name === "fs.read") { const path = file("path"); const body = await readFile(path,"utf8"); return ok({text:body.slice(0,100_000)}, "Read "+path) }
    if (name === "fs.exists") {const path=file("path");try { await access(path);return ok({exists:true},path+" exists") } catch { return ok({exists:false},path+" missing") }}
    if (name === "fs.list") {const path=file("dir");return ok({entries:(await readdir(path)).slice(0,500)}, "Listed "+path)}
    if (name === "fs.write") {
      const path=file("path"), mode=str(args,"mode")
      if (!["create","overwrite","append"].includes(mode)) return fail("Invalid write mode")
      if (mode==="create") {await writeFile(path,str(args,"content"),{flag:"wx"}); return ok({path},"Created "+path)}
      if (mode==="append") {await writeFile(path,str(args,"content"),{flag:"a"}); return ok({path},"Appended "+path)}
      await writeFile(path,str(args,"content"));return ok({path},"Overwrote "+path)
    }
    if (name === "net.httpGet" || name === "net.httpPostJson" || name === "net.download") {
      const target=url(str(args,"url"))
      const method=name==="net.httpPostJson"?"POST":"GET"
      const response=await fetch(target,{method,
        headers: name==="net.httpPostJson"?{"content-type":"application/json"}:undefined,
        body: name==="net.httpPostJson"?JSON.stringify(args.body??{}):undefined,
        signal:AbortSignal.timeout(timeout),redirect:"error"})
      if (name==="net.download") {
        if (!response.ok) return fail("HTTP "+response.status)
        const bytes=await response.arrayBuffer()
        if (bytes.byteLength>25_000_000) return fail("Download exceeds 25 MB cap")
        const destination=file("destPath")
        await writeFile(destination, Buffer.from(bytes),{flag:"wx"})
        return ok({status:response.status,path:destination},"Downloaded "+bytes.byteLength+" bytes")
      }
      const body=(await response.text()).slice(0,100_000)
      return {ok:response.ok,data:{status:response.status,body},...(response.ok?{}:{error:"HTTP "+response.status}),evidence:["HTTP "+response.status]}
    }
    if (name === "proc.list" || name === "proc.isRunning" || name === "proc.kill") {
      if (name==="proc.kill") {
        const pid=number(args,"pid",-1)
        if (!Number.isInteger(pid)||pid<=1) return fail("Invalid process ID")
        process.kill(pid);return ok({pid},"Sent termination to process "+pid)
      }
      const listing=process.platform==="win32"
        ? await run("tasklist.exe",["/fo","csv","/nh"],timeout)
        : await run("ps",["-eo","pid=,comm="],timeout)
      if(!listing.ok)return listing
      const output=String((listing.data as {stdout:string}).stdout)
      const filter=typeof args.filter==="string"?args.filter:typeof args.name==="string"?args.name:""
      const lines=output.split("\n").filter(x=>!filter||x.toLowerCase().includes(filter.toLowerCase())).slice(0,250)
      return ok(name==="proc.isRunning"?{running:lines.length>0}:{lines},"Process listing read")
    }
    if (name==="clipboard.read"||name==="clipboard.write") {
      const windows=process.platform==="win32"
      if (!windows && process.platform!=="linux") return fail("Unsupported OS")
      if(name==="clipboard.read")return windows ? run("powershell.exe",["-NoProfile","-Command","Get-Clipboard"],timeout) : run("xclip",["-selection","clipboard","-o"],timeout)
      // Never send clipboard text through interpolated shell source.
      return fail("Clipboard writing requires the approved local integration")
    }
    if(name==="window.focus"||name==="window.list"||name==="input.sendKeys")
      return fail("Screen automation is not installed as a trusted primitive; use a registered UI interaction worker")
    if(name==="time.sleep") {
      const ms=number(args,"ms",0)
      if(ms<0||ms>2000)return fail("Sleep exceeds 2-second bound")
      await new Promise(done=>setTimeout(done,ms))
      return ok({sleptMs:ms},"Timer elapsed")
    }
    if(name==="time.schedule") {
      if(!ctx.onSchedule)return fail("Scheduling adapter not connected")
      const whenISO=str(args,"whenISO"),note=str(args,"note")
      if(!Number.isFinite(Date.parse(whenISO)))return fail("Invalid schedule time")
      return ctx.onSchedule(whenISO,note)
    }
    if(name.startsWith("worker."))return ctx.onWorker?ctx.onWorker(name,args):fail("Worker control bridge unavailable")
    return fail("Unknown primitive")
  } catch(error) { return fail(error) }
}
