/// <reference path="get-port.d.ts" />

import getPort from 'get-port';
import { createServer } from 'restify';

export type Playback = {
  req: {
    method?: string;
    url?: string;
  };
  res: {
    body?: any;
    code?: number;
    headers?: any;
  };
};

export type CreateServerOptions = {
  playbacks: Playback[];
};

export type CreateServerResult = {
  dispose: () => Promise<void>;
  port: number;
  promises: Promise<void>[];
};

export default async function (options: CreateServerOptions): Promise<CreateServerResult> {
  const { playbacks } = options;
  const port = await getPort({ port: 5000 });
  const promises: Promise<void>[] = [];
  const server = createServer();

  playbacks.forEach(({ req: preq = {}, res: pres = {} }, index) => {
    let played = false;

    promises[index] = new Promise(resolve => {
      server.pre((req, res, next) => {
        if (
          !played
          && req.url === (preq.url || '/')
        ) {
          if (req.method === 'OPTIONS') {
            res.send(200, '', {
              'Access-Control-Allow-Origin': req.header('Origin') || '*',
              'Access-Control-Allow-Methods': req.header('Access-Control-Request-Method') || 'GET',
              'Access-Control-Allow-Headers': req.header('Access-Control-Request-Headers') || '',
              'Content-Type': 'text/html; charset=utf-8'
            });

            return;
          } else if (req.method === (preq.method || 'GET')) {
            resolve();
            played = true;
            res.send(pres.code || 200, pres.body, pres.headers || {});

            return;
          }
        }

        return next();
      });
    });
  });

  server.listen(port);

  return {
    dispose: () => {
      return new Promise(resolve => server.close(resolve));
    },
    port,
    promises
  };
}
