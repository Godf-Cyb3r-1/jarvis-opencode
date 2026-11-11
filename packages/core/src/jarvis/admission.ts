/** Only distinguishes speech acts. This is NOT a table of tasks or
 * recognized commands: unknown action categories go to the same planner.
 */
export function isGeneralistAction(raw:string):boolean {
 const text=raw.trim()
 if(!text||text.length>8000)return false
 if(/^(?:hi|hello|hey|thanks|thank you|vanakkam|good morning|good night)[.! ]*$/i.test(text))return false
 if(/^(?:what|why|who|where|when|which|is|are|does|do you|do we|tell me about|explain why|how (?:does|is|are|can i))\b/i.test(text))return false
 if(/^(?:i(?:'m| am| was| feel| felt| like| love| think| believe| remember)|we(?:'re| are| were)|my (?:name|favorite|favourite)|today (?:was|is)|yesterday|that's|that is)\b/i.test(text)&&
    !/\b(?:please|do this|i need you to|i want you to|can you|would you)\b/i.test(text))return false
 // All remaining requests enter the generic planner regardless of subject.
 return true
}
