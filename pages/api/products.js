const { Redis } = require('@upstash/redis');

const BOT_TOKEN = process.env.BOT_TOKEN;
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  console.log('🔧 START PRODUCTS HANDLER');

  try {
    const count = await redis.get('productCounter');
    console.log('🔢 productCounter =', count);

    if (!count) {
      return res.status(200).json([]);
    }

    const products = [];

    for (let i = 1; i <= count; i++) {
      const product = await redis.get(`product:${i}`);
      console.log(`📦 product:${i} =`, product);

      if (!product) continue;

      let parsedProduct = product;
      if (typeof product === 'string') {
        try {
          parsedProduct = JSON.parse(product);
        } catch (e) {
          console.warn(`⚠️ product:${i} не распарсился`);
        }
      }

      if (parsedProduct.media) {
        try {
          const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${parsedProduct.media}`);
          const fileData = await fileRes.json();
          if (fileData.ok) {
            const filePath = fileData.result.file_path;
            parsedProduct.photo_url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
          }
        } catch (e) {
          console.error(`❌ Ошибка получения фото для product:${i}`, e);
        }
      }

      products.push(parsedProduct);
    }

    console.log('✅ Итоговый массив товаров:', products.length);
    res.status(200).json(products);
  } catch (err) {
    console.error('❌ Ошибка API products:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
