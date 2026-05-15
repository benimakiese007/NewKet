import handler from './index.js';

export default async function ordersVerifyDelivery(req, res) {
    const orderId = req.query?.orderId;
    req.url = `/api/orders/${orderId}/verify-delivery`;
    return handler(req, res);
}
