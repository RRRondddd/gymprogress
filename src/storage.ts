import Dexie, { type Table } from "dexie";
import { initial, type State } from "./domain";
export class Database extends Dexie {
  snapshots!: Table<{ id: string; data: State }, string>;
  constructor(name = "gymprogress") {
    super(name);
    this.version(1).stores({ snapshots: "id" });
  }
}
export const db = new Database();
export const load = async () => {
  const row = await db.snapshots.get("main");
  return row ? row.data : initial();
};
export const save = async (data: State) => {
  await db.snapshots.put({ id: "main", data });
};
