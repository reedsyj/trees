# 用户查询处理流程文档

## 概述
当用户在植物推荐系统中输入一条消息后，系统会经过以下步骤处理，最终返回AI回复和相关产品数据。本文档详细说明整个流程。

---

## 📊 完整流程图

```
用户输入 (Query)
    ↓
[步骤1] 输入预处理 & 上下文注入
    ├─ 如果有商品上下文 → 将当前商品名称附加到prompt中
    ├─ 将用户消息添加到对话历史中
    └─ 触发RAG初始化
    ↓
[步骤2] RAG知识库初始化 (首次)
    ├─ 将所有产品的careKnowledge按句子分割成chunks
    ├─ 为每个chunk生成向量embedding (调用阿里云API)
    ├─ 存储到内存知识库中
    └─ 使用LRU缓存加速查询
    ↓
[步骤3] 第一次LLM调用 (意图识别 + 工具选择)
    ├─ 发送请求到阿里云 Qwen LLM API
    ├─ 系统指令 + 对话历史 + 可用工具定义
    ├─ 模型判断是否需要调用工具
    └─ 返回：响应内容 + 工具调用信息
    ↓
[步骤4] 工具调用循环 (最多3轮)
    │
    ├─循环开始─ 如果模型返回 tool_calls
    │    ↓
    │   4.1 根据工具名执行不同操作
    │    │
    │    ├─ searchProducts (产品搜索)
    │    │   ├─ 提取搜索关键词
    │    │   ├─ 关键词拆分 & 去重化处理
    │    │   ├─ 过滤产品列表 (名称/标签/描述匹配)
    │    │   ├─ 应用价格范围过滤
    │    │   ├─ 返回前3个结果
    │    │   └─ 设置 uiType = 'products' (用于前端展示)
    │    │
    │    └─ getCareKnowledge (知识检索)
    │        ├─ 用户查询 → 生成embedding (调用API或使用缓存)
    │        ├─ 与知识库中所有chunks进行余弦相似度计算
    │        ├─ 返回top-2最相关的知识片段
    │        └─ 返回组合后的知识文本
    │    ↓
    │   4.2 将工具结果添加到对话历史
    │    ↓
    │   4.3 第N次LLM调用 (处理工具结果)
    │    │   ├─ 发送工具结果给LLM
    │    │   └─ LLM基于工具结果生成回复
    │    ↓
    │    └─ 返回到循环开始 (检查是否有新的tool_calls)
    │
    └─ 循环结束 (无tool_calls 或超过3轮)
    ↓
[步骤5] 响应处理
    ├─ 提取LLM返回的最终文本
    ├─ 规范化换行符 (删除多余换行)
    ├─ 如果无回复文本但有产品数据 → 使用默认文本
    └─ 收集UI数据 (产品列表)
    ↓
[步骤6] 返回结果给前端
    └─ { 
         text: string,          // AI回复文本
         data: Product[],       // 产品数据
         type: 'products'|null  // UI展示类型
       }
```

---

## 🔍 各步骤详解

### 步骤1: 输入预处理 & 上下文注入

**文件**: `src/services/aiService.ts` - `sendMessage()` 方法

```typescript
async sendMessage(text: string, context?: { currentProductName?: string })
```

**处理逻辑**:
1. 如果用户在浏览某个具体商品（有 `currentProductName`），则注入上下文：
   ```
   [系统提示：用户当前正在浏览商品"龟背竹"，如果用户的问题中包含"这个"、"它"等代词，请默认指代该商品。]
   
   用户输入：多久浇一次水
   ```

2. 无论是否有上下文，都将用户消息添加到 `history` 数组：
   ```typescript
   this.history.push({ 
     role: "user", 
     content: prompt 
   });
   ```

3. **对话历史限制**: 保持最多10条历史消息（LRU策略）

---

### 步骤2: RAG知识库初始化

**文件**: `src/services/ragService.ts` - `initRAG()` 方法

**执行时机**: 每次用户查询时检查，如果未初始化则执行

