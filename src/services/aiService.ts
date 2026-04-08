import { products } from "../data/products";
import { initRAG, searchKnowledge } from "./ragService";

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

const SYSTEM_INSTRUCTION = `你是一位专业、亲切、有温度的植物顾问。

你的回答要求：
1. 简洁自然，像真人顾问，不要像客服模板。
2. 优先依据提供的事实回答，不要编造店里没有的信息。
3. 如果是推荐，先给一句总建议，再推荐 2-3 款，并说明理由。
4. 如果是单个植物问题，只围绕这个植物回答，不要跑去推荐别的植物。
5. 如果是对比问题，可以用 Markdown 表格，但整体仍要简洁。`;

const TOOLS = [
  {
    name: "searchProducts",
    description: "根据用户需求搜索店内商品。",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string" },
        maxPrice: { type: "number" },
        minPrice: { type: "number" }
      }
    }
  },
  {
    name: "getCareKnowledge",
    description: "检索植物养护知识。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    }
  }
];

type ReplyType = "products" | "comparison" | "care";

type ResolvedReply = {
  factsPrompt: string;
  data?: any;
  type?: ReplyType;
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

function getProductShortName(name: string): string {
  return name.split(" (")[0];
}

function findProductByName(name?: string | null) {
  if (!name) return null;
  const normalizedName = normalizeText(name);

  return products.find((product) => {
    const full = normalizeText(product.name);
    const short = normalizeText(getProductShortName(product.name));
    const english = (product.name.match(/\(([^)]+)\)/)?.[1] || "").toLowerCase();

    return full.includes(normalizedName) ||
      normalizedName.includes(full) ||
      short.includes(normalizedName) ||
      normalizedName.includes(short) ||
      (english ? normalizedName.includes(english) : false);
  }) || null;
}

function findProductsMentioned(text: string) {
  const normalizedText = normalizeText(text);
  return products.filter((product) => {
    const full = normalizeText(product.name);
    const short = normalizeText(getProductShortName(product.name));
    const english = (product.name.match(/\(([^)]+)\)/)?.[1] || "").toLowerCase();

    return normalizedText.includes(full) ||
      normalizedText.includes(short) ||
      (english ? normalizedText.includes(english) : false);
  });
}

function compareDifficulty(a: string, b: string) {
  const order = { "简单": 1, "中等": 2, "困难": 3 } as const;
  return (order[a as keyof typeof order] || 99) - (order[b as keyof typeof order] || 99);
}

function getEaseScore(product: typeof products[number]) {
  let score = 0;
  score -= compareDifficulty(product.care.difficulty, "简单");

  const water = product.care.water;
  if (water.includes("每月") || water.includes("15-20天")) score += 2;
  if (water.includes("宁干勿湿") || water.includes("耐旱")) score += 2;
  if (water.includes("见干见湿")) score += 1;
  if (water.includes("保持盆土微湿") || water.includes("经常")) score -= 2;

  const light = product.care.light;
  if (light.includes("全日照至半阴均可") || light.includes("适应性强")) score += 2;
  if (light.includes("半阴环境")) score += 1;
  if (light.includes("明亮的散射光")) score -= 1;

  return score;
}

function isSingleProductQuestion(text: string) {
  const normalized = normalizeText(text);
  return [
    "好养",
    "浇",
    "水",
    "办公室",
    "猫",
    "狗",
    "宠物",
    "有毒",
    "适合"
  ].some((keyword) => normalized.includes(keyword));
}

async function buildSingleProductReply(text: string, productName: string): Promise<ResolvedReply | null> {
  const product = findProductByName(productName);
  if (!product || !isSingleProductQuestion(text)) return null;

  const knowledge = await searchKnowledge(`${getProductShortName(product.name)} ${text}`, 2);
  return {
    factsPrompt: `任务：回答单个植物问题。
用户问题：${text}
目标植物：${product.name}
已知事实：
- 光照：${product.care.light}
- 浇水：${product.care.water}
- 难度：${product.care.difficulty}
- 宠物友好：${product.care.isPetFriendly ? "是" : "否"}
- 办公室友好：${product.care.officeFriendly ? "是" : "否"}
- 养护提示：${product.care.tips}
- 补充知识：${knowledge}
要求：
1. 只回答这个植物，不推荐别的植物。
2. 语气像植物顾问，亲切自然，简洁有温度。
3. 100字左右，必要时补一句实用建议。
4. 不要编造未提供的数据。`,
    type: "care"
  };
}

