/** Guard only actionable free-text arguments; do not alter typed paths/IDs.
 * This is an execution-time gate, not another model prompt instruction.
 */
export const ACTION_TEXT_TOOLS = new Set(["jarvis_quick_action","session_create","agent_pick"])
const stop = new Set(["a","an","the","to","for","me","my","own","on","in","at","of","and","then","please","can","you","could","would","i","want","with","is","it"])
export function contentTokens(value:string):Set<string> {
  return new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)??[])
    .filter(word=>word.length>1 && !stop.has(word)))
}
export function argumentSimilarity(original:string, supplied:string):number {
  const left=contentTokens(original), right=contentTokens(supplied)
  if(!left.size||!right.size)return 0
  let common=0
  for(const x of left)if(right.has(x))common++
  return common/(left.size+right.size-common)
}
export type GuardDecision = { allowed:boolean; reason?:string; retry:boolean; fallback:boolean; score:number }
export function inspectToolCall(
  name:string, argument:unknown, original:string, failures=0,
  threshold=0.4,
):GuardDecision {
  if(!ACTION_TEXT_TOOLS.has(name))return {allowed:true,retry:false,fallback:false,score:1}
  const args=argument && typeof argument==="object" ? argument as Record<string,unknown> : {}
  const text= [args.request,args.instruction,args.task].find(x=>typeof x==="string")
  if(typeof text!=="string")return {allowed:true,retry:false,fallback:false,score:1}
  const score=argumentSimilarity(original,text)
  const allowed=score>=threshold || original.includes(text) || text.includes(original)
  return {allowed,score,retry:!allowed&&failures<1,fallback:!allowed&&failures>=1,
    ...(allowed?{}:{reason:"Pass the user's original message verbatim; do not paraphrase."})}
}

/** After exactly one corrective model retry, use original input, never
 * another LLM paraphrase. Existing typed non-text arguments stay intact.
 */
export function rawTextFallback(name:string,input:unknown,original:string):unknown {
  if(!ACTION_TEXT_TOOLS.has(name)||!input||typeof input!=="object")return input
  const field=name==="jarvis_quick_action"?"request":name==="session_create"?"instruction":"task"
  return {...input,[field]:original}
}
