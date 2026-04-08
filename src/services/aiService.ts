import { products } from "../data/products";
import { initRAG, searchKnowledge } from "./ragService";

// 临时硬编码 API key 进行测试
const ALIYUN_API_KEY = "sk-25706075cf2e4e79a3ec50c805d6683c";
const MODEL_NAME = "qwen-plus";

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

const SYSTEM_INSTRUCTION = `你是一个专业、克制、友好的植物导购与养护助手。

【工作原则】
1. 每一轮都先理解用户意图，必要时调用工具获取事实后再回答。
2. 你的最终回答只能基于当前商品上下文、聊天历史、工具返回结果。
3. 如果工具结果里没有某个细节，明确说“目前我能确认的是……”，不要补充成事实。
4. 不要主动引导用户去追问你手头没有依据展开的内容。
5. 如果用户问“这个/它”之类指代词，请结合当前商品上下文理解。
6. 如果信息不足且无法确定对象，先简短澄清，不要猜。

【回答风格】
1. 使用简体中文。
2. 简洁、自然、有条理。
3. 推荐商品时说明理由。
4. 对比商品时可使用 Markdown 表格。

【工具使用要求】
1. 商品推荐、筛选、对比，优先调用 searchProducts。
2. 某个商品的浇水、光照、难度、宠物友好等问题，调用 getProductCare。
3. 更细的养护知识，调用 searchCareKnowledge。
4. 不要把工具未返回的信息说成已知事实。`;

const tools = [
  {
    name: "searchProducts",
    description: "根据关键词、价格范围等条件搜索店内商品，返回商品结构化信息。",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "搜索关键词，如'新手 办公室 耐阴'、'向日葵 花束'。" },
        maxPrice: { type: "number", description: "最高价格（元）。" },
        minPrice: { type: "number", description: "最低价格（元）。" },
        type: { type: "string", enum: ["plant", "flower"], description: "商品类型。" }
      }
    }
  },
  {
    name: "getProductCare",
    description: "获取某个具体商品的结构化养护信息。",
    parameters: {
      type: "object",
      properties: {
        productName: { type: "string", description: "商品名称，可以是中文名或英文别名。" }
      },
      required: ["productName"]
    }
  },
  {
    name: "searchCareKnowledge",
    description: "检索商品养护知识库，返回相关文本片段。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "要检索的养护问题。" },
        productName: { type: "string", description: "可选。限定到某个商品。" }
      },
      required: ["query"]
    }
  }
];

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

function getProductAliases(productName: string) {
  const chineseAlias = productName.split(" (")[0];
  const englishAlias = (productName.match(/\(([^)]+)\)/)?.[1] || "").toLowerCase();
  return [productName, chineseAlias, englishAlias].filter(Boolean);
}

function findProductByName(name?: string | null) {
  if (!name) return null;
  const normalizedName = normalizeText(name);

  return products.find((product) => {
    const aliases = getProductAliases(product.name).map(normalizeText);
    return aliases.some((alias) => alias.includes(normalizedName) || normalizedName.includes(alias));
  }) || null;
}