**初始化步骤**:

1. **数据准备** - 从所有产品生成知识chunks:
   ```typescript
   // 每个产品贡献2类chunks：
   // 1. careKnowledge chunks (按句号分割)
   【龟背竹】龟背竹喜欢温暖湿润的环境...
   【龟背竹】要求排水良好的土壤...
   
   // 2. 宠物友好度信息
   【龟背竹】毒性与宠物友好度：无毒，对猫狗等宠物友好...
   ```

2. **向量化** - 调用阿里云 Embedding API:
   ```
   POST https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings
   model: "text-embedding-v3"
   input: ["【龟背竹】...", ...]
   output: [[0.12, -0.34, ...], ...]  // 3072维向量
   ```

3. **缓存策略**:
   - LRU缓存存储最近100个查询的embedding
   - 避免重复API调用
   - 节省成本和时间

4. **存储**:
   ```typescript
   knowledgeBase = [
     { text: "【龟背竹】养护知识...", embedding: [...] },
     { text: "【龟背竹】宠物友好...", embedding: [...] },
     ...
   ]
   ```

---

### 步骤3: 第一次LLM调用

**文件**: `src/services/aiService.ts` - `callAliyunLLM()` 方法

**API调用**:
```
POST https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
Authorization: Bearer sk-25706075cf2e4e79a3ec50c805d6683c

请求体:
{
  "model": "qwen-plus",
  "messages": [
    {
      "role": "system",
      "content": "【系统指令】你是专业的植物顾问...[识别意图和工具调用规范]"
    },
    {
      "role": "user",
      "content": "[上下文]...[用户输入]"
    },
    // ... 之前的对话历史
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "searchProducts",
        "description": "根据需求搜索产品",
        "parameters": { ... }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "getCareKnowledge",
        "description": "检索养护知识",
        "parameters": { ... }
      }
    }
  ],
  "temperature": 0.7,
  "top_p": 0.8,
  "max_tokens": 2000
}
```

**响应示例**:
```json
{
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "为您推荐几种...",
      "tool_calls": [
        {
          "id": "call_xxx",
          "function": {
            "name": "searchProducts",
            "arguments": "{\"keyword\": \"新手 容易养\"}"
          }
        }
      ]
    }
  }]
}
```

---

### 步骤4.1: searchProducts 工具执行

**触发条件**: 用户查询涉及产品推荐时
- "新手适合养什么" → keyword: "新手"
- "办公室养什么好" → keyword: "办公室"
- "家里有猫能养吗" → keyword: "宠物友好 无毒"

**工具参数**:
```json
{
  "keyword": "新手 容易",      // 可包含多个关键词，用空格/逗号分隔
  "maxPrice": 500,              // 可选：最高价格
  "minPrice": 50               // 可选：最低价格
}
```

**执行逻辑**:

```typescript
// 1. 关键词处理
const keywords = keyword.split(/[\s,，、]+/)  // "新手容易" → ["新手", "容易"]

// 2. 产品匹配过滤
matched = products.filter(p => 
  keywords.some(kw => {
    // 特殊处理：宠物相关关键词
    if (["宠物友好", "无毒", "猫", "狗"].includes(kw)) {
      return p.care.isPetFriendly  // 检查isPetFriendly标记
    }
    
    // 普通关键词多地查找
    return p.name.toLowerCase().includes(kw) ||           // 产品名称
           p.tags.some(t => t.includes(kw)) ||            // 标签
           p.description.includes(kw)                      // 描述
  })
)

// 3. 价格范围过滤
if (maxPrice) matched = matched.filter(p => p.price <= maxPrice)
if (minPrice) matched = matched.filter(p => p.price >= minPrice)

// 4. 结果截断（最多3个）
matched = matched.slice(0, 3)

// 5. 返回结果格式化
toolResult = {
  products: [
    { name: "绿萝", price: 29 },
    { name: "吊兰", price: 39 },
    { name: "虎皮兰", price: 49 }
  ]
}

// 6. 设置前端UI数据
uiData = matched           // 完整产品对象，用于前端展示
uiType = 'products'       // 前端根据此类型渲染产品卡片
```

