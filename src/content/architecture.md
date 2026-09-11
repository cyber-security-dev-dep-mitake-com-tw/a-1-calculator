# 訂閱 × 金鑰 × 簽章 × 硬體信任根 — 三端架構發想

範圍:console(server)、local_agent(PC)、A1 USB 鎖網裝置,以及既有的 A1 Portal。
本文為設計發想,不是實作紀錄;每個「已有」都標了出處,「建議」則明確標示為建議。

---

## 0. 先更正三個前提

盤點三個 repo 後,題目的假設和現況有三處出入。這三點會直接改變設計走向,所以先講。

| 題目假設 | 實際現況 | 影響 |
|---|---|---|
| TPM 2.0 要用在 USB 鎖網裝置上 | **TPM 2.0 已經在用,但在 PC 端** — `local_agent/internal/attest/tpm.go` 用 `github.com/google/go-tpm v0.9.8`,讀 PCR 0–23,Windows 走 `//./TPM` | USB 裝置該不該再放 TPM,是成本/效益問題,不是有無問題 |
| USB 裝置將採 TPM 2.0 | A1 實際設計的是 **ATECC608C**(`a1-stm32-demo_ver/APP/secure_element.c`,I2C1 PB6/PB7,已能開機探測) | ATECC608 ≠ TPM 2.0,兩者能力不同,見 §6 |
| 訂閱要從頭發想 | **已有相當完整的 POC** — `A1_SUBSCRIPTION_ARCHITECTURE.md`:雙模式 strap、Base32 Device ID、32 字元個人 Token(HMAC-SHA256)、企業租約 COSE_Sign1/ES256、席次池、寬限 600s×10、Flash journal 防回滾 | 真正的缺口不是「怎麼設計訂閱」,而是 **console 與 Portal 的分工** |

所以本文的重點放在:**把三端既有的零件接起來**,而不是重畫一套。

---

## 1. 現況資產盤點

| 能力 | console(本專案) | local_agent(PC) | A1 裝置 | A1 Portal |
|---|---|---|---|---|
| 硬體信任根 | — | **TPM 2.0**(PCR 0–23 measured boot) | **ATECC608C**(已接線,未 provision) | — |
| 裝置身分 | `device_registry`(device_pubkey / webauthn_*)、`depin_device_certificates`(**含 tenant_id**) | ECDSA P-256 client cert(`pki.Provision()` → `{ca,agent}.pem`) | `A1-Base32(SHA256(identity)[0:16])` | `device-registry.json` |
| 遠端證明 | `HandleDeviceAttest` → `VerifyAttestation`(驗 TPM/TEE proof,可自動註冊) | `attest/{prover,measurement,baseline,signer}.go`(RSA-PKCS1v15 SHA-256) | ES256 attestation(**尚未接線**) | attestation challenge |
| 傳輸信任 | pinned CA + mTLS(`buildPinnedTLSConfig`) | `transportid.BuildTLSConfig`(pinned CA、TLS1.2 floor) | WebHID report ID 6 | HTTPS |
| 簽章基礎建設 | **DePIN PKI + Vault transit ECDSA-P256**、`IssueServerCert`、`CAChain` | — | CryptoAuthLib(待接) | COSE_Sign1/ES256 簽發 |
| 稽核 / 不可否認 | **RFC 6962 Merkle transparency log**(`depin_anchor_{entries,checkpoints,witness_sigs}`) | — | receipt(`RECEIPT:POC:`) | audit log |
| **訂閱 / 授權** | **完全沒有** | **完全沒有** | lease_seq、grace、Flash journal | **席次池、Claim Code、租約、金流沙盒** |

一句話:**console 有全部的信任基礎建設卻沒有商業層;Portal 有完整商業層卻沒有信任基礎建設。**

---

## 2. 核心架構問題:兩個 server 怎麼分工

這是本題最該先拍板的決定,其餘設計都跟著它走。

### 建議:Portal 做「發照」,console 做「驗證與稽核」,兩者用裝置身分接起來

