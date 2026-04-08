import { products } from "../data/products";
import { searchKnowledge, initRAG } from "./ragService";
// 临时硬编码 API key 进行测试
const ALIYUN_API_KEY = "sk-25706075cf2e4e79a3ec50c805d6683c";

// 确保 API key 是有效的 ASCII 字符串
if (ALIYUN_API_KEY) {
  console.log("API key length:", ALIYUN_API_KEY.length);
  console.log("API key starts with:", ALIYUN_API_KEY.substring(0, 10));
  for (let i = 0; i < ALIYUN_API_KEY.length; i++) {
    if (ALIYUN_API_KEY.charCodeAt(i) > 127) {
      console.error(`API key 位置 ${i} 包含非 ASCII 字符: ${ALIYUN_API_KEY.charAt(i)} (code: ${ALIYUN_API_KEY.charCodeAt(i)})`);
    }
  }
}

// Timer 管理器，避免重复调用
const activeTimers = new Set<string>();

function safeConsoleTime(label: string) {
  if (!activeTimers.has(label)) {
    activeTimers.add(label);
    console.time(label);
  }
}

function safeConsoleTimeEnd(label: string) {
  if (activeTimers.has(label)) {
    activeTimers.delete(label);
    console.timeEnd(label);
  }
}
const MODEL_NAME = "qwen-plus";

const SYSTEM_INSTRUCTION = `你是一个专业的官方植物顾问。请根据用户的意图提供专业、友好的回复。

【核心工作流与意图识别】
1. 当前商品咨询 (如："这个植物好养吗", "多久浇一次水", "适合办公室养吗")
   - 调用 getCareKnowledge 获取该植物的详细养护信息，并给出针对性建议。
2. 商品推荐 (如："新手适合养什么", "办公室养什么好", "没阳光养什么")
   - 调用 searchProducts 工具，将用户需求转化为合适的搜索关键词。
   - 推荐时要说明推荐理由。
3. 商品对比 (如："虎皮兰和绿萝哪个好养")
   - 调用 searchProducts，传入多个植物名称（用空格分隔）。
   - 使用 Markdown 表格输出对比结果。
4. 闲聊 - 热情地打招呼，询问是否需要推荐或建议。

【重要规则】
- 简明且有温度：回复100字左右
- 使用 Markdown 格式输出
- 推荐植物时调用 searchProducts 工具
- 语言自然、亲切，输出结果分点、结构化`;

const tools = [
  {
    name: "searchProducts",
    description: "根据用户的需求搜索店铺内的植物或鲜花商品。",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词，如'绿萝'、'送礼'、'耐阴'等" },
        maxPrice: { type: "number", description: "最高价格限制（元）" },
        minPrice: { type: "number", description: "最低价格限制（元）" }
      }
    }
  },
  {
    name: "getCareKnowledge",
    description: "在知识库中检索关于植物养护的具体知识。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "用户关于养护的具体问题" }
      },
      required: ["query"]
    }
  }
];

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

function findProductByName(name?: string | null) {
  if (!name) return null;
  const normalizedName = normalizeText(name);
  return products.find((product) => {
    const normalizedProductName = normalizeText(product.name);
    const chineseAlias = product.name.split(" (")[0];
    const englishAlias = (product.name.match(/\(([^)]+)\)/)?.[1] || "").toLowerCase();

    return normalizedProductName.includes(normalizedName) ||
      normalizedName.includes(normalizedProductName) ||
      normalizeText(chineseAlias).includes(normalizedName) ||
      normalizedName.includes(normalizeText(chineseAlias)) ||
      (englishAlias && normalizedName.includes(englishAlias));
  }) || null;
}

function findProductsMentioned(text: string) {
  const normalizedText = normalizeText(text);
  return products.filter((product) => {
    const chineseAlias = product.name.split(" (")[0];
    const englishAlias = (product.name.match(/\(([^)]+)\)/)?.[1] || "").toLowerCase();

    return normalizedText.includes(normalizeText(product.name)) ||
      normalizedText.includes(normalizeText(chineseAlias)) ||
      (englishAlias && normalizedText.includes(englishAlias));
  });
}

