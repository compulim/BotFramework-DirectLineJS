import createServer from '../../test-server/lib';
import { ConnectionStatus, DirectLine } from '../src/directLine';

test('Create conversation should set conversation ID', async () => {
  const { dispose, port, promises } = await createServer({
    playbacks: [{
      req: { method: 'POST', url: '/v3/directline/conversations' },
      res: { body: {
        conversationId: '1234'
      } }
    }]
  });

  try {
    const directLine = new DirectLine({
      domain: `http://localhost:${ port }/v3/directline`,
      webSocket: false
    });

    const subscription = directLine.activity$.subscribe(() => {});

    await Promise.all([
      promises[0],
      new Promise(resolve => {
        directLine.connectionStatus$.subscribe(value => value === ConnectionStatus.Online && resolve())
      })
    ]);

    expect(directLine).toHaveProperty('conversationId', '1234');

    subscription.unsubscribe();
  } finally {
    dispose();
  }
});
