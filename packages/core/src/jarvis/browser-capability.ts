export function browserToolsInstalled(names:readonly string[]):boolean {
  return names.some(name=>/browser_tabs_(?:open|list|navigate)|ui_click|window[._]focus|input[._]sendKeys/i.test(name))
}
export function requiresBrowserControl(text:string):boolean {
  return /\b(?:play|watch|click|interact|fill|verify playback|confirm playback|pause video|browser control)\b|பாடல்|பாட்டு/i.test(text)
}
export function browserWorkerDecision(task:string, agents:readonly {id:string}[], tools:readonly string[]): {
  route:"browser"|"direct"|"unavailable"; reason:string
} {
  if(!requiresBrowserControl(task))return {route:"direct",reason:"Browser interaction not requested"}
  const installed=agents.some(agent=>agent.id==="browser")&&browserToolsInstalled(tools)
  return installed
    ? {route:"browser",reason:"Browser-capable worker and interactive tools available"}
    : {route:"unavailable",reason:"No browser-control worker is installed; I can open a URL but cannot verify playback."}
}
