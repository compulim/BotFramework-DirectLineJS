import 'dotenv/config';

import { XMLHttpRequest } from 'xmlhttprequest';
import fetch from 'node-fetch';
import onErrorResumeNext from 'on-error-resume-next';
import WebSocket from 'ws';

import { DirectLine } from '../src/directLine';
import postActivity from './setup/postActivity';
import waitForBotEcho from './setup/waitForBotEcho';
import waitForConnected from './setup/waitForConnected';

const {
  DIRECT_LINE_SECRET
} = process.env;

beforeAll(() => {
  global.fetch = fetch;
  global.WebSocket = WebSocket;
  global.XMLHttpRequest = XMLHttpRequest;
});

describe('Happy path', () => {
  let unsubscribes;

  beforeEach(() => unsubscribes = []);
  afterEach(() => unsubscribes.forEach(fn => onErrorResumeNext(fn)));

  describe('REST', () => {
    test('should connect, send messaage, and receive echo from bot', async () => {
      const directLine = new DirectLine({
        secret: DIRECT_LINE_SECRET,
        webSocket: false
      });

      unsubscribes.push(await waitForConnected(directLine));

      await Promise.all([
        postActivity(directLine, { text: 'Hello, World!', type: 'message' }),
        waitForBotEcho(directLine, ({ text }) => text === 'Hello, World!')
      ]);
    });
  });
});
