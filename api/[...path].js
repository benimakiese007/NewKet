import app from '../backend/src/server.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default function handler(req, res) {
  return app(req, res);
}