**性能**: ~100ms (内存中过滤)

---

### 步骤4.2: getCareKnowledge 工具执行

**触发条件**: 用户查询关于特定植物的养护细节
- "这个植物好养吗" → query: "好养程度"
- "多久浇一次水" → query: "浇水频率"
- "适合办公室养吗" → query: "办公室适应性"

**工具参数**:
```json
{
  "query": "多久浇一次水"
}
```

**执行逻辑** (`searchKnowledge` 函数):

```typescript
// 1. 对用户查询进行向量化
let queryEmbedding = embeddingCache.get(query)
if (!queryEmbedding) {
  // 首次查询，调用API获取embedding
  queryEmbedding = await getAliyunEmbedding([query])
  embeddingCache.set(query, queryEmbedding)  // 缓存以供后续使用
}

// 2. 与知识库中所有chunks计算相似度
const similarities = knowledgeBase.map(chunk => ({
  text: chunk.text,
  score: cosineSimilarity(queryEmbedding, chunk.embedding)
}))

// 3. 排序并取top-2
const topResults = similarities
  .sort((a, b) => b.score - a.score)
  .slice(0, topK)  // 默认topK=2

// 4. 返回组合文本
toolResult = {
  retrieved_knowledge: topResults
    .map(r => r.text)
    .join('\n')
}
```

**示例输出**:
```
【龟背竹】龟背竹需要保持土壤湿润，春夏季节每3-5天浇一次水，秋冬季节可以适当减少浇水频次。
【龟背竹】过度浇水容易导致根部腐烂，建议用手指戳入土壤3cm深度检查，感受到干燥再浇水。
```

**性能**: ~2-3秒 (首次包含API调用；缓存命中时~10ms)

---

### 步骤4.3: 工具结果反馈给LLM

**消息格式**:
```typescript
// 将工具结果作为"用户"消息反馈（这是OpenAI Format的标准做法）
this.history.push({
  role: "user",
  content: JSON.stringify({
    tool_call_id: "call_xxx",
    result: toolResult  // searchProducts或getCareKnowledge的结果
  })
})

// 再次调用LLM，让它基于工具结果生成自然语言回复
response = await this.callAliyunLLM([
  { role: "system", content: SYSTEM_INSTRUCTION },
  ...this.history  // 包含最新的工具结果
], true)  // includeTools=true 保留工具定义，允许多轮调用
```

**例子**:
```
用户: "新手适合养什么"
  ↓ [工具调用] searchProducts(keyword="新手")
获取结果: 绿萝、吊兰、龟背竹
  ↓ [反馈给LLM]
LLM生成: "我为您推荐这三种:
  1. 🌿 绿萝 (¥29) - 超级好养，是新手首选...
  2. 🌱 吊兰 (¥39) - 生命力强，几乎不需要打理...
  3. 🎋 龟背竹 (¥49) - 外形美观，养护简单..."
```

---

## 📈 系统架构中的关键概念

### 1. 对话历史管理

```typescript
// 双向缓冲：防止内存无限增长
private history: Array<{ role: string; content: string }> = []
private readonly MAX_HISTORY_SIZE = 10

private trimHistory() {
  if (this.history.length > this.MAX_HISTORY_SIZE) {
    // 只保留最后10条消息 (LRU)
    this.history = this.history.slice(-this.MAX_HISTORY_SIZE)
  }
}
```

**作用**: 
- 保留足够的上下文用于理解对话连贯性
- 防止token消耗过大（降低成本）
- 避免历史污染（旧消息可能造成误导）

---

### 2. 意图识别 (通过系统指令)

系统指令中的4类意图：
```
1. 当前商品咨询 → 触发 getCareKnowledge
2. 商品推荐 → 触发 searchProducts
3. 商品对比 → 触发 searchProducts (多产品)
4. 闲聊 → 不调用工具，直接回复
```

