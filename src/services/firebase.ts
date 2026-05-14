
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  writeBatch,
  getDocs,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { User, UserRole, Customer, HistoryLog, Company } from "../types";
import { BRANCHES } from "../config/constants";

const firebaseConfig = {
  apiKey: "AIzaSyBc4Aam5pdipIfc2B4Ymk4A3NRWxFHU8Dc",
  authDomain: "routegeniusai.firebaseapp.com",
  projectId: "routegeniusai",
  storageBucket: "routegeniusai.firebasestorage.app",
  messagingSenderId: "104065712296",
  appId: "1:104065712296:web:4929e6afc8fa96aac9429d",
  measurementId: "G-DSWXSXRG0C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Data Isolation Helpers
const SYS_COMPANIES_COLLECTION = 'system_companies';

const getCompanyCollectionPath = (companyId: string) => {
  // All company data lives under: companies/{companyId}/data/...
  return `companies/${companyId}/data`;
};

// GLOBAL Collections
const COLLECTION_NAME = 'users_data';
const DOC_USERS = 'auth_users';
// Local/Company Docs
const DOC_HISTORY = 'upload_history';
const DOC_METADATA = 'system_metadata';

const DEFAULT_ADMIN: User = {
  username: 'admin',
  password: '123',
  companyId: 'default',
  role: UserRole.ADMIN,
  isActive: true,
  branchIds: []
};

// --- UTILITIES ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 5, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (err: any) {
    if (retries > 0 && (err?.code === 'resource-exhausted' || err?.code === 'unavailable' || err?.code === 'deadline-exceeded')) {
      console.warn(`Firestore write failed (${err.code}). Retrying in ${delay}ms...`);
      await sleep(delay);
      return retryWithBackoff(fn, retries - 1, delay * 2);
    }
    throw err;
  }
};

async function processInChunks<T>(
  items: T[],
  chunkSize: number,
  iterator: (item: T) => void,
  cancellationToken?: { aborted: boolean }
) {
  for (let i = 0; i < items.length; i += chunkSize) {
    if (cancellationToken?.aborted) throw new Error("Cancelled by user");
    const chunk = items.slice(i, i + chunkSize);
    chunk.forEach(iterator);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

const safeString = (val: any): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

const safeNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// --- DATA MAPPERS ---

const mapCustomerToFirestore = (c: any): any => {
  const baseObj: any = {
    id: safeString(c.id),
    name: safeString(c.name).substring(0, 100),
    lat: safeNumber(c.lat),
    lng: safeNumber(c.lng),
    day: safeString(c.day || 'Unscheduled').substring(0, 20),
  };

  if (c.clientCode) baseObj.clientCode = safeString(c.clientCode).substring(0, 50);
  if (c.routeName) baseObj.routeName = safeString(c.routeName).substring(0, 100);
  if (c.address) baseObj.address = safeString(c.address).substring(0, 200);
  if (c.week) baseObj.week = safeString(c.week).substring(0, 20);
  if (c.regionDescription) baseObj.regionDescription = safeString(c.regionDescription).substring(0, 100);
  if (c.regionCode) baseObj.regionCode = safeString(c.regionCode).substring(0, 50);
  if (c.nameAr) baseObj.nameAr = safeString(c.nameAr).substring(0, 100);

  return baseObj;
};

const mapUserToFirestore = (u: any): User => ({
  username: safeString(u.username),
  password: safeString(u.password),
  role: u.role as UserRole,
  isActive: Boolean(u.isActive),
  branchIds: Array.isArray(u.branchIds) ? u.branchIds.map(safeString) : [],
  lastLogin: safeString(u.lastLogin),
  companyId: safeString(u.companyId)
});

const mapHistoryLogToFirestore = (log: any): HistoryLog => {
  let safeStats = undefined;
  if (log && log.stats && typeof log.stats === 'object') {
    safeStats = {
      distinctClients: safeNumber(log.stats.distinctClients),
      skippedRecords: safeNumber(log.stats.skippedRecords),
      distinctSkipped: safeNumber(log.stats.distinctSkipped),
      regions: Array.isArray(log.stats.regions) ? log.stats.regions.map(safeString).slice(0, 50) : [],
      regionBreakdown: Array.isArray(log.stats.regionBreakdown) ? log.stats.regionBreakdown.map((r: any) => ({
        name: safeString(r.name),
        count: safeNumber(r.count),
        skipped: safeNumber(r.skipped),
        routes: []
      })) : [],
      skippedDetails: Array.isArray(log.stats.skippedDetails) ? log.stats.skippedDetails.map((s: any) => ({
        name: safeString(s.name),
        clientCode: safeString(s.clientCode),
        reason: safeString(s.reason),
        region: safeString(s.region),
        route: safeString(s.route)
      })).slice(0, 500) : []
    };
  }

  const baseLog: any = {
    id: safeString(log.id),
    fileName: safeString(log.fileName),
    uploadDate: safeString(log.uploadDate),
    recordCount: safeNumber(log.recordCount),
    uploader: safeString(log.uploader),
    type: log.type === 'USERS' ? 'USERS' : 'ROUTE',
  };

  if (safeStats) {
    baseLog.stats = safeStats;
  }

  return baseLog;
};

// --- SYSADMIN SERVICES ---

export const subscribeToCompanies = (callback: (companies: Company[]) => void) => {
  const colRef = collection(db, SYS_COMPANIES_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const companies: Company[] = [];
    snapshot.forEach(doc => {
      companies.push({ id: doc.id, ...doc.data() } as Company);
    });
    callback(companies);
  });
};

export const subscribeToCompany = (companyId: string, callback: (company: Company | null) => void) => {
  const docRef = doc(db, SYS_COMPANIES_COLLECTION, companyId);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Company);
    } else {
      callback(null);
    }
  });
};

