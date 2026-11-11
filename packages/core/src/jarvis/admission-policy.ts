import type { Match, SkillResult } from "./skill-router.js"
export type AdmissionState = "matched"|"executed"|"verified"
export type AdmissionReport = {
  state:AdmissionState;matched:boolean;executed:boolean;verified:boolean;
  narrationOnly:boolean; clarification?:string
}
export function admissionReport(matches:readonly Match[],results:readonly SkillResult[]):AdmissionReport {
  const clarification=matches.some(m=>m.missingSlots?.includes("lang")) ? "Which language?" : undefined
  const complete=matches.length>0&&matches.length===results.length&&results.every(r=>r.success)
  const verified=complete&&results.every(r=>r.verified)
  return {
    state:verified?"verified":complete?"executed":"matched",
    matched:matches.length>0,executed:complete,verified,
    narrationOnly:complete||!!clarification,
    ...(clarification?{clarification}:{}),
  }
}
export function narrationTools<T>(available:Map<string,T>,state:AdmissionReport):Map<string,T> {
  return state.narrationOnly ? new Map([...available].filter(([name])=>name==="read")) : new Map(available)
}
export function narrationInstructions(state:AdmissionReport,results:readonly SkillResult[]):string {
  if(state.clarification)return "[Jarvis missing slot] Ask exactly: "+state.clarification+" Do not take action."
  if(!state.executed)return "[Jarvis raw request] Use the user's original content words verbatim in action tools; the executor validates arguments."
  const details=results.map(r=>r.id+": "+r.detail+" (verified="+r.verified+")").join("; ")
  return "[Jarvis narration-only] Already attempted: "+details+
    ". In at most twelve words, acknowledge the actual verified extent ONLY. Do not re-run the skill,"+
    " open another tab, delegate, duplicate an opener, or ask an unsolicited question."+
    " OS launch does not verify browser playback. [/Jarvis narration-only]"
}
export function continuationText(text:string,emittedOpener:string):string {
 const opener=emittedOpener.trim().replace(/[.!?]+$/,"").toLowerCase()
 const words=text.trim().split(/\s+/)
 if(!opener)return words.slice(0,12).join(" ")
 const first=words[0]?.replace(/[.!?]+$/,"").toLowerCase()
 return (first===opener?words.slice(1):words).slice(0,12).join(" ")
}

/** Deterministic final-result rendering protects against fabricated completion
 * on an otherwise narration-only provider call.
 */
export function verifiedNarration(
  generated:string,results:readonly SkillResult[], emittedOpener?:string,
):string {
  const final=results.at(-1)
  if(!final)return generated
  if(final.id==="greet"){
    const base=(emittedOpener || final.detail).trim()
    const tail=continuationText(generated,base).replace(/^(?:(?:hi|hey|hello|vanakkam|ayyo|right|okay|sure|got it|on it)[.!?,\\s]+){1,3}/i,"").trim()
    return base+(tail?" "+tail:"")
  }
  if(!final.success)return "The action could not be completed: "+final.detail
  if(!final.verified)return final.detail.split(/\s+/).slice(0,20).join(" ")
  return generated.split(/\s+/).slice(0,12).join(" ")
}
