import 'dotenv/config';

async function test() {
    const kpay = (await import('./src/services/kpayService.js')).default;
    const testCases = [
        { currencyCode: 'USD' },
        { currency_code: 'USD' },
        { isoCurrency: 'USD' },
        { currency: 'USD' },
        { wallet: 'USD' },
        { walletCurrency: 'USD' }
    ];

    for (const testCase of testCases) {
        try {
            console.log(`\nTesting KPay API with ${JSON.stringify(testCase)}...`);
            const payload = {
                amount: 300,
                externalId: 'TEST-' + Math.random().toString(36).substring(7),
                returnUrl: 'http://localhost',
                cancelUrl: 'http://localhost',
                ...testCase
            };
            const response = await kpay.client.post('/api/v1/payments/init', payload);
            console.log('Success:', response.data);
        } catch (err) {
            console.error('Error:', err.response?.data?.message || err.message);
        }
    }
}
test();
