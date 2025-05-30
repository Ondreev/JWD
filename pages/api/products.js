import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const products = await redis.get('products') || [];
    res.status(200).json(products);
  } catch (error) {
    console.error('Ошибка при получении товаров из Redis:', error);
    res.status(500).json({ error: 'Не удалось получить товары' });
  }
}
