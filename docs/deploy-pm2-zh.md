# 用 pm2 部署到 Oracle Cloud（AMD 小机器）

这份文档假设：

- 机器是 Oracle Cloud 的 AMD 免费实例（`VM.Standard.E2.1.Micro`，1 GB 内存）
- 系统是 **Ubuntu**，登录用户是 `ubuntu`
- 你已经能用 SSH 登录这台机器

如果你装的是 Oracle Linux，登录用户是 `opc`，包管理器是 `dnf` 而不是 `apt`，第 1、2 步的命令需要换，其余步骤相同。

文档里的 `<服务器IP>` 换成你实例的公网 IP。标着 **【本机】** 的命令在你自己的电脑上跑，标着 **【服务器】** 的在 SSH 登录后的服务器上跑。

---

## 0. 部署前（本机）

**把代码推到 GitHub。** 服务器是从 GitHub 拉代码的，没推上去的改动服务器拿不到。

**【本机】**
```bash
git push origin main
```

**停掉本机正在跑的机器人。** 同一个 Discord token 同时在两个地方运行，每条消息会被回复两次。

---

## 1. 加 swap（服务器，只做一次）

1 GB 内存在 `npm install` 时容易不够用，先加 2 GB 的 swap。

**【服务器】**
```bash
sudo fallocate -l 2G /swapfile
```
```bash
sudo chmod 600 /swapfile
```
```bash
sudo mkswap /swapfile
```
```bash
sudo swapon /swapfile
```
```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

检查：下面这条命令的 `Swap` 一行应该显示 `2.0Gi`。
```bash
free -h
```

---

## 2. 安装 Node.js 和 git（服务器，只做一次）

装 Node.js 22（长期支持版）。

**【服务器】**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
```
```bash
sudo apt-get install -y nodejs git
```

检查：应该显示 `v22.x.x`。
```bash
node -v
```

---

## 3. 拉代码、装依赖（服务器）

**【服务器】**
```bash
cd ~
```
```bash
git clone https://github.com/wenzhiTeo/simple-ai-bot.git
```
```bash
cd ~/simple-ai-bot
```
```bash
npm ci --omit=dev
```

`npm ci` 会严格按 `package-lock.json` 安装，小机器上大概要一两分钟。

如果仓库是私有的，`git clone` 会要你输入 GitHub 用户名和 token（不是登录密码），token 在 GitHub → Settings → Developer settings → Personal access tokens 里创建。

---

## 4. 配置 .env（服务器）

`.env` 不在 git 里，需要在服务器上单独创建。

**【服务器】**
```bash
cp .env.example .env
```
```bash
nano .env
```

至少填这几项：

| 变量 | 说明 |
| --- | --- |
| `GEMINI_API_KEY` | 必填 |
| `DISCORD_TOKEN` | 必填，否则 Discord 不会启动 |
| `TZ` | 你的时区，例如 `Asia/Singapore`。服务器默认是 UTC，不设的话 `/remind 1430` 会按 UTC 的 14:30 算 |
| `INIT_CHANNEL_ID` | **建议留空**，原因见下 |
| `ADMIN_PASSWORD` | 留空即可，后台通过 SSH 隧道访问（第 8 步） |

`.env.example` 里其他带示例值的行（比如 `BLACKLISTED_CHANNEL_IDS=channel_id_1,channel_id_2`）不用的话要删掉或清空。

nano 里按 `Ctrl+O` 回车保存，`Ctrl+X` 退出。

> **为什么 `INIT_CHANNEL_ID` 建议留空**：设置后机器人每次启动都会在那个频道 `@everyone` 发上线通知。pm2 会在崩溃时自动重启，每次更新部署也要重启，每一次都会 @ 全员。

**想保留本机的提示词和历史？** 新服务器会自动创建一个带两条默认提示词的空数据库。如果要沿用本机的数据，把数据库文件传上去：

**【本机】**（在项目目录里执行）
```bash
scp database.sqlite ubuntu@<服务器IP>:~/simple-ai-bot/
```

---

## 5. 先手动跑一次（服务器）

用 pm2 之前先直接跑，确认配置没问题，报错也看得更清楚。

**【服务器】**
```bash
node index.js
```

看到下面这几行就是正常的：

```
✅ Database ready
✅ Express server running on port 3000
✅ Discord bot ready: 你的机器人名字#1234
✅ Registered 6 commands
```

去 Discord 里 @ 机器人说句话，确认它会回复。然后按 `Ctrl+C` 停掉。

---

## 6. 安装 pm2 并启动（服务器）

