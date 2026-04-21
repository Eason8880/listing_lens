# 商品信息匹配背景开关设计

## 背景

当前“图片调整”区域包含两个相关能力：

- `提炼图片卖点`：生成后识别图片卖点文字，并在生成 prompt 中要求叠加简短卖点文案。
- `修改商品角度`：要求模型调整商品展示角度。

现状问题有两个：

1. `提炼图片卖点` 的 prompt 同时夹带了“根据卖点调整背景与场景”的语义，导致“叠加卖点文字”和“改造背景”无法独立控制。
2. UI 顺序不符合当前使用优先级，卖点提炼没有放在最前面，也没有单独的背景匹配能力。

本次目标是采用方案 1：新增一个独立勾选项，根据商品信息匹配适合的场景并修改商品图片背景；该能力可单独使用，不依赖卖点提炼，也不叠加卖点文字。

## 目标

- 将 `提炼图片卖点` 调整为“图片调整”区域的第一个选项。
- 在“图片调整”区域最下面新增独立勾选项：`根据商品信息匹配背景`。
- 新勾选项只负责引导模型根据商品本体信息、材质、用途和适合的使用场景来调整背景与环境。
- 当仅勾选新背景选项时，不叠加任何卖点文字。
- 当同时勾选卖点提炼与背景匹配时，两者效果可以叠加。

## 非目标

- 不新增额外的用户输入字段，不让用户手动指定厨房、户外、浴室等背景分类。
- 不增加生成前的单独商品分析接口。
- 不修改现有卖点识别接口、卖点展示面板和生成后卖点翻译流程。
- 不改动图片生成请求协议，只在前端 prompt 组装层增加新参数。

## 方案

### 1. UI 结构

在 `components/listing-lens-app.tsx` 的“图片调整”区域内调整选项顺序：

1. `提炼图片卖点`
2. `修改商品角度`
3. `根据商品信息匹配背景`

新增项文案：

- 标题：`根据商品信息匹配背景`
- 说明：`根据商品用途与属性，匹配更适合的场景背景，不添加卖点文字`

交互规则：

- 该选项为独立布尔开关。
- 不依赖 `提炼图片卖点` 是否开启。
- 不受卖点提炼能力的可用性限制，因为它只影响生成 prompt，不依赖生成后 OCR。

### 2. 状态与数据流

在 `ListingLensApp` 中新增独立状态：

- `matchBackgroundToProductInfo: boolean`

生成流程中，继续由前端直接构建 prompt，并将该布尔值传入 `buildGenerationPrompt()`。

本次不修改 `/api/generate-image` 的接口结构，因为当前服务端接收的仍然只是最终 prompt 和图片文件；新能力只影响 prompt 文本。

### 3. Prompt 设计

在 `lib/prompt.ts` 中将两个能力彻底拆开：

- `extractSellingPoints`
  - 只负责叠加少量卖点关键词或短语。
  - 不再包含“根据卖点调整背景/场景”的说明。
- `matchBackgroundToProductInfo`
  - 单独追加背景匹配指令。
  - 明确要求模型依据商品本体信息、用途、材质、适用环境和消费场景来选择更合适的背景与场景氛围。
  - 明确要求商品主体本身保持不变，只调整背景、道具氛围、环境元素和空间语义。
  - 明确禁止因为背景匹配而添加卖点文字、徽章、标签或参数文案。

推荐指令方向：

- “Choose a background and scene that fit the product’s use case, material, and merchandising context.”
- “Keep the product itself unchanged.”
- “Do not add extra selling-point text or overlay copy unless explicitly requested elsewhere.”

### 4. 组合行为

需要支持以下组合：

- 仅卖点提炼：叠加卖点文字，不强制背景重构。
- 仅背景匹配：改背景，不叠加卖点文字。
- 仅修改角度：改角度，不附带卖点文字或背景改造。
- 卖点提炼 + 背景匹配：同时允许叠加卖点文字和背景改造。

### 5. 测试

优先补 `tests/prompt.test.ts`：

- 新增测试：开启 `matchBackgroundToProductInfo` 时，prompt 包含背景匹配指令和“不添加卖点文字”的约束。
- 新增测试：仅开启 `extractSellingPoints` 时，prompt 仍保留卖点叠加指令，但不再包含背景匹配语义。

UI 层本次不新增组件测试，原因是现有仓库未建立 React 组件测试基础设施；本次主要通过 prompt 单元测试锁定行为，并在页面代码中做最小 UI 调整。

## 风险与处理

### Prompt 语义重叠

风险：
新背景指令可能再次与“保留原构图”或“修改商品角度”的指令出现冲突。

处理：
背景匹配文案只限定“允许调整背景、环境和场景氛围”，不要求必须改变商品角度，也不要求必须重排版式，避免与角度功能重复。

### 用户理解偏差

风险：
用户可能误以为“根据商品信息匹配背景”会自动识别商品卖点并加文案。

处理：
在新增开关的副文案中明确写出“不添加卖点文字”。

## 实施范围

- `components/listing-lens-app.tsx`
- `lib/prompt.ts`
- `tests/prompt.test.ts`

## 验证

- 运行 `node --import tsx --test tests/prompt.test.ts`
- 运行 `npx eslint components/listing-lens-app.tsx lib/prompt.ts tests/prompt.test.ts`
