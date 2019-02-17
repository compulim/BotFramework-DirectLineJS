/// <reference path="../node_modules/@types/jest/index.d.ts" />
/// <reference path="setup/types.d.ts" />

import { ConnectionStatus, DirectLine } from '../src/directLine';

test('Create conversation should set conversation ID', async () => {
  const conversationId = `c_${ random() }`;

  const { port, promises } = await createMockServer({
    playbacks: [{
      req: { method: 'POST', url: '/v3/directline/conversations' },
      res: {
        body: { conversationId }
      }
    }]
  });

  const directLine = new DirectLine({
    domain: `http://localhost:${ port }/v3/directline`,
    webSocket: false
  });

  const connectionStatuses: ConnectionStatus[] = [];

  subscriptions.push(directLine.connectionStatus$.subscribe(connectionStatuses.push.bind(connectionStatuses)));

  expect(connectionStatuses).toEqual([ ConnectionStatus.Uninitialized ]);

  subscriptions.push(directLine.activity$.subscribe(() => {}));

  expect(connectionStatuses).toEqual([ ConnectionStatus.Uninitialized, ConnectionStatus.Connecting ]);

  await Promise.all([
    promises[0],
    new Promise(resolve => {
      directLine.connectionStatus$.subscribe(value => value === ConnectionStatus.Online && resolve())
    })
  ]);

  expect(connectionStatuses).toEqual([ ConnectionStatus.Uninitialized, ConnectionStatus.Connecting, ConnectionStatus.Online ]);
  expect(directLine).toHaveProperty('conversationId', conversationId);
});
