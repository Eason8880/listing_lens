# ListingLens

ListingLens 是一个面向跨境电商卖家的 AI 主图优化工具。用户可以上传商品主图，或输入商品详情页 URL 抓取候选主图，再通过 GPT-Best 图像编辑接口完成图片本地化与电商视觉优化。

## 功能

- 上传主图或输入商品 URL 抓取候选图
- 选择源语言、目标语言、提示词预设与模型
- 通过服务端代理调用 GPT-Best `POST /v1/images/edits`
- 预览原图和生成图，并复制生成结果 URL
- 含基础 SSRF 防护、文件大小限制与 IP 级内存限流

## 环境变量

复制 `.env.example` 为 `.env.local` 并填入：

```bash
GPT_BEST_BASE_URL=
GPT_BEST_API_KEY=
GPT_BEST_MODEL_GEMINI=gemini-3.1-flash-image-preview-4k
GPT_BEST_MODEL_NANO=nano-banana-2-4k
```

- `GPT_BEST_BASE_URL`：GPT-Best OpenAI 兼容接口基础地址，不要带末尾斜杠。
- `GPT_BEST_API_KEY`：服务端调用所需密钥。
- 两个模型环境变量可按实际控制台可用值覆盖默认映射。

## 开发

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 验证

```bash
npm run lint
npm test
npm run build
```
