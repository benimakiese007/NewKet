-- Trigger automatique pour appeler l'Edge Function push-live-activity lors d'un changement de statut
CREATE OR REPLACE FUNCTION trigger_push_live_activity()
RETURNS TRIGGER AS $$
DECLARE
    request_id BIGINT;
    edge_url TEXT := 'https://kuygjocnnlvjtoaquicq.supabase.co/functions/v1/push-live-activity';
BEGIN
    -- Déclencher uniquement si le statut a changé ET qu'un token est présent
    IF (NEW.status IS DISTINCT FROM OLD.status) AND (NEW.live_activity_token IS NOT NULL OR NEW.vendor_live_activity_token IS NOT NULL) THEN
        request_id := net.http_post(
            url := edge_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
                'record', row_to_json(NEW),
                'old_record', row_to_json(OLD),
                'type', TG_OP
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_push_live_activity ON orders;
CREATE TRIGGER trg_push_live_activity
AFTER UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION trigger_push_live_activity();
