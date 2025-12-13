-- Sample Coupons for The Hit Algorithm
-- Run this SQL after database initialization to create test coupons

-- Note: Make sure to run this AFTER the tables are created (after first app startup)

-- ==========================================
-- BETA TESTING COUPONS
-- ==========================================

-- Single-use coupon for individual beta testers (5000 credits = 50 analyses)
INSERT INTO coupons (code, credits, max_uses, expires_at, is_active, description, created_at)
VALUES
    ('BETA-TESTER-2024', 5000, 1, '2025-12-31 23:59:59', true, 'Beta tester unlimited access', CURRENT_TIMESTAMP),
    ('BETA-ADAM-X7K2', 5000, 1, '2025-12-31 23:59:59', true, 'Beta tester: Adam', CURRENT_TIMESTAMP),
    ('BETA-KASIA-M3P9', 5000, 1, '2025-12-31 23:59:59', true, 'Beta tester: Kasia', CURRENT_TIMESTAMP),
    ('BETA-PIOTR-L8N4', 5000, 1, '2025-12-31 23:59:59', true, 'Beta tester: Piotr', CURRENT_TIMESTAMP),
    ('BETA-ANNA-Q2R7', 5000, 1, '2025-12-31 23:59:59', true, 'Beta tester: Anna', CURRENT_TIMESTAMP);

-- ==========================================
-- MULTI-USE COUPONS FOR GROUPS
-- ==========================================

-- Shareable coupon for beta testing group (50 uses, 2000 credits each)
INSERT INTO coupons (code, credits, max_uses, expires_at, is_active, description, created_at)
VALUES
    ('BETATEST500', 2000, 50, '2025-06-30 23:59:59', true, 'Beta testing group - 50 uses', CURRENT_TIMESTAMP),
    ('EARLYBIRD1000', 3000, 100, '2025-03-31 23:59:59', true, 'Early adopter bonus - 100 uses', CURRENT_TIMESTAMP);

-- ==========================================
-- UNLIMITED WELCOME BONUSES
-- ==========================================

-- Evergreen welcome bonus (unlimited uses, never expires)
INSERT INTO coupons (code, credits, max_uses, expires_at, is_active, description, created_at)
VALUES
    ('WELCOME2025', 500, NULL, NULL, true, 'Evergreen welcome bonus', CURRENT_TIMESTAMP),
    ('FIRSTTIME100', 1000, NULL, NULL, true, 'First time user bonus', CURRENT_TIMESTAMP);

-- ==========================================
-- LIMITED TIME PROMOTIONS
-- ==========================================

-- Weekend special (1500 credits, 200 uses, expires in 3 days)
INSERT INTO coupons (code, credits, max_uses, expires_at, is_active, description, created_at)
VALUES
    ('WEEKEND2024', 1500, 200, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 3 DAY), true, 'Weekend special promotion', CURRENT_TIMESTAMP);

-- ==========================================
-- PARTNER/INFLUENCER CODES
-- ==========================================

-- Example influencer codes (can track usage separately)
INSERT INTO coupons (code, credits, max_uses, expires_at, is_active, description, created_at)
VALUES
    ('PRODUCER-MIKE', 2000, 500, '2025-12-31 23:59:59', true, 'Mike Producer referral code', CURRENT_TIMESTAMP),
    ('ARTIST-SARA', 2000, 500, '2025-12-31 23:59:59', true, 'Sara Artist referral code', CURRENT_TIMESTAMP);

-- ==========================================
-- TESTING COUPONS (for development)
-- ==========================================

-- Simple test codes for quick testing
INSERT INTO coupons (code, credits, max_uses, expires_at, is_active, description, created_at)
VALUES
    ('TEST100', 100, NULL, NULL, true, 'Test coupon - 100 credits', CURRENT_TIMESTAMP),
    ('TEST1000', 1000, NULL, NULL, true, 'Test coupon - 1000 credits', CURRENT_TIMESTAMP),
    ('TEST5000', 5000, NULL, NULL, true, 'Test coupon - 5000 credits', CURRENT_TIMESTAMP);

-- ==========================================
-- QUERY TO VIEW ALL COUPONS
-- ==========================================

-- After running the inserts, you can view all coupons with:
-- SELECT code, credits, max_uses, current_uses, expires_at, is_active, description
-- FROM coupons
-- ORDER BY created_at DESC;

-- ==========================================
-- QUERY TO VIEW COUPON USAGE
-- ==========================================

-- To see which coupons have been used:
-- SELECT
--     c.code,
--     c.credits,
--     c.current_uses,
--     c.max_uses,
--     COUNT(cr.id) as total_redemptions
-- FROM coupons c
-- LEFT JOIN coupon_redemptions cr ON c.id = cr.coupon_id
-- GROUP BY c.id
-- ORDER BY c.current_uses DESC;

-- ==========================================
-- DEACTIVATE A COUPON
-- ==========================================

-- To deactivate a coupon (make it unusable):
-- UPDATE coupons SET is_active = false WHERE code = 'COUPON_CODE_HERE';

-- ==========================================
-- NOTES FOR PRODUCTION
-- ==========================================

/*
IMPORTANT REMINDERS:

1. START CREDITS: Users get 1000 credits on signup (set in models.py)
2. ANALYSIS COST: Each analysis costs 100 credits (set in main.py)
3. This means: 1000 credits = 10 free analyses

COUPON STRATEGY:
- BETA testers: 5000 credits (50 analyses) - generous for testing
- Welcome bonus: 500-1000 credits (5-10 analyses) - hook new users
- Referrals: 2000 credits (20 analyses) - reward sharing

RECOMMENDED PRODUCTION CODES:
- Remove TEST* codes before production
- Keep WELCOME2025 active for marketing
- Create seasonal codes (NEWYEAR2025, SUMMER2025, etc.)
- Track influencer codes separately for analytics

DATABASE NOTES:
- Run this file once after database initialization
- Duplicate code inserts will fail (code is UNIQUE)
- To reset coupons: DELETE FROM coupons; then re-run this file
*/
