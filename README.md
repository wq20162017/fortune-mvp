# 🔮 算命软件 MVP

AI 对话式情感运势分析 H5

## 快速启动

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd frontend
npm install
```

### 2. 配置 API Key

复制 `backend/.env.example` 为 `.env`，填入硅基流动 API Key：

```
AI_API_URL=https://api.siliconflow.cn/v1/chat/completions
AI_API_KEY=你的API密钥
PORT=3001
```

### 3. 启动

```bash
# 后端（终端1）
cd backend && npm run dev

# 前端（终端2）
cd frontend && npm run dev
```

打开 http://localhost:5173

## 技术栈

- **前端**：React + Vite + TailwindCSS
- **后端**：Node.js + Express
- **AI**：DeepSeek (硅基流动) - ¥1/百万token
- **八字排盘**：`lunar-lord` (npm)
