import { supabase } from './supabase';
import { db } from './db';

const TABLES = [
  'sessions',
  'clips',
  'clipGroups',
  'sessionGroups',
  'sessionMedia'
] as const;

let syncTimeout: ReturnType<typeof setTimeout>;

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

export const syncEngine = {
  scheduleSync() {
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => this.syncAll(), 2000);
  },

  async syncAll() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return; // Skip if not logged in

    try {
      await this.pushLocalChanges(session.user.id);
      await this.pullCloudChanges(session.user.id);
      window.dispatchEvent(new Event('lmplog-sync-complete'));
    } catch (error) {
      console.error('Sync failed:', error);
    }
  },

  async pushLocalChanges(userId: string) {
    for (const table of TABLES) {
      const allLocal = await db.readAllFromDbRaw<any>(table, true);
      const pendingItems = allLocal.filter((item: any) => item.pending_sync !== false);

      for (const item of pendingItems) {
        // Strip out local-only fields
        const { audioBlob, audioBlobBase64, blob, fileHandle, mediaBase64, pending_sync, ...dbData } = item;
        
        // Handle audio blob upload to storage if present and it's a new upload
        if (table === 'sessionMedia' && blob && !item.deleted) {
           const ext = item.filename?.split('.').pop() || 'bin';
           const path = `${userId}/${item.sessionId}/${item.id}.${ext}`;
           await supabase.storage.from('sessionMedia').upload(path, blob, { upsert: true });
           // dbData.filename = path; // keep original filename, but know that cloud has it. Or maybe add a remotePath.
        }

        const payload = {
          ...dbData,
          user_id: userId,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from(table).upsert(payload);

        if (!error) {
          if (item.deleted) {
            await db.deleteFromDbRaw(table, item.id, true); // hard delete locally
          } else {
            await db.writeToDbRaw(table, { ...item, pending_sync: false }, true); // clear pending
          }
        } else {
          console.error(`Error syncing ${table} id ${item.id}:`, error);
        }
      }
    }
  },

  async pullCloudChanges(userId: string) {
    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
      if (error || !data) continue;

      const localItems = await db.readAllFromDbRaw<any>(table, true);
      const localMap = new Map(localItems.map((i: any) => [i.id, i]));

      for (const cloudItem of data) {
        const localItem = localMap.get(cloudItem.id);
        
        // Skip if local has pending changes (local wins)
        if (localItem && localItem.pending_sync !== false) continue;

        if (cloudItem.deleted) {
          if (localItem) {
             await db.deleteFromDbRaw(table, cloudItem.id, true); // hard delete locally
          }
          continue;
        }

        // Clean payload before saving locally
        const { user_id, updated_at, ...cleanCloudItem } = cloudItem;
        
        // Preserve local blobs
        if (localItem?.audioBlob) cleanCloudItem.audioBlob = localItem.audioBlob;
        if (localItem?.audioBlobBase64) cleanCloudItem.audioBlobBase64 = localItem.audioBlobBase64;
        if (localItem?.blob) cleanCloudItem.blob = localItem.blob;
        if (localItem?.fileHandle) cleanCloudItem.fileHandle = localItem.fileHandle;
        if (localItem?.mediaBase64) cleanCloudItem.mediaBase64 = localItem.mediaBase64;

        await db.writeToDbRaw(table, { ...cleanCloudItem, pending_sync: false }, true);
      }
    }
  },

  async checkInitialSyncConflicts(userId: string): Promise<{ hasLocalPending: boolean, hasCloudData: boolean }> {
    let hasLocalPending = false;
    let hasCloudData = false;

    // Check local
    for (const table of TABLES) {
      const allLocal = await db.readAllFromDbRaw<any>(table, true);
      if (allLocal.some((item: any) => item.pending_sync !== false)) {
        hasLocalPending = true;
        break;
      }
    }

    // Check cloud
    for (const table of TABLES) {
      const { data } = await supabase.from(table).select('id').eq('user_id', userId).limit(1);
      if (data && data.length > 0) {
        hasCloudData = true;
        break;
      }
    }

    return { hasLocalPending, hasCloudData };
  },

  async forcePushLocal(userId: string) {
    // Treat all local data as pending_sync to overwrite cloud
    for (const table of TABLES) {
      const allLocal = await db.readAllFromDbRaw<any>(table, true);
      for (const item of allLocal) {
        const payload = { ...item };
        delete payload.pending_sync;
        delete payload.fileHandle;
        delete payload.blob;
        payload.user_id = userId;
        payload.updated_at = new Date().toISOString();

        const { error } = await supabase.from(table).upsert(payload);
        if (!error) {
          await db.writeToDbRaw(table, { ...item, pending_sync: false }, true);
        }
      }
    }
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('lmplog-sync-complete'));
  },

  initRealtimeSubscription(userId: string) {
    if (realtimeChannel) return; // Already listening

    realtimeChannel = supabase.channel('lmplog-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          // Verify the change is for the current user to prevent cross-account bleed
          if (payload.new && 'user_id' in payload.new && payload.new.user_id !== userId) return;
          if (payload.old && 'user_id' in payload.old && payload.old.user_id !== userId) return;
          
          // Trigger a debounce sync to pull down the latest cloud state safely
          this.scheduleSync();
        }
      )
      .subscribe();
  }
};

export const initialCloudPull = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    
    // Set up Realtime listener
    syncEngine.initRealtimeSubscription(session.user.id);
    
    await syncEngine.syncAll();
}
