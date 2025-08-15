/// <reference types="jest" />

process.env.STRIPE_SECRET_KEY = 'sk_test';

const mockSubscriptionSet = jest.fn();
const mockUserSet = jest.fn();

const mockStripe = {
  subscriptions: {
    create: jest.fn().mockResolvedValue({
      id: 'sub_123',
      status: 'active',
      current_period_end: 1700000000,
      items: { data: [{ price: { id: 'price_123', product: 'prod_123' } }] },
      metadata: { uid: 'user123' },
      customer: 'cus_123',
    }),
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
};

jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

jest.mock('firebase-admin', () => {
  const firestoreFn: any = () => ({
    collection: () => ({
      doc: () => ({
        get: jest.fn().mockResolvedValue({
          exists: true,
          data: () => ({ stripeCustomerId: 'cus_123' }),
        }),
        set: jest.fn(),
      }),
    }),
    doc: (path: string) => {
      if (path === 'subscriptions/user123') return { set: mockSubscriptionSet } as any;
      if (path === 'users/user123') return { set: mockUserSet } as any;
      return { set: jest.fn() } as any;
    },
    runTransaction: jest.fn().mockImplementation((fn) => fn({})),
  });
  firestoreFn.FieldValue = { serverTimestamp: jest.fn(() => 'now') };
  firestoreFn.Timestamp = { fromMillis: (ms: number) => ({ milliseconds: ms }) };
  return {
    firestore: firestoreFn,
    auth: () => ({
      verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user123' }),
    }),
    apps: [],
    initializeApp: jest.fn(),
  } as any;
});

import { activateSubscriptionHandler } from '../index';

describe('activateSubscription', () => {
  it('creates subscription and syncs Firestore', async () => {
    const req: any = {
      method: 'POST',
      headers: { authorization: 'Bearer token' },
      body: { uid: 'user123', priceId: 'price_123' },
    };
    const res: any = {
      statusCode: 0,
      body: undefined,
      headers: {} as Record<string, string>,
      setHeader(key: string, value: string) {
        this.headers[key] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(obj: any) {
        this.body = obj;
      },
    };

    await activateSubscriptionHandler(req, res);

    expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
      customer: 'cus_123',
      items: [{ price: 'price_123' }],
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata: { uid: 'user123' },
      expand: ['latest_invoice.payment_intent'],
    });
    expect(mockSubscriptionSet).toHaveBeenCalled();
    const subDoc = mockSubscriptionSet.mock.calls[0][0];
    expect(subDoc.status).toBe('active');
    expect(subDoc.priceId).toBe('price_123');
    expect(subDoc.productId).toBe('prod_123');
    expect(subDoc.isActive).toBe(true);
    expect(mockUserSet).toHaveBeenCalledWith({ isSubscribed: true }, { merge: true });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('active');
    expect(res.body.currentPeriodEnd).toBe(1700000000);
  });
});

