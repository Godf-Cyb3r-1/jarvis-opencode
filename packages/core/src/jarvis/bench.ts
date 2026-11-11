import { matchSkills, executeSkill } from "./skill-router.js"
import { scopedTools } from "./tool-scope.js"
export type Sample = { prompt: string; firstResultMs: number; confidence: number; toolCount: number; refusals: number; opener: string; matched: boolean }
export const benchmarkPrompts = [
 "play a Tamil song","play a sad song","play tamil paattu","பாடல் போடு தமிழ்","play music",
 "open github","open gmail","open youtube","open spotify","open https://github.com/",
 "google laptops","search for rice recipes","தேடு தமிழ்ப் பாடல்","search Java docs","google weather forecast",
 "hi","hello","hey","vanakkam","வணக்கம்",
 "task status","worker status","what's happening","enna nadakuthu","என்ன நடக்குது",
 "build a website","refactor auth","fix unit tests","migrate the db","deploy production",
 "delete the old database","wipe disk","send email","update secret","purchase a product",
 "hi Jarvis","open https://www.youtube.com/","google machine learning","play a Tamil sad song","search for OpenCode workers",
] as const
/** Test-only deterministic admission benchmark. These are not provider token latency measurements. */
export async function benchmarkAdmission() : Promise<Sample[]> {
 const rows:Sample[]=[]
 for(const prompt of benchmarkPrompts){
  const started=performance.now()
  const matched=matchSkills(prompt)
  let firstResultMs=0
  if(matched.length){
   await executeSkill(matched[0]!,{ launch: async ()=>"Requested browser launch", workers: async ()=>"No workers" })
   firstResultMs=performance.now()-started
  }else firstResultMs=performance.now()-started
  const tools=scopedTools(new Map([["read",1],["browser_tabs_open",1],["session_create",1]]),matched)
  rows.push({prompt,firstResultMs,confidence:matched[0]?.confidence??0,toolCount:tools.size,
    refusals:0,opener:"",matched:matched.length>0})
 }
 return rows
}
