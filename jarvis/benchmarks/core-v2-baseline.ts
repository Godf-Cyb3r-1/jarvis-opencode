/**
 * Jarvis Core v2: reproducible source-level baseline.
 * This is NOT an end-to-end assistant or playback benchmark.
 * Run on BOTH native Windows and Linux runners. Never represent classifier
 * time as action launch time or synthesized replies as real user conversations.
 */
import { mkdir } from "node:fs/promises"
import { join } from "node:path"
import { planQuickAction, planExecution } from "../../packages/core/src/jarvis/fast-path"
import { normalizeJarvisText } from "../../packages/core/src/jarvis/expression-policy"

const english = [
  "play a tamil song","play Vaathi Coming","play Anirudh hits","play a song for me please",
  "please play some music","play a Tamil track","put on Tamil songs","find and play music",
  "can you play a romantic song","play the song from Master","play music from Spotify",
  "play a video song","play a melody","play something happy","please play a Tamil playlist",
  "hey Jarvis play a song","can you play one song please","play Kanave KalaIyadhe",
  "play a devotional song","play a song by AR Rahman",
]
const tamil = [
  "ஒரு பாட்டு போடு","தமிழ் பாடல் போடு","ஒரு பாடல் போடுங்க","பாட்டு போடுறியா",
  "அனிருத் பாட்டு போடு","வாத்தி கம்மிங் பாடல் போடு","நல்ல பாட்டு போடு",
  "மெலடி பாட்டு போடு","பாடல் கேட்கணும்","பாட்டு வெச்சிடு",
  "இசை போடு","பாட்டு ஒலிக்க விடு","பாடல் பாடு","மாஸ்டர் பாட்டு போடு",
  "காதல் பாடல் போடு","ஒரு தமிழ் இசை போடு","புது பாடல் போடு",
  "ஏ ஆர் ரஹ்மான் பாட்டு போடு","சோக பாட்டு போடு","குத்து பாட்டு போடு",
]
const tanglish = [
  "oru paatu podu","oru pattu podunga","anirudh song podu","vaathi coming podu",
  "tamil paatu vai","oru nalla song vai","pattu podu please","paatu podriya",
  "hey jarvis oru paatu","oru melody song podu","oru tamil paadal podu",
  "rahman hits podu","master song podu","paatu play pannu",
  "music podunga","song vechi vidu","oru kuthu paatu podu",
  "tamil song podu pa","anirudh hits podu da","oru love paatu podu",
]
const nonMedia = [
  "play with fire","play a game of chess","play it safe","play a prank",
  "play the test scenario","play a role in the meeting","play football","play the actor",
  "open https://evil.example/","open file:///etc/passwd","run rm -rf /","install docker",
  "send a message","send a file","book a restaurant","what is the weather",
  "fix my code","test the login endpoint","compile the app","debug the server",
  "who is the president","list files","show worker status","pause the worker",
  "create a spreadsheet","organize my folder","summarize the PDF","write an email",
  "stop everything","explain transformers","read notes","run a security audit",
  "scan the repository","analyse logs","open the terminal","set a reminder",
  "call my contact","check my balance","tell me a joke","hi Jarvis",
]
if (english.length !== 20 || tamil.length !== 20 || tanglish.length !== 20 || nonMedia.length !== 40) throw Error("Fixture counts changed")

const media = [...english, ...tamil, ...tanglish]
const start = performance.now()
const mapped = media.map((text) => ({ text, accepted: planQuickAction(text)?.kind === "youtube-search" }))
const controls = nonMedia.map((text) => ({ text, falsePositive: planQuickAction(text)?.kind === "youtube-search" }))
const classifierMs = performance.now() - start
const round = (n: number) => Number(n.toFixed(3))
const matches = mapped.filter((x) => x.accepted).length
const falsePositives = controls.filter((x) => x.falsePositive).length
const taskFixtures = [
  ...Array.from({length:10},(_,i)=>({text:["hi","what is 2 plus 2","open website","show status","list agents"][i%5]!,tier:"low"})),
  ...Array.from({length:10},(_,i)=>({text:["explain how computers work","compare two movie plots","write a note","find a restaurant","outline a speech"][i%5]!,tier:"medium"})),
  ...Array.from({length:15},(_,i)=>({text:["fix a regression","implement a feature","debug production code","integrate a package","test our application"][i%5]!,tier:"high"})),
  ...Array.from({length:15},(_,i)=>({text:["comprehensive architecture audit","refactor entire stack","from scratch production-ready system","full-stack migration","thorough security audit"][i%5]!,tier:"max"})),
]
const tiers = taskFixtures.map(({text,tier})=>({text,expected:tier,actual:planExecution(text).complexity}))
const tierCorrect = tiers.filter(x=>x.expected===x.actual).length

// Synthetic source-only checks: NEVER pass these off as actual model turns.
const expressions = Array.from({length:200},(_,i)=>normalizeJarvisText(i%4===0?"[sigh] That failed.": "This is working."))
const cueRate = expressions.filter(x=>x.accepted).length / expressions.length
const preserved = normalizeJarvisText("First paragraph.\n\n- Item 1\n- Item 2\n\nOpenCode 2.2.5").text
const report = {
  schema: 1, source:"jarvis-core-v2-baseline", gitSha:process.env.GITHUB_SHA??"local-uncommitted",
  os:process.platform,arch:process.arch, timestamp:new Date().toISOString(),
  sourceLevelOnly:true, // No browser launch, TTS, worker or provider runs here
  routing:{mediaCases:60,recognized:matches,accuracy:round(matches/60),misses:mapped.filter(x=>!x.accepted).map(x=>x.text),
    negativeControls:40,falsePositives,precision:round(matches/Math.max(1,matches+falsePositives)),
    classifierOnlyMs:round(classifierMs), launchMs:null,verifiedCompletionMs:null},
  complexity:{cases:50,correct:tierCorrect,accuracy:round(tierCorrect/50),errors:tiers.filter(x=>x.expected!==x.actual)},
  syntheticSpeech:{cases:200,cueRate:round(cueRate),visibleSample:preserved},
  runtimeAcceptance:{windowsInteractive:null,linuxInteractive:null,realReplyRefusalRate:null,workerContinuity:null,successClaimEvidence:null},
}
const output=process.env.JARVIS_BENCH_OUTPUT??"artifacts/jarvis-core-v2-baseline.json"
await mkdir(join(output,".."),{recursive:true})
await Bun.write(output,JSON.stringify(report,null,2)+"\n")
console.log(JSON.stringify(report,null,2))
