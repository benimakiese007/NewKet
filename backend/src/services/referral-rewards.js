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

