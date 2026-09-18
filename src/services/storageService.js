// Offline IndexedDB Storage Service for Local-First Persistence
const DB_NAME = 'ZenCaptionStudioDB';
const DB_VERSION = 1;

class StorageService {
  constructor() {
    this.db = null;
  }

  async open() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('videos')) {
          db.createObjectStore('videos', { keyPath: 'id' });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.error('IndexedDB open error:', e);
        reject(e);
      };
    });
  }

  async saveSetting(key, value) {
    try {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        store.put({ key, value, updated: Date.now() });
        tx.oncomplete = () => resolve(true);
        tx.onerror = (err) => reject(err);
      });
    } catch (e) {
      // Fallback to localStorage
      try {
        localStorage.setItem(`zen_${key}`, JSON.stringify(value));
      } catch (err) {}
    }
  }

  async getSetting(key, defaultValue = null) {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result && req.result.value !== undefined) {
            resolve(req.result.value);
          } else {
            // Check localStorage
            const local = localStorage.getItem(`zen_${key}`);
            resolve(local ? JSON.parse(local) : defaultValue);
          }
        };
        req.onerror = () => {
          const local = localStorage.getItem(`zen_${key}`);
          resolve(local ? JSON.parse(local) : defaultValue);
        };
      });
    } catch (e) {
      const local = localStorage.getItem(`zen_${key}`);
      return local ? JSON.parse(local) : defaultValue;
    }
  }

  async saveCurrentProject(projectData) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      store.put({
        id: 'active_project',
        ...projectData,
        savedAt: Date.now()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror = (err) => reject(err);
    });
  }

  async getActiveProject() {
    try {
      const db = await this.open();
      return new Promise((resolve) => {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const req = store.get('active_project');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async clearActiveProject() {
    try {
      const db = await this.open();
      const tx = db.transaction('projects', 'readwrite');
      tx.objectStore('projects').delete('active_project');
    } catch (e) {}
  }
}

export const storage = new StorageService();
