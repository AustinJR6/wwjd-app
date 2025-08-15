import { Request, Response } from 'express';
import { extractBearerToken, verifyIdToken } from './auth';
import { AppError, Unauthorized } from './errors';
import * as logger from './logger';

export function withCors<T extends (req: Request, res: Response, ...args: any[]) => any>(
  handler: T
) {
  return async (req: Request, res: Response, ...args: any[]) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    return handler(req, res, ...args);
  };
}

interface HandlerContext {
  uid?: string;
  token?: string;
}

interface WithHandlerOptions {
  auth?: 'required' | 'optional';
}

export function withHandler(
  handler: (req: Request, res: Response, ctx: HandlerContext) => Promise<any> | any,
  opts: WithHandlerOptions = {}
) {
  return async (req: Request, res: Response) => {
    try {
      const ctx: HandlerContext = {};
      if (opts.auth) {
        const token = extractBearerToken(req);
        if (!token) {
          if (opts.auth === 'required') throw new Unauthorized();
        } else {
          const decoded = await verifyIdToken(token);
          ctx.uid = decoded.uid;
          ctx.token = token;
        }
      }
      await handler(req, res, ctx);
    } catch (err: any) {
      jsonError(res, err);
    }
  };
}

export function jsonOk(res: Response, body: any, status = 200) {
  res.status(status).json(body);
}

export function jsonError(res: Response, err: any) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
  } else {
    logger.error('Unhandled error', err);
    res.status(500).json({ error: 'Internal error' });
  }
}
