import { supabaseAdmin, supabase } from '../config/supabase.js';
import { ORDER_STATUSES, ESCROW_STATUSES } from '../services/order-workflow.js';

const client = supabaseAdmin || supabase;

// Utility to check admin access
function assertAdmin(req, res) {
    const user = req.user;
    if (!user) {
        res.status(401).json({ error: 'Non autorisé' });
        return false;
    }
    const role = user.app_metadata?.role || user.user_metadata?.role || '';
    if (role !== 'admin') {
        res.status(403).json({ error: 'Accès refusé. Réservé aux administrateurs.' });
        return false;
    }
    return true;
}

export const getKPIs = async (req, res, next) => {
    if (!assertAdmin(req, res)) return;

    try {
        // Fetch exchange rate to normalize everything to CDF
        const { data: settings } = await client
            .from('settings')
            .select('exchange_rate')
            .single();
        const exchangeRate = parseFloat(settings?.exchange_rate) || 2850;

        const { data: orders, error } = await client
            .from('orders')
            .select('status, total_amount, platform_commission_amount, created_at, escrow_status, payment_expected_currency')
            .in('status', [ORDER_STATUSES.COMPLETED, ORDER_STATUSES.PAID_HELD, ORDER_STATUSES.DELIVERED]);

        if (error) throw error;

        let totalGMV = 0;
        let totalCommissions = 0;
        let totalEscrowHeld = 0;
        let totalEscrowReleased = 0;
        let mrr = 0;

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        let mrrCommission = 0;
        let wrrCommission = 0;
        let drrCommission = 0;

        orders.forEach(order => {
            let amount = parseFloat(order.total_amount || 0);
            let commission = parseFloat(order.platform_commission_amount || 0);
            const createdAt = new Date(order.created_at);
            const currency = order.payment_expected_currency || 'CDF';

            // Normalize to CDF
            if (currency === 'USD') {
                amount = amount * exchangeRate;
                commission = commission * exchangeRate;
            }

            if (order.status === ORDER_STATUSES.COMPLETED) {
                totalGMV += amount;
                totalCommissions += commission;

                if (createdAt >= thirtyDaysAgo) mrrCommission += commission;
                if (createdAt >= sevenDaysAgo) wrrCommission += commission;
                if (createdAt >= oneDayAgo) drrCommission += commission;
            }

            if (order.escrow_status === ESCROW_STATUSES.HELD) {
                totalEscrowHeld += amount;
            } else if (order.escrow_status === ESCROW_STATUSES.RELEASED || order.escrow_status === ESCROW_STATUSES.AUTO_RELEASED) {
                totalEscrowReleased += amount;
            }
        });

        // ARR is MRR * 12
        const arrCommission = mrrCommission * 12;

        res.status(200).json({
            kpis: {
                totalGMV,
                totalCommissions,
                totalEscrowHeld,
                totalEscrowReleased,
                mrr: mrrCommission,
                arr: arrCommission,
                wrr: wrrCommission,
                drr: drrCommission
            }
        });
    } catch (error) {
        console.error('[AccountingController] getKPIs error:', error.message);
        next(error);
    }
};

export const getCharts = async (req, res, next) => {
    if (!assertAdmin(req, res)) return;

    try {
        const { data: settings } = await client
            .from('settings')
            .select('exchange_rate')
            .single();
        const exchangeRate = parseFloat(settings?.exchange_rate) || 2850;

        const { data: orders, error } = await client
            .from('orders')
            .select('total_amount, platform_commission_amount, created_at, payment_expected_currency')
            .eq('status', ORDER_STATUSES.COMPLETED)
            .order('created_at', { ascending: true });

        if (error) throw error;

        // Group by day for the last 30 days
        const daysMap = {};
        const now = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dateStr = d.toISOString().split('T')[0];
            daysMap[dateStr] = { gmv: 0, commission: 0 };
        }

        orders.forEach(order => {
            const dateStr = order.created_at.split('T')[0];
            if (daysMap[dateStr] !== undefined) {
                let amount = parseFloat(order.total_amount || 0);
                let commission = parseFloat(order.platform_commission_amount || 0);
                const currency = order.payment_expected_currency || 'CDF';

                if (currency === 'USD') {
                    amount = amount * exchangeRate;
                    commission = commission * exchangeRate;
                }

                daysMap[dateStr].gmv += amount;
                daysMap[dateStr].commission += commission;
            }
        });

        const labels = Object.keys(daysMap);
        const gmvData = labels.map(l => daysMap[l].gmv);
        const commissionData = labels.map(l => daysMap[l].commission);

        res.status(200).json({
            labels,
            datasets: [
                {
                    label: 'GMV',
                    data: gmvData
                },
                {
                    label: 'Commissions',
                    data: commissionData
                }
            ]
        });

    } catch (error) {
        console.error('[AccountingController] getCharts error:', error.message);
        next(error);
    }
};

export const exportCSV = async (req, res, next) => {
    if (!assertAdmin(req, res)) return;

    try {
        const { data: orders, error } = await client
            .from('orders')
            .select('id, created_at, status, total_amount, platform_commission_amount, payout_amount, escrow_status')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let csv = 'ID Commande,Date,Statut,GMV,Commission Plateforme,Montant Payout,Statut Escrow\n';

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleString('fr-FR');
            const gmv = order.total_amount || 0;
            const comm = order.platform_commission_amount || 0;
            const payout = order.payout_amount || 0;
            csv += `${order.id},"${date}",${order.status},${gmv},${comm},${payout},${order.escrow_status}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=comptabilite_export.csv');
        res.status(200).send(csv);

    } catch (error) {
        console.error('[AccountingController] exportCSV error:', error.message);
        next(error);
    }
};
