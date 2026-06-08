/**
 * NewKet Order Manager
 * Handles orders data for admin, vendor, and customer dashboards.
 */
const OrderManager = {
    data: [],
    _initialized: false,

    /**
     * Mapping centralisé : Statut Backend (EN) → Label UI (FR).
     * Le backend stocke TOUJOURS en anglais majuscules.
     * La traduction se fait uniquement ici pour l'affichage.
     */
    STATUS_LABELS: {
        'PENDING':    'En attente',
        'QUOTE':      'Devis livraison',
        'READY_FOR_PAYMENT': 'Prêt pour paiement',
        'PROCESSING': 'En cours',
        'SHIPPED':    'Expédié',
        'IN_DELIVERY': 'En livraison',
        'DELIVERED':  'Livré',
        'CANCELLED':  'Annulé',
        'COMPLETED':  'Terminé',
        'REFUNDED':   'Remboursé',
        'PAID_HELD':  'Séquestre',
        'RELEASED':   'Confirmé',
        'DISPUTED':   'En litige',
        'DISPUTE_OPEN': 'Litige ouvert',
        'FROZEN':     'Gelé',
        // Legacy fallback pour les anciennes données en base
        'ANNULÉ':     'Annulé'
    },

    /**
     * Traduit un statut backend en label français pour l'UI.
     */
    getStatusLabel(backendStatus) {
        return this.STATUS_LABELS[backendStatus] || backendStatus || 'Inconnu';
    },

    async init(options = {}) {
        const force = options.force === true;
        
        if (!window.ApiClient) {
            console.error('[OrderManager] ApiClient introuvable.');
            return;
        }
        if (!window.AuthManager || !window.AuthManager.role) {
            console.warn('[OrderManager] Check skipped: no authenticated role');
            this._initialized = true;
            return;
        }

        // Re-normalize orders when products are updated so we don't get stuck with missing product names/images
        if (!this._productsListenerAdded) {
            window.addEventListener('productsUpdated', () => {
                if (this.data && this.data.length > 0 && this._rawOrders) {
                    this.data = this._rawOrders.map(order => this._normalizeOrder(order));
                    window.dispatchEvent(new CustomEvent('ordersUpdated'));
                }
            });
            this._productsListenerAdded = true;
        }

        // Wait for existing fetch
        if (this._fetchPromise) {
            await this._fetchPromise;
            return;
        }
        
        // Prevent spamming requests unless manual refresh is forced
        const lastFetch = localStorage.getItem('newket_orders_sync_time');
        const now = Date.now();
        const COOLDOWN = 1000 * 60 * 5; // 5 mins
        
        if (!force && this._initialized && lastFetch && (now - parseInt(lastFetch)) < COOLDOWN && this.data.length > 0) {
            return; // Skip if recently fetched and data exists
        }

        this._fetchPromise = (async () => {
            try {
                // Fetch from Express Backend API
                const orders = await ApiClient.get('/orders');
                this._rawOrders = orders || [];
                this.data = this._rawOrders.map(order => this._normalizeOrder(order));
                this._initialized = true;
                localStorage.setItem('newket_orders_sync_time', now.toString());
                console.log(`[OrderManager] Loaded ${this.data.length} orders.`);
            } catch (error) {
                console.warn('[OrderManager] Could not fetch orders, using empty data:', error.message);
                if (!this._initialized) this.data = [];
                this._initialized = true;
            }
        })();
        
        await this._fetchPromise;
        this._fetchPromise = null;
        // Dashboards listen to this event to rerender their lists/stats.
        window.dispatchEvent(new CustomEvent('ordersUpdated'));
    },

    /**
     * Normalize an order object
     * so all admin pages can consume it uniformly.
     */
    _normalizeOrder(order) {
        // Parse items if they arrive as a JSON string
        let rawItems = order.items;
        if (typeof rawItems === 'string') {
            try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
        }
        let rawOrderItems = order.order_items;
        if (typeof rawOrderItems === 'string') {
            try { rawOrderItems = JSON.parse(rawOrderItems); } catch (e) { rawOrderItems = []; }
        }

        const itemsArr = Array.isArray(rawItems) ? rawItems : [];
        const orderItemsArr = Array.isArray(rawOrderItems) ? rawOrderItems : [];
        const allItems = itemsArr.length > 0 ? itemsArr : orderItemsArr;
        const firstItem = allItems.length > 0 ? allItems[0] : null;

        const productId = order.product_id || firstItem?.product_id || firstItem?.id || null;
        
        // Retrieve up-to-date product data if available
        let product = null;
        if (window.ProductManager && productId && typeof window.ProductManager.getProduct === 'function') {
            product = window.ProductManager.getProduct(productId);
        }
        
        return {
            id: order.id,
            product_id: productId,
            product_name: product?.name || order.product_name || firstItem?.name || firstItem?.product_name || 'Produit',
            product_image: (product?.image || order.product_image || order.image || order.image_url || firstItem?.image || firstItem?.product_image || firstItem?.image_url || '').split(',')[0],
            customer_name: (Array.isArray(order.customer) ? order.customer[0] : order.customer)?.name || order.user_name || order.customer_name || 'Visiteur',
            customer_email: order.user_email || order.customer_email || (Array.isArray(order.customer) ? order.customer[0] : order.customer)?.email || '',
            customer: Array.isArray(order.customer) ? order.customer[0] : (order.customer || null),
            user_id: order.user_id,
            customer_id: order.customer_id || order.user_id || null,
            vendor_id: order.vendor_id,
            vendor: Array.isArray(order.vendor) ? order.vendor[0] : (order.vendor || null),
            vendor_name: (Array.isArray(order.vendor) ? order.vendor[0] : order.vendor)?.name || '',
            vendor_company_name: (Array.isArray(order.vendor) ? order.vendor[0] : order.vendor)?.company_name || '',
            vendor_email: order.vendor_email || (Array.isArray(order.vendor) ? order.vendor[0] : order.vendor)?.email || '',
            phone_number: order.phone_number || order.customer_phone || order.vendor_phone || (Array.isArray(order.customer) ? order.customer[0] : order.customer)?.store_phone || '',
            customer_phone: order.customer_phone || order.phone_number || (Array.isArray(order.customer) ? order.customer[0] : order.customer)?.store_phone || '',
            customer_city: order.customer_city || '',
            customer_lat: order.customer_lat || null,
            customer_lng: order.customer_lng || null,
            date: order.created_at || new Date().toISOString(),
            total: order.final_total_amount || order.total_amount || product?.price || product?.priceCDF || 0,
            status: order.status || 'PENDING',
            payment_status: order.payment_status || 'N/A',
            transaction_id: order.transaction_id || null,
            otp_code: order.otp_code || null,
            delivery_fee_amount: order.delivery_fee_amount || 0,
            merchandise_amount: order.merchandise_amount || order.subtotal_amount || order.total_amount || order.total || 0,
            subtotal_amount: order.subtotal_amount || order.merchandise_amount || order.total_amount || order.total || 0,
            promo_id: order.promo_id || null,
            promo_code: order.promo_code || null,
            promo_discount_amount: order.promo_discount_amount || 0,
            final_total_amount: order.final_total_amount || order.total_amount || order.total || 0,
            latest_delivery_quote: order.latest_delivery_quote || null,
            payment_method: order.payment_status && order.payment_status !== 'N/A' ? 'Paiement en ligne' : 'N/A',
            type: 'order',
            items: allItems.map(item => ({
                id: item.product_id || item.id,
                name: item.product_name || item.name || 'Produit',
                image: (item.product_image || item.image || item.image_url || item.thumbnail || '').split(',')[0],
                price: item.price || 0,
                quantity: item.quantity || 1,
                category: item.category || ''
            })).concat((allItems.length === 0 && productId) ? [{
                id: productId,
                name: product?.name || 'Produit',
                image: (product?.image || '').split(',')[0],
                price: product?.price || 0,
                quantity: 1,
                category: product?.category || ''
            }] : []),
            _raw: order
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
        const totalEstimatedValue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
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
            totalRevenue: totalEstimatedValue,
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
        const normalize = (value) => (value == null ? '' : String(value));
        const fallbackVendorId = localStorage.getItem('newketUserId');
        const fallbackVendorEmail = localStorage.getItem('newketUserEmail');
        const vendorIdentifiers = new Set([emailOrId, fallbackVendorId, fallbackVendorEmail].map(normalize).filter(Boolean));
        const vendorOrders = this.data.filter(o => {
            const vendorEmail = normalize(o.vendor_email);
            const vendorId = normalize(o.vendor_id);
            return vendorIdentifiers.has(vendorEmail) || vendorIdentifiers.has(vendorId);
        });
        const totalEstimatedValue = vendorOrders.reduce((sum, o) => sum + (o.total || 0), 0);
        const totalViews = window.ProductManager && typeof ProductManager.getProducts === 'function'
            ? ProductManager.getProducts()
                .filter((product) => {
                    const productOwnerEmail = normalize(product?.supplier_email);
                    const productOwnerId = normalize(product?.user_id);
                    return vendorIdentifiers.has(productOwnerEmail) || vendorIdentifiers.has(productOwnerId);
                })
                .reduce((sum, product) => sum + (parseInt(product?.views, 10) || 0), 0)
            : 0;
        const uniqueCustomers = [...new Set(vendorOrders.map((order) => normalize(order.customer_id || order.user_id || order.customer_email)).filter(Boolean))].length;

        return {
            totalOrders: vendorOrders.length,
            totalLeads: vendorOrders.length,
            totalRevenue: totalEstimatedValue,
            estimatedValue: totalEstimatedValue,
            averageOrderValue: vendorOrders.length > 0 ? totalEstimatedValue / vendorOrders.length : 0,
            conversionRate: totalViews > 0 ? Number(((vendorOrders.length / totalViews) * 100).toFixed(2)) : 0,
            totalViews,
            uniqueCustomers,
            commission: 0, 
            commissionPercent: 0,
            netGains: totalEstimatedValue,
            netRevenue: totalEstimatedValue,
            pendingOrders: vendorOrders.filter(o => ['PENDING', 'QUOTE', 'READY_FOR_PAYMENT', 'PROCESSING', 'PAID_HELD', 'IN_DELIVERY'].includes(o.status)).length,
            deliveredOrders: vendorOrders.filter(o => ['DELIVERED', 'COMPLETED', 'RELEASED'].includes(o.status)).length,
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

    getCustomerStats(email, userId) {
        const fallbackUserId = localStorage.getItem('newketUserId');
        const customerOrders = this.data.filter(o =>
            (email && o.customer_email === email) || 
            (userId && o.user_id === userId) ||
            o.customer_id === userId ||
            o.customer_id === fallbackUserId
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

    _normalizeDateRange(range) {
        if (!range) return null;

        const rawStart = range.start || range.startDate || range.from || null;
        const rawEnd = range.end || range.endDate || range.to || null;

        const startTime = rawStart ? new Date(`${rawStart}T00:00:00`).getTime() : null;
        const endTime = rawEnd ? new Date(`${rawEnd}T23:59:59.999`).getTime() : null;

        if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
            return null;
        }

        if (startTime == null && endTime == null) return null;
        return { startTime, endTime };
    },

    _isOrderInNormalizedRange(orderDate, normalizedRange) {
        if (!normalizedRange) return true;
        const timestamp = new Date(orderDate).getTime();
        if (Number.isNaN(timestamp)) return false;

        if (normalizedRange.startTime != null && timestamp < normalizedRange.startTime) return false;
        if (normalizedRange.endTime != null && timestamp > normalizedRange.endTime) return false;
        return true;
    },

    _filterOrdersByPeriod(orders, timeframe = 'all', range = null) {
        const normalizedRange = this._normalizeDateRange(range);
        const now = new Date();

        if (normalizedRange) {
            return orders.filter((order) => this._isOrderInNormalizedRange(order?.date, normalizedRange));
        }

        return orders.filter((order) => {
            const d = new Date(order.date);
            if (timeframe === 'day') return d.toDateString() === now.toDateString();
            if (timeframe === 'week') return (now - d) / 86400000 <= 7;
            if (timeframe === 'month') return (now - d) / 86400000 <= 30;
            if (timeframe === 'year') return d.getFullYear() === now.getFullYear();
            return true; // 'all'
        });
    },

    getAdvancedStats(timeframe = 'all', range = null) {
        const filtered = this._filterOrdersByPeriod(this.data, timeframe, range);

        const totalRevenue = filtered.reduce((sum, o) => sum + (o.total || 0), 0);
        const products = window.ProductManager ? ProductManager.getProducts() : [];
        const totalLeads = filtered.length;
        const aov = totalLeads > 0 ? totalRevenue / totalLeads : 0;

        // Conversion Rate Logic
        const totalViews = products.reduce((sum, p) => sum + (parseInt(p.views) || 0), 0);
        const conversionRate = totalViews > 0 ? (totalLeads / totalViews) * 100 : 0;

        // Loyalty rate: % of unique customers that returned (>= 2 orders)
        const customerOrderCounts = new Map();
        filtered.forEach((order) => {
            const key = order?.customer_id || order?.user_id || order?.customer_email || '';
            if (!key) return;
            customerOrderCounts.set(key, (customerOrderCounts.get(key) || 0) + 1);
        });
        const uniqueCustomers = customerOrderCounts.size;
        const repeatCustomers = Array.from(customerOrderCounts.values()).filter((count) => count >= 2).length;
        const loyaltyRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

        // Category breakdown
        const categorySales = {};
        filtered.forEach(o => {
            const p = products.find(prod => prod.id === o.product_id);
            const cat = p?.category || 'Autre';
            categorySales[cat] = (categorySales[cat] || 0) + (o.total || 0);
        });

        // Dead stock: products in stock that have 0 orders in timeframe
        const soldProductIds = new Set(filtered.map((order) => order?.product_id).filter(Boolean));
        const deadStockCount = products.filter((product) => (product?.stock || 0) > 0 && !soldProductIds.has(product.id)).length;

        // Daily breakdown for charts
        const dailyData = {};
        filtered.forEach(o => {
            const day = new Date(o.date).toLocaleDateString();
            if (!dailyData[day]) dailyData[day] = { leads: 0, revenue: 0 };
            dailyData[day].leads++;
            dailyData[day].revenue += (o.total || 0);
        });

        // Platform Health Score (out of 100)
        // Based on conversion rate (target: 3%), stock availability, and lead volume
        const healthScore = Math.min(100, Math.round(
            (conversionRate / 3 * 40) + // 40pts for conversion
            (totalLeads > 0 ? 30 : 0) + // 30pts for activity
            (products.filter(p => (p.stock || 0) > 0).length / Math.max(1, products.length) * 30) // 30pts for stock
        ));

        return {
            totalOrders: totalLeads,
            totalLeads,
            totalRevenue,
            averageOrderValue: aov,
            aov,
            categorySales,
            dailyData,
            topProducts: this._getTopProducts(filtered),
            conversionRate: conversionRate.toFixed(2),
            productsInDanger: products.filter(p => (p.stock || 0) < 10 && (p.stock || 0) > 0).length,
            deadStockCount,
            deadStockList: products.filter((product) => (product?.stock || 0) > 0 && !soldProductIds.has(product.id)),
            loyaltyRate: Number(loyaltyRate.toFixed(1)),
            healthScore
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
                const isAdmin = window.AuthManager?.role === 'admin';
                await ApiClient.put(`/orders/${id}/status`, { status: newStatus, ...(isAdmin ? { force: true } : {}) });
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

    async createDeliveryQuote(orderId, payload) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/orders/${orderId}/quote`, payload);
            this._initialized = false;
            await this.init();
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur createDeliveryQuote:', error);
            throw error;
        }
    },

    async respondToDeliveryQuote(orderId, payload) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/orders/${orderId}/quote/respond`, payload);
            this._initialized = false;
            await this.init();
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur respondToDeliveryQuote:', error);
            throw error;
        }
    },

    async initiatePayment(orderId, options = {}) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            return await ApiClient.post('/payments/initiate', {
                order_id: orderId,
                promo_code: options.promo_code || null
            });
        } catch (error) {
            if (error?.data?.code === 'PAYMENT_PROVIDER_NOT_CONFIGURED') {
                throw new Error(error.data.message || 'Le paiement est temporairement indisponible.');
            }
            console.error('[OrderManager] Erreur initiatePayment:', error);
            throw error;
        }
    },

    async startDelivery(orderId, payload = {}) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/orders/${orderId}/start-delivery`, payload);
            this._initialized = false;
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur startDelivery:', error);
            throw error;
        }
    },

    async validateDelivery(orderId, otpCode) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/orders/${orderId}/verify-delivery`, { otp: otpCode });
            this._initialized = false; // Forcer la mise à jour des stats et listes
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur validateDelivery:', error);
            throw error;
        }
    },

    async getDisputes() {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.get(`/disputes`);
            return data.data; // renvoie le array de disputes
        } catch (error) {
            console.error('[OrderManager] Erreur getDisputes:', error);
            throw error;
        }
    },

    async getDisputeByOrder(orderId) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.get(`/disputes/by-order/${orderId}`);
            return data.data;
        } catch (error) {
            console.error('[OrderManager] Erreur getDisputeByOrder:', error);
            throw error;
        }
    },

    async openDispute(orderId, reasonCategory, description, evidence) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/disputes`, {
                order_id: orderId,
                reason: reasonCategory,
                description,
                evidence
            });
            this._initialized = false; // Rafraîchissement
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur openDispute:', error);
            throw error;
        }
    },

    async vendorRespondToDispute(disputeId, payload) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/disputes/${disputeId}/vendor-action`, payload);
            this._initialized = false;
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur vendorRespondToDispute:', error);
            throw error;
        }
    },

    async buyerRespondToDispute(disputeId, payload) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/disputes/${disputeId}/buyer-action`, payload);
            this._initialized = false;
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur buyerRespondToDispute:', error);
            throw error;
        }
    },

    async resolveDispute(disputeId, payload) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.patch(`/disputes/${disputeId}/resolve`, payload);
            this._initialized = false;
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur resolveDispute:', error);
            throw error;
        }
    },

    async getDisputeMessages(disputeId) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.get(`/disputes/${disputeId}/messages`);
            return data.data;
        } catch (error) {
            console.error('[OrderManager] Erreur getDisputeMessages:', error);
            throw error;
        }
    },

    async addDisputeMessage(disputeId, payload) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/disputes/${disputeId}/messages`, payload);
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur addDisputeMessage:', error);
            throw error;
        }
    },

    async vendorResolveAmiable(disputeId) {
        if (!window.ApiClient) throw new Error('ApiClient non disponible');
        try {
            const data = await ApiClient.post(`/disputes/${disputeId}/vendor-resolve`);
            this._initialized = false;
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            return data;
        } catch (error) {
            console.error('[OrderManager] Erreur vendorResolveAmiable:', error);
            throw error;
        }
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