function buildComparisonReply(text: string): ResolvedReply | null {
  const matched = findProductsMentioned(text);
  if (matched.length < 2) return null;

  const [p1, p2] = matched.slice(0, 2);
  const easier = getEaseScore(p1) >= getEaseScore(p2) ? p1 : p2;

  return {
    factsPrompt: `任务：回答两个植物的对比问题。
用户问题：${text}
对比对象：
- ${p1.name}：光照=${p1.care.light}；浇水=${p1.care.water}；难度=${p1.care.difficulty}；宠物友好=${p1.care.isPetFriendly ? "是" : "否"}；办公室友好=${p1.care.officeFriendly ? "是" : "否"}；价格=¥${p1.price}
- ${p2.name}：光照=${p2.care.light}；浇水=${p2.care.water}；难度=${p2.care.difficulty}；宠物友好=${p2.care.isPetFriendly ? "是" : "否"}；办公室友好=${p2.care.officeFriendly ? "是" : "否"}；价格=¥${p2.price}
更省心的一般是：${getProductShortName(easier.name)}
要求：
1. 可以用 Markdown 表格。
2. 先对比，再给一句结论。
3. 只依据这些事实，不要扩展毒性等级等未给出的信息。`,
    type: "comparison"
  };
}

function buildRecommendationReply(text: string): ResolvedReply | null {
  const normalized = normalizeText(text);
  let matched: typeof products = [];
  let scene = "";

  if (normalized.includes("新手")) {
    matched = products.filter((product) => product.tags.includes("新手友好")).slice(0, 3);
    scene = "新手入门";
  } else if (normalized.includes("办公室")) {
    matched = products.filter((product) => product.care.officeFriendly).slice(0, 3);
    scene = "办公室摆放";
  } else if (normalized.includes("没阳光") || normalized.includes("没有阳光") || normalized.includes("耐阴")) {
    matched = products.filter((product) =>
      product.tags.includes("耐阴") || product.care.officeFriendly
    ).slice(0, 3);
    scene = "光线较弱环境";
  } else if (normalized.includes("推荐店里") || normalized.includes("推荐店里的植物") || normalized.includes("店里的植物")) {
    matched = products.filter((product) => product.type === "plant").slice(0, 3);
    scene = "店内植物推荐";
  } else if (normalized.includes("猫") || normalized.includes("宠物")) {
    matched = products.filter((product) => product.care.isPetFriendly).slice(0, 3);
    scene = "有猫或有宠物的家庭";
  }

  if (!matched.length) return null;

  const facts = matched.map((product) =>
    `- ${product.name}：价格=¥${product.price}；标签=${product.tags.join("、")}；光照=${product.care.light}；浇水=${product.care.water}；难度=${product.care.difficulty}；宠物友好=${product.care.isPetFriendly ? "是" : "否"}；办公室友好=${product.care.officeFriendly ? "是" : "否"}`
  ).join("\n");

  return {
    factsPrompt: `任务：根据商品事实做推荐回答。
用户问题：${text}
推荐场景：${scene}
候选商品：
${facts}
要求：
1. 最终语气像亲切的植物顾问。
2. 先给一句总建议，再推荐 2-3 款。
3. 每款用一句话说明理由。
4. 只依据提供的事实，不要编造店外信息。`,
    data: matched,
    type: "products"
  };
}

async function resolveLocalReply(text: string, context?: { currentProductName?: string }): Promise<ResolvedReply | null> {
  if (context?.currentProductName) {
    const reply = await buildSingleProductReply(text, context.currentProductName);
    if (reply) return reply;
  }

  const mentioned = findProductsMentioned(text);
  if (mentioned.length === 1) {
    const reply = await buildSingleProductReply(text, mentioned[0].name);
    if (reply) return reply;
  }

  const comparisonReply = buildComparisonReply(text);
  if (comparisonReply) return comparisonReply;

  return buildRecommendationReply(text);
}

