/** Inversion-of-control bridge. Never import Session.Service into the model-request
 * module: Session owns ModelRequest and a direct import creates a circular type graph.
 * The controller registers these callbacks while authorizing its real worker tools.
 */
export type WorkerSummary = { id: string; title: string }
export interface WorkerAdapter {
  active: () => Promise<WorkerSummary[]>
  list: () => Promise<string>
  interrupt: (id:string) => Promise<boolean>
  send: (id:string, instruction:string) => Promise<void>
}
const adapters = new Map<string, WorkerAdapter>()
const MAX = 128
export function registerWorkerAdapter(parentID:string, adapter:WorkerAdapter) {
  adapters.delete(parentID)
  adapters.set(parentID,adapter)
  if(adapters.size>MAX) adapters.delete(adapters.keys().next().value!)
}
export function getWorkerAdapter(parentID:string):WorkerAdapter|undefined {
  return adapters.get(parentID)
}
export function unregisterWorkerAdapter(parentID:string) {
  adapters.delete(parentID)
}
