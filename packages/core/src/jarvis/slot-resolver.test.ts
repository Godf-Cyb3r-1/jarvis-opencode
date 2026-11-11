import {expect,test} from "bun:test"
import {resolveSlots,mediaSearchURL,planShapeKey} from "./slot-resolver"
test("uses preferred language in my-language request without LLM",()=>{
 const a=resolveSlots("play a song in my language",{preferences:{preferred_language:"tamil"}})
 expect(a.missing).toEqual([])
 expect(a.slots.lang).toBe("tamil")
 expect(mediaSearchURL(a.slots)).toContain("tamil")
 const b=resolveSlots("play a song in my language")
 expect(b.missing).toEqual(["lang"])
 const c=resolveSlots("play a song in my language",{preferences:{preferred_language:"english"}})
 expect(planShapeKey("play.media.search",a.slots)).toBe(planShapeKey("play.media.search",c.slots))
})
