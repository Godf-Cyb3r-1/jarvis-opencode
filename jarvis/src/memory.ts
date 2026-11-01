import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"

export type MemoryCard = {
  sessionId: string; title: string; goal: string; keywords: string;
  state: string; outcome: string; files: string; updatedAt: number
}
export class MemoryLedger {
  readonly db: Database
  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
    this.db = new Database(path, { create: true })
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS cards(
        session_id TEXT PRIMARY KEY, title TEXT NOT NULL, goal TEXT NOT NULL,
        keywords TEXT NOT NULL, state TEXT NOT NULL, outcome TEXT NOT NULL,
        files TEXT NOT NULL, updated_at INTEGER NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
        title, goal, keywords, outcome, content='cards', content_rowid='rowid');
      CREATE TRIGGER IF NOT EXISTS cards_insert AFTER INSERT ON cards BEGIN
        INSERT INTO cards_fts(rowid,title,goal,keywords,outcome)
          VALUES (new.rowid,new.title,new.goal,new.keywords,new.outcome);
      END;
      CREATE TRIGGER IF NOT EXISTS cards_delete AFTER DELETE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts,rowid,title,goal,keywords,outcome)
          VALUES ('delete',old.rowid,old.title,old.goal,old.keywords,old.outcome);
      END;
      CREATE TRIGGER IF NOT EXISTS cards_update AFTER UPDATE ON cards BEGIN
        INSERT INTO cards_fts(cards_fts,rowid,title,goal,keywords,outcome)
          VALUES ('delete',old.rowid,old.title,old.goal,old.keywords,old.outcome);
        INSERT INTO cards_fts(rowid,title,goal,keywords,outcome)
          VALUES (new.rowid,new.title,new.goal,new.keywords,new.outcome);
      END;
      CREATE TABLE IF NOT EXISTS profile(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    `)
    this.db.exec("INSERT INTO cards_fts(cards_fts) VALUES ('rebuild')")
  }
  upsert(card: MemoryCard): void {
    this.db.query(`INSERT INTO cards(session_id,title,goal,keywords,state,outcome,files,updated_at)
      VALUES ($sessionId,$title,$goal,$keywords,$state,$outcome,$files,$updatedAt)
      ON CONFLICT(session_id) DO UPDATE SET title=excluded.title,goal=excluded.goal,
      keywords=excluded.keywords,state=excluded.state,outcome=excluded.outcome,
      files=excluded.files,updated_at=excluded.updated_at`).run({ ...card })
  }
  get(sessionId: string): MemoryCard | null {
    const result = this.db.query(`SELECT session_id AS sessionId,title,goal,keywords,state,
      outcome,files,updated_at AS updatedAt FROM cards WHERE session_id=?`).get(sessionId)
    return (result ?? null) as MemoryCard | null
  }
  search(input: string, limit = 3): MemoryCard[] {
    const tokens = input.normalize("NFKC").match(/[\p{L}\p{N}_-]+/gu)?.slice(0, 8) ?? []
    if (!tokens.length) return []
    const query = tokens.map(t => '"' + t.replaceAll('"','') + '"*').join(" OR ")
    return this.db.query(`SELECT cards.session_id AS sessionId,cards.title AS title,cards.goal AS goal,cards.keywords AS keywords,cards.state AS state,
      cards.outcome AS outcome,cards.files AS files,cards.updated_at AS updatedAt FROM cards JOIN cards_fts
      ON cards.rowid=cards_fts.rowid WHERE cards_fts MATCH ?
      ORDER BY bm25(cards_fts),updated_at DESC LIMIT ?`).all(query, Math.max(1, Math.min(limit, 10))) as MemoryCard[]
  }
  setProfile(key: string, value: string): void {
    this.db.query("INSERT INTO profile(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,value)
  }
  profile(): Record<string,string> {
    return Object.fromEntries((this.db.query("SELECT key,value FROM profile").all() as {key:string,value:string}[]).map(r=>[r.key,r.value]))
  }
  close(): void { this.db.close() }
}