export const addCompany = async (company: Company) => {
  const docRef = doc(db, SYS_COMPANIES_COLLECTION, company.name); // ID is Name
  await setDoc(docRef, company);
};

export const updateCompany = async (company: Company) => {
  const docRef = doc(db, SYS_COMPANIES_COLLECTION, company.id);
  await setDoc(docRef, company, { merge: true });
};


// --- COMPANY SCOPED SERVICES ---

/**
 * Access the FULL global user list (internal use for login check)
 */
export const subscribeToGlobalUsers = (callback: (users: User[]) => void) => {
  const docRef = doc(db, COLLECTION_NAME, DOC_USERS);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data().list || []);
    } else {
      callback([]);
    }
  });
};

/**
 * Subscribe to users filtered by Company ID.
 * Reads from GLOBAL collection but returns subset.
 */
export const subscribeToUsers = (companyId: string, callback: (users: User[]) => void) => {
  const docRef = doc(db, COLLECTION_NAME, DOC_USERS);

  return onSnapshot(docRef, async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      const allUsers: User[] = data.list || [];
      const companyUsers = allUsers.filter(u => u.companyId === companyId);
      callback(companyUsers);
    } else {
      callback([]);
    }
  });
};

/**
 * Update users for a SPECIFIC company in the GLOBAL list.
 * Merges logic to handle potential race conditions naively.
 */
export const saveUsers = async (companyId: string, users: User[]) => {
  const docRef = doc(db, COLLECTION_NAME, DOC_USERS);

  try {
    await retryWithBackoff(async () => {
      const docSnap = await getDoc(docRef);
      let allUsers: User[] = [];
      if (docSnap.exists()) {
        allUsers = (docSnap.data().list || []).map(mapUserToFirestore);
      }

      // Remove OLD users of this company
      const otherUsers = allUsers.filter(u => u.companyId !== companyId);

      // Add NEW users for this company (ensuring companyId is set)
      const cleanNewUsers = users.map(u => ({ ...mapUserToFirestore(u), companyId }));

      const merged = [...otherUsers, ...cleanNewUsers];
      await setDoc(docRef, { list: merged }, { merge: true });
    });
  } catch (e) {
    console.error("Failed to save users", e);
    throw e;
  }
};

/**
 * Helper to add a single user globally (used by SysAdmin)
 */
export const addGlobalUser = async (user: User) => {
  const docRef = doc(db, COLLECTION_NAME, DOC_USERS);
  try {
    await retryWithBackoff(async () => {
      const docSnap = await getDoc(docRef);
      let allUsers: User[] = [];
      if (docSnap.exists()) {
        allUsers = (docSnap.data().list || []);
      }
      // Check uniqueness (simple check)
      if (allUsers.find(u => u.username === user.username)) {
        throw new Error("Username already taken system-wide");
      }
      const cleanUser = mapUserToFirestore(user);
      // Ensure companyId is set
      if (!cleanUser.companyId) cleanUser.companyId = user.companyId || 'default';

      const merged = [...allUsers, cleanUser];
      await setDoc(docRef, { list: merged }, { merge: true });
    });
  } catch (e) {
    throw e;
  }
};

export const updateUserLastLogin = async (companyId: string, username: string) => {
  const docRef = doc(db, COLLECTION_NAME, DOC_USERS);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const list = data.list || [];
      const updatedList = list.map((u: any) => {
        if (u.username === username) {
          return { ...u, lastLogin: new Date().toISOString() };
        }
        return u;
      });
      await updateDoc(docRef, { list: updatedList });
    }
  } catch (e: any) {
    console.error("Failed to update last login: " + (e.message || String(e)));
  }
};

let unsubscribeCurrentRoute: (() => void) | null = null;

