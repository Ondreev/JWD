export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const order = req.body;

  // Здесь можно добавить отправку заказа в Telegram, на почту, в базу и т.д.
  // Пока просто логируем заказ:
  console.log('Новый заказ:', order);

  // Пример успешного ответа
  res.status(200).json({ success: true });
}
