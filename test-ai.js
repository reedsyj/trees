import { ChatAgent } from './src/services/aiService.ts';

const testMessages = [
  '这个植物好养吗',
  '多久浇一次水',
  '适合办公室养吗',
  '新手适合养什么',
  '办公室养什么好',
  '没阳光养什么',
  '帮我推荐店里的植物',
  '家里有猫能养吗',
  '虎皮兰和绿萝哪个好养',
  '龟背竹和发财树有什么区别'
];

async function testAI() {
  console.log('开始测试 AI 回复...\n');

  const agent = new ChatAgent();

  for (let i = 0; i < testMessages.length; i++) {
    const message = testMessages[i];
    console.log(`\n=== 测试 ${i + 1}: ${message} ===`);

    try {
      const startTime = Date.now();
      const response = await agent.sendMessage(message);
      const endTime = Date.now();

      console.log(`回复: ${response.text}`);
      console.log(`耗时: ${endTime - startTime}ms`);

      if (response.data) {
        console.log(`数据: ${JSON.stringify(response.data, null, 2)}`);
      }

    } catch (error) {
      console.error(`错误: ${error.message}`);
    }
  }

  console.log('\n测试完成！');
}

// 运行测试
testAI().catch(console.error);