export const subscribeToRoutes = (companyId: string, callback: (customers: Customer[]) => void) => {
  const collectionPath = getCompanyCollectionPath(companyId);
  const metadataRef = doc(db, collectionPath, DOC_METADATA);

  return onSnapshot(metadataRef, (metaSnap) => {
    const metaData = metaSnap.data();
    const activeVersionId = metaData?.activeRouteVersion || 'active_routes';
    // Sub-collection for routes lives inside the company path
    const collectionName = activeVersionId === 'active_routes' ? 'active_routes' : `route_v_${activeVersionId}`;

    if (unsubscribeCurrentRoute) {
      unsubscribeCurrentRoute();
      unsubscribeCurrentRoute = null;
    }

    // Path: companies/{companyId}/data/{routeCollection}/chunks
    const chunksRef = collection(db, collectionPath, collectionName, 'chunks');

    unsubscribeCurrentRoute = onSnapshot(chunksRef, (snapshot) => {
      if (!snapshot.empty) {
        const allCustomers: Customer[] = [];
        const sortedDocs = snapshot.docs.sort((a, b) => a.id.localeCompare(b.id));
        sortedDocs.forEach(doc => {
          const d = doc.data();
          if (d.data && Array.isArray(d.data)) {
            allCustomers.push(...d.data);
          }
        });
        callback(allCustomers);
      } else {
        callback([]);
      }
    });
  });
};

export const subscribeToSystemMetadata = (companyId: string, callback: (data: { lastUpdated: string, activeVersionId: string }) => void) => {
  const collectionPath = getCompanyCollectionPath(companyId);
  const docRef = doc(db, collectionPath, DOC_METADATA);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      const d = docSnap.data();
      callback({
        lastUpdated: d.lastUpdated || '',
        activeVersionId: d.activeRouteVersion || 'active_routes'
      });
    } else {
      callback({ lastUpdated: '', activeVersionId: '' });
    }
  });
};

export const restoreRouteVersion = async (companyId: string, versionId: string, timestamp: string) => {
  const collectionPath = getCompanyCollectionPath(companyId);
  const metaRef = doc(db, collectionPath, DOC_METADATA);
  await setDoc(metaRef, {
    activeRouteVersion: versionId,
    lastUpdated: timestamp
  }, { merge: true });
};

export type BranchProgressMap = Record<string, {
  total: number,
  uploaded: number,
  done: boolean,
  distinct: number,
  noGps: number,
  nearby: number
}>;