LLM根据用户查询自动选择工具，无需硬编码规则。

---

### 3. 性能优化机制

| 优化点 | 方法 | 效果 |
|--------|------|------|
| **Embedding缓存** | LRU缓存(容量100) | 相同查询时减少API调用 |
| **知识库预生成** | 启动时一次性embedding所有chunks | 查询时无需embedding用户输入 |
| **结果截断** | searchProducts返回前3个 | 减少LLM处理和前端渲染时间 |
| **历史裁剪** | 保持max 10条消息 | 减少API请求体大小 |
| **Timer管理** | activeTimers Set避免重复计时 | 避免console.time重复调用 |
| **单次工具调用** | 只返回第一个tool_call | 减少复杂度 |

---

### 4. 错误处理

```typescript
try {
  // 执行LLM调用和工具调用
  let response = await this.callAliyunLLM(messages, true)
  
  while (response.tool_calls && ...) {
    // 工具调用循环
  }
  
  return { text: responseText, data: uiData, type: uiType }

} catch (error) {
  console.error("Chat Agent Error:", error)
  this.history.pop()  // 回滚用户消息（因为处理失败）
  return { text: "抱歉，AI 服务暂时不可用..." }
}
```

---

## 🎯 典型使用场景

### 场景A: 产品推荐
```
用户输入: "新手适合养什么"
  ↓
LLM识别: 这是"商品推荐"意图
  ↓
调用工具: searchProducts(keyword="新手")
  ↓
返回: [绿萝, 吊兰, 龟背竹]
  ↓
LLM生成: "推荐这3种..."
  ↓
前端收到: { text: "推荐...", data: [{...}, {...}, {...}], type: "products" }
前端展示: ProductCard组件显示3个产品卡片

总耗时: ~800ms (API调用 + 工具执行)
```

---

### 场景B: 养护咨询
```
用户输入: "龟背竹" (浏览产品页)
用户输入: "多久浇一次水"
  ↓
系统注入上下文: 用户当前浏览"龟背竹"
  ↓
LLM识别: 这是"当前商品咨询"意图
  ↓
调用工具: getCareKnowledge(query="浇水频率")
  ↓
RAG检索: 从龟背竹的知识库中检索相关内容
  ↓
返回: "龟背竹需要保持土壤湿润，春夏3-5天浇一次..." (top-2结果组合)
  ↓
LLM生成: "龟背竹应该这样浇水...[更多建议]"
  ↓
前端收到: { text: "龟背竹应该...", data: null, type: null }
前端展示: ChatMessage组件显示文本回复

总耗时: ~3-4s (首次包含embedding API; 缓存命中时~1-2s)
```

---

### 场景C: 多轮对话
```
用户Q1: "有没有无毒的植物"
  ↓
LLM: [调用searchProducts关键词="无毒宠物友好"]
回复A1: "为您找到...卓越的选择"
  ↓
用户Q2: "这些里面哪个最便宜"
  ↓
LLM: 从历史记录中看到之前的推荐，比较价格
回复A2: "吊兰最便宜，只需¥39"  (无需再调用工具)
  ↓
用户Q3: "吊兰在哪买"
  ↓
LLM: 超过3轮工具调用限制 或 不需要工具
回复A3: "可以直接添加到购物车..."
```

---

## ⚙️ 相关API文档

### 阿里云 Qwen API
- **Endpoint**: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
- **模型**: qwen-plus
- **认证**: Bearer Token (已硬编码)
- **参数**:
  - `temperature`: 0.7 (创意性)
  - `top_p`: 0.8 (多样性)
  - `max_tokens`: 2000 (最大输出长度)

### 阿里云 Embedding API
- **Endpoint**: https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings
- **模型**: text-embedding-v3
- **输出维度**: 3072
- **批处理**: 支持多条文本同时embedding

### Function Calling Format
遵循 OpenAI 标准格式：
- 请求中的 `tools` 定义：function name、description、parameters schema
- 响应中的 `tool_calls` 数组：call_id、function name、arguments JSON
- 反馈结果时使用特殊格式的"用户消息"

