# MCoin 1.3 - Centralized Digital Banking Platform & Discord Bot

แพลตฟอร์มธนาคารดิจิทัลจำลองและระบบคลังเงินรวมศูนย์ (BaaS - Banking as a Service) ครบวงจร พร้อมรองรับ 9 สกุลเงิน (Fiat, Precious Metals, Crypto), ระบบ User กลาง, Authentication (JWT / Discord OAuth2), Core REST API และ Modern Web Banking Application

---

## 🚀 Key Features in v1.3

1. **Standalone User & Wallet Architecture**:
   - ระบบ User กลาง ไม่ผูกขาดกับ Discord ID เพียงอย่างเดียว
   - สามารถสมัครและเข้าสู่ระบบด้วย Username/Email หรือ Discord OAuth2
   - ระบบ Link / Unlink Discord Account ย้อนหลังได้

2. **Core RESTful API Layer (`/api/v1/*`)**:
   - Authentication (Register, Login, Refresh, Me, Discord OAuth)
   - Multi-Currency Wallet & Portfolio (`/wallet/me`, `/wallet/history`)
   - P2P Transfers & Instant Currency Swap (`/wallet/transfer`, `/wallet/exchange`)
   - Interactive Escrow Contracts with automated timeout refund (`/escrows/*`)
   - Payment Requests / Invoices Manager (`/requests/*`)
   - Group Expense Split Bills (`/splits/*`)
   - MBC Staking Vault with live APR (`/staking/*`)
   - Public Real-time Rate Feeds (`/rates`)

3. **Modern Fintech Web Application (`frontend/`)**:
   - พัฒนาด้วย **React + Vite + TailwindCSS + Lucide Icons**
   - ธีม **Cyberpunk / Fintech Dark Glassmorphism**
   - Real-time Rate Ticker Bar, Live Swap Preview, Escrow Countdown, Staking Yield Calculator

4. **9 Supported Currencies**:
   - **Fiat**: `THB`, `USD`, `CNY`, `GBP`, `EUR`, `JPY`
   - **Precious Metals**: `XAU` (Gold per troy oz), `XAG` (Silver per troy oz)
   - **Digital Crypto**: `MBC` (Miyabi Coin - Stakable)

---

## ⚡ Quick Start

### 1. ติดตั้ง Dependencies

```bash
# ติดตั้ง Backend dependencies
npm install

# ติดตั้ง Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. ตั้งค่า Environment Variables (`.env`)

คัดลอกไฟล์ template:
```bash
cp .env.example .env
```

แก้ไขค่าใน `.env`:
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (MySQL / MariaDB)
- `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (Discord Developer Portal)
- `EXCHANGE_RATE_API_KEY` (ExchangeRate-API: `5243b75340c4b7c8bb8b1c36`)
- `XAU_API_KEY` (goldapi.io: `b4ffcbb91805801153573b3337945472`)
- `ADMIN_API_KEY`, `WALLET_API_KEY`, `JWT_SECRET`

### 3. Setup Database Schema

```bash
npm run db:setup
```

### 4. Deploy Slash Commands (Discord Bot)

```bash
npm run deploy
```

### 5. Start Servers

```bash
# Terminal 1: Backend REST API (Port 3001)
npm run start:api

# Terminal 2: Web Banking Frontend (Port 5173)
npm run start:web

# Terminal 3: Discord Bot Client
npm start
```

---

## 🌐 Core REST API Reference (`/api/v1/*`)

