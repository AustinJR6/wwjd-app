/// <reference types="jest" />

process.env.STRIPE_SECRET_KEY = 'sk_test';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test';

const mockStripe = {
  ephemeralKeys: { create: jest.fn().mockResolvedValue({ secret: 'ephkey' }) },
  setupIntents: { create: jest.fn().mockResolvedValue({ client_secret: 'seti_secret' }) },
  customers: { create: jest.fn().mockResolvedValue({ id: 'cus_123' }) },
};

jest.mock('stripe', () => {
  return jest.fn(() => mockStripe);
});

jest.mock('firebase-admin', () => {
  return {
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: jest.fn().mockResolvedValue({ exists: false }),
          set: jest.fn(),
        }),
      }),
    }),
    auth: () => ({}),
    apps: [],
    initializeApp: jest.fn(),
  } as any;
});

import { prepareSubscriptionPaymentSheetHandler } from '../index';

describe('prepareSubscriptionPaymentSheet', () => {
  it('returns all required keys', async () => {
    const req: any = { method: 'POST', headers: { uid: 'user123', origin: 'http://localhost' } };
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

    await prepareSubscriptionPaymentSheetHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.customer).toBe('cus_123');
    expect(res.body.ephemeralKey).toBe('ephkey');
    expect(res.body.setupIntent).toBe('seti_secret');
    expect(res.body.publishableKey).toBe('pk_test');
  });
});
