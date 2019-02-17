/// <reference path="../node_modules/@types/jest/index.d.ts" />
/// <reference path="setup/global.d.ts" />

import createDeferred from 'p-defer';

import { ConnectionStatus, DirectLine } from '../src/directLine';

test('Receive conversation update after created', async () => {
  const conversationId = `c_${ random() }`;

  const { port, promises } = await createMockServer({
    playbacks: [{
      req: { method: 'POST', url: '/v3/directline/conversations' },
      res: {
        body: { conversationId }
      }
    }, {
      req: { method: 'GET', url: `/v3/directline/conversations/${ conversationId }/activities?watermark=` },
      res: {
        body: {
          activities: [{
            from: {
              id: conversationId
            },
            type: 'conversationUpdate'
          }],
          watermark: 1
        }
      }
    }]
  });

  const directLine = new DirectLine({
    domain: `http://localhost:${ port }/v3/directline`,
    webSocket: false
  });

  const activities: Activity[] = [];
  const connectionStatuses: ConnectionStatus[] = [];
  const activitiesReceivedDeferred = createDeferred();

  subscriptions.push(directLine.connectionStatus$.subscribe(connectionStatuses.push.bind(connectionStatuses)));

  expect(connectionStatuses).toEqual([ ConnectionStatus.Uninitialized ]);

  subscriptions.push(directLine.activity$.subscribe(activity => {
    activities.push(activity);
    activitiesReceivedDeferred.resolve();
  }));

  expect(connectionStatuses).toEqual([ ConnectionStatus.Uninitialized, ConnectionStatus.Connecting ]);

  await Promise.all([
    promises[0],
    promises[1],
    new Promise(resolve => {
      directLine.connectionStatus$.subscribe(value => value === ConnectionStatus.Online && resolve())
    })
  ]);

  expect(connectionStatuses).toEqual([ ConnectionStatus.Uninitialized, ConnectionStatus.Connecting, ConnectionStatus.Online ]);

  await activitiesReceivedDeferred.promise;

  expect(activities[0]).toEqual({
    from: {
      id: conversationId
    },
    type: 'conversationUpdate'
  });
});
