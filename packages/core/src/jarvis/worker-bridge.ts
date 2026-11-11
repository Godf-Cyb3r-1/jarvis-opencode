import type { PrimitiveName, PrimitiveResult } from "./primitives/index.js"
export type GeneralistWorkerBridge=(parentID:string,name:PrimitiveName,args:Record<string,unknown>)=>Promise<PrimitiveResult>
let bridge:GeneralistWorkerBridge|undefined
export const registerGeneralistWorkerBridge=(next:GeneralistWorkerBridge)=>{bridge=next}
export const callGeneralistWorker=(parentID:string,name:PrimitiveName,args:Record<string,unknown>)=>
 bridge?bridge(parentID,name,args):Promise.resolve({ok:false,error:"Worker controller is unavailable",evidence:["Missing worker bridge"]})