理由是它們的信任模型本質不同:

- Portal 面對**金流與商務**:付款、席次、Claim Code、退款、通路。它的錯誤模式是「多賣/少賣」。
- console 面對**資安營運**:attestation、PKI、SIEM/SOAR、transparency log。它的錯誤模式是「漏判/誤判」。

把兩者混在一個服務裡,會讓「沒付錢」和「不可信」變成同一個錯誤碼 — 這在 B2B 稽核時是災難(客戶會問:這台裝置被擋,是因為欠費還是被入侵?)。

```
                    ┌──────────────────────────────┐
                    │  A1 Portal (發照 / 商務)      │
                    │  席次池、Claim Code、金流      │
                    │  簽發 COSE_Sign1 lease        │
                    └──────────┬───────────────────┘
                               │ ① 查「這台裝置可信嗎」
                               ▼
┌──────────────────────────────────────────────────┐
│  console (信任 / 稽核)                            │
│  VerifyAttestation · DePIN PKI(Vault transit)   │
│  transparency log · tenant · SIEM/SOAR           │
└──────────┬───────────────────────────────────────┘
           │ ② mTLS + presence token          ▲
           ▼                                  │ ④ receipt 錨定
┌────────────────────┐  ③ WebHID  ┌───────────┴────────┐
│ local_agent (PC)   │───────────►│ A1 裝置 (ATECC608) │
│ TPM 2.0 measured   │            │ 驗 lease、net:off  │
└────────────────────┘            └────────────────────┘
```

**四條關鍵鏈路**

1. Portal 簽 lease 前,先問 console「這個 device_id 的 attestation 有效嗎、屬於哪個 tenant」。console 已有 `VerifyAttestation` 與帶 `tenant_id` 的 `depin_device_certificates`,這條只需要一個內部 API。
2. agent ↔ console 已經通了(mTLS + `GetPresenceToken`,`internal/console/client.go:249`)。
3. agent ↔ 裝置已經通了(WebHID report ID 6)。
4. **目前缺的一條**:裝置簽發的 receipt 應該回流 console,錨進 transparency log。見 §5。

---

## 3. 金鑰階層

分三層,對應三種生命週期。混用是多數硬體訂閱產品出事的地方。

```
【製造層】離線 HSM,一輩子不換
  Mitake Root CA
    └─ Device Sub-CA
         └─ IDevID (per device)  ← ATECC608 Slot 0,產線鎖定,不可撤
              作用:證明「這是我們出廠的硬體」

【營運層】console,可撤銷、可輪替
  console PKI (Vault transit ECDSA-P256,已有)
    ├─ LDevID / enrollment cert  ← 綁 tenant_id,客戶退租即撤
    ├─ agent mTLS client cert    ← 已有 pki.Provision()
    └─ checkpoint signer         ← 已有 TransitCheckpointSigner

【商務層】Portal,短期、可過期
  Lease signing key (ES256)
    └─ COSE_Sign1 lease  ← 綁 device_id + lease_seq + exp + tenant
         作用:證明「這台裝置這段期間有付錢」
```

**為什麼要分開**:退租要能撤 LDevID 而不動 IDevID(硬體還是真的);換方案要能重簽 lease 而不動 PKI。這三把鑰匙若共用,任何一次撤銷都會誤傷另外兩層。

---

## 4. 訂閱怎麼「真的」綁在硬體上

訂閱制的三個經典攻擊,以及現況對應:

| 攻擊 | 手法 | 現況 | 缺口 |
|---|---|---|---|
| **複製授權** | 把 lease 複製到第二台裝置 | lease 綁 device_id,device_id 來自 ATECC identity | ⚠️ ATECC 未 provision 時退回 UID POC identity(文件自己標 `unattested`)→ 可偽造 |
| **回滾** | 抹 Flash / 降級韌體,回到舊 lease | `lease_seq` + Flash journal | ⚠️ Flash 可被重刷;**需要 ATECC monotonic counter** 才真正防得住 |
| **改時鐘** | 把系統時間調回過去,無限用過期 lease | `time_trusted` 旗標 | ⚠️ 同上,需要單調計數器當「已消耗的離線額度」 |

