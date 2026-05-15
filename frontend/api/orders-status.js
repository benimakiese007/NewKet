import handler from './index.js';

export default async function ordersStatus(req, res) {
    const orderId = req.query?.orderId;
    req.url = `/api/orders/${orderId}/status`;
    return handler(req, res);
}
