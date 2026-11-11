import {expect,test} from "bun:test"
import {classifyTurn} from "./chat-classifier"
test("incoming messages classify deterministically without LLM",()=>{
 expect(classifyTurn("status please",true)).toBe("STATUS_QUERY")
 expect(classifyTurn("cancel",true)).toBe("CANCEL")
 expect(classifyTurn("also add a test",true)).toBe("FOLLOWUP")
 expect(classifyTurn("open github",true)).toBe("NEW_TASK")
 expect(classifyTurn("How are you?",true)).toBe("SMALLTALK")
})
