const DEFAULT_NK_TOKEN_REWARD = 1;

function getReferralClient(client) {
    return client || null;
}

export async function awardReferralNkToken({
    client,
    inviteeId,
    orderId,
    rewardAmount = DEFAULT_NK_TOKEN_REWARD
}) {
    const db = getReferralClient(client);
    if (!db || !inviteeId || !orderId) {
        return { awarded: false, reason: 'missing_context' };
    }

    // Protection anti-abus : vérifier que la commande dépasse 10$
    const { data: order } = await db
        .from('orders')
        .select('total_amount, final_total_amount')
        .eq('id', orderId)
        .single();
    
    const amount = order?.final_total_amount || order?.total_amount || 0;
    if (amount < 10) {
        return { awarded: false, reason: 'order_amount_too_low_for_referral_reward' };
    }

    const { data, error } = await db.rpc('grant_referral_nktoken_reward', {
        p_invitee_id: inviteeId,
        p_order_id: orderId,
        p_reward_amount: rewardAmount
    });

    if (error) {
        throw error;
    }

    return data || { awarded: false, reason: 'empty_response' };
}

