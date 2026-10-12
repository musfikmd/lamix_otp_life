-- =========================================================
-- SMS Hadi / Lamix Bot — Production Supabase Database Schema
-- Tailored exactly for Lamix SMS API & WebApp Bot
-- =========================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    telegram_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    balance NUMERIC(12, 2) DEFAULT 0.00,        -- Current BDT Balance
    total_earnings NUMERIC(12, 2) DEFAULT 0.00, -- Total BDT Earned
    total_withdrawn NUMERIC(12, 2) DEFAULT 0.00,-- Total BDT Withdrawn
    pending_withdrawal NUMERIC(12, 2) DEFAULT 0.00,
    total_sms INT DEFAULT 0,
    wallet_address TEXT,
    wallet_method TEXT,
    is_banned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users (telegram_id);

-- 2. Number Pool Table (Synced from Lamix /api/v1/numbers & /api/v1/ranges)
CREATE TABLE IF NOT EXISTS public.number_pool (
    id BIGSERIAL PRIMARY KEY,
    number TEXT UNIQUE NOT NULL,                -- E.164 formatted without plus (e.g. '60102604682')
    range_id TEXT,                              -- Lamix UUID (e.g. 'b16857ed-5ab6-42d3-...')
    range_name TEXT,                            -- e.g. 'Malaysia XOX SPCL (Fresh) 01oct'
    prefix TEXT,                                -- Dial code prefix (e.g. '60', '213')
    country TEXT,                               -- Country extracted from name/prefix
    payout_usd NUMERIC(10, 4) DEFAULT 0.0100,   -- Rate in USD from Lamix
    payout_bdt NUMERIC(10, 2) DEFAULT 1.20,     -- Rate in BDT offered to user
    is_assigned BOOLEAN DEFAULT FALSE,          -- If assigned to a Telegram user
    assigned_to BIGINT,                         -- User Telegram ID
    assigned_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_number_pool_number ON public.number_pool (number);
CREATE INDEX IF NOT EXISTS idx_number_pool_available ON public.number_pool (is_assigned, range_id);
CREATE INDEX IF NOT EXISTS idx_number_pool_prefix ON public.number_pool (prefix);

-- 3. Assigned Numbers Table (User's active claimed numbers)
CREATE TABLE IF NOT EXISTS public.assigned_numbers (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    number TEXT NOT NULL,
    local_number TEXT,
    range_id TEXT,
    range_name TEXT,
    country TEXT,
    dial_code TEXT,
    payout_bdt NUMERIC(10, 2) DEFAULT 0.00,
    payout_usd NUMERIC(10, 4) DEFAULT 0.0000,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '20 minutes'),
    status TEXT DEFAULT 'ACTIVE'                -- 'ACTIVE', 'COMPLETED', 'RELEASED', 'EXPIRED'
);

CREATE INDEX IF NOT EXISTS idx_assigned_numbers_active ON public.assigned_numbers (telegram_id, status);
CREATE INDEX IF NOT EXISTS idx_assigned_numbers_number ON public.assigned_numbers (number, status);

-- 4. CDR & SMS Messages Table (From Lamix /api/v1/cdrs & /api/v1/messages)
CREATE TABLE IF NOT EXISTS public.cdr_logs (
    id BIGSERIAL PRIMARY KEY,
    cdr_time TIMESTAMPTZ NOT NULL,
    number TEXT NOT NULL,
    cli TEXT,                                   -- Sender (e.g. 'WhatsApp', 'MyDisney')
    content TEXT NOT NULL,                      -- Full message text with OTP
    extracted_otp TEXT,                         -- Auto parsed OTP digits
    range_name TEXT,
    currency TEXT DEFAULT 'USD',
    payout_usd NUMERIC(10, 4) DEFAULT 0.0000,
    payout_bdt NUMERIC(10, 2) DEFAULT 0.00,
    telegram_id BIGINT,                         -- User credited (if number was assigned)
    is_credited BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_cdr_record UNIQUE (number, content, cdr_time)
);

CREATE INDEX IF NOT EXISTS idx_cdr_logs_number ON public.cdr_logs (number);
CREATE INDEX IF NOT EXISTS idx_cdr_logs_user ON public.cdr_logs (telegram_id, created_at DESC);

-- 5. Transactions Ledger Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    type TEXT NOT NULL,                         -- 'EARNING', 'WITHDRAWAL', 'BONUS'
    amount NUMERIC(12, 2) NOT NULL,             -- Amount in BDT
    number TEXT,
    cli TEXT,
    sms_text TEXT,
    range_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions (telegram_id, created_at DESC);

-- 6. Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,             -- BDT amount
    method TEXT NOT NULL,                       -- 'bKash', 'Nagad', 'Rocket', 'Binance'
    wallet_address TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',              -- 'PENDING', 'APPROVED', 'REJECTED'
    reject_reason TEXT,
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals (status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals (telegram_id);

-- 7. App Services Table (WhatsApp, Telegram, etc.)
CREATE TABLE IF NOT EXISTS public.app_services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'messaging',
    icon TEXT,
    is_popular BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0
);

INSERT INTO public.app_services (id, name, category, icon, is_popular, display_order)
VALUES 
    ('whatsapp', 'WhatsApp', 'messaging', '💬', true, 1),
    ('telegram', 'Telegram', 'messaging', '✈️', true, 2),
    ('facebook', 'Facebook', 'social', '👥', true, 3),
    ('imo', 'Imo Messenger', 'messaging', '📞', true, 4),
    ('openai', 'OpenAI / ChatGPT', 'ai', '🤖', true, 5),
    ('binance', 'Binance', 'finance', '🟡', true, 6),
    ('tiktok', 'TikTok', 'social', '🎵', false, 7),
    ('google', 'Google / Gmail', 'social', '🔍', false, 8)
ON CONFLICT (id) DO NOTHING;

-- 8. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL,
    referred_id BIGINT UNIQUE NOT NULL,
    is_eligible BOOLEAN DEFAULT FALSE,
    total_otp_received INT DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);

-- 9. Row Level Security (RLS) & Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.number_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assigned_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdr_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role (Used by bot & backend server)
CREATE POLICY "service_role_users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_number_pool" ON public.number_pool FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_assigned_numbers" ON public.assigned_numbers FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_cdr_logs" ON public.cdr_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_transactions" ON public.transactions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_withdrawals" ON public.withdrawals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_app_services" ON public.app_services FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_referrals" ON public.referrals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public read access to app_services
CREATE POLICY "public_read_app_services" ON public.app_services FOR SELECT TO anon, authenticated USING (true);
