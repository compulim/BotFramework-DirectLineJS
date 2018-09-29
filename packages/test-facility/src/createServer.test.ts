/// <reference path="../node_modules/@types/jest/index.d.ts" />

import fetch from 'node-fetch';

import createServer from './createServer';

test('GET /health.txt should return 200 OK', async () => {
  const { dispose, port } = await createServer({
    playbacks: [{
      req: { method: 'GET', url: '/health.txt' },
      res: { body: 'OK' }
    }]
  });

  try {
    const res = await fetch(`http://localhost:${ port }/health.txt`);

    expect(res).toHaveProperty('ok', true);
  } finally {
    dispose();
  }
});

test('OPTIONS /health.txt should return 200 OK', async () => {
  const { dispose, port } = await createServer({
    playbacks: [{
      req: { method: 'GET', url: '/health.txt' },
      res: { body: 'OK' }
    }]
  });

  try {
    const res = await fetch(`http://localhost:${ port }/health.txt`, { method: 'OPTIONS' });

    expect(res).toHaveProperty('ok', true);
  } finally {
    dispose();
  }
});
