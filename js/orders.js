/* newket EMarket Order Manager */

const OrderManager = {
    orders: [],
    withdrawals: [],

    async init() {
        if (!window.SupabaseAdapter) return;

        // 1. Orders
        const data = await window.SupabaseAdapter.fetchWithFilters('orders', {
            order: ['date', { ascending: false }],
            limit: 100
        });
        this.orders = (data || []).map(o => ({
            ...o,
            customer: { name: o.customer_name, email: o.customer_email }
        }));

        // 2. Withdrawals
        const wData = await window.SupabaseAdapter.fetchWithFilters('withdrawals', {
            order: ['created_at', { ascending: false }],
            limit: 100
        });
        this.withdrawals = wData || [];

        window.dispatchEvent(new CustomEvent('ordersUpdated'));
        window.dispatchEvent(new CustomEvent('withdrawalsUpdated'));
        console.log('[NewKet] OrderManager initialized.');
    },

    getOrders() { return this.orders; },

    async addOrder(order) {
        const recalculatedSubtotal = (order.items || []).reduce(
            (acc, item) => acc + (parseFloat(item.price) * parseInt(item.quantity || 1)),
            0
        );
        const pointsUsedAmount = parseFloat(order.pointsUsed || 0);
        const safeFinalTotal = order.total !== undefined
            ? Math.max(0, Math.min(order.total, recalculatedSubtotal))
            : Math.max(0, recalculatedSubtotal - pointsUsedAmount);

        const newOrderData = {
            id: order.id || 'EN-' + Date.now(),
            date: new Date().toISOString(),
            status: 'En attente',
            total: safeFinalTotal,
            customer_name: order.customer?.name || order.customer_name,
            customer_email: order.customer?.email || order.customer_email,
            items: order.items,
            payment_method: order.paymentMethod || 'Non spécifié',
            phone_number: order.phoneNumber || '',
            points_used: order.pointsUsed || 0
        };

        const inserted = await window.SupabaseAdapter.insert('orders', newOrderData);
        if (inserted) {
            const mappedOrder = { ...inserted, customer: { name: inserted.customer_name, email: inserted.customer_email } };
            this.orders.unshift(mappedOrder);
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return inserted;
        }
        return null;
    },

    async updateStatus(orderId, status) {
        const updated = await window.SupabaseAdapter.update('orders', orderId, { status });
        if (updated) {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                order.status = status;
                window.dispatchEvent(new CustomEvent('ordersUpdated'));
            }
        }
        return updated;
    },

    async requestWithdrawal(withdrawal) {
        const newWithdrawal = {
            id: 'WDR-' + Date.now(),
            created_at: new Date().toISOString(),
            supplier_email: withdrawal.supplier_email,
            amount: withdrawal.amount,
            method: withdrawal.method,
            phone_number: withdrawal.phone_number,
            status: 'En attente'
        };

        const inserted = await window.SupabaseAdapter.insert('withdrawals', newWithdrawal);
        if (inserted) {
            this.withdrawals.unshift(inserted);
            window.dispatchEvent(new CustomEvent('withdrawalsUpdated'));
            return inserted;
        }
        return null;
    },

    async updateWithdrawalStatus(id, status) {
        const updated = await window.SupabaseAdapter.update('withdrawals', id, { status });
        if (updated) {
            const w = this.withdrawals.find(item => item.id === id);
            if (w) {
                w.status = status;
                window.dispatchEvent(new CustomEvent('withdrawalsUpdated'));
            }
        }
        return updated;
    },

    getCustomerStats(email) {
        const allOrders = this.orders.filter(o => o.customer_email === email && o.status !== 'Annulé');
        const totalSpent = allOrders.reduce((sum, o) => sum + o.total, 0);

        let earnedUSD = 0;
        allOrders.forEach(order => {
            (order.items || []).forEach(item => {
                const itemPriceUSD = window.CurrencyManager ? CurrencyManager.convert(item.price, true) : item.price / 2500;
                earnedUSD += (itemPriceUSD * item.quantity);
            });
        });

        const pointsEarned = Math.floor(earnedUSD / 10);
        const pointsUsed = allOrders.reduce((sum, o) => sum + (o.points_used || 0), 0);
        const currentBalance = Math.max(0, pointsEarned - pointsUsed);

        return {
            totalOrders: allOrders.length,
            totalSpent: totalSpent,
            avgOrderValue: allOrders.length > 0 ? totalSpent / allOrders.length : 0,
            lastOrder: allOrders.length > 0 ? allOrders[0] : null,
            newketPoints: currentBalance,
            pointsEarned,
            pointsUsed
        };
    },

    getVendorStats(vendorEmail) {
        const allOrders = this.getOrders();
        let vendorTotalSales = 0;
        let vendorOrderCount = 0;
        const salesByDay = {};

        // Init last 7 days chart data
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            salesByDay[d.toISOString().split('T')[0]] = 0;
        }

        allOrders.forEach(order => {
            const vendorItems = order.items.filter(item => {
                const product = window.ProductManager ? ProductManager.getProduct(item.id) : null;
                return product && product.supplier_email === vendorEmail;
            });

            if (vendorItems.length > 0) {
                vendorOrderCount++;
                const orderTotalForVendor = vendorItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                vendorTotalSales += orderTotalForVendor;

                const dateKey = new Date(order.date).toISOString().split('T')[0];
                if (salesByDay[dateKey] !== undefined) {
                    salesByDay[dateKey] += orderTotalForVendor;
                }
            }
        });

        const platformCommission = vendorTotalSales * 0.05;
        const netGains = vendorTotalSales - platformCommission;

        const vendorWithdrawals = this.withdrawals.filter(w => w.supplier_email === vendorEmail);
        const totalWithdrawn = vendorWithdrawals
            .filter(w => w.status === 'Approuvé')
            .reduce((sum, w) => sum + w.amount, 0);
        const pendingWithdrawals = vendorWithdrawals
            .filter(w => w.status === 'En attente')
            .reduce((sum, w) => sum + w.amount, 0);

        const availableBalance = Math.max(0, netGains - totalWithdrawn - pendingWithdrawals);

        return {
            totalSales: vendorTotalSales,
            netGains: netGains,
            commission: platformCommission,
            totalOrders: vendorOrderCount,
            availableBalance: availableBalance,
            pendingWithdrawals: pendingWithdrawals,
            totalWithdrawn: totalWithdrawn,
            chartData: {
                labels: Object.keys(salesByDay).map(date => {
                    const d = new Date(date);
                    return d.toLocaleDateString('fr-FR', { weekday: 'short' });
                }),
                data: Object.values(salesByDay)
            },
            recentOrders: allOrders.filter(order =>
                order.items.some(item => {
                    const product = window.ProductManager ? ProductManager.getProduct(item.id) : null;
                    return product && product.supplier_email === vendorEmail;
                })
            ).slice(0, 5),
            payouts: vendorWithdrawals.map(w => ({
                id: w.id,
                date: w.created_at,
                amount: w.amount,
                status: w.status,
                method: w.method
            }))
        };
    },

    getAdvancedStats(timeframe = 'all') {
        const role = localStorage.getItem('newketRole');
        const email = localStorage.getItem('newketUserEmail');
        let orders = this.orders;

        if (timeframe !== 'all') {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            orders = orders.filter(o => {
                const orderDate = new Date(o.date);
                if (timeframe === 'day') return orderDate >= startOfDay;
                const diffDays = (now - orderDate) / (1000 * 60 * 60 * 24);
                if (timeframe === 'week') return diffDays <= 7;
                if (timeframe === 'month') return diffDays <= 30;
                if (timeframe === 'year') return diffDays <= 365;
                return true;
            });
        }

        if (role === 'supplier' && email) {
            orders = orders.filter(o => (o.items || []).some(item => {
                const p = window.ProductManager ? ProductManager.getProduct(item.id) : null;
                return p && p.supplier_email === email;
            }));
        }

        const products = window.ProductManager ? ProductManager.getProducts() : [];
        const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const commissionTotal = totalSales * 0.05;

        const productSalesCount = {};
        const categorySales = {};
        const customerEmails = new Set();

        orders.forEach(o => {
            const email = o.customer_email;
            if (email) customerEmails.add(email);
            (o.items || []).forEach(item => {
                productSalesCount[item.id] = (productSalesCount[item.id] || 0) + item.quantity;
                const p = products.find(prod => prod.id === item.id);
                const cat = p ? p.category : 'Autre';
                categorySales[cat] = (categorySales[cat] || 0) + (item.price * item.quantity);
            });
        });

        const deadStock = products.filter(p => !productSalesCount[p.id]);
        const topProducts = products
            .map(p => ({ ...p, salesCount: productSalesCount[p.id] || 0 }))
            .filter(p => p.salesCount > 0)
            .sort((a, b) => b.salesCount - a.salesCount)
            .slice(0, 5);

        return {
            totalOrders: orders.length,
            totalSales,
            commissionTotal,
            netSales: totalSales - commissionTotal,
            totalCustomers: customerEmails.size,
            deadStockCount: deadStock.length,
            categorySales,
            topProducts
        };
    },

    getProfitStats() {
        const stats = this.getAdvancedStats();
        const totalNet = stats.commissionTotal;
        const pendingPayout = this.withdrawals
            .filter(w => w.status === 'En attente')
            .reduce((sum, w) => sum + w.amount, 0);

        return {
            totalGross: stats.totalSales,
            totalCommission: stats.commissionTotal,
            totalNet,
            commissionPercent: 5,
            payouts: this.withdrawals.filter(w => w.status === 'Approuvé').map(w => ({
                id: w.id,
                date: w.created_at,
                amount: w.amount,
                status: w.status,
                supplier_email: w.supplier_email
            })),
            pendingPayout: pendingPayout
        };
    }
};

window.OrderManager = OrderManager;
