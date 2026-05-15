import handler from './index.js';

export default async function ordersQuoteRespond(req, res) {
    const orderId = req.query?.orderId;
    req.url = `/api/orders/${orderId}/quote/respond`;
    return handler(req, res);
}
