export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const order = req.body;

  // Формируем текст заказа для Telegram
  const itemsText = order.items.map(item =>
    `${item.name} x${item.quantity} — ${item.price * item.quantity} руб.`
  ).join('\n');

  const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const text = `
🛒 <b>Новый заказ!</b>
👤 <b>Имя:</b> ${order.customer.name}
📞 <b>Телефон:</b> ${order.customer.phone}
🏠 <b>Адрес:</b> ${order.customer.address}
💬 <b>Комментарий:</b> ${order.customer.comment || '-'}
-------------------------
${itemsText}
-------------------------
<b>Итого:</b> ${total} руб.
  `;

  // Отправляем в Telegram-группу
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.ADMIN_GROUP_ID; // ID вашей группы

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });

    const tgData = await tgRes.json();

    if (tgData.ok) {
      res.status(200).json({ success: true });
    } else {
      console.error('Ошибка Telegram:', tgData);
      res.status(500).json({ success: false, error: 'Ошибка отправки в Telegram', details: tgData });
    }
  } catch (error) {
    console.error('Ошибка при отправке заказа:', error);
    res.status(500).json({ success: false, error: 'Ошибка при отправке заказа', details: error.message });
  }
}
