/** Resolve typed user-intent slots before calling OS primitives.
 * A missing personal preference is never inferred from identity or locale.
 */
export type ResolvedSlots = {
  text:string; query?:string; lang?:string; url?:string; path?:string;
  app?:string; duration?:number; genre?:string
}
export type SlotResolution = { slots:ResolvedSlots; missing:string[] }
export type SlotContext = { recentUserTurns?:readonly string[]; preferences?:Readonly<Record<string,string>> }
const languageAliases:Readonly<Record<string,string>>={
  tamil:"tamil",தமிழ்:"tamil",tamizh:"tamil",english:"english",
  ஆங்கிலம்:"english",malayalam:"malayalam",hindi:"hindi",telugu:"telugu",
  kannada:"kannada",odia:"odia",bengali:"bengali",
}
export function preferredLanguage(context:SlotContext):string|undefined {
  const saved=context.preferences?.preferred_language?.trim().toLowerCase()
  if(saved) return languageAliases[saved] ?? saved
  for(const turn of [...(context.recentUserTurns??[])].reverse().slice(0,8)){
    const explicit=turn.match(/(?:my|preferred|native|own)\s+language\s+(?:is\s+)?([\p{L}]+)/iu)?.[1]
      ?? turn.match(/\b(?:i speak|i prefer|i mainly speak)\s+([\p{L}]+)/iu)?.[1]
    if(explicit){const language=languageAliases[explicit.toLowerCase()];if(language)return language}
  }
}
export function resolveSlots(text:string,context:SlotContext={}):SlotResolution {
  const missing:string[]=[]
  const slots:ResolvedSlots={text}
  const ownLanguage=/\b(?:my (?:own |native |preferred )?lang(?:uage)?|own lang|en madhiri)\b/i.test(text)
  const explicit=Object.entries(languageAliases).find(([alias])=>new RegExp("(?:^|\\W)"+alias+"(?:\\W|$)","iu").test(text))
  if(explicit)slots.lang=explicit[1]
  else if(ownLanguage){slots.lang=preferredLanguage(context);if(!slots.lang)missing.push("lang")}
  const genre=text.match(/\b(sad|happy|romantic|melody|devotional|classical|rock|pop)\b/i)?.[1]
  if(genre)slots.genre=genre.toLowerCase()
  const url=text.match(/https:\/\/[^\s]+/i)?.[0]
  if(url)slots.url=url
  const duration=text.match(/\b(\d{1,3})\s*(?:minutes?|mins?|seconds?|secs?)\b/i)
  if(duration)slots.duration=Number(duration[1])
  const app=text.match(/\b(?:open|launch)\s+(github|gmail|youtube|spotify)\b/i)?.[1]
  if(app)slots.app=app.toLowerCase()
  if(/\b(?:play|listen)\b|பாடல்|பாட்டு/i.test(text)) {
    const cleaned=text.replace(/^(?:and\s+)?(?:then\s+)?(?:(?:hey|hi) jarvis,?\s*)?(?:please\s+)?(?:play|listen to)\s+/i,"")
      .replace(/\b(?:for me|on my (?:own )?lang(?:uage)?|in my (?:own )?lang(?:uage)?|in (?:tamil|english|malayalam|telugu|hindi)|for me)\b/gi,"")
      .trim()
    slots.query=cleaned||"song"
  }
  return {slots,missing}
}
export const planShapeKey=(intent:string,slots:ResolvedSlots)=>
  intent+":"+Object.keys(slots).filter(k=>k!=="text").sort().join(",")
export function mediaSearchURL(slots:ResolvedSlots):string {
  const text=[slots.genre,slots.lang,slots.query ?? "song"].filter(Boolean).join(" ").replace(/\s+/g," ").trim()
  const url=new URL("https://www.youtube.com/results")
  url.searchParams.set("search_query",text)
  return url.toString()
}
