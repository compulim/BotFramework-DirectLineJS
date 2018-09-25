import getPort from 'get-port';
import restify from 'restify';

export default async function ({ playbacks }) {
  const port = await getPort({ port: 5000 });
  const server = restify.createServer();

  playbacks.forEach(({ req: preq = {}, res: pres = {} }) => {
    let played = false;

    server.pre((req, res, next) => {
      if (
        !played
        && req.method === (preq.method || 'GET')
        && req.url === (preq.url || '/')
      ) {
        played = true;
        res.send(pres.code || 200, pres.body, pres.headers || {});
      } else {
        return next();
      }
    });
  });

  server.listen(port);

  return {
    dispose: () => {
      server.close();
    },
    port
  };
}
