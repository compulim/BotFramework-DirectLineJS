import getPort from 'get-port';
import restify from 'restify';

export default async function ({ playbacks }) {
  const port = await getPort({ port: 5000 });
  const promises = [];
  const server = restify.createServer();

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
              'Access-Control-Allow-Origin': req.header('Origin'),
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
      server.close();
    },
    port,
    promises
  };
}
