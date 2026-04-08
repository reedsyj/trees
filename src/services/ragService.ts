import { products } from "../data/products";

let knowledgeBase: { text: string; embedding: number[] }[] = [];
let isInitialized = false;
let initPromise: Promise<void> | null = null;

const ALIYUN_API_KEY = "sk-25706075cf2e4e79a3ec50c805d6683c";

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

class EmbeddingCache {
  private cache = new Map<string, number[]>();
  private maxSize = 100;

  get(query: string) {
    return this.cache.get(query);
  }

  set(query: string, embedding: number[]) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(query, embedding);
  }
}

const embeddingCache = new EmbeddingCache();

async function getAliyunEmbedding(texts: string[]): Promise<number[][]> {
  if (!ALIYUN_API_KEY) {
    console.error("缺少 ALIYUN_API_KEY");
    return [];
  }

  try {
    const batchSize = 10;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const response = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Authorization": "Bearer " + ALIYUN_API_KEY
        },
        body: JSON.stringify({
          model: "text-embedding-v3",
          input: batch
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Aliyun API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      if (data.error) {
        throw new Error(`Aliyun API error: ${data.error.message}`);
      }

      embeddings.push(...data.data.map((item: any) => item.embedding));
    }

    return embeddings;
  } catch (error) {
    console.error("Embedding API Error:", error);
    return [];
  }
}

function buildKnowledgeTexts() {
  const texts: string[] = [];

  products.forEach((product) => {
    if (product.careKnowledge) {
      const chunks = product.careKnowledge
        .split(/(?<=[。！？])/)
        .filter((text) => text.trim().length > 5);
      chunks.forEach((chunk) => texts.push(`【${product.name}】${chunk.trim()}`));
    }

    texts.push(
      `【${product.name}】宠物友好度：${product.care.isPetFriendly ? "宠物友好，可作为有猫狗家庭的优先候选。" : "对宠物不太友好，需要避免误食。"}`
    );
  });

  return texts;
}

export async function initRAG() {
  if (isInitialized) return;
  if (initPromise) {
    await initPromise;
    return;
  }

  if (!ALIYUN_API_KEY) {
    console.error("缺少 ALIYUN_API_KEY，无法初始化 RAG");
    return;
  }

  initPromise = (async () => {
    const textsToEmbed = buildKnowledgeTexts();
    if (textsToEmbed.length === 0) return;

    try {
      safeConsoleTime("RAG 初始化 - 获取 embeddings");
      const embeddings = await getAliyunEmbedding(textsToEmbed);
      safeConsoleTimeEnd("RAG 初始化 - 获取 embeddings");

      knowledgeBase = textsToEmbed.map((text, index) => ({
        text,
        embedding: embeddings[index] || []
      })).filter((item) => item.embedding.length > 0);

      isInitialized = knowledgeBase.length > 0;
      console.log("RAG Knowledge Base Initialized with", knowledgeBase.length, "chunks.");
    } catch (error) {
      console.error("Failed to initialize RAG", error);
    } finally {
      initPromise = null;
    }
  })();

  await initPromise;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export async function searchKnowledge(query: string, topK = 2): Promise<string> {
  if (!isInitialized) await initRAG();
  if (knowledgeBase.length === 0) return "暂无知识库数据";
  if (!ALIYUN_API_KEY) return "缺少 API Key";

  try {
    let queryEmbedding = embeddingCache.get(query);

    if (!queryEmbedding) {
      safeConsoleTime("获取查询 embedding");
      const embeddings = await getAliyunEmbedding([query]);
      queryEmbedding = embeddings[0];
      safeConsoleTimeEnd("获取查询 embedding");

      if (queryEmbedding) {
        embeddingCache.set(query, queryEmbedding);
      }
    }

    if (!queryEmbedding || queryEmbedding.length === 0) {
      return "无法获取查询的 embedding";
    }

    const scored = knowledgeBase.map((item) => ({
      text: item.text,
      score: cosineSimilarity(queryEmbedding!, item.embedding)
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((item) => item.text).join("\n");
  } catch (error) {
    console.error("RAG Search Error", error);
    return "检索知识库失败";
  }
}