### 建議 1:用 ATECC608 monotonic counter 綁 lease_seq

Flash journal 擋得住軟體錯誤,擋不住有心人重刷。ATECC608 的 counter 硬體上只能遞增、不能歸零,這正是防回滾唯一可靠的錨。文件已把它列在「尚未完成」,我認為這是**整條訂閱防線的關鍵路徑**,優先度高於 COSE 驗簽接線。

### 建議 2:硬體買斷的基本功能,不要因訂閱過期而失效

這是產品安全問題,不只是商業問題:

- 這台裝置的本質是**斷網開關**,在 AV 偵測到威脅時切網。
- 若訂閱過期導致 `net:off` 失效,等於「沒付錢就讓你更不安全」——這在事故後是法律風險,不是商業損失。
- 現行 `ERR:SE_NOT_PROVISIONED` → 繼電器 fail closed 的設計方向是對的(fail closed = 切網,安全側),應該保持。

**建議切法**:
- **永久**(硬體買斷即有):本地 AV 觸發 → net:off、實體按鍵手動切網、本地 LED 狀態。
- **訂閱解鎖**:雲端事件紀錄與長期保存、多裝置集中管理、SIEM/SOAR 整合、威脅情資、遠端解鎖/覆寫、合規報表。

換句話說:**訂閱賣的是「看得見、管得動、留得下證據」,不是「能不能自保」。**

### 建議 3:離線寬限沿用 DDIL 思路

企業寬限 600s × 10 已實作,概念與本專案 SIEM 端剛做的 DDIL store-and-forward 一致:**斷線不該等於停擺,但也不能無限寬容**。建議把寬限額度記在 ATECC counter 而非只在 Flash,理由同建議 1。

---

## 5. 簽章的三個用途 — 別混為一談

| # | 用途 | 誰簽 | 誰驗 | 現況 |
|---|---|---|---|---|
| 1 | **身分**:這台裝置是真的 | 裝置(ATECC ES256 / TPM AK) | console `VerifyAttestation` | 骨架已有,ATECC 端待接 |
| 2 | **授權**:這台裝置有付錢 | Portal lease key(ES256) | 裝置 `subscription_apply_lease()` | Portal 已能簽;裝置端驗簽待 CryptoAuthLib 接線 |
| 3 | **稽核**:這台裝置在 T 時刻切了網 | 裝置(receipt) | console transparency log | **完全缺** |

### 用途 3 是目前最大的漏接,也是最容易補的高價值項

console 已經有 RFC 6962 append-only Merkle log(`depin_anchor_entries` / `depin_anchor_checkpoints` / `depin_anchor_witness_sigs`),由 Vault transit 簽 checkpoint。而裝置已經會發 receipt。

把 receipt 錨進去,就得到一條**不可否認、可對外證明、無法事後竄改**的資安動作紀錄鏈:

```
AV 偵測 → agent → 裝置 net:off → 裝置簽 receipt
    → agent 上傳 → console 驗簽 → 併入 Merkle 葉節點
    → 定期 checkpoint(Vault transit 簽)→ 可交付稽核
```

商業上這是 B2B 的**差異化賣點**:資安法、ISO 27001、金融業稽核都要求「事件處置紀錄不可否認」。市面上的 EDR 給你一份可被管理員修改的資料庫紀錄;這條鏈給的是密碼學上可驗證的 append-only log,而且**基礎建設已經寫好了**。

---

## 6. TPM 2.0 該放哪裡

先講結論:**PC 端用 TPM 2.0(已在做),USB 裝置維持 ATECC608C** — 這其實已經是現況,而且是對的。

### 兩者能力對照

