import { initiatePayment } from './src/controllers/payment.controller.js';
import dotenv from 'dotenv';
dotenv.config();

const req = {
    body: {
        order_id: 'ORD_68ACF241F1_1784835157406',
        customer_phone: '12345678',
        customer_name: 'Test',
        customer_city: 'Test',
        email: 'test@example.com'
    },
    headers: { host: 'localhost:5173' }
};
const res = {
    status: (s) => ({
        json: (data) => console.log('STATUS:', s, 'JSON:', data)
    })
};
initiatePayment(req, res).catch(console.error);
