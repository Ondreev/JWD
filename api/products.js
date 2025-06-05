const { Redis } = require('@upstash/redis');

const BOT_TOKEN = process.env.BOT_TOKEN;
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const count = await redis.get('productCounter') || 0;
    const products = [];

    for (let i = 1; i <= count; i++) {
      const product = await redis.get(`product:${i}`);
      if (!product) continue;

      if (product.media) {
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${product.media}`);
        const fileData = await fileRes.json();
        if (fileData.ok) {
          const filePath = fileData.result.file_path;
          product.photo_url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
        }
      }

      products.push(product);
    }

    res.status(200).json(products);
  } catch (err) {
    console.error('Ошибка API products:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}
