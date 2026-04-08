import { useState, useRef, useEffect } from 'react';
import { Product, Message } from '../types';
import { ChatAgent } from '../services/aiService';
import { products } from '../data/products';
import { ChevronLeft, Send, Bot, User } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatViewProps {
  isVisible: boolean;
  currentProduct?: Product | null;
  onBack: () => void;
  onProductClick: (product: Product) => void;
}

export default function ChatView({ isVisible, currentProduct, onBack, onProductClick }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '您好！我是官方植物顾问。有什么我可以帮您的吗？',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<ChatAgent | null>(null);

  useEffect(() => {
    agentRef.current = new ChatAgent();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    if (!text.trim() || !agentRef.current) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await agentRef.current.sendMessage(text, {
        currentProductName: currentProduct?.name
      });

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text,
        type: response.type as any,
        data: response.data
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const quickQuestions = currentProduct ? [
    "这个植物好养吗？",
    "多久浇一次水？",
    "适合在办公室养吗？",
    "对猫有毒吗？"
  ] : [
    "绿萝怎么养？",
    "新手适合养什么？",
    "帮我推荐店里的植物",
    "虎皮兰好养吗？"
  ];

  return (
    <div className={`flex-col h-full bg-gray-50 absolute inset-0 z-50 ${isVisible ? 'flex' : 'hidden'}`}>
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center border-b border-gray-100 shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <h2 className="flex-1 text-center font-medium text-gray-800 mr-6">官方客服</h2>
      </div>

      {/* Product Snippet */}
      {currentProduct && (
        <div className="bg-white p-3 flex gap-3 border-b border-gray-100 shrink-0">
          <img src={currentProduct.image} className="w-16 h-16 rounded object-cover" referrerPolicy="no-referrer" />
          <div className="flex flex-col justify-between py-1">
            <p className="text-sm text-gray-800 line-clamp-2">{currentProduct.name} {currentProduct.shortDescription}</p>
            <p className="text-[#e02e24] font-bold text-sm">¥{currentProduct.price}</p>
          </div>
          <button 
            onClick={() => handleSend(`请问关于“${currentProduct.name}”的养护建议？`)}
            className="ml-auto self-center px-3 py-1.5 bg-red-50 text-[#e02e24] text-xs rounded-full border border-red-100"
          >
            发送商品
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-[#e02e24] text-white'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-xl text-sm ${msg.role === 'user' ? 'bg-blue-500 text-white rounded-tr-sm whitespace-pre-wrap' : 'bg-white text-gray-800 shadow-sm rounded-tl-sm border border-gray-100'}`}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:my-1 prose-table:my-2 prose-th:p-2 prose-td:p-2 prose-th:bg-gray-50 prose-table:border prose-table:border-gray-200">
                    <Markdown remarkPlugins={[remarkGfm]}>{msg.content.replace(/\*\*/g, '')}</Markdown>
                  </div>
                )}

                {/* Products */}
                {msg.type === 'products' && (
                  <div className="mt-3 space-y-2">
                    {msg.data.map((p: Product) => (
                      <div key={p.id} onClick={() => onProductClick(p)} className="flex gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100 cursor-pointer">
                        <img src={p.image} alt={p.name} className="w-12 h-12 rounded object-cover" referrerPolicy="no-referrer" />
                        <div className="flex flex-col justify-between">
                          <p className="font-medium text-gray-800 text-xs line-clamp-1">{p.name}</p>
                          <p className="text-[#e02e24] font-bold text-xs">¥{p.price}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-1 rounded-tl-sm">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Quick Questions */}
      <div className="p-2 bg-gray-50 overflow-x-auto whitespace-nowrap scrollbar-hide shrink-0">
        <div className="flex gap-2">
          {quickQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="px-3 py-1.5 bg-white text-gray-700 text-xs rounded-full border border-gray-200 hover:bg-gray-50 shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0 pb-safe">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend(input)}
          placeholder="输入您的问题..."
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={isLoading || !input.trim()}
          className="bg-[#e02e24] text-white w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-50 shrink-0"
        >
          <Send size={16} className="-ml-0.5" />
        </button>
      </div>
    </div>
  );
}
