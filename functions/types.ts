import * as functions from 'firebase-functions';

export interface RawBodyRequest extends functions.https.Request {
  rawBody: Buffer;
}