export class ChatAgent {
  private history: Array<{ role: string; content: string }> = [];
  private readonly MAX_HISTORY_SIZE = 10;

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

  private async callAliyunLLM(messages: any[], includeTools = false): Promise<any> {
    const payload: any = {
      model: MODEL_NAME,
      messages,
      temperature: 0.7,
      top_p: 0.8,
      max_tokens: 1200
    };

    if (includeTools) {
      payload.tools = TOOLS.map((tool) => ({
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

  private async synthesizeReply(localReply: ResolvedReply) {
    const response = await this.callAliyunLLM([
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content: localReply.factsPrompt }
    ], false);

    const text = (response.content || "").trim();
    return {
      text: text || "我先根据现有信息给你整理了一下，有需要我可以继续细讲。",
      data: localReply.data,
      type: localReply.type
    };
  }

  async sendMessage(text: string, context?: { currentProductName?: string }): Promise<{ text: string; data?: any; type?: string }> {
    console.time("Total AI Response Time");
    safeConsoleTime("initRAG");
    await initRAG();
    safeConsoleTimeEnd("initRAG");

    try {
      const localReply = await resolveLocalReply(text, context);
      if (localReply) {
        const synthesized = await this.synthesizeReply(localReply);
        console.timeEnd("Total AI Response Time");
        return synthesized;
      }

      let prompt = text;
      if (context?.currentProductName) {
        prompt = `[系统提示：用户当前正在浏览商品"${context.currentProductName}"，如果用户的问题里有“这个”“它”等代词，默认指向该商品。]\n\n用户输入：${text}`;
      }

      this.history.push({ role: "user", content: prompt });
      this.trimHistory();

      safeConsoleTime("LLM First Call (Intent & Tool Selection)");
      const messages = [
        { role: "system", content: SYSTEM_INSTRUCTION },
        ...this.history
      ];
      let response = await this.callAliyunLLM(messages, true);
      safeConsoleTimeEnd("LLM First Call (Intent & Tool Selection)");

      let uiData = null;
      let uiType: string | null = null;
      let loopCount = 0;

      while (response.tool_calls && response.tool_calls.length > 0 && loopCount < 3) {
        loopCount++;
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
            matched = matched.filter((product) =>
              keywords.some((kw: string) => {
                const isPetQuery = ["宠物友好", "无毒", "猫", "狗", "宠物"].includes(kw);
                if (isPetQuery && product.care.isPetFriendly) return true;

                return product.name.toLowerCase().includes(kw) ||
                  product.tags.some((tag) => tag.includes(kw)) ||
                  product.description.includes(kw);
              })
            );
          }

          if (maxPrice !== undefined) matched = matched.filter((product) => product.price <= maxPrice);
          if (minPrice !== undefined) matched = matched.filter((product) => product.price >= minPrice);

          matched = matched.slice(0, 3);
          toolResult = { products: matched.map((product) => ({ name: product.name, price: product.price })) };
          uiData = matched;
          uiType = matched.length > 0 ? "products" : null;
        } else if (toolName === "getCareKnowledge") {
          const knowledge = await searchKnowledge(toolArgs.query, 2);
          toolResult = { retrieved_knowledge: knowledge };
        }
        console.timeEnd(`Tool Execution: ${toolName}`);

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

      this.history.push({
        role: "assistant",
        content: response.content || ""
      });
      this.trimHistory();

      let responseText = (response.content || "").replace(/\n\s*\n\s*\n/g, "\n\n").trim();
      if (!responseText && uiType === "products") {
        responseText = "我先帮你筛了几款，你看看有没有喜欢的。";
      } else if (!responseText) {
        responseText = "我先没完全理解你的意思，你可以再换一种说法问我。";
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
      return { text: "抱歉，AI 服务暂时有点忙，你稍后再试试，我还在这儿。" };
    }
  }
}

export async function compareTwoProducts(id1: string, id2: string) {
  const p1 = products.find((product) => product.id === id1);
  const p2 = products.find((product) => product.id === id2);

  if (!p1 || !p2) {
    return { text: "抱歉，我没找到其中一个商品的信息。", type: "text" as const };
  }

  return {
    text: `${p1.name} vs ${p2.name}`,
    type: "text" as const
  };
}
