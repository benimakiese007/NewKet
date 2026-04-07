/**
 * NewKet Order Manager
 * Handles WhatsApp leads / orders data for admin, vendor, and customer dashboards.
 * Since NewKet is a lead-gen marketplace (WhatsApp clicks), "orders" = leads/prospects.
 */
const OrderManager = {
    data: [],
    _initialized: false,

    async init() {
        if (!window.ApiClient) {
            console.warn('[OrderManager] ApiClient not found, using empty data.');
            this._initialized = true;
            return;
        }

        try {
            // Fetch from Express Backend API
            const leads = await ApiClient.get('/orders');
            this.data = (leads || []).map(lead => this._normalizeLeadToOrder(lead));
            this._initialized = true;
            console.log(`[OrderManager] Loaded ${this.data.length} leads/orders.`);
        } catch (error) {
            console.warn('[OrderManager] Could not fetch leads, using empty data:', error.message);
            this.data = [];
            this._initialized = true;
        }
    },

    /**
     * Normalize a whatsapp_click lead into an "order-like" object
     * so all admin pages can consume it uniformly.
     */
    _normalizeLeadToOrder(lead) {
        const product = window.ProductManager ? ProductManager.getProduct(lead.product_id) : null;
        return {
            id: lead.id,
            product_id: lead.product_id,
            product_name: product?.name || 'Produit',
            product_image: product?.image || '',
            customer_name: lead.user_name || lead.customer_name || 'Visiteur',
            customer_email: lead.user_email || lead.customer_email || '',
            user_id: lead.user_id,
            vendor_id: lead.vendor_id,
            vendor_email: lead.vendor_email || '',
            phone_number: lead.phone_number || lead.vendor_phone || '',
            date: lead.created_at || new Date().toISOString(),
            total: product?.price || product?.priceCDF || 0,
            status: lead.status || 'Lead',
            payment_method: 'WhatsApp',
            type: 'lead',
            _raw: lead
        };
    },

    // ========== GETTERS ==========

    getOrders() {
        return this.data;
    },

    getOrderById(id) {
        return this.data.find(o => o.id === id) || null;
    },

    // ========== STATS ==========

    getStats() {
        const orders = this.data;
        const totalLeads = orders.length;
        const totalEstimatedValue = orders.reduce((sum, o) => sum + (o.total || 0), 0); // Estimated from WhatsApp clicks
        const uniqueClients = [...new Set(orders.map(o => o.customer_email).filter(Boolean))].length;

        const revenueGrowth = this._calculateGrowth(orders, o => o.total || 0);
        const leadsGrowth = this._calculateGrowth(orders, () => 1);
        const clientsGrowth = this._calculateGrowth(
            orders.filter((o, i, arr) => arr.findIndex(x => x.customer_email === o.customer_email) === i), 
            () => 1
        );

        return {
            totalOrders: totalLeads,
            totalLeads,
            totalRevenue: totalEstimatedValue, // Kept for UI compatibility
            estimatedValue: totalEstimatedValue,
            uniqueClients,
            averageOrderValue: totalLeads > 0 ? totalEstimatedValue / totalLeads : 0,
            conversionRate: null, // Placeholder
            revenueGrowth,
            leadsGrowth,
            clientsGrowth,
            topProducts: this._getTopProducts(orders)
        };
    },

    getVendorStats(emailOrId) {
        const vendorOrders = this.data.filter(o =>
            o.vendor_email === emailOrId || o.vendor_id === emailOrId
        );
        const totalEstimatedValue = vendorOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        return {
            totalOrders: vendorOrders.length,
            totalLeads: vendorOrders.length,
            totalRevenue: totalEstimatedValue,
            estimatedValue: totalEstimatedValue,
            commission: 0, 
            commissionPercent: 0,
            netGains: totalEstimatedValue,
            netRevenue: totalEstimatedValue,
            pendingOrders: vendorOrders.filter(o => o.status === 'En attente' || o.status === 'Lead').length,
            deliveredOrders: vendorOrders.filter(o => o.status === 'Livré').length,
            topProducts: this._getTopProducts(vendorOrders),
            orders: vendorOrders,
            availableBalance: totalEstimatedValue,
            pendingWithdrawals: 0
        };
    },

    getProfitStats() {
        const orders = this.data;
        const totalGross = orders.reduce((sum, o) => sum + (o.total || 0), 0);

        return {
            totalGross,
            totalCommission: 0,
            totalNet: totalGross,
            commissionPercent: 0,
            pendingPayout: 0, // Placeholder
            payouts: [] // Placeholder
        };
    },

    getCustomerStats(emailOrId) {
        const customerOrders = this.data.filter(o =>
            o.customer_email === emailOrId || o.user_id === emailOrId
        );
        const totalSpent = customerOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        return {
            totalOrders: customerOrders.length,
            totalSpent,
            avgOrderValue: customerOrders.length > 0 ? totalSpent / customerOrders.length : 0,
            newketPoints: Math.floor(totalSpent / 100), // 1 point per 100 FC
            orders: customerOrders
        };
    },

    getAdvancedStats(timeframe = 'all') {
        const now = new Date();
        const filtered = this.data.filter(o => {
            const d = new Date(o.date);
            if (timeframe === 'day') return d.toDateString() === now.toDateString();
            if (timeframe === 'week') return (now - d) / 86400000 <= 7;
            if (timeframe === 'month') return (now - d) / 86400000 <= 30;
            if (timeframe === 'year') return d.getFullYear() === now.getFullYear();
            return true; // 'all'
        });

        const totalRevenue = filtered.reduce((sum, o) => sum + (o.total || 0), 0);
        const products = window.ProductManager ? ProductManager.getProducts() : [];

        // Category breakdown
        const categorySales = {};
        filtered.forEach(o => {
            const p = products.find(prod => prod.id === o.product_id);
            const cat = p?.category || 'Autre';
            categorySales[cat] = (categorySales[cat] || 0) + (o.total || 0);
        });

        // Daily breakdown for charts
        const dailyData = {};
        filtered.forEach(o => {
            const day = new Date(o.date).toLocaleDateString();
            if (!dailyData[day]) dailyData[day] = { leads: 0, revenue: 0 };
            dailyData[day].leads++;
            dailyData[day].revenue += (o.total || 0);
        });

        return {
            totalOrders: filtered.length,
            totalLeads: filtered.length,
            totalRevenue,
            averageOrderValue: filtered.length > 0 ? totalRevenue / filtered.length : 0,
            categorySales,
            dailyData,
            topProducts: this._getTopProducts(filtered),
            conversionRate: null,
            productsInDanger: products.filter(p => (p.stock || 0) < 10).length,
            healthScore: null
        };
    },

    // ========== MUTATIONS ==========

    async updateStatus(id, newStatus) {
        // Update local data
        const order = this.data.find(o => o.id === id);
        if (order) {
            order.status = newStatus;
        }

        // Update in backend API if possible
        if (window.ApiClient) {
            try {
                await ApiClient.put(`/orders/${id}/status`, { status: newStatus });
            } catch (err) {
                console.warn('[OrderManager] Could not update status in DB:', err.message);
            }
        }

        window.dispatchEvent(new CustomEvent('ordersUpdated'));
        return true;
    },

    async updateOrderStatus(orderId, newStatus) {
        return this.updateStatus(orderId, newStatus);
    },

    async requestWithdrawal(details) {
        console.log('[OrderManager] Withdrawal requested:', details);
        // Placeholder - would integrate with payment system
        if (window.ActivityManager) {
            ActivityManager.log(`Demande de retrait de ${details.amount || 0} FC`, 'withdrawal');
        }
        return { success: true, message: 'Demande enregistrée.' };
    },

    // ========== HELPERS ==========

    _calculateGrowth(orders, valueExtractor) {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        
        const lastMonthDate = new Date(now);
        lastMonthDate.setMonth(currentMonth - 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastMonthYear = lastMonthDate.getFullYear();

        let currentVal = 0;
        let lastVal = 0;

        orders.forEach(o => {
            const d = new Date(o.date);
            const m = d.getMonth();
            const y = d.getFullYear();
            const val = valueExtractor(o);

            if (m === currentMonth && y === currentYear) {
                currentVal += val;
            } else if (m === lastMonth && y === lastMonthYear) {
                lastVal += val;
            }
        });

        if (lastVal === 0) return currentVal > 0 ? 100 : 0;
        return Math.round(((currentVal - lastVal) / lastVal) * 100);
    },

    _getTopProducts(orders) {
        const productCounts = {};
        orders.forEach(o => {
            if (o.product_id) {
                if (!productCounts[o.product_id]) {
                    const product = window.ProductManager ? ProductManager.getProduct(o.product_id) : null;
                    productCounts[o.product_id] = {
                        id: o.product_id,
                        name: product?.name || o.product_name || 'Produit',
                        image: product?.image || o.product_image || '',
                        salesCount: 0,
                        revenue: 0
                    };
                }
                productCounts[o.product_id].salesCount++;
                productCounts[o.product_id].revenue += (o.total || 0);
            }
        });

        return Object.values(productCounts)
            .sort((a, b) => b.salesCount - a.salesCount)
            .slice(0, 5);
    }
};

window.OrderManager = OrderManager;
