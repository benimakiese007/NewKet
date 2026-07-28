import 'dotenv/config';

async function test() {
    const kpay = (await import('./src/services/kpayService.js')).default;
    try {
        console.log('Testing KPay API with currency USD...');
        const res = await kpay.createPayment(300, 'USD', 'TEST-1234', 'http://localhost', 'http://localhost');
        console.log('Success:', res);
    } catch (err) {
        console.error('Error testing USD:', err.message);
    }
    try {
        console.log('\nTesting KPay API with currency CDF...');
        const res = await kpay.createPayment(3000, 'CDF', 'TEST-1235', 'http://localhost', 'http://localhost');
        console.log('Success:', res);
    } catch (err) {
        console.error('Error testing CDF:', err.message);
    }
}
test();
