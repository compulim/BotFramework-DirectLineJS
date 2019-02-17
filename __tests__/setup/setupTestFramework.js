import createSeedRandom from 'seedrandom';

import createMockServer from './createMockServer';

global.createMockServer = createMockServer;
global.random = createSeedRandom('seed');

beforeEach(() => {
  global.subscriptions = [];
});

afterEach(async () => {
  await Promise.all(global.subscriptions.map(subscription =>
    typeof subscription === 'function' ? subscription : subscription.unsubscribe.bind(subscription)
  ));
});
