# ListingLens

ListingLens 是一个面向跨境电商卖家的 AI 主图优化工具。用户可以上传商品主图，或输入商品详情页 URL 抓取候选主图，再通过图像编辑接口完成图片本地化与电商视觉优化。

## 功能

- 上传主图或输入商品 URL 抓取候选图
- 选择源语言、目标语言、提示词预设与模型
- 前端输入 API Key，并在浏览器本地保存后直接调用 `https://api.bltcy.ai/v1/images/edits`
- 预览原图和生成图，并复制生成结果 URL
- 含基础 SSRF 防护、文件大小限制

## 开发

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

首次使用时，在页面中输入你的 API Key。密钥会写入浏览器 `localStorage`，不会写入项目环境变量。

## 验证

```bash
npm run lint
npm test
npm run build
```
