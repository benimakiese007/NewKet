import handler from './index.js';

export default async function ordersQuote(req, res) {
    const orderId = req.query?.orderId;
    req.url = `/api/orders/${orderId}/quote`;
    return handler(req, res);
}
