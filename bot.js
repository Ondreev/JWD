
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
  try {
    if (!ctx.session) ctx.session = {};

    // Обработка WebApp заказа
    if (ctx.message.web_app_data) {
      const data = JSON.parse(ctx.message.web_app_data.data);
      const allValid = data.items.every(item => {
        const box = item.minQty || 1;
        return item.quantity % box === 0;
      });
      if (!allValid) {
        return ctx.reply('Некоторые товары должны заказываться кратно размеру коробки.');
      }

      const orderId = await redis.incr('orderCounter');
      const order = {
        id: orderId,
        user: ctx.from,
        items: data.items,
        totalPrice: data.totalPrice,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        customerComment: data.customerComment,
        status: 'new',
        createdAt: Date.now()
      };
      await redis.set(`order:${orderId}`, order);
      await redis.lpush('orders', orderId);

      const message = `🛒 Новый заказ #${orderId}
👤 Клиент: ${order.customerName}
📞 Телефон: ${order.customerPhone}
🏠 Адрес: ${order.customerAddress}
💬 Комментарий: ${order.customerComment}
📋 Товары:\n${order.items.map(i => `- ${i.name} x${i.quantity} = ${i.price * i.quantity} руб.`).join('\n')}\n\n💰 Итого: ${order.totalPrice} руб.`;

      for (const adminId of ADMIN_IDS) {
        try {
          await bot.telegram.sendMessage(adminId, message);
        } catch (e) {
          console.error('Ошибка отправки админу:', e);
        }
      }

      return ctx.reply('✅ Заказ принят! Спасибо!');
    }

    // Добавление товара по шагам
    if (ctx.session.step === 'product_name') {
      ctx.session.newProduct = { name: ctx.message.text };
      ctx.session.step = 'product_price';
      return ctx.reply('💰 Введите цену товара в рублях:');
    }

    if (ctx.session.step === 'product_price') {
      const price = parseFloat(ctx.message.text);
      if (isNaN(price)) return ctx.reply('❌ Введите корректную цену.');
      ctx.session.newProduct.price = price;
      ctx.session.step = 'product_minQty';
      return ctx.reply('📦 Укажите минимальное количество (в упаковке):');
    }

    if (ctx.session.step === 'product_minQty') {
      const qty = parseInt(ctx.message.text);
      if (isNaN(qty)) return ctx.reply('❌ Введите корректное количество.');
      ctx.session.newProduct.minQty = qty;
      ctx.session.step = 'product_promo';
      return ctx.reply('🔥 Это акционный товар? (да/нет)');
    }

    if (ctx.session.step === 'product_promo') {
      ctx.session.newProduct.promo = ctx.message.text.toLowerCase().includes('да');
      ctx.session.step = 'product_media';
      return ctx.reply('📷 Пришлите фото или мини-видео товара:');
    }

    if (ctx.session.step === 'product_media' && (ctx.message.photo || ctx.message.video)) {
      const fileId = ctx.message.photo ? ctx.message.photo.pop().file_id : ctx.message.video.file_id;
      ctx.session.newProduct.media = fileId;
      const id = await redis.incr('productCounter');
      await redis.set(`product:${id}`, ctx.session.newProduct);
      ctx.session.step = null;
      ctx.session.newProduct = null;
      return ctx.reply('✅ Товар добавлен!');
    }

    if (ctx.session.step) {
      return ctx.reply('⏳ Пожалуйста, завершите текущее действие или введите /cancel.');
    }

  } catch (err) {
    console.error('❌ Ошибка обработки сообщения:', err);
    return ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
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
