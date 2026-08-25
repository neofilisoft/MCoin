-- MCoin Database Schema v3 (MCoin 1.3)
-- Run: node src/db/setup.js
-- Manual: mysql -u <user> -p <dbname> < src/db/schema.sql

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- users: Central user identity (Web, Bot, API)
-- ============================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`             BIGINT          NOT NULL AUTO_INCREMENT,
  `username`       VARCHAR(50)     NOT NULL,
  `email`          VARCHAR(255)    NULL DEFAULT NULL,
  `password_hash`  VARCHAR(255)    NULL DEFAULT NULL,
  `discord_id`     VARCHAR(20)     NULL DEFAULT NULL,
  `display_name`   VARCHAR(100)    NULL DEFAULT NULL,
  `avatar_url`     VARCHAR(500)    NULL DEFAULT NULL,
  `role`           ENUM('user', 'admin', 'teller') NOT NULL DEFAULT 'user',
  `is_active`      TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_username` (`username`),
  UNIQUE KEY `uq_email` (`email`),
  UNIQUE KEY `uq_discord_id` (`discord_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- master_wallet: Central reserve for all currencies
-- ============================================================
CREATE TABLE IF NOT EXISTS `master_wallet` (
  `currency`   VARCHAR(10)     NOT NULL,
  `balance`    DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `master_wallet` (`currency`, `balance`) VALUES
  ('THB', 999999999.00000000),
  ('USD', 999999999.00000000),
  ('CNY', 999999999.00000000),
  ('GBP', 999999999.00000000),
  ('EUR', 999999999.00000000),
  ('JPY', 999999999.00000000),
  ('XAU', 999999999.00000000),
  ('XAG', 999999999.00000000),
  ('MBC', 999999999.00000000);

-- ============================================================
-- wallets: Wallets linked to user_id (and optional discord_id)
-- ============================================================
CREATE TABLE IF NOT EXISTS `wallets` (
  `id`             BIGINT          NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT          NULL DEFAULT NULL,
  `discord_id`     VARCHAR(20)     NULL DEFAULT NULL,
  `wallet_address` VARCHAR(64)     NOT NULL,
  `thb`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000,
  `usd`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000,
  `cny`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000,
  `gbp`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000,
  `eur`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000,
  `jpy`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000,
  `xau`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000 COMMENT 'Gold troy oz',
  `xag`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000 COMMENT 'Silver troy oz',
  `mbc`            DECIMAL(20, 8)  NOT NULL DEFAULT 0.00000000,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_id` (`user_id`),
  UNIQUE KEY `uq_wallet_address` (`wallet_address`),
  KEY `idx_discord_id` (`discord_id`),
  CONSTRAINT `fk_wallets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- transactions: Full audit trail with user_id and discord_id
-- ============================================================
CREATE TABLE IF NOT EXISTS `transactions` (
  `id`                  BIGINT          NOT NULL AUTO_INCREMENT,
  `txid`                VARCHAR(64)     NOT NULL,
  `user_id`             BIGINT          NULL DEFAULT NULL,
  `discord_id`          VARCHAR(20)     NULL DEFAULT NULL,
  `type`                ENUM(
                          'deposit',
                          'withdraw',
                          'transfer_in',
                          'transfer_out',
                          'exchange',
                          'staking_reward',
                          'escrow_lock',
                          'escrow_release',
                          'escrow_cancel',
                          'split_out',
                          'split_in',
                          'external_in',
                          'external_out'
                        )               NOT NULL,
  `currency`            VARCHAR(10)     NOT NULL,
  `amount`              DECIMAL(20, 8)  NOT NULL,
  `from_currency`       VARCHAR(10)     NULL DEFAULT NULL,
  `from_amount`         DECIMAL(20, 8)  NULL DEFAULT NULL,
  `rate`                DECIMAL(20, 8)  NULL DEFAULT NULL,
  `counterpart_id`      VARCHAR(20)     NULL DEFAULT NULL COMMENT 'counterpart discord_id',
  `counterpart_user_id` BIGINT          NULL DEFAULT NULL COMMENT 'counterpart user_id',
  `ref_id`              BIGINT          NULL DEFAULT NULL COMMENT 'escrow_id, split_id, request_id, or institution_id',
  `note`                VARCHAR(255)    NULL DEFAULT NULL,
  `created_at`          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_txid` (`txid`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_discord_id` (`discord_id`),
  KEY `idx_type` (`type`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_tx_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- escrows: P2P Escrow contracts
-- ============================================================
CREATE TABLE IF NOT EXISTS `escrows` (
  `id`                BIGINT          NOT NULL AUTO_INCREMENT,
  `sender_user_id`    BIGINT          NULL DEFAULT NULL,
  `receiver_user_id`  BIGINT          NULL DEFAULT NULL,
  `sender_id`         VARCHAR(20)     NOT NULL COMMENT 'sender discord_id or fallback',
  `receiver_id`       VARCHAR(20)     NOT NULL COMMENT 'receiver discord_id or fallback',
  `currency`          VARCHAR(10)     NOT NULL,
  `amount`            DECIMAL(20, 8)  NOT NULL,
  `note`              VARCHAR(255)    NULL DEFAULT NULL,
  `status`            ENUM('pending', 'completed', 'cancelled', 'timeout') NOT NULL DEFAULT 'pending',
  `expires_at`        DATETIME        NOT NULL,
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sender_user` (`sender_user_id`),
  KEY `idx_receiver_user` (`receiver_user_id`),
  KEY `idx_sender` (`sender_id`),
  KEY `idx_receiver` (`receiver_id`),
  KEY `idx_status_expires` (`status`, `expires_at`),
  CONSTRAINT `fk_escrow_sender_user` FOREIGN KEY (`sender_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_escrow_receiver_user` FOREIGN KEY (`receiver_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- payment_requests: P2P Payment Requests / Invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS `payment_requests` (
  `id`                BIGINT          NOT NULL AUTO_INCREMENT,
  `requester_user_id` BIGINT          NOT NULL,
  `target_user_id`    BIGINT          NOT NULL,
  `currency`          VARCHAR(10)     NOT NULL,
  `amount`            DECIMAL(20, 8)  NOT NULL,
  `note`              VARCHAR(255)    NULL DEFAULT NULL,
  `status`            ENUM('pending', 'paid', 'declined', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_requester_user` (`requester_user_id`),
  KEY `idx_target_user` (`target_user_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_req_requester` FOREIGN KEY (`requester_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_req_target` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- split_bills: Group Split Bills
-- ============================================================
CREATE TABLE IF NOT EXISTS `split_bills` (
  `id`                 BIGINT          NOT NULL AUTO_INCREMENT,
  `initiator_user_id`  BIGINT          NULL DEFAULT NULL,
  `initiator_id`       VARCHAR(20)     NOT NULL COMMENT 'initiator discord_id or fallback',
  `currency`           VARCHAR(10)     NOT NULL,
  `total_amount`       DECIMAL(20, 8)  NOT NULL,
  `description`        VARCHAR(255)    NULL DEFAULT NULL,
  `status`             ENUM('pending', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  `created_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_initiator_user` (`initiator_user_id`),
  KEY `idx_initiator` (`initiator_id`),
  CONSTRAINT `fk_split_initiator_user` FOREIGN KEY (`initiator_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `split_bill_members` (
  `id`           BIGINT          NOT NULL AUTO_INCREMENT,
  `split_id`     BIGINT          NOT NULL,
  `user_id`      BIGINT          NULL DEFAULT NULL,
  `discord_id`   VARCHAR(20)     NOT NULL,
  `share_amount` DECIMAL(20, 8)  NOT NULL,
  `paid`         TINYINT(1)      NOT NULL DEFAULT 0,
  `paid_at`      DATETIME        NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_split_id` (`split_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_discord_id` (`discord_id`),
  CONSTRAINT `fk_split_members_bill` FOREIGN KEY (`split_id`) REFERENCES `split_bills` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_split_member_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- staking_positions: Active and historical MBC stakes
-- ============================================================
CREATE TABLE IF NOT EXISTS `staking_positions` (
  `id`              BIGINT          NOT NULL AUTO_INCREMENT,
  `user_id`         BIGINT          NULL DEFAULT NULL,
  `discord_id`      VARCHAR(20)     NOT NULL,
  `amount`          DECIMAL(20, 8)  NOT NULL,
  `apr`             DECIMAL(7, 4)   NOT NULL COMMENT 'APR snapshot at stake time',
  `started_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_payout_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_active`       TINYINT(1)      NOT NULL DEFAULT 1,
  `ended_at`        DATETIME        NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_discord_id` (`discord_id`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `fk_staking_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- staking_config
-- ============================================================
CREATE TABLE IF NOT EXISTS `staking_config` (
  `id`         INT             NOT NULL DEFAULT 1,
  `apr`        DECIMAL(7, 4)   NOT NULL DEFAULT 0.1200,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `staking_config` (`id`, `apr`) VALUES (1, 0.1200);

-- ============================================================
-- custom_rates: Admin-controlled rates (MBC only)
-- ============================================================
CREATE TABLE IF NOT EXISTS `custom_rates` (
  `currency`     VARCHAR(10)     NOT NULL,
  `rate_in_usd`  DECIMAL(20, 8)  NOT NULL COMMENT '1 MBC = X USD',
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by`   VARCHAR(20)     NULL DEFAULT NULL,
  PRIMARY KEY (`currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `custom_rates` (`currency`, `rate_in_usd`) VALUES
  ('MBC', 1.00000000);

-- ============================================================
-- INSTITUTION LAYER (Digital Inventory / Banking-as-a-Service)
-- ============================================================

CREATE TABLE IF NOT EXISTS `institutions` (
  `id`           BIGINT          NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(100)    NOT NULL,
  `slug`         VARCHAR(50)     NOT NULL COMMENT 'URL-safe short identifier',
  `api_key_hash` VARCHAR(64)     NOT NULL COMMENT 'SHA-256 of the institution API key',
  `webhook_url`  VARCHAR(500)    NULL DEFAULT NULL COMMENT 'POST callback on events',
  `is_active`    TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `institution_wallets` (
  `institution_id` BIGINT          NOT NULL,
  `thb`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `usd`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `cny`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `gbp`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `eur`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `jpy`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `xau`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `xag`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `mbc`            DECIMAL(30, 8)  NOT NULL DEFAULT 0,
  `updated_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`institution_id`),
  CONSTRAINT `fk_inst_wallet_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `institution_accounts` (
  `id`             BIGINT          NOT NULL AUTO_INCREMENT,
  `institution_id` BIGINT          NOT NULL,
  `user_id`        BIGINT          NULL DEFAULT NULL,
  `discord_id`     VARCHAR(20)     NOT NULL,
  `account_number` VARCHAR(20)     NOT NULL COMMENT 'Human-readable account number within institution',
  `is_active`      TINYINT(1)      NOT NULL DEFAULT 1,
  `created_at`     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_institution_account` (`institution_id`, `discord_id`),
  UNIQUE KEY `uq_account_number` (`institution_id`, `account_number`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_discord_id` (`discord_id`),
  CONSTRAINT `fk_inst_account_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inst_account_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `digital_inventory` (
  `id`               BIGINT          NOT NULL AUTO_INCREMENT,
  `institution_id`   BIGINT          NOT NULL,
  `owner_user_id`    BIGINT          NULL DEFAULT NULL,
  `owner_discord_id` VARCHAR(20)     NOT NULL,
  `item_type`        VARCHAR(50)     NOT NULL COMMENT 'e.g. voucher, license, nft, loyalty_point',
  `item_id`          VARCHAR(64)     NOT NULL COMMENT 'Unique item identifier within institution',
  `metadata`         JSON            NULL DEFAULT NULL,
  `is_transferable`  TINYINT(1)      NOT NULL DEFAULT 1,
  `acquired_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `transferred_at`   DATETIME        NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_institution_item` (`institution_id`, `item_id`),
  KEY `idx_owner_user` (`owner_user_id`),
  KEY `idx_owner_discord` (`owner_discord_id`),
  KEY `idx_institution` (`institution_id`),
  CONSTRAINT `fk_inventory_institution` FOREIGN KEY (`institution_id`) REFERENCES `institutions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inventory_owner_user` FOREIGN KEY (`owner_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
