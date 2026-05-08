'use client'

import type {
  OfflineBookRecord,
  OfflineProgressRecord,
  OfflineSyncState,
  PendingOfflineAction,
} from '@/lib/offline-types'

const DB_NAME = 'bookstream-offline'
const DB_VERSION = 1
const BOOK_STORE = 'books'
const PROGRESS_STORE = 'progress'
const QUEUE_STORE = 'queue'
const SYNC_STORE = 'sync'

type StoreName = typeof BOOK_STORE | typeof PROGRESS_STORE | typeof QUEUE_STORE | typeof SYNC_STORE

function getIndexedDb(): IDBFactory {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB is unavailable')
  }

  return window.indexedDB
}

async function openDatabase(): Promise<IDBDatabase> {
  const indexedDb = getIndexedDb()

  return await new Promise((resolve, reject) => {
    const request = indexedDb.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(BOOK_STORE)) {
        const store = database.createObjectStore(BOOK_STORE, { keyPath: 'book.id' })
        store.createIndex('key', 'key', { unique: true })
      }

      if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
        database.createObjectStore(PROGRESS_STORE, { keyPath: 'id' })
      }

      if (!database.objectStoreNames.contains(QUEUE_STORE)) {
        const store = database.createObjectStore(QUEUE_STORE, { keyPath: 'operationId' })
        store.createIndex('bookId', 'bookId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }

      if (!database.objectStoreNames.contains(SYNC_STORE)) {
        database.createObjectStore(SYNC_STORE, { keyPath: 'bookId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'))
  })
}

async function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase()

  return await new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)

    void operation(store)
      .then((result) => {
        transaction.oncomplete = () => {
          database.close()
          resolve(result)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error ?? new Error(`Transaction failed for ${storeName}`))
        }
      })
      .catch((error) => {
        database.close()
        reject(error)
      })
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function buildProgressStoreId(bookId: string, readerId: string): string {
  return `${bookId}::${readerId}`
}

export async function putOfflineBook(record: OfflineBookRecord): Promise<void> {
  await withStore(BOOK_STORE, 'readwrite', async (store) => {
    store.put(record)
  })
}

export async function getOfflineBook(bookId: string): Promise<OfflineBookRecord | null> {
  return await withStore(BOOK_STORE, 'readonly', async (store) => {
    return await requestToPromise(store.get(bookId)) as OfflineBookRecord | null
  })
}

export async function getOfflineBookByKey(key: string): Promise<OfflineBookRecord | null> {
  return await withStore(BOOK_STORE, 'readonly', async (store) => {
    const index = store.index('key')
    return await requestToPromise(index.get(key)) as OfflineBookRecord | null
  })
}

export async function listOfflineBooks(): Promise<OfflineBookRecord[]> {
  return await withStore(BOOK_STORE, 'readonly', async (store) => {
    return await requestToPromise(store.getAll()) as OfflineBookRecord[]
  })
}

export async function deleteOfflineBook(bookId: string): Promise<void> {
  await withStore(BOOK_STORE, 'readwrite', async (store) => {
    store.delete(bookId)
  })
}

export async function putOfflineProgress(progress: OfflineProgressRecord): Promise<void> {
  await withStore(PROGRESS_STORE, 'readwrite', async (store) => {
    store.put({
      id: buildProgressStoreId(progress.bookId, progress.readerId),
      ...progress,
    })
  })
}

export async function getOfflineProgress(bookId: string, readerId: string): Promise<OfflineProgressRecord | null> {
  return await withStore(PROGRESS_STORE, 'readonly', async (store) => {
    const result = await requestToPromise(
      store.get(buildProgressStoreId(bookId, readerId)),
    ) as (OfflineProgressRecord & { id: string }) | null

    if (!result) {
      return null
    }

    const { id: _id, ...progress } = result
    return progress
  })
}

export async function deleteOfflineProgressForBook(bookId: string): Promise<void> {
  const existing = await withStore(PROGRESS_STORE, 'readonly', async (store) => {
    return await requestToPromise(store.getAll()) as Array<OfflineProgressRecord & { id: string }>
  })

  await withStore(PROGRESS_STORE, 'readwrite', async (store) => {
    for (const progress of existing) {
      if (progress.bookId === bookId) {
        store.delete(progress.id)
      }
    }
  })
}

export async function addOfflineAction(action: PendingOfflineAction): Promise<void> {
  await withStore(QUEUE_STORE, 'readwrite', async (store) => {
    store.put(action)
  })
}

export async function updateOfflineAction(action: PendingOfflineAction): Promise<void> {
  await addOfflineAction(action)
}

export async function deleteOfflineAction(operationId: string): Promise<void> {
  await withStore(QUEUE_STORE, 'readwrite', async (store) => {
    store.delete(operationId)
  })
}

export async function listOfflineActions(): Promise<PendingOfflineAction[]> {
  return await withStore(QUEUE_STORE, 'readonly', async (store) => {
    return await requestToPromise(store.getAll()) as PendingOfflineAction[]
  })
}

export async function deleteOfflineActionsForBook(bookId: string): Promise<void> {
  const actions = await listOfflineActions()

  await withStore(QUEUE_STORE, 'readwrite', async (store) => {
    for (const action of actions) {
      if (action.bookId === bookId) {
        store.delete(action.operationId)
      }
    }
  })
}

export async function putOfflineSyncState(state: OfflineSyncState): Promise<void> {
  await withStore(SYNC_STORE, 'readwrite', async (store) => {
    store.put(state)
  })
}

export async function getOfflineSyncState(bookId: string): Promise<OfflineSyncState | null> {
  return await withStore(SYNC_STORE, 'readonly', async (store) => {
    return await requestToPromise(store.get(bookId)) as OfflineSyncState | null
  })
}

export async function listOfflineSyncStates(): Promise<OfflineSyncState[]> {
  return await withStore(SYNC_STORE, 'readonly', async (store) => {
    return await requestToPromise(store.getAll()) as OfflineSyncState[]
  })
}

export async function deleteOfflineSyncState(bookId: string): Promise<void> {
  await withStore(SYNC_STORE, 'readwrite', async (store) => {
    store.delete(bookId)
  })
}