pm2 是一个进程管理器：让程序在后台一直跑，崩溃了自动拉起来，并且帮你收集日志。

**【服务器】**
```bash
sudo npm install -g pm2
```
```bash
cd ~/simple-ai-bot
```
```bash
pm2 start ecosystem.config.cjs
```

启动参数都写在项目里的 `ecosystem.config.cjs`，进程名叫 `ai-bot`。

检查状态：`status` 一列应该是 `online`，`↺`（重启次数）应该是 `0`。
```bash
pm2 status
```

看日志（`Ctrl+C` 退出查看，不会停掉机器人）：
```bash
pm2 logs ai-bot
```

如果 `↺` 的数字一直在涨，说明程序在反复崩溃重启，看日志里的报错。

---

## 7. 设置开机自启（服务器，只做一次）

到这一步机器人已经在跑了，但服务器重启后不会自己起来。需要两条命令。

**【服务器】**
```bash
pm2 startup
```

这条命令**不会直接生效**，它会打印出一行以 `sudo env PATH=...` 开头的命令。把那一整行复制下来，粘贴执行。

然后保存当前的进程列表，pm2 开机时会恢复它：
```bash
pm2 save
```

验证（可选）：重启服务器，等一分钟重新 SSH 登录，`pm2 status` 应该显示 `ai-bot` 是 `online`。
```bash
sudo reboot
```

---

## 8. 访问管理后台（本机）

**不要**在 Oracle 的安全列表里开放 3000 端口。后台在没设密码时只接受来自服务器本机的访问，用 SSH 隧道把服务器的 3000 端口映射到你的电脑。

**【本机】**
```bash
ssh -L 3000:localhost:3000 ubuntu@<服务器IP>
```

保持这个 SSH 窗口开着，然后在本机浏览器打开 `http://localhost:3000/admin`。关掉 SSH 窗口隧道就断了。

如果本机的 3000 端口被占用，把命令里**第一个** `3000` 换成别的，比如 `-L 3001:localhost:3000`，然后访问 `http://localhost:3001/admin`。

---

## 9. 日志轮转（服务器，只做一次）

pm2 的日志文件默认会一直增长。装一个官方插件自动切分和清理：

**【服务器】**
```bash
pm2 install pm2-logrotate
```
```bash
pm2 set pm2-logrotate:max_size 10M
```
```bash
pm2 set pm2-logrotate:retain 7
```

这样每个日志文件最大 10 MB，最多保留 7 个。

---

## 日常操作

### 更新代码

本机改完代码并 `git push` 之后：

**【服务器】**
```bash
cd ~/simple-ai-bot
```
```bash
git pull
```
```bash
npm ci --omit=dev
```
```bash
pm2 restart ai-bot
```

如果这次更新没有改依赖（`package.json` 没变），`npm ci` 那一步可以跳过。

### 改了 .env

改完需要重启才生效：
```bash
pm2 restart ai-bot
```

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `pm2 status` | 看进程状态、内存、重启次数 |
| `pm2 logs ai-bot` | 实时看日志 |
| `pm2 logs ai-bot --lines 200` | 看最近 200 行 |
| `pm2 logs ai-bot --err` | 只看错误日志 |
| `pm2 restart ai-bot` | 重启 |
| `pm2 stop ai-bot` | 停止（不会自动重启） |
| `pm2 start ai-bot` | 停止后再启动 |
| `pm2 monit` | 实时监控面板，按 `q` 退出 |

### 备份数据库

所有数据（提示词、聊天历史、提醒）都在 `database.sqlite` 一个文件里。

**【本机】**
```bash
scp ubuntu@<服务器IP>:~/simple-ai-bot/database.sqlite ./database-backup.sqlite
```

---

## 常见问题

**`npm ci` 卡住或者被 `Killed`**
内存不够。确认第 1 步的 swap 加上了（`free -h`）。

**`pm2 status` 里 `↺` 一直涨**
程序启动后马上崩溃。`pm2 logs ai-bot --err --lines 50` 看原因，最常见的是 `.env` 里 key 填错。先 `pm2 stop ai-bot`，用第 5 步的 `node index.js` 手动跑更容易看清楚。

**机器人每条消息回复两次**
有另一个实例在用同一个 token，通常是本机忘了关。

**提醒时间差了几个小时**
`.env` 里没设 `TZ`，或者设了之后没重启。

**`pm2: command not found`**
全局安装没成功，重新执行 `sudo npm install -g pm2`。

**服务器重启后机器人没起来**
第 7 步里 `pm2 startup` 打印出来的那行命令没有执行，或者之后忘了 `pm2 save`。
