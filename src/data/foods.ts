// 常见食物 kcal 数据库(粗略估算,单位为每份)
export interface FoodPreset {
  name: string
  amount: string
  calories: number
  category: 'staple' | 'protein' | 'veg' | 'fruit' | 'drink' | 'snack' | 'meal'
}

export const CATEGORY_LABELS: Record<FoodPreset['category'], string> = {
  staple: '🍚 主食',
  protein: '🥩 蛋白',
  veg: '🥗 蔬菜',
  fruit: '🍎 水果',
  drink: '🥤 饮品',
  snack: '🍪 零食',
  meal: '🍱 整餐',
}

export const FOOD_PRESETS: FoodPreset[] = [
  // 主食
  { name: '米饭', amount: '一碗 (150g)', calories: 195, category: 'staple' },
  { name: '米饭', amount: '大碗 (250g)', calories: 325, category: 'staple' },
  { name: '馒头', amount: '一个 (100g)', calories: 220, category: 'staple' },
  { name: '包子', amount: '一个', calories: 250, category: 'staple' },
  { name: '面条', amount: '一碗', calories: 350, category: 'staple' },
  { name: '面包', amount: '一片 (30g)', calories: 90, category: 'staple' },
  { name: '燕麦', amount: '40g 干', calories: 150, category: 'staple' },
  { name: '玉米', amount: '一根', calories: 130, category: 'staple' },
  { name: '红薯', amount: '中等一个', calories: 130, category: 'staple' },
  { name: '土豆', amount: '中等一个', calories: 100, category: 'staple' },
  { name: '饺子', amount: '10 个', calories: 300, category: 'staple' },
  { name: '煎饼果子', amount: '一份', calories: 400, category: 'staple' },

  // 蛋白
  { name: '鸡蛋', amount: '一个', calories: 78, category: 'protein' },
  { name: '鸡胸肉', amount: '100g', calories: 165, category: 'protein' },
  { name: '鸡腿', amount: '一只 (去皮)', calories: 200, category: 'protein' },
  { name: '牛肉', amount: '100g', calories: 250, category: 'protein' },
  { name: '瘦猪肉', amount: '100g', calories: 143, category: 'protein' },
  { name: '五花肉', amount: '100g', calories: 395, category: 'protein' },
  { name: '三文鱼', amount: '100g', calories: 208, category: 'protein' },
  { name: '虾', amount: '100g', calories: 90, category: 'protein' },
  { name: '牛奶', amount: '一杯 (250ml)', calories: 150, category: 'protein' },
  { name: '酸奶', amount: '一盒 (150g)', calories: 130, category: 'protein' },
  { name: '豆浆', amount: '一杯 (300ml)', calories: 90, category: 'protein' },
  { name: '豆腐', amount: '100g', calories: 82, category: 'protein' },
  { name: '蛋白粉', amount: '一勺 (30g)', calories: 115, category: 'protein' },

  // 蔬菜
  { name: '西兰花', amount: '100g', calories: 34, category: 'veg' },
  { name: '菠菜', amount: '100g', calories: 23, category: 'veg' },
  { name: '生菜', amount: '100g', calories: 15, category: 'veg' },
  { name: '黄瓜', amount: '一根', calories: 16, category: 'veg' },
  { name: '西红柿', amount: '一个', calories: 22, category: 'veg' },
  { name: '胡萝卜', amount: '一根', calories: 40, category: 'veg' },
  { name: '青菜炒', amount: '一份', calories: 80, category: 'veg' },

  // 水果
  { name: '苹果', amount: '一个 (200g)', calories: 104, category: 'fruit' },
  { name: '香蕉', amount: '一根 (120g)', calories: 105, category: 'fruit' },
  { name: '橙子', amount: '一个', calories: 62, category: 'fruit' },
  { name: '葡萄', amount: '100g', calories: 43, category: 'fruit' },
  { name: '西瓜', amount: '一片 (200g)', calories: 60, category: 'fruit' },
  { name: '蓝莓', amount: '100g', calories: 57, category: 'fruit' },
  { name: '牛油果', amount: '半个', calories: 160, category: 'fruit' },

  // 饮品
  { name: '黑咖啡', amount: '一杯', calories: 5, category: 'drink' },
  { name: '拿铁', amount: '一杯', calories: 190, category: 'drink' },
  { name: '奶茶(全糖)', amount: '一杯', calories: 500, category: 'drink' },
  { name: '奶茶(半糖)', amount: '一杯', calories: 350, category: 'drink' },
  { name: '可乐', amount: '罐 (330ml)', calories: 139, category: 'drink' },
  { name: '果汁', amount: '一杯 (250ml)', calories: 110, category: 'drink' },
  { name: '绿茶', amount: '一杯', calories: 2, category: 'drink' },
  { name: '啤酒', amount: '一罐 (330ml)', calories: 145, category: 'drink' },

  // 零食
  { name: '薯片', amount: '小包 (30g)', calories: 160, category: 'snack' },
  { name: '巧克力', amount: '一块 (10g)', calories: 55, category: 'snack' },
  { name: '饼干', amount: '2 片', calories: 100, category: 'snack' },
  { name: '坚果', amount: '一小把 (20g)', calories: 130, category: 'snack' },
  { name: '蛋糕', amount: '一小块', calories: 300, category: 'snack' },
  { name: '冰淇淋', amount: '一份', calories: 250, category: 'snack' },

  // 整餐(懒得算的时候用)
  { name: '快餐盒饭', amount: '一份', calories: 700, category: 'meal' },
  { name: '沙拉碗', amount: '一份', calories: 400, category: 'meal' },
  { name: '汉堡套餐', amount: '一份', calories: 900, category: 'meal' },
  { name: '火锅', amount: '一顿', calories: 1200, category: 'meal' },
  { name: '烤肉', amount: '一顿', calories: 1000, category: 'meal' },
  { name: '兰州拉面', amount: '一碗', calories: 550, category: 'meal' },
  { name: '沙县套餐', amount: '一份', calories: 650, category: 'meal' },
  { name: '早餐组合', amount: '常规', calories: 400, category: 'meal' },
]

// 快速估算份量档(粗略)
export const PORTION_BUCKETS = [
  { label: '小份', kcal: 300 },
  { label: '中份', kcal: 500 },
  { label: '大份', kcal: 700 },
  { label: '特大', kcal: 900 },
]
