import createServer from '../../test-server/lib';
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