Header สำหรับ Protected Endpoints:
```
Authorization: Bearer <JWT_ACCESS_TOKEN>
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/register` | สมัครสมาชิก (username, email, password) |
| `POST` | `/api/v1/auth/login` | เข้าสู่ระบบ (identifier, password) |
| `POST` | `/api/v1/auth/refresh` | Refresh Access Token |
| `GET`  | `/api/v1/auth/me` | ดึงข้อมูล Profile ปัจจุบัน |
| `GET`  | `/api/v1/auth/discord/url` | ขอ URL สำหรับ Discord OAuth2 Login |
| `POST` | `/api/v1/auth/discord/callback` | แลก OAuth Code เป็น JWT Token |
| `POST` | `/api/v1/auth/link-discord` | ผูก Discord Account เข้ากับ User |
| `GET`  | `/api/v1/wallet/me` | ดูยอดเงินทุกสกุล, Wallet Address, QR Code |
| `GET`  | `/api/v1/wallet/history` | ประวัติธุรกรรมแบบ Paginated + Filters |
| `POST` | `/api/v1/wallet/transfer` | โอนเงิน P2P (ระบุ username, address, email) |
| `POST` | `/api/v1/wallet/exchange` | แลกเปลี่ยนสกุลเงิน (Instant Swap) |
| `GET`  | `/api/v1/escrows` | ดึงรายการ Escrow Contracts ทั้งหมด |
| `POST` | `/api/v1/escrows` | สร้าง Escrow ล็อคเงิน |
| `POST` | `/api/v1/escrows/:id/accept` | ผู้รับตอบรับ Escrow และรับเงิน |
| `POST` | `/api/v1/escrows/:id/reject` | ผู้รับปฏิเสธ Escrow คืนเงินผู้ส่ง |
| `POST` | `/api/v1/escrows/:id/cancel` | ผู้ส่งยกเลิก Escrow คืนเงิน |
| `GET`  | `/api/v1/requests` | ดึง Payment Requests (Incoming/Outgoing) |
| `POST` | `/api/v1/requests` | สร้างคำขอเก็บเงิน (Request Invoice) |
| `POST` | `/api/v1/requests/:id/pay` | ชำระเงินตามคำขอ |
| `POST` | `/api/v1/requests/:id/decline` | ปฏิเสธคำขอชำระเงิน |
| `GET`  | `/api/v1/splits` | รายการ Group Split Bills |
| `POST` | `/api/v1/splits` | สร้างและตัดยอด Split Bill อัตโนมัติ |
| `GET`  | `/api/v1/staking/info` | ดูสถานะ Staking, APR, Accrued Rewards |
| `POST` | `/api/v1/staking/stake` | ล็อค MBC เพื่อ Stake |
| `POST` | `/api/v1/staking/unstake` | ถอน MBC และรับ Reward สะสม |
| `GET`  | `/api/v1/rates` | ดึงอัตราแลกเปลี่ยน Real-time (Public) |

---

## 🤖 Discord Slash Commands

| Command | Description |
|---------|-------------|
| `/wallet` | ดู Balance ทุกสกุลเงิน + Wallet Address |
| `/rates` | ดูอัตราแลกเปลี่ยนปัจจุบัน (Fiat, Gold, Silver, MBC) |
| `/history [currency] [page]` | ดูประวัติธุรกรรม |
| `/transfer @user currency amount [note]` | โอนเงิน P2P ทันที |
| `/request @user currency amount [note]` | ส่งคำขอเก็บเงิน |
| `/escrow @user currency amount [note]` | ล็อคเงินใน Escrow (รอ Confirm 5 นาที) |
| `/split currency total @user1 [@user2...]` | หารบิลกลุ่ม |
| `/exchange from to amount` | แลกเปลี่ยนสกุลเงิน |
| `/stake amount` | Stake MBC รับ Daily Reward |
| `/unstake` | ถอน MBC และรับผลตอบแทน |
| `/staking-info` | ดูสถานะและผลตอบแทนสะสมของ Staking |

---

## 📁 Project Architecture

```
mcoin/
├── frontend/                     # Web Banking Frontend (React + Vite + Tailwind)
│   ├── src/
│   │   ├── components/           # UI & Layout components
│   │   ├── contexts/             # AuthContext, RatesContext
│   │   ├── pages/                # Dashboard, Transfers, Exchange, Escrow, Staking, etc.
│   │   └── services/api.js       # Axios JWT Interceptor
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── src/
│   ├── api/                      # REST API Server (Express.js)
│   │   ├── middleware/           # userAuth, auth, institutionAuth
│   │   └── routes/               # auth, user wallet, escrows, requests, splits, staking, admin
│   ├── bot/                      # Discord Bot Client (discord.js)
│   │   ├── commands/             # Slash commands
│   │   └── events/               # Event handlers
│   ├── db/                       # MySQL Connection & Queries
│   │   ├── queries/              # user, wallet, transaction, escrow, request, staking
│   │   ├── schema.sql            # Master database schema v3
│   │   └── setup.js              # DB initialization script
│   ├── services/                 # Unified Business Logic Layer
│   └── utils/                    # Formatters, Address Gen, Embed builders
├── .env.example
├── package.json
└── README.md
```
