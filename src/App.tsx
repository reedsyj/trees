import { useState, useEffect } from 'react';
import { products } from './data/products';
import { Product } from './types';
import ProductCard from './components/ProductCard';
import ChatView from './components/ChatView';
import CareCard from './components/CareCard';
import { initRAG } from './services/ragService';
import { ChevronLeft, MessageSquare, ShoppingCart, Store, Share, CheckCircle2, Search, Home as HomeIcon, User } from 'lucide-react';

type Page = 'home' | 'detail' | 'chat' | 'success';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    // 预加载 RAG 知识库，避免首次对话时卡顿
    initRAG();
  }, []);

  const navigateToDetail = (product: Product) => {
    setSelectedProduct(product);
    setCurrentPage('detail');
    window.scrollTo(0, 0);
  };

  const navigateToHome = () => {
    setCurrentPage('home');
    setSelectedProduct(null);
    window.scrollTo(0, 0);
  };

  const navigateToChat = () => {
    setCurrentPage('chat');
  };

  const handleOrder = () => {
    setCurrentPage('success');
    window.scrollTo(0, 0);
  };

  return (
    <div className="bg-gray-200 min-h-screen flex justify-center font-sans">
      <div className="w-full max-w-[480px] bg-gray-100 min-h-screen relative shadow-2xl flex flex-col overflow-hidden">
        
        {currentPage === 'home' && (
          <div className="flex flex-col h-full overflow-y-auto pb-16">
            {/* Top Search Bar */}
            <div className="bg-white px-3 py-2 sticky top-0 z-10 flex gap-2 items-center">
              <div className="flex-1 bg-gray-100 rounded-full flex items-center px-3 py-1.5">
                <Search size={16} className="text-gray-400 mr-2" />
                <span className="text-gray-400 text-sm">搜索鲜花绿植</span>
              </div>
              <button className="text-gray-600 text-sm font-medium whitespace-nowrap">搜索</button>
            </div>

            {/* Categories */}
            <div className="bg-white py-3 px-2 flex gap-4 overflow-x-auto scrollbar-hide text-sm text-gray-600 border-b border-gray-100">
              <span className="font-bold text-[#e02e24] border-b-2 border-[#e02e24] pb-1 whitespace-nowrap px-2">推荐</span>
              <span className="whitespace-nowrap px-2">绿植盆栽</span>
              <span className="whitespace-nowrap px-2">鲜花速递</span>
              <span className="whitespace-nowrap px-2">多肉植物</span>
              <span className="whitespace-nowrap px-2">园艺用品</span>
            </div>

            {/* Product Grid */}
            <div className="p-2 grid grid-cols-2 gap-2">
              {products.map(product => (
                <ProductCard 
                  key={product.id} 
                  product={product} 
                  onClick={navigateToDetail} 
                />
              ))}
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 w-full max-w-[480px] bg-white border-t border-gray-200 flex justify-around py-2 text-xs text-gray-500 z-20 pb-safe">
              <div className="flex flex-col items-center text-[#e02e24]">
                <HomeIcon size={22} />
                <span>首页</span>
              </div>
              <div className="flex flex-col items-center" onClick={() => { setSelectedProduct(null); navigateToChat(); }}>
                <MessageSquare size={22} />
                <span>客服</span>
              </div>
              <div className="flex flex-col items-center opacity-40 cursor-not-allowed">
                <ShoppingCart size={22} />
                <span>购物车</span>
              </div>
              <div className="flex flex-col items-center opacity-40 cursor-not-allowed">
                <User size={22} />
                <span>个人中心</span>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'detail' && selectedProduct && (
          <div className="flex flex-col h-full overflow-y-auto pb-14 bg-gray-100">
            {/* Back Button */}
            <button 
              onClick={navigateToHome}
              className="absolute top-4 left-4 z-10 w-8 h-8 bg-black/40 rounded-full flex items-center justify-center text-white"
            >
              <ChevronLeft size={20} className="-ml-0.5" />
            </button>

            {/* Image */}
            <div className="w-full aspect-square bg-white">
              <img 
                src={selectedProduct.image} 
                alt={selectedProduct.name} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Price Block */}
            <div className="bg-[#e02e24] text-white px-4 py-3 flex items-baseline gap-1">
              <span className="text-sm">¥</span>
              <span className="text-3xl font-bold">{selectedProduct.price}</span>
              <span className="text-xs ml-2 bg-white/20 px-1.5 py-0.5 rounded">已拼10万+件</span>
            </div>

            {/* Title Block */}
            <div className="bg-white px-4 py-3 mb-2">
              <div className="flex justify-between items-start gap-4">
                <h1 className="text-base font-bold text-gray-800 leading-snug flex-1">
                  {selectedProduct.name} {selectedProduct.shortDescription}
                </h1>
                <button className="flex flex-col items-center text-gray-500 shrink-0 mt-1 opacity-40 cursor-not-allowed">
                  <Share size={18} />
                  <span className="text-[10px] mt-1">分享</span>
                </button>
              </div>
              <div className="flex gap-2 mt-3">
                {selectedProduct.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 bg-red-50 text-[#e02e24] text-[10px] rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Service Tags */}
            <div className="bg-white px-4 py-3 mb-2 flex items-center gap-3 text-xs text-gray-600">
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#e02e24]" /> 退货包运费</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#e02e24]" /> 极速退款</span>
              <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-[#e02e24]" /> 全场包邮</span>
            </div>

            {/* Details */}
            <div className="bg-white p-4 mb-2">
              <h2 className="text-sm font-bold text-gray-800 mb-3">商品详情</h2>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {selectedProduct.description}
              </p>
              
              <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-2">
                <div className="flex"><span className="w-16 text-gray-400">光照</span><span>{selectedProduct.care.light}</span></div>
                <div className="flex"><span className="w-16 text-gray-400">水分</span><span>{selectedProduct.care.water}</span></div>
                <div className="flex"><span className="w-16 text-gray-400">难度</span><span>{selectedProduct.care.difficulty}</span></div>
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="fixed bottom-0 w-full max-w-[480px] bg-white border-t border-gray-200 flex h-14 z-20 pb-safe">
              <div className="flex w-1/3">
                <button className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-40 cursor-not-allowed">
                  <Store size={20} />
                  <span className="text-[10px] mt-0.5">店铺</span>
                </button>
                <button onClick={navigateToChat} className="flex-1 flex flex-col items-center justify-center text-gray-500">
                  <MessageSquare size={20} />
                  <span className="text-[10px] mt-0.5">客服</span>
                </button>
              </div>
              <div className="flex w-2/3">
                <button className="flex-1 bg-[#f4a213] text-white flex flex-col items-center justify-center opacity-60 cursor-not-allowed">
                  <span className="text-sm font-bold">¥{selectedProduct.price + 10}</span>
                  <span className="text-[10px]">单独购买</span>
                </button>
                <button onClick={handleOrder} className="flex-1 bg-[#e02e24] text-white flex flex-col items-center justify-center">
                  <span className="text-sm font-bold">¥{selectedProduct.price}</span>
                  <span className="text-[10px]">发起拼单</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat View is always rendered to preserve state, but hidden when not active */}
        <ChatView 
          isVisible={currentPage === 'chat'}
          currentProduct={selectedProduct} 
          onBack={() => setCurrentPage(selectedProduct ? 'detail' : 'home')} 
          onProductClick={navigateToDetail}
        />

        {currentPage === 'success' && selectedProduct && (
          <div className="flex flex-col h-full overflow-y-auto bg-gray-50 p-4">
            <div className="bg-white rounded-xl p-6 text-center shadow-sm mb-4 mt-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">拼单成功</h2>
              <p className="text-sm text-gray-500">商家将尽快为您发货</p>
            </div>
            
            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2 ml-1">专属养护建议</p>
              <CareCard product={selectedProduct} />
            </div>

            <button 
              onClick={navigateToHome}
              className="w-full py-3 bg-white border border-gray-200 text-gray-700 rounded-full text-sm font-medium mt-4"
            >
              返回首页
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