function formatProductList(productsToFormat: typeof products, title: string, reasons: string[]) {
  const lines = [title, ""];
  productsToFormat.forEach((product, index) => {
    lines.push(`${index + 1}. **${product.name}**，¥${product.price}`);
    lines.push(`推荐理由：${reasons[index] || product.shortDescription}`);
  });
  return lines.join("\n");
}

function compareDifficulty(a: string, b: string) {
  const order = { "简单": 1, "中等": 2, "困难": 3 } as const;
  return (order[a as keyof typeof order] || 99) - (order[b as keyof typeof order] || 99);
}

function compareProductsByText(text: string) {
  const matched = findProductsMentioned(text);
  if (matched.length < 2) return null;

  const [p1, p2] = matched.slice(0, 2);
  const easier = compareDifficulty(p1.care.difficulty, p2.care.difficulty) <= 0 ? p1 : p2;

  return {
    text: `| 维度 | ${p1.name.split(" (")[0]} | ${p2.name.split(" (")[0]} |
|------|------|------|
| 光照 | ${p1.care.light} | ${p2.care.light} |
| 浇水 | ${p1.care.water} | ${p2.care.water} |
| 难度 | ${p1.care.difficulty} | ${p2.care.difficulty} |
| 宠物友好 | ${p1.care.isPetFriendly ? "是" : "否"} | ${p2.care.isPetFriendly ? "是" : "否"} |
| 办公室友好 | ${p1.care.officeFriendly ? "是" : "否"} | ${p2.care.officeFriendly ? "是" : "否"} |
| 价格 | ¥${p1.price} | ¥${p2.price} |

**结论**
- 单看好养程度：**${easier.name.split(" (")[0]}**更省心
- 如果你告诉我使用场景，我还可以继续按“办公室 / 宠物 / 新手”帮你再细分。`,
    type: "comparison" as const
  };
}

function getDeterministicRecommendations(text: string) {
  const normalized = normalizeText(text);

  if (normalized.includes("新手")) {
    const matched = products.filter((product) => product.tags.includes("新手友好")).slice(0, 3);
    return {
      text: formatProductList(matched, "这几款比较适合新手入门：", [
        "好养、耐折腾，基本不容易出错。",
        "耐旱耐阴，浇水频率低，很适合忙一点的人。",
        "体积小、上手简单，放桌面也方便。"
      ]),
      data: matched,
      type: "products" as const
    };
  }

  if (normalized.includes("办公室")) {
    const matched = products.filter((product) => product.care.officeFriendly).slice(0, 3);
    return {
      text: formatProductList(matched, "这几款更适合办公室：", [
        "耐阴、好打理，办公位也能养。",
        "株型大方，适合前台或会议室。",
        "占地小，桌面摆放压力小。"
      ]),
      data: matched,
      type: "products" as const
    };
  }

  if (normalized.includes("没阳光") || normalized.includes("没有阳光") || normalized.includes("耐阴")) {
    const matched = products.filter((product) =>
      product.tags.includes("耐阴") || product.care.officeFriendly
    ).slice(0, 3);
    return {
      text: formatProductList(matched, "如果环境光线一般，可以优先看这几款：", [
        "耐阴能力强，散射光环境就能养。",
        "耐阴又耐旱，养护压力小。",
        "办公和室内角落都比较友好。"
      ]),
      data: matched,
      type: "products" as const
    };
  }

  if (normalized.includes("推荐店里") || normalized.includes("推荐店里的植物") || normalized.includes("店里的植物")) {
    const matched = products.filter((product) => product.type === "plant").slice(0, 3);
    return {
      text: formatProductList(matched, "店里目前比较值得优先看的植物有：", [
        "入门友好，绝大多数人都能养住。",
        "经典耐养款，适合卧室和办公室。",
        "造型感强，适合做家居氛围植物。"
      ]),
      data: matched,
      type: "products" as const
    };
  }

  if (normalized.includes("猫") || normalized.includes("宠物")) {
    const matched = products.filter((product) => product.care.isPetFriendly).slice(0, 3);
    return {
      text: matched.length > 0
        ? formatProductList(matched, "如果家里有猫，可以优先看这几款店内相对友好的：", [
            "店内数据标记为宠物友好，风险相对低。",
            "好养又更适合有宠物的家庭。",
            "摆在家里更省心一些。"
          ])
        : "店里目前没有明确标记为宠物友好的植物。",
      data: matched,
      type: matched.length > 0 ? "products" as const : undefined
    };
  }

  return null;
}

