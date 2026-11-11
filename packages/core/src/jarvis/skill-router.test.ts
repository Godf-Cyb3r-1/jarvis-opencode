import { expect, test } from "bun:test"
import { matchSkill, matchSkills, executeSkill } from "./skill-router"
test("multilingual deterministic matches and no partial multi-intent actions", () => {
  for (const [prompt, skill] of [
    ["play a tamil sad song","play.media.search"],
    ["play tamil paattu","play.media.search"],
    ["பாடல் போடு தமிழ்","play.media.search"],
    ["open https://github.com/","open.url"],
    ["open spotify","open.app"],
    ["google new laptops","search.web"],
    ["search for security papers","search.web"],
    ["வணக்கம்","greet"],
    ["enna nadakuthu","status.workers"],
  ]) expect(matchSkill(prompt)?.id).toBe(skill)
  expect(matchSkills("open github then search for laptop")).toHaveLength(2)
  expect(matchSkills("open github then blow up something")).toHaveLength(0)
  expect(matchSkill("write a program to play videos")).toBeUndefined()
})
test("skill completion has bounded execution and verified narration", async () => {
  const m = matchSkill("play a tamil sad song")!
  let opened = ""
  const result = await executeSkill(m,{
    launch: async (url) => { opened=url; return "Browser launch requested, playback unverified" },
    workers: async () => "No workers",
  })
  expect(result.success).toBe(true)
  expect(opened).toContain("youtube.com/results?search_query=")
  expect(result.detail).toContain("unverified")
  expect(result.elapsedMs).toBeLessThan(600)
})
