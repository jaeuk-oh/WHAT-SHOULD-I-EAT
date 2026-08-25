import React from 'react';
import { Apple, Beef, Egg, Leaf, Milk, Package, Utensils } from 'lucide-react';

export const ItemIcon = ({ category, size = 20 }: { category: string; size?: number }) => {
  switch (category) {
    case '유제품': return <Milk size={size} />;
    case '콩류': return <Package size={size} />;
    case '채소류': return <Leaf size={size} />;
    case '육류': return <Beef size={size} />;
    case '기타': return <Egg size={size} />;
    case '과일': return <Apple size={size} />;
    default: return <Utensils size={size} />;
  }
};
