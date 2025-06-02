
require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const { Redis } = require('@upstash/redis');

const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const WEBAPP_URL = 'https://jwd-psi.vercel.app';
const redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });

const bot = new Telegraf(BOT_TOKEN);
bot.use(session());

const ADMIN_IDS = [1922996803, 530258581, 6418671958];

async function isAdmin(userId) {
  const admins = await redis.get('admins') || [];
  return ADMIN_IDS.includes(userId) || admins.includes(userId);
}

bot.start(async (ctx) => {
  const isUserAdmin = await isAdmin(ctx.from.id);
  await ctx.reply('Добро пожаловать! Жмите кнопку ниже, чтобы открыть магазин:', {
    reply_markup: {
      keyboard: [[{ text: '🛍 Открыть магазин', web_app: { url: WEBAPP_URL } }],
                 isUserAdmin ? [{ text: '🛠 Админ-панель' }] : []],
      resize_keyboard: true
    }
  });
});

bot.hears('🛠 Админ-панель', async (ctx) => {
  if (await isAdmin(ctx.from.id)) {
    await ctx.reply('🔧 Админ-панель:', Markup.inlineKeyboard([
      [Markup.button.callback('📋 Новые заказы', 'admin_orders_new')],
      [Markup.button.callback('📦 На сборке', 'admin_orders_assembling')]
    ]));
  }
});

bot.on('message', async (ctx) => {
  if (!ctx.message.web_app_data) return;
  try {
    const data = JSON.parse(ctx.message.web_app_data.data);
    const allValid = data.items.every(item => {
      const box = item.minQty || 1;
      return item.quantity % box === 0;
    });
    if (!allValid) {
      await ctx.reply('Некоторые товары должны заказываться кратно размеру коробки. Пожалуйста, проверьте количество.');
      return;
    }

    let orderCounter = await redis.get('orderCounter') || 0;
    orderCounter++;

    const newOrder = {
      id: orderCounter,
      userId: ctx.from.id,
      userName: ctx.from.first_name,
      items: data.items,
      totalPrice: data.totalPrice,
      customerName: data.customerName,
      customerPhone: data.customerPhone,
      customerAddress: data.customerAddress,
      customerComment: data.customerComment,
      status: 'new',
      createdAt: new Date().toISOString()
    };

    await redis.set(`order:${orderCounter}`, newOrder);
    await redis.set('orderCounter', orderCounter);

    let orderMessage = `🛒 Заказ #${orderCounter}
`;
    orderMessage += `👤 Имя: ${newOrder.customerName}
📞 Тел: ${newOrder.customerPhone}
🏠 Адрес: ${newOrder.customerAddress}
`;
    if (newOrder.customerComment) orderMessage += `💬 Комментарий: ${newOrder.customerComment}
`;
    orderMessage += `
📋 Состав:
`;

    for (const item of newOrder.items) {
      const promoMark = item.promo ? '🔥 АКЦИЯ! ' : '';
      const minQtyInfo = item.minQty ? `(упаковка: ${item.minQty})` : '';
      orderMessage += `- ${promoMark}${item.name} x${item.quantity} = ${item.price * item.quantity} руб. ${minQtyInfo}
`;
    }
    orderMessage += `
💰 Итого: ${newOrder.totalPrice} руб.`;

    for (const adminId of ADMIN_IDS) {
      try {
        await bot.telegram.sendMessage(adminId, orderMessage);
      } catch (e) {
        console.error(`Ошибка отправки админу ${adminId}:`, e.description);
      }
    }
    await ctx.reply('✅ Заказ оформлен! Мы свяжемся с вами.');
  } catch (err) {
    console.error('Ошибка при заказе:', err);
    await ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
  }
});

const orderStatusFilter = async (ctx, status) => {
  const count = await redis.get('orderCounter') || 0;
  let found = false;
  for (let i = 1; i <= count; i++) {
    const order = await redis.get(`order:${i}`);
    if (!order || order.status !== status) continue;

    found = true;
    let msg = `🛒 Заказ #${order.id}
Имя: ${order.customerName}
Тел: ${order.customerPhone}
`;
    msg += `Адрес: ${order.customerAddress}

📋 Товары:
`;
    for (const item of order.items) {
      const promoMark = item.promo ? '🔥 ' : '';
      msg += `- ${promoMark}${item.name} x${item.quantity} = ${item.price * item.quantity} руб.
`;
    }
    msg += `
💰 Итого: ${order.totalPrice} руб.`;

    await ctx.reply(msg, {
      reply_markup: {
        inline_keyboard: [[
          { text: '📦 На сборке', callback_data: `assemble_${order.id}` },
          { text: '✅ Завершить', callback_data: `complete_${order.id}` }
        ], [
          { text: '🔧 В админ-панель', callback_data: 'admin_panel' }
        ]]
      }
    });
  }
  if (!found) await ctx.reply('Нет заказов в этом статусе.');
};

bot.action('admin_orders_new', (ctx) => orderStatusFilter(ctx, 'new'));
bot.action('admin_orders_assembling', (ctx) => orderStatusFilter(ctx, 'assembling'));

bot.action('admin_panel', async (ctx) => {
  if (await isAdmin(ctx.from.id)) {
    await ctx.reply('🔧 Админ-панель:', Markup.inlineKeyboard([
      [Markup.button.callback('📋 Новые заказы', 'admin_orders_new')],
      [Markup.button.callback('📦 На сборке', 'admin_orders_assembling')]
    ]));
  }
});

bot.action(/assemble_(\d+)/, async (ctx) => {
  const id = ctx.match[1];
  const order = await redis.get(`order:${id}`);
  if (!order) return ctx.reply('Заказ не найден.');
  order.status = 'assembling';
  await redis.set(`order:${id}`, order);
  await ctx.reply(`🔄 Заказ #${id} переведён в статус «На сборке».`);
  try {
    await bot.telegram.sendMessage(order.userId, `📦 Ваш заказ #${id} сейчас собирается. Мы скоро с вами свяжемся!`);
  } catch (e) {
    console.error('Ошибка уведомления клиента о сборке:', e);
  }
});

bot.action(/complete_(\d+)/, async (ctx) => {
  const id = ctx.match[1];
  const order = await redis.get(`order:${id}`);
  if (!order) return ctx.reply('Заказ не найден.');
  order.status = 'completed';
  await redis.set(`order:${id}`, order);
  await redis.del(`order:${id}`);
  await ctx.reply(`✅ Заказ #${id} завершён и удалён из базы.`);
  try {
    await bot.telegram.sendMessage(order.userId, `✅ Ваш заказ #${id} завершён и отправлен! Благодарим за покупку!`);
  } catch (e) {
    console.error('Ошибка уведомления клиента о завершении:', e);
  }
});

bot.launch();
console.log('✅ Бот запущен. Ожидает сообщения в Telegram...');
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