---

## 📝 代码入口

| 流程 | 代码位置 | 关键方法 |
|------|---------|---------|
| 启动查询 | `src/components/ChatView.tsx` | `handleSend()` |
| 意图识别 & 工具选择 | `src/services/aiService.ts` | `sendMessage()` |
| LLM API调用 | `src/services/aiService.ts` | `callAliyunLLM()` |
| searchProducts执行 | `src/services/aiService.ts` | `sendMessage()` 内部逻辑 |
| getCareKnowledge执行 | `src/services/ragService.ts` | `searchKnowledge()` |
| RAG初始化 | `src/services/ragService.ts` | `initRAG()` |
| Embedding获取 | `src/services/ragService.ts` | `getAliyunEmbedding()` |
| 向量相似度计算 | `src/services/ragService.ts` | `cosineSimilarity()` |

---

## 🔐 关键配置

- **API密钥**: 硬编码在 `aiService.ts` 和 `ragService.ts` 中
- **对话历史上限**: 10条消息 (可调节 MAX_HISTORY_SIZE)
- **工具调用循环次数**: 最多3轮 (可调节 loopCount < 3)
- **embedding缓存大小**: 100条 (可调节 EmbeddingCache.maxSize)
- **检索知识结果**: top-2片段 (可调节 searchKnowledge 的 topK 参数)
- **产品搜索结果**: 最多3个 (可调节 matched.slice(0, 3))

---

## 🚀 性能基准

| 操作 | 耗时 | 备注 |
|------|------|------|
| searchProducts (产品搜索) | ~100ms | 内存过滤，无API调用 |
| getCareKnowledge (命中缓存) | ~10ms | embedding缓存命中 |
| getCareKnowledge (首次查询) | ~2-3s | 包含embedding API调用 |
| LLM第一次调用 | ~1-2s | 主要的网络延迟 |
| LLM后续调用 | ~800ms | 消息体较小 |
| **总体目标** | **3-8s** | 整个查询流程，含2轮工具调用 |

---

## 📊 系统组件依赖图

```
ChatView.tsx (前端UI)
    ↓
sendMessage()
    ├─ initRAG() ────→ getAliyunEmbedding() ────→ 阿里云Embedding API
    │                   searchKnowledge()
    │                       └─ cosineSimilarity() (本地计算)
    │
    ├─ callAliyunLLM() ────→ 阿里云Qwen API
    │
    └─ 工具执行
        ├─ searchProducts() ────→ products.ts (内存数据)
        └─ getCareKnowledge() ──→ searchKnowledge() (RAG)

前端展示
    ├─ text → ChatMessage 组件
    ├─ data (type=products) → ProductCard 列表
    └─ data (type=comparison) → 对比表格
```

---

## 💡 优化建议

1. **数据库集成**: 将 `products.ts` 替换为数据库查询（支持动态更新）
2. **持久化知识库**: 将 embedding 缓存到 Redis（多实例时共享）
3. **异步embedding**: 批量预生成 embedding，后台更新
4. **智能缓存失效**: 基于时间戳或数据版本自动更新
5. **多模态支持**: 支持植物图片输入进行识别
6. **用户个性化**: 存储用户偏好，优化推荐结果
7. **AB测试框架**: 测试不同系统指令和参数组合
8. **实时监控**: 添加性能指标上报，监控API调用费用

---

## 📚 相关文件速查

- **UI组件**: 
  - `src/components/ChatView.tsx` - 聊天界面
  - `src/components/ProductCard.tsx` - 产品卡片
  - `src/components/CareCard.tsx` - 养护建议卡片

- **业务逻辑**:
  - `src/services/aiService.ts` - ChatAgent 核心类
  - `src/services/ragService.ts` - RAG 检索引擎

- **数据**:
  - `src/data/products.ts` - 产品数据 + 养护知识
  - `src/types.ts` - TypeScript 类型定义

---

**文档最后更新**: 2026年4月8日