| | ATECC608C | TPM 2.0 |
|---|---|---|
| 介面 | I2C(已接 PB6/PB7) | SPI / I2C,需 TSS stack |
| 演算法 | ECC P-256、SHA-256、HMAC | RSA、ECC、SHA、更完整的金鑰階層 |
| 單調計數器 | ✅ | ✅ |
| **Measured boot / PCR** | ❌(有 SecureBoot 但非 PCR 模型) | ✅ **這是 TPM 的主要價值** |
| 標準遠端證明 | 專有 | ✅ TCG 標準 |
| 概估單價 | 約 US$0.5–1 | 約 US$1.5–3 |
| MCU 負擔 | 輕,CryptoAuthLib | 重,STM32F407 資源吃緊 |

*單價為一般行情概估,非即時報價,採購前請自行核。*

### 為什麼現況的分法是對的

- **PC 端**:Windows 11 強制要求 TPM 2.0 → **成本為零**,而且 PCR 0–23 正好回答「這台電腦的開機鏈有沒有被動過」,這是 ATECC 做不到的。`local_agent` 已經在讀了。
- **USB 裝置**:需要的是「不可匯出的身分金鑰 + 單調計數器 + 驗 ES256 簽章」,ATECC608C 全部滿足,而且已經接線、韌體已能探測。為此換 TPM 要付出 BOM、韌體複雜度、以及重做 provisioning 流程的代價,換到的主要只有 PCR 和 TCG 標準。

### 由此得到一個更強的設計:三因子綁定

既然兩顆晶片都在,不如讓它們**各綁一件事**:

| 因子 | 由誰證明 | 綁什麼 |
|---|---|---|
| **機** — 這台電腦沒被動過 | PC TPM 2.0(PCR quote) | 開機鏈完整性 |
| **鎖** — 這個硬體是我們出的 | A1 ATECC608(IDevID) | 裝置真偽 |
| **人** — 操作者是本人 | Box CTAP2 authenticator(`local_agent/internal/ctaphid`)/ console WebAuthn | 使用者身分 |

三者都通過才發 lease / 才允許遠端覆寫。console 端 `VerifyAttestation`、`VerifyPresence`、`GenerateNonces`(一次發 presence/device/authz 三個 nonce)的設計**本來就是為這種多因子組合寫的** — 三個 nonce 對應三個因子,這個骨架已經在那裡了。

### 什麼情況下 USB 裝置才該上 TPM 2.0

1. 目標客戶是政府/軍工,採購規格書**指名** TPM 2.0(本 repo 近期的 mil-api 脈絡下,這並非假想)。
2. 需要證明**裝置韌體版本**未被竄改(measured boot),而非只證明裝置身分。
3. 需要 TCG 標準遠端證明以接第三方稽核工具。

若是 1,建議做成**企業版硬體 SKU**(ATECC 標準版 / TPM 企業版),而不是全線換料 — 這同時變成一個自然的價格分層。

---

## 7. B2B / B2C 收費機制與價格區間

> 以下價格為**定價框架與參考錨點**,依據一般市場行情與硬體成本結構推估,非市場調查數據。實際定價需做競品調查與毛利試算。

### 成本結構(推估)

- BOM:STM32F407 + ATECC608C + 外殼 + 線材,小量約 US$12–20,量產(>10k)可望壓到 US$8–12。
- 雲端邊際成本:每裝置每月的事件儲存 + lease 簽發,極低(< US$0.3),主要成本在 SIEM 事件量。

### B2C — 個人模式

已有的 32 字元 Base32 Token(HMAC-SHA256)非常適合通路銷售:可印在卡片上、可做預付序號、不需帳號即可啟用。

| 項目 | 建議區間 | 說明 |
|---|---|---|
| 硬體買斷 | **NT$1,500–2,500**(約 US$50–80) | 對標消費級安全金鑰(YubiKey 5 約 US$50–70)。含永久基本鎖網功能 |
| 訂閱(月) | **NT$149–299** | 雲端紀錄、多裝置、情資更新 |
| 訂閱(年) | **NT$1,490–2,690** | 約 10 個月價,年繳折扣 |
| 預付卡(1年) | **NT$1,690** | 通路/禮品卡,溢價換取免綁卡 |

