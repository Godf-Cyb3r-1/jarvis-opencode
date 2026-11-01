export type GatedKind = "delete" | "force-push" | "external-script" | "plugin-write" | "permission-expand" | "paid-model"
type Pending = { id: string; kind: GatedKind; target: string; created: number; stage: 1 | 2; nonce: string }
export class ConfirmationGate {
  private readonly pending = new Map<string,Pending>()
  constructor(private readonly audit: (event: string, detail: string) => void = () => {}) {}
  request(id: string, kind: GatedKind, target: string): { phrase: string } {
    if (!id || !target.trim()) throw new Error("Action and exact target required")
    const nonce = crypto.randomUUID().slice(0,8)
    this.pending.set(id, {id,kind,target,created:Date.now(),stage:1,nonce})
    this.audit("requested", `${kind}: ${target}`)
    return { phrase: `confirm ${kind} ${target}` }
  }
  confirm(id: string, phrase: string): { approved: boolean; next?: string } {
    const action=this.pending.get(id)
    if (!action) return {approved:false}
    if (Date.now()-action.created>120000) {
      this.pending.delete(id);this.audit("expired",id);return {approved:false}
    }
    if (action.stage===1) {
      if (phrase!==`confirm ${action.kind} ${action.target}`) {
        this.pending.delete(id);this.audit("denied",id);return {approved:false}
      }
      action.stage=2
      return {approved:false,next:`Type final confirmation: ${action.nonce}`}
    }
    this.pending.delete(id)
    const approved=phrase===action.nonce
    this.audit(approved?"approved":"denied",id)
    return {approved}
  }
  cancelAll():void {this.pending.clear()}
}
