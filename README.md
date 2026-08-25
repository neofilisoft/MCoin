# MCoin - Discord Bank Bot

ระบบ Wallet/ธนาคารจำลองสำหรับ Discord พร้อมสกุลเงินดิจิทัล, Exchange, Escrow, Split Bill และ Staking

## ⚡ Quick Start

### 1. Clone & Install

```bash
cd mcoin
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# แก้ไข .env ใส่ค่าต่างๆ
```

ค่าที่ต้องใส่:
- `DISCORD_TOKEN` - Bot token จาก Discord Developer Portal
- `DISCORD_CLIENT_ID` - Application ID
- `DISCORD_GUILD_ID` - Guild ID (สำหรับ test, ละออกไปถ้าต้องการ global commands)
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - MySQL credentials
- `EXCHANGE_RATE_API_KEY` - จาก https://app.exchangerate-api.com (free)
- `ADMIN_API_KEY` - สร้าง random string แข็งแกร่ง
- `WALLET_API_KEY` - สร้าง random string แข็งแกร่ง

### 3. Setup Database

```bash
npm run db:setup
```

### 4. Deploy Slash Commands

```bash
npm run deploy
```

### 5. Start Bot

```bash
npm start          # Bot
npm run start:api  # API (แยก terminal)
```

---

## 📋 Discord Commands

| Command | Description |
|---------|-------------|
| `/wallet` | ดู Balance ทุกสกุลเงิน + Wallet Address |
| `/rates` | ดู Exchange Rates ปัจจุบัน |
| `/history [currency] [page]` | ดู Transaction History |
| `/transfer @user currency amount [note]` | โอน P2P ทันที |
| `/request @user currency amount [note]` | ขอเงินจาก User อื่น |
| `/escrow @user currency amount [note]` | ล็อคเงิน รอ Confirm 5 นาที |
| `/split currency total @user1 [@user2...] [desc]` | หาร Bill |
| `/exchange from to amount` | แลกสกุลเงิน |
| `/stake amount` | Stake MBC รับ Reward |
| `/unstake` | ถอน MBC + Reward |
| `/staking-info` | ดูสถานะ Staking |

---

## 🪙 Currencies

| Currency | Description |
|----------|-------------|
| THB | Thai Baht |
| USD | US Dollar |
| CNY | Chinese Yuan |
| GBP | British Pound |
| EUR | Euro |
| AUX | Gold (ราคากำหนดโดย Admin) |
| MBC | Miyabi Coin (ราคากำหนดโดย Admin, Stakable) |

---

## 🔧 Admin API

Base URL: `http://localhost:3001`

Header: `X-Admin-Key: <your ADMIN_API_KEY>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/overview | ดู Master Wallet + Rates + APR |
| GET | /admin/wallets/:discordId | ดู Wallet ของ User |
| POST | /admin/wallets/:discordId/mint | เพิ่มเงินจาก Master → User |
| POST | /admin/wallets/:discordId/burn | ลดเงิน User → Master |
| GET | /admin/rates | ดู Rates ทั้งหมด |
| PUT | /admin/rates/AUX | ปรับ Rate AUX (body: `{rateInUsd}`) |
| PUT | /admin/rates/MBC | ปรับ Rate MBC (body: `{rateInUsd}`) |
| GET | /admin/rates/staking/config | ดู APR |
| PUT | /admin/rates/staking/config | ปรับ APR (body: `{apr}`, เช่น 0.12) |

### Mint Example

```bash
curl -X POST http://localhost:3001/admin/wallets/123456789/mint \
  -H "X-Admin-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{"currency":"MBC","amount":1000,"note":"Initial balance"}'
```

---

## 🌐 External Wallet API

Base URL: `http://localhost:3001`

Header: `X-Api-Key: <your WALLET_API_KEY>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /wallet/address/:discordId | ได้ Address + QR Code URL |
| GET | /wallet/balance/:address | ดู Balance ผ่าน Address |
| GET | /wallet/balance/by-discord/:discordId | ดู Balance ผ่าน Discord ID |
| POST | /wallet/pay | โอนเงินผ่าน Address |
| GET | /wallet/tx/:txid | ดูรายละเอียด Transaction |

### Pay Example

```bash
curl -X POST http://localhost:3001/wallet/pay \
  -H "X-Api-Key: your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAddress": "mc1a2b3c4d...",
    "toAddress": "mc9x8y7z...",
    "currency": "MBC",
    "amount": 10.5,
    "note": "Payment for services"
  }'
```

---

## 🏗️ Architecture

```
Master Wallet (Reserve)
  ├── Mint → User Wallet (Admin only)
  └── Burn ← User Wallet (Admin only)
  └── Staking Rewards → User Wallets (Daily, automatic)

User Wallets (P2P - Master not involved)
  ├── Transfer: User A → User B
  ├── Exchange: Currency A ↔ Currency B (within same wallet)
  ├── Escrow: Lock → Accept/Reject/Timeout
  └── Split Bill: Distribute from each member → Initiator
```

---

## ⚙️ Staking System

- Stake เฉพาะ **MBC**
- APR ปัจจุบัน: ดูจาก `/admin/rates/staking/config`
- Payout: **ทุกวัน 00:00 UTC** โดยอัตโนมัติ
- Formula: `daily_reward = staked_amount × (apr / 365)`
- Reward ออกจาก Master Wallet MBC Reserve
- ปรับ APR ได้ผ่าน Admin API (มีผลกับ Stake ใหม่เท่านั้น)

---

## 🔒 Escrow System

1. `/escrow @user currency amount` - Sender สร้าง Escrow, เงินถูก Lock ทันที
2. Receiver เห็น Embed พร้อม **[Accept]** / **[Reject]** Button
3. ถ้า Reject → เงินคืน Sender
4. ถ้าไม่มีการ Confirm ภายใน **5 นาที** → เงินคืน Sender อัตโนมัติ

---

## 📁 Project Structure

```
mcoin/
├── src/
│   ├── bot/           - Discord Bot (discord.js)
│   ├── api/           - REST API (Express)
│   ├── db/            - Database layer (MySQL)
│   ├── services/      - Business logic
│   └── utils/         - Helpers
├── .env.example
└── package.json
```
