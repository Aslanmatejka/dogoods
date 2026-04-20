-- Update pickup deadline from 5PM to 11:59PM Pacific
-- Claimed food returns to inventory at 11:59PM on the Friday after it is claimed

-- Add 'expired' value to claim_status enum so claims can be marked expired
ALTER TYPE claim_status ADD VALUE IF NOT EXISTS 'expired';

-- Update the deadline calculator to use 11:59 PM instead of 5:00 PM Pacific
CREATE OR REPLACE FUNCTION calculate_pickup_deadline(claim_time TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
DECLARE
    claim_pacific TIMESTAMP;
    days_until_friday INT;
    next_friday_pacific TIMESTAMP;
BEGIN
    -- Convert to Pacific Time (no time zone)
    claim_pacific := claim_time AT TIME ZONE 'America/Los_Angeles';
    
    -- Calculate days until next Friday (0=Sunday, 5=Friday)
    days_until_friday := (12 - EXTRACT(DOW FROM claim_pacific)::INT) % 7;
    
    -- If it's Friday, push to NEXT Friday (minimum 7 days)
    -- This ensures claims made on Friday have a full week to be picked up
    IF days_until_friday = 0 THEN
        days_until_friday := 7;
    END IF;
    
    -- Deadline is next Friday at 11:59 PM Pacific
    next_friday_pacific := date_trunc('day', claim_pacific) + (days_until_friday || ' days')::INTERVAL + INTERVAL '23 hours 59 minutes';
    
    -- Convert back to UTC for storage by treating it as a Pacific time
    RETURN timezone('America/Los_Angeles', next_friday_pacific);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_pickup_deadline IS 'Calculates next Friday 11:59 PM Pacific from claim time. Claims on Friday get next Friday.';

-- Fix expire_unclaimed_receipts to use correct listing_status enum value ('active' not 'available')
CREATE OR REPLACE FUNCTION expire_unclaimed_receipts()
RETURNS TABLE(expired_count INT) AS $$
DECLARE
    expired_receipt RECORD;
    total_expired INT := 0;
BEGIN
    FOR expired_receipt IN
        SELECT id FROM receipts
        WHERE status = 'pending'
        AND pickup_by < NOW()
    LOOP
        UPDATE receipts
        SET status = 'expired',
            expired_at = NOW()
        WHERE id = expired_receipt.id;
        
        -- Return food items to inventory (use 'active' enum value)
        UPDATE food_listings
        SET status = 'active'
        WHERE id IN (
            SELECT food_id FROM food_claims
            WHERE receipt_id = expired_receipt.id
        );
        
        UPDATE food_claims
        SET status = 'expired'
        WHERE receipt_id = expired_receipt.id;
        
        total_expired := total_expired + 1;
    END LOOP;
    
    RETURN QUERY SELECT total_expired;
END;
$$ LANGUAGE plpgsql;
