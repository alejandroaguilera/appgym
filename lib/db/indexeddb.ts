import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  SessionLogRecord,
  SetLogRecord,
  PauseRecord,
  RestTimerRecord,
  SessionContextRecord,
  OutboxRecord,
} from "./types";

interface AppGymDB extends DBSchema {
  sessionLogs: {
    key: string;
    value: SessionLogRecord;
    indexes: { "by-estado": string };
  };
  setLogs: {
    key: string;
    value: SetLogRecord;
    indexes: { "by-sessionLogId": string };
  };
  pauses: {
    key: number;
    value: PauseRecord;
    indexes: { "by-sessionLogId": string };
  };
  restTimer: {
    key: string; // sessionLogId
    value: RestTimerRecord;
  };
  sessionContext: {
    key: string; // sessionLogId
    value: SessionContextRecord;
  };
  outbox: {
    key: number;
    value: OutboxRecord;
  };
}

const DB_NAME = "appgym-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<AppGymDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AppGymDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB no disponible (SSR)"));
  }
  if (!dbPromise) {
    dbPromise = openDB<AppGymDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessionLogs = db.createObjectStore("sessionLogs", { keyPath: "id" });
        sessionLogs.createIndex("by-estado", "estado");

        const setLogs = db.createObjectStore("setLogs", { keyPath: "id" });
        setLogs.createIndex("by-sessionLogId", "sessionLogId");

        const pauses = db.createObjectStore("pauses", {
          keyPath: "seq",
          autoIncrement: true,
        });
        pauses.createIndex("by-sessionLogId", "sessionLogId");

        db.createObjectStore("restTimer", { keyPath: "sessionLogId" });
        db.createObjectStore("sessionContext", { keyPath: "sessionLogId" });

        db.createObjectStore("outbox", { keyPath: "seq", autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export type { AppGymDB };
