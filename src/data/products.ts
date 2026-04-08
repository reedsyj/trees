import { Product } from '../types';

export const products: Product[] = [
  {
    id: '1',
    name: '绿萝 (Pothos)',
    price: 29,
    image: 'https://images.unsplash.com/photo-1604762524889-3e2fcc145683?auto=format&fit=crop&q=80&w=400',
    shortDescription: '生命力极强，净化空气的首选。',
    description: '绿萝是非常受欢迎的室内植物，不仅美观而且极易养护。它能有效吸收室内的甲醛、苯等有害气体，是新房装修后的理想选择。',
    type: 'plant',
    tags: ['新手友好', '净化空气', '耐阴', '办公室'],
    care: {
      light: '半阴环境，避开强光直射',
      water: '见干见湿，夏季增加喷水',
      difficulty: '简单',
      isPetFriendly: false,
      officeFriendly: true,
      tips: '如果叶子变黄，可能是浇水过多或光照太强。'
    },
    careKnowledge: '绿萝（学名：Epipremnum aureum）属于天南星科大型常绿藤本植物。它非常耐阴，适合在室内散射光下生长，强光直射会灼伤叶片。浇水需遵循“见干见湿”原则，夏季水分蒸发快，可适当增加浇水频率，并经常向叶面喷水以增加空气湿度。冬季应减少浇水，保持盆土微偏干。如果发现绿萝叶子发黄，通常是因为浇水过多导致烂根，或者长期处于阴暗角落缺乏必要的光照。此时应剪去黄叶，将盆栽移至通风且有明亮散射光的地方，暂停浇水直到盆土干透。'
  },
  {
    id: '2',
    name: '虎皮兰 (Snake Plant)',
    price: 45,
    image: 'https://images.unsplash.com/photo-1593482892290-f54927ae1bb6?auto=format&fit=crop&q=80&w=400',
    shortDescription: '“天然清道夫”，耐旱且耐阴。',
    description: '虎皮兰品种多样，叶片坚挺直立，具有很高的观赏价值。它在夜间也能释放氧气，非常适合摆放在卧室。',
    type: 'plant',
    tags: ['新手友好', '耐旱', '净化空气', '卧室'],
    care: {
      light: '适应性强，全日照至半阴均可',
      water: '宁干勿湿，每月浇水1-2次即可',
      difficulty: '简单',
      isPetFriendly: false,
      officeFriendly: true,
      tips: '最怕积水，冬天要严格控水。'
    },
    careKnowledge: '虎皮兰（Sansevieria trifasciata）是百合科虎尾兰属的多年生草本观叶植物。它极其耐旱，根系较浅，最怕积水烂根。浇水一定要等盆土完全干透后再浇，宁干勿湿。虎皮兰对光照适应性极强，既能在阳光充足处生长，也能耐半阴，但长期缺乏光照会导致叶片斑纹变暗。如果虎皮兰叶片发软倒伏，多半是浇水过频或盆土排水不良导致的根系腐烂，需立即脱盆修根，换上疏松透气的沙质土壤重新栽种。'
  },
  {
    id: '3',
    name: '龟背竹 (Monstera)',
    price: 88,
    image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&q=80&w=400',
    shortDescription: '北欧风标配，巨大的开窗叶片。',
    description: '龟背竹以其独特的叶片开窗而闻名，是打造室内“小森林”感的不二之选。它喜欢温暖潮湿的环境。',
    type: 'plant',
    tags: ['网红植物', '大叶', '喜湿'],
    care: {
      light: '明亮的散射光',
      water: '保持盆土微湿，经常向叶片喷雾',
      difficulty: '中等',
      isPetFriendly: false,
      officeFriendly: false,
      tips: '叶片上的灰尘要定期擦拭，有利于光合作用。'
    },
    careKnowledge: '龟背竹（Monstera deliciosa）是天南星科龟背竹属植物。它喜欢温暖湿润、半阴且通风良好的环境。龟背竹对水分要求较高，生长期需保持盆土湿润，但忌积水。空气干燥时，叶尖容易干枯发黄，因此需要经常向叶面及周围环境喷水保湿。它不耐寒，冬季需保持在10℃以上。如果龟背竹出现叶片发黄干枯，首先检查是否空气过于干燥，其次检查是否受到强光直射或盆土积水烂根。'
  },
  {
    id: '4',
    name: '发财树 (Money Tree)',
    price: 128,
    image: 'https://images.unsplash.com/photo-1599598425947-330026293905?auto=format&fit=crop&q=80&w=400',
    shortDescription: '寓意美好，办公室开业首选。',
    description: '发财树树干粗壮，叶片翠绿，寓意财源广进。它是非常经典的商务礼品植物。',
    type: 'plant',
    tags: ['寓意好', '送礼', '办公室'],
    care: {
      light: '明亮的散射光，忌暴晒',
      water: '耐旱，每15-20天浇一次透水',
      difficulty: '简单',
      isPetFriendly: true,
      officeFriendly: true,
      tips: '注意通风，避免环境过于闷热。'
    }
  },
  {
    id: '5',
    name: '琴叶榕 (Fiddle Leaf Fig)',
    price: 199,
    image: 'https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&q=80&w=400',
    shortDescription: '高端室内装饰，叶片如提琴。',
    description: '琴叶榕是室内设计的宠儿，巨大的叶片非常有质感。但它对环境比较挑剔，需要一定的养护经验。',
    type: 'plant',
    tags: ['高端', '大叶', '挑剔'],
    care: {
      light: '充足的散射光，每天至少4小时',
      water: '土表干2-3厘米后浇透',
      difficulty: '困难',
      isPetFriendly: false,
      officeFriendly: false,
      tips: '不喜欢频繁搬动位置，环境改变容易掉叶子。'
    }
  },
  {
    id: '6',
    name: '多肉组合 (Succulents)',
    price: 39,
    image: 'https://images.unsplash.com/photo-1520302630591-fd1c66edc19d?auto=format&fit=crop&q=80&w=400',
    shortDescription: '萌萌哒小可爱，适合放在桌面。',
    description: '多肉植物形态各异，色彩丰富，是办公室桌面和窗台的最佳装饰。',
    type: 'plant',
    tags: ['新手友好', '可爱', '桌面'],
    care: {
      light: '充足阳光，每天至少6小时',
      water: '极度耐旱，干透浇透',
      difficulty: '简单',
      isPetFriendly: true,
      officeFriendly: true,
      tips: '夏季高温需要遮阴和断水，防止黑腐。'
    }
  },
  {
    id: '7',
    name: '红玫瑰花束 (Red Roses)',
    price: 158,
    image: 'https://images.unsplash.com/photo-1518621736915-f3b1c41bfd00?auto=format&fit=crop&q=80&w=400',
    shortDescription: '经典浪漫，表达爱意的最佳选择。',
    description: '精选昆明A级红玫瑰，搭配尤加利叶，简约而不失格调。',
    type: 'flower',
    tags: ['浪漫', '送礼', '鲜花'],
    care: {
      light: '避开阳光直射，阴凉处摆放',
      water: '每天更换清水，修剪根部',
      difficulty: '简单',
      isPetFriendly: false,
      officeFriendly: false,
      tips: '在水中加入少量保鲜剂可以延长花期。'
    }
  },
  {
    id: '8',
    name: '香水百合 (Lilies)',
    price: 128,
    image: 'https://images.unsplash.com/photo-1589244159943-460088ed5c92?auto=format&fit=crop&q=80&w=400',
    shortDescription: '清香怡人，高雅大方。',
    description: '多头香水百合，花朵硕大，香气浓郁，适合居家摆放。',
    type: 'flower',
    tags: ['香气', '高雅', '鲜花'],
    care: {
      light: '散射光即可',
      water: '2-3天换一次水',
      difficulty: '简单',
      isPetFriendly: false,
      officeFriendly: false,
      tips: '及时摘除花药，防止花粉弄脏花瓣。'
    }
  },
  {
    id: '9',
    name: '向日葵花束 (Sunflowers)',
    price: 99,
    image: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?auto=format&fit=crop&q=80&w=400',
    shortDescription: '阳光向上，充满活力。',
    description: '向日葵代表着希望和阳光，非常适合送给朋友或长辈。',
    type: 'flower',
    tags: ['活力', '送礼', '鲜花'],
    care: {
      light: '明亮环境',
      water: '需水量大，保持水质清洁',
      difficulty: '简单',
      isPetFriendly: true,
      officeFriendly: false,
      tips: '向日葵头重脚轻，建议使用较深的花瓶。'
    }
  },
  {
    id: '10',
    name: '康乃馨花束 (Carnations)',
    price: 88,
    image: 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?auto=format&fit=crop&q=80&w=400',
    shortDescription: '温馨母爱，感恩之选。',
    description: '康乃馨花期长，寓意温馨，是表达感激之情的经典之选。',
    type: 'flower',
    tags: ['温馨', '感恩', '鲜花'],
    care: {
      light: '散射光',
      water: '3天左右换一次水',
      difficulty: '简单',
      isPetFriendly: true,
      officeFriendly: false,
      tips: '不要将水喷在花头上，容易导致腐烂。'
    }
  }
];
