# Discord AI 聊天机器人

一个基于 Google Gemini AI 的 Discord 机器人，支持智能对话、定时提醒和网页管理界面。

## 🎯 主要功能

- **🤖 AI 聊天**：使用 Google Gemini 进行自然对话
- **📷 图片分析**：上传图片让 AI 分析内容
- **💸 水电费（WhatsApp）**：用文字或账单照片计算每月分摊，确认后发给指定联系人
- **⏰ 定时提醒**：设置提醒消息，到时间自动发送
- **🛠️ 网页管理**：通过浏览器管理机器人设置

## 🚀 快速开始

### 准备工作
- 安装 Node.js (版本 20 或更高)
- 获取 Discord 机器人令牌：[点击这里](https://discord.com/developers/applications)
- 获取 Google Gemini API 密钥：[点击这里](https://aistudio.google.com/apikey)

### 安装步骤

1. **下载代码**
   ```bash
   git clone <仓库地址>
   cd simple-ai-bot
   npm install
   ```

2. **配置环境变量**
   创建 `.env` 文件：
   ```env
   DISCORD_TOKEN=你的Discord机器人令牌
   GEMINI_API_KEY=你的Gemini_API密钥
   INIT_CHANNEL_ID=启动通知频道ID（可选）
   BLACKLISTED_CHANNEL_IDS=忽略的频道ID，用逗号分隔（可选）
   ```

3. **Discord 机器人权限设置**
   
   在 Discord 开发者面板中，确保机器人有以下权限：
   - 发送消息
   - 读取消息历史
   - 使用斜杠命令
   - 提及所有人
   - 附加文件
   
   并启用以下意图：
   - 消息内容意图
   - 服务器成员意图

4. **启动机器人**
   ```bash
   npm start
   ```
   
   **可用地址：**
   - 管理面板：`http://localhost:3000/admin`
   - 状态页：`http://localhost:3000/status`（访问规则和管理面板相同）
   - 健康检查：`http://localhost:3000/health`

## 📖 使用方法

### 基本 Discord 机器人用法

#### 💬 与 AI 聊天
```
@你的机器人 你好！今天怎么样？
@你的机器人 [上传图片] 这张图片里有什么？
```

#### 🔧 斜杠命令
```
/help                    # 显示所有可用命令
/ping                    # 检查机器人延迟和状态
/remind                  # 设置特定时间的提醒
/reminders               # 列出所有活跃提醒
/clear-reminders         # 清除所有活跃提醒
/reset                   # 清空机器人对当前频道的对话记忆
/status                  # 机器人和服务器状态，只有你能看到（默认仅服务器管理者可用）
```

#### ⏰ 设置提醒
使用 `/remind` 命令，时间格式为 HHMM：
```
/remind time:1430 message:开会提醒
/remind time:0900 message:吃药时间
/remind time:2000 message:给妈妈打电话
```

### WhatsApp：水电费

机器人会作为"关联设备"登录你自己的 WhatsApp（和 WhatsApp Web 一样），只监听你的
**「给自己发消息」** 聊天，别人发来的消息一律不处理。它在这个聊天里的回复以 🤖 开头。

```
水电费 9月 wifi 100 水 6.50 电 25.6
```

也可以直接发账单照片或 PDF，配文写 `水电费`：Gemini 负责读金额，计算由代码完成。
先回你一份草稿：

```
水电费
2026 年 9 月
Wi-Fi = 100.00 / 2 = 50.00
水费 = 6.50 / 2 = 3.25
电费 = 25.60 / 2 = 12.80
总计 RM66.05
```

草稿打开期间：发 `电 25.60` 修改，`删 电` 删除，继续发照片会追加，`确认` 发送给
`BILL_RECIPIENT`，`取消` 放弃。草稿 6 小时后失效。其他消息照常和 AI 聊天。
发出去的账单会存进 `bills` 表。

> 使用 [Baileys](https://github.com/WhiskeySockets/Baileys)（非官方 WhatsApp Web 客户端），
> 违反 WhatsApp 服务条款，有封号风险，请只做个人小量使用。账单照片会发给 Gemini。

### 管理面板

访问 `http://localhost:3000/admin` 可以：

- **📝 管理提示词**：创建和编辑 AI 个性风格
- **🎛️ 模型设置**：在「Settings」里改 Gemini 模型、temperature、回复长度和记忆条数
- **🔄 实时更新**：提示词和模型设置修改后，下一条消息即生效，不用重启
- **💬 历史与提醒**：查看已保存的对话和待发送的提醒
- **⚙️ 数据库管理**：浏览和管理所有存储的数据

### 状态页

`http://localhost:3000/status` 一眼看出机器人是否正常：各平台是否连接、当前模型和个性、
本次启动后的回复失败次数（附最近一次报错）、服务器内存 / swap / 磁盘 / 负载、机器人自身内存、
保存的数据量。有问题会列在页面最上方。每 30 秒自动刷新，和 `/admin` 一样受保护。

在手机上可以直接用 Discord 的 `/status` 命令：同样的检查结果，精简成一张卡片，只有你自己能看到。
默认只有「管理服务器」权限的成员能看到这个命令（可在 服务器设置 → 整合 里调整）。


## ⚙️ 配置说明

### 环境变量

| 变量名                    | 说明                                   | 必需 | 示例                 |
| ------------------------- | -------------------------------------- | ---- | -------------------- |
| `GEMINI_API_KEY`          | Google Gemini API 密钥                 | ✅    | `AIzaSyC...`         |
| `DISCORD_TOKEN`           | Discord 机器人令牌（设置后才启动 Discord） | ❌    | `MTIzNDU2Nzg5...`    |
| `MODEL_NAME`              | Gemini 模型 ¹                          | ❌    | `gemini-2.5-flash`   |
| `MAX_OUTPUT_TOKENS`       | 单条回复最多 token 数 ¹                | ❌    | `4096`               |
| `HISTORY_LIMIT`           | 每个会话发给模型的历史消息条数 ¹       | ❌    | `20`                 |
| `HISTORY_RETENTION_DAYS`  | 历史保留天数（`0` 为永久，默认 30）    | ❌    | `30`                 |
| `INIT_CHANNEL_ID`         | 启动通知频道 ID                        | ❌    | `123456789012345678` |
| `BLACKLISTED_CHANNEL_IDS` | 忽略的频道 ID（逗号分隔）              | ❌    | `123,456,789`        |
| `WHATSAPP_PHONE`          | 你的 WhatsApp 号码（含国家码，只写数字），设置后才启动 WhatsApp | ❌ | `60123456789` |
| `BILL_RECIPIENT`          | 水电费的收件人（含国家码，只写数字）   | ❌    | `60198765432`        |
| `BILL_SPLIT`              | 分摊人数（默认 2）                     | ❌    | `2`                  |
| `ADMIN_PASSWORD`          | `/admin` 的密码，不设置则只允许本机访问 | ❌    |                      |
| `TZ`                      | `/remind` 使用的时区                   | ❌    | `Asia/Singapore`     |

¹ 只在第一次启动时读取，用来初始化「Settings」表。之后请在管理面板的「Settings」里修改，改 `.env` 不再生效。

完整列表见 `.env.example`。

## 🧱 架构

```
index.js                     组装：数据库、AI、路由、适配器、定时任务、Web 服务
src/adapters/<平台>/          所有平台相关代码（discord、whatsapp）
src/skills/                  在 AI 聊天之前处理的功能（水电费）
src/core/router.js           与平台无关的消息处理
src/core/conversationStore.js  按会话保存聊天历史（SQLite）
src/services/                gemini.js（无状态 AI 客户端）、reminder.js（落库的提醒）
src/server.js                Express：/health、/status、/admin、各平台 webhook
src/web/status.html          状态页（无需构建）
database/models/             Prompt、Message、Reminder、Bill、Setting
test/                        `npm test`
```

适配器把平台事件转换成统一的 `IncomingMessage`
（`platform`、`conversationId`、`userId`、`text`、`images`、`reply()`），交给 `router.handle()`。
接入新平台时，在 `src/adapters/` 下新建目录，实现 `name`、`start(onMessage)`、
`send(conversationId, text)`、`mention(userId)`，再到 `index.js` 注册即可，
`core/` 和 `services/` 不需要改。

每个会话（一个 Discord 频道、一个 WhatsApp 聊天）有独立的历史，每次把最近 `history_limit`
条（管理面板 →「Settings」）发给模型。提醒保存在数据库里，重启不会丢。

## 🚢 部署

用 pm2 部署到服务器的分步教程：[docs/deploy-pm2-zh.md](docs/deploy-pm2-zh.md)

## 🛠️ 技术栈

| 类别       | 技术               | 用途         |
| ---------- | ------------------ | ------------ |
| **机器人** | Discord.js         | Discord API  |
| **AI**     | Google Gemini  | 自然语言处理 |
| **数据库** | SQLite + Sequelize | 数据存储     |
| **管理**   | AdminJS            | 网页管理界面 |
| **定时**   | node-cron          | 提醒系统     |
| **服务器** | Express.js         | 网页服务     |

