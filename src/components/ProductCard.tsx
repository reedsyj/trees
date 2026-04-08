import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onClick: (product: Product) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onClick }) => {
  return (
    <div 
      onClick={() => onClick(product)}
      className="bg-white rounded-lg overflow-hidden cursor-pointer"
    >
      <img 
        src={product.image} 
        alt={product.name} 
        className="w-full aspect-square object-cover"
        referrerPolicy="no-referrer"
      />
      <div className="p-2">
        <h3 className="text-[13px] text-gray-800 line-clamp-2 leading-snug">
          {product.name} {product.shortDescription}
        </h3>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-[#e02e24] text-xs font-bold">¥</span>
          <span className="text-[#e02e24] text-lg font-bold leading-none">{product.price}</span>
          <span className="text-gray-400 text-[10px] ml-1">已拼10万+件</span>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
