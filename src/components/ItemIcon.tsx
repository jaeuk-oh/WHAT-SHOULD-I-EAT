import React from 'react';
import { Apple, Beef, Egg, Leaf, Milk, Package, Utensils } from 'lucide-react';

export const ItemIcon = ({ category }: { category: string }) => {
  switch (category) {
    case '유제품': return <Milk size={20} />;
    case '콩류': return <Package size={20} />;
    case '채소류': return <Leaf size={20} />;
    case '육류': return <Beef size={20} />;
    case '기타': return <Egg size={20} />;
    case '과일': return <Apple size={20} />;
    default: return <Utensils size={20} />;
  }
};
