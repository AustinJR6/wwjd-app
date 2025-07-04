export class MockDoc {
  dataObj: any;
  constructor(initial: any = {}) {
    this.dataObj = initial;
  }
  async get() {
    return { exists: this.dataObj !== undefined, data: () => this.dataObj } as any;
  }
  set(data: any, options?: { merge?: boolean }) {
    if (options && options.merge) {
      this.dataObj = { ...(this.dataObj || {}), ...data };
    } else {
      this.dataObj = data;
    }
  }
}

export class MockCollection {
  docs: Record<string, MockDoc> = {};
  doc(id: string) {
    if (!this.docs[id]) this.docs[id] = new MockDoc();
    return this.docs[id];
  }
}

export class MockFirestore {
  collections: Record<string, MockCollection> = {};
  collection(name: string) {
    if (!this.collections[name]) this.collections[name] = new MockCollection();
    return this.collections[name];
  }
  doc(path: string) {
    const [col, id] = path.split('/');
    return this.collection(col).doc(id);
  }
  async runTransaction(fn: any) {
    const t = {
      get: (doc: MockDoc) => doc.get(),
      set: (doc: MockDoc, data: any, options?: { merge?: boolean }) => doc.set(data, options),
    };
    return fn(t);
  }
}