async function buildCurrentProductReply(text: string, currentProductName: string) {
  const product = findProductByName(currentProductName);
  if (!product) return null;

  const normalized = normalizeText(text);
  const productShortName = product.name.split(" (")[0];

  if (normalized.includes("好养")) {
    const knowledge = await searchKnowledge(`${productShortName} 好养 养护 新手`, 2);
    return {
      text: `**${productShortName}**${product.care.difficulty === "简单" ? "比较好养" : "养护要求中等"}。\n\n- 光照：${product.care.light}\n- 浇水：${product.care.water}\n- 难度：${product.care.difficulty}\n\n补充建议：${knowledge}`,
      type: "care" as const
    };
  }

  if (normalized.includes("浇") || normalized.includes("水")) {
    return {
      text: `**${productShortName}**的浇水建议：${product.care.water}。\n\n如果你愿意，我还可以继续告诉你它在夏天和冬天分别怎么浇更稳。`,
      type: "care" as const
    };
  }

  if (normalized.includes("办公室")) {
    return {
      text: `**${productShortName}**${product.care.officeFriendly ? "适合" : "不太建议"}放办公室养。\n\n- 办公室友好：${product.care.officeFriendly ? "是" : "否"}\n- 光照需求：${product.care.light}\n- 养护难度：${product.care.difficulty}`,
      type: "care" as const
    };
  }

  if (normalized.includes("猫") || normalized.includes("狗") || normalized.includes("宠物") || normalized.includes("有毒")) {
    return {
      text: `**${productShortName}**对宠物${product.care.isPetFriendly ? "相对友好" : "不太友好"}。\n\n- 宠物友好：${product.care.isPetFriendly ? "是" : "否"}\n- 养护提示：${product.care.tips}`,
      type: "care" as const
    };
  }

  return null;
}

export class ChatAgent {
  private history: Array<{ role: string; content: string }> = [];
  private readonly MAX_HISTORY_SIZE = 10;

  constructor() {
    if (!ALIYUN_API_KEY) {
      console.error("缺少 VITE_ALIYUN_API_KEY");
    }
    this.history = [];
  }

