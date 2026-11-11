import {expect,test} from "bun:test"
import {matchSkills,executeSkill} from "./skill-router"
import {admissionReport,narrationTools,continuationText,narrationInstructions} from "./admission-policy"
import {stripDuplicateOpener} from "./expression-governor"
/** Reconstructs the three-turn failure described in the directive.
 * The full greeting.json was not provided, so only the documented turn-3
 * content and known greeting behavior are asserted.
 */
test("reported greeting trace resolves original turn 3 to exactly one OS primitive",async()=>{
 const turns=["hi jarvis","hi again","then play a sad song for me on my own lang"]
 const preference={preferred_language:"tamil"}
 const matches=matchSkills(turns[2]!,{recentUserTurns:turns.slice(0,2),preferences:preference})
 expect(matches).toHaveLength(1)
 expect(matches[0]!.id).toBe("play.media.search")
 const calls:string[]=[]
 const results=await Promise.all(matches.map(m=>executeSkill(m,{
   launch:async url=>{calls.push("os.openUrl:"+url);return "Browser launch requested; playback unverified"},
   workers:async()=>{calls.push("session_create");return "unexpected"},
 })))
 expect(calls).toHaveLength(1)
 expect(calls[0]).toContain("search_query=sad+tamil")
 expect(calls.join(" ")).not.toMatch(/agent_pick|agent_list|session_create/)
 const state=admissionReport(matches,results)
 expect(state.state).toBe("executed")
 expect(state.verified).toBe(false)
 expect(state.narrationOnly).toBe(true)
 const tools=narrationTools(new Map([["read",1],["session_create",2],["jarvis_quick_action",3],["browser_tabs_open",4]]),state)
 expect([...tools.keys()]).toEqual(["read"])
 const text="Opened the browser search; playback is not independently verified."
 expect(text.split(/\s+/).length).toBeLessThanOrEqual(20)
 expect(text).not.toMatch(/worker|lining up|will tell you once/i)
})
test("greeting short-circuits duplicate opener and prunes real tool schema",async()=>{
 const match=matchSkills("hi jarvis")
 expect(match).toHaveLength(1)
 const results=await Promise.all(match.map(m=>executeSkill(m,{
   launch:async()=>{throw Error("must not launch")},
   workers:async()=>{throw Error("must not delegate")},
   greeting:async()=> "Vanakkam.",
 })))
 const state=admissionReport(match,results)
 expect(state.verified).toBe(true)
 expect(state.narrationOnly).toBe(true)
 expect(narrationInstructions(state,results)).toContain("twelve words")
 expect([...narrationTools(new Map([["read",1],["session_create",2],["jarvis_quick_action",3]]),state).keys()]).toEqual(["read"])
 const spoken=stripDuplicateOpener("Vanakkam. What's going on?","Vanakkam.")
 expect(spoken).toBe("What's going on?")
 expect(continuationText("Vanakkam. What's going on?","Vanakkam.")).toBe("What's going on?")
})
test("verified plan cache gate excludes an unverified browser launch",()=>{
 const match=matchSkills("open github")
 const report=admissionReport(match,[{id:"open.app",success:true,verified:false,detail:"OS accepted",elapsedMs:3}])
 expect(report.state).toBe("executed")
 expect(report.verified).toBe(false)
})