**關鍵設計**:硬體買斷後基本功能永久可用(§4 建議 2)。這讓「不續訂」的損失是功能降級而非變磚,退貨率與負評會差很多。

### B2B — 企業模式

已有席次池、裝置撤銷/恢復、稽核紀錄的 POC,方向正確。

| 方案 | 建議區間(每裝置/月) | 內容 |
|---|---|---|
| **Standard** | **US$3–5** | 集中管理、席次調度、基本稽核報表 |
| **Advanced** | **US$6–10** | + SIEM/SOAR 整合、transparency log 不可否認稽核(§5)、API |
| **Regulated / Gov** | **US$12–20** | + TPM 2.0 硬體 SKU、measured boot 證明、地端部署、合規報表 |
| MSP / 通路 | 上述 **55–60%** | 給 40–45% 通路利潤,業界常見區間 |

**商務條款建議**
- 年約起跳,席次可增不可減(或只在續約點可減)—— 現有席次池 POC 已接近此模型。
- 最低採購量 25–50 席,低於此走 B2C 或通路。
- 硬體可選買斷或含在訂閱(訂閱含硬體時,月費 +US$2–3,三年攤提)。

### 為什麼建議「硬體買斷 + 訂閱」而非純訂閱

1. 硬體買斷回收 BOM,避免現金流被硬體墊付拖垮(這是硬體訂閱新創最常見的死因)。
2. 消費者對「買了硬體還會變磚」極度反感;分離後負評風險大幅下降。
3. 企業採購常把硬體列資本支出、訂閱列營運支出,分開反而好過預算。

### 金流缺口

`A1_SUBSCRIPTION_ARCHITECTURE.md` 明列尚未完成:正式金流與 server-to-server webhook、個人 HMAC 金鑰需移至 KMS/Vault。後者尤其重要 —— **能簽個人 Token 的金鑰若外洩,等於整條 B2C 產線被破解**。console 已有 Vault transit 在跑,這把金鑰應該直接搬進去,而不是另建一套。

---

## 8. 分階段落地建議

依「解鎖後續最多東西」排序,不是依難度。

**Phase 1 — 把防線補到真的能擋(硬體端)**
1. ATECC608C Slot 6 I/O Protection Key + config/data zone 鎖定(產線流程)
2. **monotonic counter 綁 lease_seq 與離線寬限額度** ← 整條訂閱防線的關鍵路徑
3. CryptoAuthLib 接線,關閉 `A1_POC_SOFT_LEASE` 與 `A1_POC_UNATTESTED_LEASES`

**Phase 2 — 兩個 server 接起來(§2)**
4. console 開一支內部 API 供 Portal 查裝置 attestation 與 tenant 歸屬
5. 個人 Token HMAC 金鑰搬進 console 既有的 Vault transit

**Phase 3 — 差異化(§5)**
6. 裝置 receipt → console transparency log 錨定 → B2B Advanced 方案的賣點

**Phase 4 — 商業化**
7. 正式金流 + webhook、Portal SSO/WebAuthn/tenant isolation
8. Regulated SKU 評估(TPM 2.0 硬體版,§6)

---

## 附:本文依據

- console:`internal/verifier/*`、`internal/depin/pki.go`、`internal/handlers/verifier_handler.go`、`database/migrations/004_create_zk_verifier_tables.sql`
- local_agent:`internal/attest/tpm.go`(go-tpm v0.9.8)、`internal/transportid/tlsconfig.go`、`internal/pki/pki.go`、`internal/console/client.go:249`、`internal/ctaphid/*`
- A1:`docs/A1_SUBSCRIPTION_ARCHITECTURE.md`、`docs/A1_ATECC608_DT100104_GUIDE.md`、`APP/secure_element.c`、`Portal/server.mjs`