async function limitConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  const executing: Promise<void>[] = [];
  for (const item of items) {
    const p = fn(item).then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

const cloneBranchStats = (stats: BranchProgressMap): BranchProgressMap => {
  const newStats: BranchProgressMap = {};
  for (const key in stats) {
    if (Object.prototype.hasOwnProperty.call(stats, key)) {
      const old = stats[key];
      newStats[key] = {
        total: old.total,
        uploaded: old.uploaded,
        done: old.done,
        distinct: old.distinct,
        noGps: old.noGps,
        nearby: old.nearby
      };
    }
  }
  return newStats;
};

export const saveRouteData = async (
  companyId: string,
  customers: Customer[],
  onProgress?: (overallProgress: number, branchStats: BranchProgressMap) => void,
  cancellationToken?: { aborted: boolean }
) => {
  const versionId = Date.now().toString();
  const collectionId = `route_v_${versionId}`;
  const collectionPath = getCompanyCollectionPath(companyId);

  const routeDocRef = doc(db, collectionPath, collectionId);
  const chunksRef = collection(db, collectionPath, collectionId, 'chunks');
  const metadataRef = doc(db, collectionPath, DOC_METADATA);

  const branchMap: Record<string, Customer[]> = {};
  const branchStats: BranchProgressMap = {};
  const branchNoGpsSets: Record<string, Set<string>> = {};

  const cleanCustomers = customers.map(mapCustomerToFirestore);
  const totalRecords = cleanCustomers.length;

  await processInChunks(cleanCustomers, 2000, (c) => {
    const branch = c.regionDescription || 'Unknown';
    if (!branchMap[branch]) branchMap[branch] = [];
    branchMap[branch].push(c);

    if (!branchStats[branch]) {
      branchStats[branch] = {
        total: 0, uploaded: 0, done: false, distinct: 0, noGps: 0, nearby: 0
      };
      branchNoGpsSets[branch] = new Set();
    }

    const bs = branchStats[branch];
    bs.total++;

    if (c.lat === 0 || c.lng === 0) {
      branchNoGpsSets[branch].add(c.clientCode || c.id);
      bs.noGps = branchNoGpsSets[branch].size;
    }

    const bInfo = BRANCHES.find(b => b.code === c.regionCode);
    if (bInfo && c.lat && c.lng) {
      if (calcDist(bInfo.lat, bInfo.lng, c.lat, c.lng) < 0.3) bs.nearby++;
    }
  }, cancellationToken);

  if (cancellationToken?.aborted) throw new Error("Upload Cancelled");

  Object.keys(branchMap).forEach(b => {
    const set = new Set(branchMap[b].map(c => c.clientCode || c.id));
    branchStats[b].distinct = set.size;
  });

  if (onProgress) onProgress(0, cloneBranchStats(branchStats));

  try {
    await retryWithBackoff(() => setDoc(routeDocRef, {
      id: versionId,
      status: 'uploading',
      uploadDate: new Date().toISOString(),
      recordCount: totalRecords
    }, { merge: true }));
  } catch (e) { }

  const allBatches: { branch: string, chunk: Customer[], chunkIndex: number }[] = [];
  let globalChunkIndex = 0;

  Object.entries(branchMap).forEach(([branchName, branchCustomers]) => {
    for (let i = 0; i < branchCustomers.length; i += 400) {
      allBatches.push({
        branch: branchName,
        chunk: branchCustomers.slice(i, i + 400),
        chunkIndex: globalChunkIndex++
      });
    }
  });

  let globalUploaded = 0;

  await limitConcurrency(allBatches, 3, async (batchItem) => {
    if (cancellationToken?.aborted) return;

    await retryWithBackoff(async () => {
      const batch = writeBatch(db);
      const docId = `chunk_${batchItem.chunkIndex.toString().padStart(5, '0')}`;
      const chunkRef = doc(chunksRef, docId);
      batch.set(chunkRef, { data: batchItem.chunk });
      await batch.commit();
    });

    await sleep(50);

    globalUploaded += batchItem.chunk.length;
    const bStat = branchStats[batchItem.branch];
    bStat.uploaded += batchItem.chunk.length;

    if (bStat.uploaded >= bStat.total) {
      bStat.done = true;
      bStat.uploaded = bStat.total;
    }

    if (onProgress) {
      const overallPercent = Math.round((globalUploaded / totalRecords) * 100);
      onProgress(overallPercent, cloneBranchStats(branchStats));
    }
  });

  if (cancellationToken?.aborted) throw new Error("Upload Cancelled");

  try {
    const timestamp = new Date().toISOString();
    await retryWithBackoff(() => setDoc(routeDocRef, { status: 'complete' }, { merge: true }));
    await retryWithBackoff(() => setDoc(metadataRef, {
      activeRouteVersion: versionId,
      lastUpdated: timestamp
    }, { merge: true }));
  } catch (e: any) {
    throw new Error("Data uploaded but failed to switch active version.");
  }
};

export const subscribeToHistory = (companyId: string, callback: (logs: HistoryLog[]) => void) => {
  const collectionPath = getCompanyCollectionPath(companyId);
  const docRef = doc(db, collectionPath, DOC_HISTORY);
  return onSnapshot(docRef, async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback(data.logs || []);
    } else {
      await setDoc(docRef, { logs: [] });
    }
  });
};

export const addHistoryLog = async (companyId: string, log: HistoryLog) => {
  const collectionPath = getCompanyCollectionPath(companyId);
  const docRef = doc(db, collectionPath, DOC_HISTORY);
  const cleanLog = mapHistoryLogToFirestore(log);

  try {
    await retryWithBackoff(async () => {
      const docSnap = await getDoc(docRef);
      let existingLogs: HistoryLog[] = [];
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.logs && Array.isArray(data.logs)) {
          existingLogs = data.logs.map(mapHistoryLogToFirestore);
        }
      }
      const newLogs = [...existingLogs, cleanLog].slice(-20);
      await setDoc(docRef, { logs: newLogs }, { merge: true });

      // Sync to Company Doc if it's a Route Upload
      if (cleanLog.type === 'ROUTE') {
        const companyRef = doc(db, SYS_COMPANIES_COLLECTION, companyId);
        await setDoc(companyRef, {
          lastUploadDate: cleanLog.uploadDate,
          lastUploadRecordCount: cleanLog.recordCount
        }, { merge: true });
      }
    });
  } catch (e: any) {
    await setDoc(docRef, { logs: [cleanLog] }).catch(err => console.error("Failed to write log", err));
  }
};

export const deleteCompany = async (companyId: string) => {
  try {
    // 1. Delete Company Scoped Data
    const dataPath = getCompanyCollectionPath(companyId);
    await deleteDoc(doc(db, dataPath, DOC_METADATA)).catch(() => { });
    await deleteDoc(doc(db, dataPath, DOC_HISTORY)).catch(() => { });

    // 2. Delete Company Document
    // Note: ID for system_companies is likely the Name, but let's be safe and try efficient deletion if ID passed is Name
    // In our app, ID === Name currently.
    await deleteDoc(doc(db, SYS_COMPANIES_COLLECTION, companyId));

    return true;
  } catch (error) {
    console.error("Delete Company Failed:", error);
    throw error;
  }
};

export { db };