function searchProductsData(filters: { keyword?: string; maxPrice?: number; minPrice?: number; type?: string }) {
  const { keyword, maxPrice, minPrice, type } = filters;
  let matched = products;

  if (type === "plant" || type === "flower") {
    matched = matched.filter((product) => product.type === type);
  }

  if (keyword) {
    const keywords = keyword
      .toLowerCase()
      .split(/[\s,，、]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    matched = matched.filter((product) => {
      const searchable = [
        product.name.toLowerCase(),
        product.shortDescription.toLowerCase(),
        product.description.toLowerCase(),
        ...product.tags.map((tag) => tag.toLowerCase()),
        product.care.light.toLowerCase(),
        product.care.water.toLowerCase(),
        product.care.difficulty.toLowerCase(),
        product.care.tips.toLowerCase()
      ];

      return keywords.every((kw) => {
        if (["宠物", "猫", "狗", "宠物友好", "无毒"].includes(kw)) {
          return product.care.isPetFriendly;
        }
        if (["办公室", "办公"].includes(kw)) {
          return product.care.officeFriendly;
        }
        if (["新手", "好养"].includes(kw)) {
          return product.care.difficulty === "简单" || product.tags.includes("新手友好");
        }
        if (["耐阴", "没阳光", "没有阳光"].includes(kw)) {
          return searchable.some((field) => field.includes("耐阴") || field.includes("散射光") || field.includes("半阴"));
        }
        return searchable.some((field) => field.includes(kw));
      });
    });
  }

  if (maxPrice !== undefined) {
    matched = matched.filter((product) => product.price <= maxPrice);
  }

  if (minPrice !== undefined) {
    matched = matched.filter((product) => product.price >= minPrice);
  }

  return matched.slice(0, 5);
}

function getProductCareData(productName: string) {
  const product = findProductByName(productName);
  if (!product) {
    return {
      found: false,
      message: `未找到商品：${productName}`
    };
  }

  return {
    found: true,
    product: {
      id: product.id,
      name: product.name,
      price: product.price,
      type: product.type,
      tags: product.tags,
      shortDescription: product.shortDescription,
      description: product.description,
      care: product.care
    }
  };
}

async function getCareKnowledgeData(query: string, productName?: string) {
  const mergedQuery = productName ? `${productName} ${query}` : query;
  const knowledge = await searchKnowledge(mergedQuery, 2);

  return {
    query: mergedQuery,
    snippets: knowledge
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
  };
}

export class ChatAgent {
  private history: ChatMessage[] = [];
  private readonly MAX_HISTORY_SIZE = 12;

  constructor() {
    if (!ALIYUN_API_KEY) {
      console.error("缺少 VITE_ALIYUN_API_KEY");
    }
  }

  private trimHistory() {
    if (this.history.length > this.MAX_HISTORY_SIZE) {
      this.history = this.history.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  private async callAliyunLLM(messages: ChatMessage[], includeTools = false): Promise<any> {
    const payload: any = {
      model: MODEL_NAME,
      messages,
      temperature: 0.3,
      top_p: 0.8,
      max_tokens: 1200
    };

    if (includeTools) {
      payload.tools = tools.map((tool) => ({
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

  private buildMessages(context?: { currentProductName?: string }) {
    const contextLines: string[] = [];
    if (context?.currentProductName) {
      contextLines.push(`当前浏览商品：${context.currentProductName}`);
      contextLines.push("如果用户使用“这个”“它”等代词，优先理解为当前浏览商品。");
    } else {
      contextLines.push("当前没有明确的商品上下文。");
    }

    return [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "system" as const, content: `[会话上下文]\n${contextLines.join("\n")}` },
      ...this.history
    ];
  }

  async sendMessage(text: string, context?: { currentProductName?: string }): Promise<{ text: string; data?: any; type?: string }> {
    console.time("Total AI Response Time");
    safeConsoleTime("initRAG");
    await initRAG();
    safeConsoleTimeEnd("initRAG");

    this.history.push({
      role: "user",
      content: `[上下文商品] ${context?.currentProductName || "无"}\n[用户输入] ${text}`
    });
    this.trimHistory();

    try {
      safeConsoleTime("LLM First Call");
      let response = await this.callAliyunLLM(this.buildMessages(context), true);
      safeConsoleTimeEnd("LLM First Call");

      let uiData = null;
      let uiType: string | undefined;
      let loopCount = 0;

      while (response.tool_calls && response.tool_calls.length > 0 && loopCount < 4) {
        loopCount += 1;

        this.history.push({
          role: "assistant",
          content: response.content || "[工具调用]"
        });
        this.trimHistory();

        for (const toolCall of response.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments || "{}");
          let toolResult: any = {};

          console.time(`Tool Execution: ${toolName}`);

          if (toolName === "searchProducts") {
            const matched = searchProductsData(toolArgs);
            toolResult = {
              total: matched.length,
              products: matched.map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price,
                type: product.type,
                tags: product.tags,
                shortDescription: product.shortDescription,
                care: product.care
              }))
            };
            uiData = matched;
            uiType = matched.length > 0 ? "products" : undefined;
          } else if (toolName === "getProductCare") {
            const fallbackName = context?.currentProductName;
            toolResult = getProductCareData(toolArgs.productName || fallbackName || "");
          } else if (toolName === "searchCareKnowledge") {
            toolResult = await getCareKnowledgeData(
              toolArgs.query,
              toolArgs.productName || context?.currentProductName
            );
          } else {
            toolResult = { error: `未知工具：${toolName}` };
          }

          console.timeEnd(`Tool Execution: ${toolName}`);

          this.history.push({
            role: "user",
            content: JSON.stringify({
              tool_call_id: toolCall.id,
              tool_name: toolName,
              result: toolResult
            })
          });
          this.trimHistory();
        }

        console.time(`LLM Follow-up Call ${loopCount}`);
        response = await this.callAliyunLLM(this.buildMessages(context), true);
        console.timeEnd(`LLM Follow-up Call ${loopCount}`);
      }

      const responseText = (response.content || "抱歉，我暂时没法给出明确结论。")
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();

      this.history.push({
        role: "assistant",
        content: responseText
      });
      this.trimHistory();

      console.timeEnd("Total AI Response Time");
      return {
        text: responseText,
        data: uiData,
        type: uiType
      };
    } catch (error) {
      console.error("Chat Agent Error:", error);
      console.timeEnd("Total AI Response Time");
      return { text: "抱歉，AI 服务暂时不可用，请稍后再试。" };
    }
  }
}

export async function compareTwoProducts(id1: string, id2: string) {
  const p1 = products.find((p) => p.id === id1);
  const p2 = products.find((p) => p.id === id2);

  if (!p1 || !p2) {
    return { text: "抱歉，我找不到其中一个商品的信息。", type: "text" as const };
  }

  return {
    text: `${p1.name} vs ${p2.name}：\n\n${JSON.stringify({ p1, p2 }, null, 2)}`,
    type: "text" as const
  };
}
