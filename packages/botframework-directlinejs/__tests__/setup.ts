/// <reference path="../node_modules/@types/jest/index.d.ts" />

import { createServer } from 'test-facility';
import fetch from 'node-fetch';

test('Jest setup correctly', () => {
});

test('createServer setup correctly', async () => {
  const { dispose, port } = await createServer({
    playbacks: [{
      req: { url: '/health.txt' },
      res: { body: 'OK' }
    }]
  });

  const res = await fetch(`http://localhost:${ port }/health.txt`);

  expect(res).toHaveProperty('ok', true);

  try {
  } finally {
    dispose();
  }
});
