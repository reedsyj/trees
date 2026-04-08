import { Product } from '../types';
import { Sun, Droplets, Thermometer, Info } from 'lucide-react';

interface CareCardProps {
  product: Product;
}

export default function CareCard({ product }: CareCardProps) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-800 mb-3 text-sm border-b border-gray-50 pb-2">
        {product.name} 养护指南
      </h3>

      <div className="space-y-3">
        <div className="flex gap-3 items-start">
          <div className="bg-amber-50 p-1.5 rounded text-amber-600 shrink-0">
            <Sun size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-700">光照</p>
            <p className="text-xs text-gray-500 mt-0.5">{product.care.light}</p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="bg-blue-50 p-1.5 rounded text-blue-600 shrink-0">
            <Droplets size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-700">浇水</p>
            <p className="text-xs text-gray-500 mt-0.5">{product.care.water}</p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="bg-green-50 p-1.5 rounded text-green-600 shrink-0">
            <Thermometer size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-700">难度</p>
            <p className="text-xs text-gray-500 mt-0.5">{product.care.difficulty}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-1 text-gray-700 font-bold mb-1 text-xs">
          <Info size={14} />
          <span>小贴士</span>
        </div>
        <p className="text-gray-500 text-xs">
          {product.care.tips}
        </p>
      </div>
    </div>
  );
}