  private trimHistory() {
    if (this.history.length > this.MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  private async callAliyunLLM(messages: any[], includeTools: boolean = false): Promise<any> {
    const payload: any = {
      model: MODEL_NAME,
      messages: messages,
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 2000
    };

    if (includeTools) {
      payload.tools = tools.map(tool => ({
        type: "function",
        function: tool
      }));
    }

    const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": "Bearer " + ALIYUN_API_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Aliyun API error: ${response.status}`);
    }

    const data = await response.json() as any;

    if (data.error) {
      throw new Error(`Aliyun API error: ${data.error.message}`);
    }

    return data.choices[0].message;
  }

  async sendMessage(text: string, context?: { currentProductName?: string }): Promise<{ text: string, data?: any, type?: string }> {
    console.time("Total AI Response Time");
    safeConsoleTime("initRAG");
    await initRAG();
    safeConsoleTimeEnd("initRAG");

    const currentProductReply = context?.currentProductName
      ? await buildCurrentProductReply(text, context.currentProductName)
      : null;
    if (currentProductReply) {
      console.timeEnd("Total AI Response Time");
      return currentProductReply;
    }

    const comparisonReply = compareProductsByText(text);
    if (comparisonReply) {
      console.timeEnd("Total AI Response Time");
      return comparisonReply;
    }

    const deterministicReply = getDeterministicRecommendations(text);
    if (deterministicReply) {
      console.timeEnd("Total AI Response Time");
      return deterministicReply;
    }

    let prompt = text;
    if (context?.currentProductName) {
      prompt = `[系统提示：用户当前正在浏览商品"${context.currentProductName}"，如果用户的问题中包含"这个"、"它"等代词，请默认指代该商品。]\n\n用户输入：${text}`;
    }

    this.history.push({ role: "user", content: prompt });
    this.trimHistory();

    try {
      safeConsoleTime("LLM First Call (Intent & Tool Selection)");

      const messages = [
        { role: "system", content: SYSTEM_INSTRUCTION },
        ...this.history
      ];

      let response = await this.callAliyunLLM(messages, true);

      safeConsoleTimeEnd("LLM First Call (Intent & Tool Selection)");

      let uiData = null;
      let uiType = null;
      let loopCount = 0;

      // 处理 tool_calls 循环
      while (response.tool_calls && response.tool_calls.length > 0 && loopCount < 3) {
        loopCount++;

        // 添加助手响应到历史
        this.history.push({
          role: "assistant",
          content: response.content || ""
        });

        const toolCall = response.tool_calls[0];
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        let toolResult: any = {};

        console.time(`Tool Execution: ${toolName}`);
        if (toolName === "searchProducts") {
          const keyword = toolArgs.keyword?.toLowerCase() || "";
          const maxPrice = toolArgs.maxPrice;
          const minPrice = toolArgs.minPrice;

          let matched = products;

          if (keyword) {
            const keywords = keyword.split(/[\s,，、]+/);
            matched = matched.filter(p =>
              keywords.some((kw: string) => {
                const isPetQuery = ["宠物友好", "无毒", "猫", "狗", "宠物"].includes(kw);
                if (isPetQuery && p.care.isPetFriendly) return true;

                return p.name.toLowerCase().includes(kw) ||
                       p.tags.some(t => t.includes(kw)) ||
                       p.description.includes(kw);
              })
            );
          }

          if (maxPrice !== undefined) {
            matched = matched.filter(p => p.price <= maxPrice);
          }

          if (minPrice !== undefined) {
            matched = matched.filter(p => p.price >= minPrice);
          }

          matched = matched.slice(0, 3);
          toolResult = { products: matched.map(p => ({ name: p.name, price: p.price })) };

          uiData = matched;
          uiType = matched.length > 0 ? "products" : null;
        }
        else if (toolName === "getCareKnowledge") {
          const knowledge = await searchKnowledge(toolArgs.query, 2);
          toolResult = { retrieved_knowledge: knowledge };
        }
        console.timeEnd(`Tool Execution: ${toolName}`);

        // 添加工具结果到历史
        this.history.push({
          role: "user",
          content: JSON.stringify({
            tool_call_id: toolCall.id,
            result: toolResult
          })
        });
        this.trimHistory();

        console.time(`LLM Follow-up Call ${loopCount}`);
        response = await this.callAliyunLLM([
          { role: "system", content: SYSTEM_INSTRUCTION },
          ...this.history
        ], true);
        console.timeEnd(`LLM Follow-up Call ${loopCount}`);
      }

      // 添加最终响应到历史
      this.history.push({
        role: "assistant",
        content: response.content || ""
      });
      this.trimHistory();

      let responseText = response.content || "";
      responseText = responseText.replace(/\n\s*\n\s*\n/g, "\n\n").trim();

      if (!responseText && uiType === "products") {
        responseText = "为您找到以下商品：";
      } else if (!responseText) {
        responseText = "抱歉，我没有理解您的意思。";
      }

      console.timeEnd("Total AI Response Time");
      return {
        text: responseText,
        data: uiData,
        type: uiType || undefined
      };

    } catch (error) {
      console.error("Chat Agent Error:", error);
      this.history.pop();
      console.timeEnd("Total AI Response Time");
      return { text: "抱歉，AI 服务暂时不可用，请稍后再试。" };
    }
  }
}

// 商品对比逻辑
export async function compareTwoProducts(id1: string, id2: string) {
  const p1 = products.find(p => p.id === id1);
  const p2 = products.find(p => p.id === id2);

  if (!p1 || !p2) return { text: "抱歉，我找不到其中一个商品的信息。", type: "text" as const };

  const comparisonData = {
    p1: {
      name: p1.name,
      light: p1.care.light,
      water: p1.care.water,
      difficulty: p1.care.difficulty,
      price: p1.price,
      tags: p1.tags.join(", ")
    },
    p2: {
      name: p2.name,
      light: p2.care.light,
      water: p2.care.water,
      difficulty: p2.care.difficulty,
      price: p2.price,
      tags: p2.tags.join(", ")
    }
  };

  return {
    text: `${p1.name} vs ${p2.name}：\n\n${JSON.stringify(comparisonData, null, 2)}`,
    type: "text" as const
  };
}
