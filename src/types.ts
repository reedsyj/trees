export interface Product {
  id: string;
  name: string;
  price: number;
  image: string;
  shortDescription: string;
  description: string;
  type: 'plant' | 'flower';
  tags: string[];
  care: {
    light: string;
    water: string;
    difficulty: '简单' | '中等' | '困难';
    isPetFriendly: boolean;
    officeFriendly: boolean;
    tips: string;
  };
  careKnowledge?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'products' | 'comparison' | 'care';
  data?: any;
}
