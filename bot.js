const { Telegraf, Markup, session } = require('telegraf');
const { Redis } = require('@upstash/redis');
const axios = require('axios');

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN || '8111751981:AAGZZZzrOu2tdKWm6xhQvquBh2_viQRXCMk';
const GROUP_ID = process.env.GROUP_ID || '-1002665972722';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://gusc1-star-chow-30378.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AXaqASQgYWMyNTUxZmMtMDYxZS00YTRlLThlNjAtYTc5YWY5MTMwY2QyMDdiNTM2NDc0ZTEzNDU2OTk5ZGFiNDY1MzA1N2E2MTQ=';

// URL веб-приложения
const WEBAPP_URL = 'https://flourishing-cuchufli-5b4d4c.netlify.app';

// Инициализация Redis
const redis = new Redis({
  url: REDIS_URL,
  token: REDIS_TOKEN,
});

// Инициализация бота
const bot = new Telegraf(BOT_TOKEN);

// Middleware для сессий
bot.use(session());

// Список администраторов
const ADMIN_IDS = [1922996803, 530258581, 6418671958];

// Проверка, является ли пользователь администратором
async function isAdmin(userId) {
  try {
    const admins = await redis.get('admins') || [];
    return ADMIN_IDS.includes(userId) || admins.includes(userId);
  } catch (error) {
    console.error('Ошибка при проверке администратора:', error);
    return ADMIN_IDS.includes(userId);
  }
}

// Инициализация данных в Redis
async function initRedis() {
  try {
    const admins = await redis.get('admins');
    if (!admins) {
      await redis.set('admins', ADMIN_IDS);
    }

    const minItems = await redis.get('minItems');
    if (!minItems) {
      await redis.set('minItems', 1);
    }

    const productCounter = await redis.get('productCounter');
    if (!productCounter) {
      await redis.set('productCounter', 0);
    }

    console.log('Redis инициализирован');
  } catch (error) {
    console.error('Ошибка при инициализации Redis:', error);
  }
}

// Функция для создания главного меню
function createMainMenu(isUserAdmin, chatType) {
  const buttons = [];
  
  if (chatType === 'private') {
    // В личке - web_app кнопка
    buttons.push([Markup.button.webApp('🛒 Заказать товары', WEBAPP_URL)]);
  } else {
    // В группе - обычная кнопка-ссылка
    buttons.push([Markup.button.url('🛒 Заказать товары', WEBAPP_URL)]);
  }
  
  if (isUserAdmin && chatType === 'private') {
    buttons.push([Markup.button.callback('⚙️ Админ панель', 'admin_panel')]);
  }
  
  return Markup.inlineKeyboard(buttons);
}

// Функция для создания клавиатуры админ меню
function createAdminMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Добавить товар', 'add_product')],
    [Markup.button.callback('✏️ Редактировать товар', 'edit_product')],
    [Markup.button.callback('🗑️ Удалить товар', 'delete_product')],
    [Markup.button.callback('📦 Список товаров', 'list_products')],
    [Markup.button.callback('⚙️ Мин. количество', 'set_min_items')],
    [Markup.button.callback('👥 Управление админами', 'manage_admins')],
    [Markup.button.callback('🔙 Главное меню', 'main_menu')],
  ]);
}

// Функция для создания клавиатуры управления админами
function createAdminManagementKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Добавить админа', 'add_admin')],
    [Markup.button.callback('🗑️ Удалить админа', 'delete_admin')],
    [Markup.button.callback('📋 Список админов', 'list_admins')],
    [Markup.button.callback('🔙 Админ панель', 'admin_panel')],
  ]);
}

// Функция для создания клавиатуры редактирования товара
function createEditProductKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📝 Название', 'edit_name')],
    [Markup.button.callback('💰 Цена', 'edit_price')],
    [Markup.button.callback('📷 Фото', 'edit_photo')],
    [Markup.button.callback('🔥 Акция', 'edit_promo')],
    [Markup.button.callback('🔙 Админ панель', 'admin_panel')],
  ]);
}

// Функция для создания клавиатуры да/нет
function createYesNoKeyboard(action, id) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('✅ Да', `${action}_yes_${id}`),
      Markup.button.callback('❌ Нет', `${action}_no_${id}`),
    ],
  ]);
}

// Команда /start
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatType = ctx.chat.type;
    const isUserAdmin = await isAdmin(userId);

    if (chatType === 'private') {
      if (isUserAdmin) {
        await ctx.reply('👋 Привет! Я бот для управления товарами в мини-магазине.', createMainMenu(true, chatType));
      } else {
        await ctx.reply('👋 Привет! Добро пожаловать в наш мини-магазин!', createMainMenu(false, chatType));
      }
    } else {
      await ctx.reply('👋 Добро пожаловать в наш мини-магазин!', createMainMenu(false, chatType));
    }
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Главное меню"
bot.action('main_menu', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatType = ctx.chat.type;
    const isUserAdmin = await isAdmin(userId);

    await ctx.answerCbQuery();
    await ctx.editMessageText('🏠 Главное меню:', createMainMenu(isUserAdmin, chatType));
    ctx.session = null;
  } catch (error) {
    console.error('Ошибка при обработке кнопки main_menu:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Админ панель"
bot.action('admin_panel', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к админ панели.');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText('⚙️ Админ панель:', createAdminMenu());
    ctx.session = null;
  } catch (error) {
    console.error('Ошибка при обработке кнопки admin_panel:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Добавить товар"
bot.action('add_product', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    ctx.session = { action: 'add_product' };
    await ctx.editMessageText('📝 Введите название товара:');
  } catch (error) {
    console.error('Ошибка при обработке кнопки add_product:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Редактировать товар"
bot.action('edit_product', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const products = await redis.get('products') || [];
    
    if (products.length === 0) {
      await ctx.editMessageText('📦 Список товаров пуст. Сначала добавьте товары.', createAdminMenu());
      return;
    }
    
    let message = '✏️ Выберите ID товара для редактирования:\n\n';
    products.forEach(product => {
      message += `🆔 ${product.id} - ${product.name} - ${product.price} руб.\n`;
    });
    
    ctx.session = { action: 'edit_product' };
    await ctx.editMessageText(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки edit_product:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Удалить товар"
bot.action('delete_product', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const products = await redis.get('products') || [];
    
    if (products.length === 0) {
      await ctx.editMessageText('📦 Список товаров пуст. Сначала добавьте товары.', createAdminMenu());
      return;
    }
    
    let message = '🗑️ Выберите ID товара для удаления:\n\n';
    products.forEach(product => {
      message += `🆔 ${product.id} - ${product.name} - ${product.price} руб.\n`;
    });
    
    ctx.session = { action: 'delete_product' };
    await ctx.editMessageText(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки delete_product:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Список товаров"
bot.action('list_products', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const products = await redis.get('products') || [];
    
    if (products.length === 0) {
      await ctx.editMessageText('📦 Список товаров пуст.', createAdminMenu());
      return;
    }
    
    let message = '📦 Список товаров:\n\n';
    products.forEach(product => {
      message += `🆔 ID: ${product.id}\n`;
      message += `📝 Название: ${product.name}\n`;
      message += `💰 Цена: ${product.price} руб.\n`;
      message += `🔥 Акция: ${product.promo ? 'Да' : 'Нет'}\n\n`;
    });
    
    await ctx.editMessageText(message, createAdminMenu());
  } catch (error) {
    console.error('Ошибка при обработке кнопки list_products:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Установить мин. количество"
bot.action('set_min_items', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const minItems = await redis.get('minItems') || 1;
    
    ctx.session = { action: 'set_min_items' };
    await ctx.editMessageText(`⚙️ Текущее минимальное количество товаров: ${minItems}\n\n📝 Введите новое значение:`);
  } catch (error) {
    console.error('Ошибка при обработке кнопки set_min_items:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Управление админами"
bot.action('manage_admins', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.editMessageText('👥 Управление администраторами:', createAdminManagementKeyboard());
  } catch (error) {
    console.error('Ошибка при обработке кнопки manage_admins:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Добавить админа"
bot.action('add_admin', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    ctx.session = { action: 'add_admin' };
    await ctx.editMessageText('👤 Введите ID нового администратора:');
  } catch (error) {
    console.error('Ошибка при обработке кнопки add_admin:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Удалить админа"
bot.action('delete_admin', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const admins = await redis.get('admins') || [];
    
    if (admins.length === 0) {
      await ctx.editMessageText('👥 Список администраторов пуст.', createAdminManagementKeyboard());
      return;
    }
    
    let message = '🗑️ Выберите ID администратора для удаления:\n\n';
    admins.forEach(admin => {
      message += `👤 ID: ${admin}\n`;
    });
    
    ctx.session = { action: 'delete_admin' };
    await ctx.editMessageText(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки delete_admin:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Список админов"
bot.action('list_admins', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const admins = await redis.get('admins') || [];
    
    if (admins.length === 0) {
      await ctx.editMessageText('👥 Список администраторов пуст.', createAdminManagementKeyboard());
      return;
    }
    
    let message = '👥 Список администраторов:\n\n';
    admins.forEach(admin => {
      message += `👤 ID: ${admin}\n`;
    });
    
    await ctx.editMessageText(message, createAdminManagementKeyboard());
  } catch (error) {
    console.error('Ошибка при обработке кнопки list_admins:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопок редактирования товара
bot.action(/edit_(name|price|photo|promo)/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const field = ctx.match[1];
    
    if (!ctx.session.productId) {
      await ctx.editMessageText('❌ Сначала выберите товар для редактирования.', createAdminMenu());
      return;
    }
    
    ctx.session.editField = field;
    
    switch (field) {
      case 'name':
        await ctx.editMessageText('📝 Введите новое название товара:');
        break;
      case 'price':
        await ctx.editMessageText('💰 Введите новую цену товара:');
        break;
      case 'photo':
        await ctx.editMessageText('📷 Отправьте новую фотографию товара:');
        break;
      case 'promo':
        await ctx.editMessageText('🔥 Сделать товар акционным?', createYesNoKeyboard('promo', ctx.session.productId));
        break;
    }
  } catch (error) {
    console.error('Ошибка при обработке кнопки редактирования товара:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопок да/нет для акции
bot.action(/promo_(yes|no)_(\d+)/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const answer = ctx.match[1];
    const productId = parseInt(ctx.match[2]);
    
    const products = await redis.get('products') || [];
    const productIndex = products.findIndex(product => product.id === productId);
    
    if (productIndex === -1) {
      await ctx.editMessageText('❌ Товар не найден.', createAdminMenu());
      return;
    }
    
    products[productIndex].promo = answer === 'yes';
    await redis.set('products', products);
    
    await ctx.editMessageText(`✅ Товар ${products[productIndex].name} ${answer === 'yes' ? 'теперь акционный' : 'больше не акционный'}.`, createAdminMenu());
    ctx.session = null;
  } catch (error) {
    console.error('Ошибка при обработке кнопки да/нет для акции:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопок да/нет для удаления товара
bot.action(/delete_(yes|no)_(\d+)/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const answer = ctx.match[1];
    const productId = parseInt(ctx.match[2]);
    
    if (answer === 'no') {
      await ctx.editMessageText('❌ Удаление отменено.', createAdminMenu());
      ctx.session = null;
      return;
    }
    
    const products = await redis.get('products') || [];
    const productIndex = products.findIndex(product => product.id === productId);
    
    if (productIndex === -1) {
      await ctx.editMessageText('❌ Товар не найден.', createAdminMenu());
      return;
    }
    
    const deletedProduct = products.splice(productIndex, 1)[0];
    await redis.set('products', products);
    
    await ctx.editMessageText(`✅ Товар ${deletedProduct.name} успешно удален.`, createAdminMenu());
    ctx.session = null;
  } catch (error) {
    console.error('Ошибка при обработке кнопки да/нет для удаления товара:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопки "Отправить на сборку"
bot.action(/assemble_(\d+)/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('❌ У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery('✅ Заказ отправлен на сборку!');
    
    const orderId = ctx.match[1];
    const order = await redis.get(`order:${orderId}`);
    
    if (!order) {
      await ctx.reply('❌ Заказ не найден.');
      return;
    }
    
    order.status = 'assembling';
    await redis.set(`order:${orderId}`, order);
    
    await ctx.editMessageText(ctx.update.callback_query.message.text + '\n\n🟢 Заказ отправлен на сборку!');
  } catch (error) {
    console.error('Ошибка при обработке кнопки "Отправить на сборку":', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const chatType = ctx.chat.type;
    const isUserAdmin = await isAdmin(userId);
    const text = ctx.message.text;

    // Если это не личка или не админ, показываем главное меню
    if (chatType !== 'private' || !isUserAdmin) {
      if (chatType === 'private') {
        await ctx.reply('🏠 Главное меню:', createMainMenu(isUserAdmin, chatType));
      }
      return;
    }

    // Добавление товара
    if (ctx.session?.action === 'add_product' && !ctx.session.product) {
      ctx.session.product = { name: text };
      await ctx.reply('💰 Введите цену товара (руб.):');
      return;
    }
    
    if (ctx.session?.action === 'add_product' && ctx.session.product && !ctx.session.product.price) {
      const price = parseFloat(text);
      
      if (isNaN(price) || price <= 0) {
        await ctx.reply('❌ Пожалуйста, введите корректную цену (положительное число):');
        return;
      }
      
      ctx.session.product.price = price;
      await ctx.reply('📷 Отправьте фотографию товара:');
      return;
    }
    
    // Редактирование товара
    if (ctx.session?.action === 'edit_product' && !ctx.session.productId) {
      const productId = parseInt(text);
      
      if (isNaN(productId)) {
        await ctx.reply('❌ Пожалуйста, введите корректный ID товара (число):');
        return;
      }
      
      const products = await redis.get('products') || [];
      const product = products.find(product => product.id === productId);
      
      if (!product) {
        await ctx.reply('❌ Товар с таким ID не найден. Попробуйте еще раз:');
        return;
      }
      
      ctx.session.productId = productId;
      await ctx.reply(`✅ Выбран товар: ${product.name}\n\n✏️ Что вы хотите изменить?`, createEditProductKeyboard());
      return;
    }
    
    if (ctx.session?.action === 'edit_product' && ctx.session.productId && ctx.session.editField) {
      const products = await redis.get('products') || [];
      const productIndex = products.findIndex(product => product.id === ctx.session.productId);
      
      if (productIndex === -1) {
        await ctx.reply('❌ Товар не найден.', createAdminMenu());
        ctx.session = null;
        return;
      }
      
      switch (ctx.session.editField) {
        case 'name':
          products[productIndex].name = text;
          await ctx.reply(`✅ Название товара изменено на "${text}".`, createAdminMenu());
          break;
        case 'price':
          const price = parseFloat(text);
          
          if (isNaN(price) || price <= 0) {
            await ctx.reply('❌ Пожалуйста, введите корректную цену (положительное число):');
            return;
          }
          
          products[productIndex].price = price;
          await ctx.reply(`✅ Цена товара изменена на ${price} руб.`, createAdminMenu());
          break;
      }
      
      await redis.set('products', products);
      ctx.session = null;
      return;
    }
    
    // Удаление товара
    if (ctx.session?.action === 'delete_product' && !ctx.session.productId) {
      const productId = parseInt(text);
      
      if (isNaN(productId)) {
        await ctx.reply('❌ Пожалуйста, введите корректный ID товара (число):');
        return;
      }
      
      const products = await redis.get('products') || [];
      const product = products.find(product => product.id === productId);
      
      if (!product) {
        await ctx.reply('❌ Товар с таким ID не найден. Попробуйте еще раз:');
        return;
      }
      
      ctx.session.productId = productId;
      await ctx.reply(`🗑️ Вы уверены, что хотите удалить товар "${product.name}"?`, createYesNoKeyboard('delete', productId));
      return;
    }
    
    // Установка минимального количества товаров
    if (ctx.session?.action === 'set_min_items') {
      const minItems = parseInt(text);
      
      if (isNaN(minItems) || minItems <= 0) {
        await ctx.reply('❌ Пожалуйста, введите корректное значение (положительное число):');
        return;
      }
      
      await redis.set('minItems', minItems);
      await ctx.reply(`✅ Минимальное количество товаров установлено: ${minItems}`, createAdminMenu());
      ctx.session = null;
      return;
    }
    
    // Добавление администратора
    if (ctx.session?.action === 'add_admin') {
      const adminId = parseInt(text);
      
      if (isNaN(adminId)) {
        await ctx.reply('❌ Пожалуйста, введите корректный ID администратора (число):');
        return;
      }
      
      const admins = await redis.get('admins') || [];
      
      if (admins.includes(adminId)) {
        await ctx.reply('❌ Этот пользователь уже является администратором.', createAdminManagementKeyboard());
        ctx.session = null;
        return;
      }
      
      admins.push(adminId);
      await redis.set('admins', admins);
      
      await ctx.reply(`✅ Администратор с ID ${adminId} успешно добавлен.`, createAdminManagementKeyboard());
      ctx.session = null;
      return;
    }
    
    // Удаление администратора
    if (ctx.session?.action === 'delete_admin') {
      const adminId = parseInt(text);
      
      if (isNaN(adminId)) {
        await ctx.reply('❌ Пожалуйста, введите корректный ID администратора (число):');
        return;
      }
      
      const admins = await redis.get('admins') || [];
      const adminIndex = admins.indexOf(adminId);
      
      if (adminIndex === -1) {
        await ctx.reply('❌ Администратор с таким ID не найден.', createAdminManagementKeyboard());
        ctx.session = null;
        return;
      }
      
      if (adminId === userId) {
        await ctx.reply('❌ Вы не можете удалить сами себя из списка администраторов.', createAdminManagementKeyboard());
        ctx.session = null;
        return;
      }
      
      admins.splice(adminIndex, 1);
      await redis.set('admins', admins);
      
      await ctx.reply(`✅ Администратор с ID ${adminId} успешно удален.`, createAdminManagementKeyboard());
      ctx.session = null;
      return;
    }
    
    // Если нет активной сессии, показываем главное меню
    await ctx.reply('🏠 Главное меню:', createMainMenu(isUserAdmin, chatType));
  } catch (error) {
    console.error('Ошибка при обработке текстового сообщения:', error);
    await ctx.reply('❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка получения фотографии
bot.on('photo', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.reply('❌ У вас нет доступа к админ-панели.');
      return;
    }

    // Добавление товара
    if (ctx.session?.action === 'add_product' && ctx.session.product && ctx.session.product.price) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      
      let productCounter = await redis.get('productCounter') || 0;
      productCounter++;
      
      const newProduct = {
        id: productCounter,
        name: ctx.session.product.name,
        price: ctx.session.product.price,
        photo: fileId,
        promo: false,
      };
      
      const products = await redis.get('products') || [];
      products.push(newProduct);
      
      await redis.set('products', products);
      await redis.set('productCounter', productCounter);
      
      await ctx.reply(`✅ Товар "${newProduct.name}" успешно добавлен.`, createAdminMenu());
      ctx.session = null;
      return;
    }
    
    // Редактирование товара
    if (ctx.session?.action === 'edit_product' && ctx.session.productId && ctx.session.editField === 'photo') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      
      const products = await redis.get('products') || [];
      const productIndex = products.findIndex(product => product.id === ctx.session.productId);
      
      if (productIndex === -1) {
        await ctx.reply('❌ Товар не найден.', createAdminMenu());
        ctx.session = null;
        return;
      }
      
      products[productIndex].photo = fileId;
      await redis.set('products', products);
      
      await ctx.reply('✅ Фотография товара успешно обновлена.', createAdminMenu());
      ctx.session = null;
      return;
    }
  } catch (error) {
    console.error('Ошибка при обработке фотографии:', error);
    await ctx.reply('❌ Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка данных, полученных из Telegram Web App
bot.on('message', async (ctx) => {
  try {
    if (ctx.message.web_app_data) {
      const data = JSON.parse(ctx.message.web_app_data.data);
      console.log('Получены данные из Web App:', data);
      
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
        createdAt: new Date().toISOString(),
      };

      await redis.set(`order:${orderCounter}`, newOrder);
      await redis.set('orderCounter', orderCounter);
      
      let orderMessage = `🛒 Новый заказ #${orderCounter}\n\n`;
      orderMessage += `👤 Клиент: ${newOrder.customerName}\n`;
      orderMessage += `📞 Телефон: ${newOrder.customerPhone}\n`;
      orderMessage += `🏠 Адрес: ${newOrder.customerAddress}\n`;
      
      if (newOrder.customerComment) {
        orderMessage += `💬 Комментарий: ${newOrder.customerComment}\n`;
      }
      
      orderMessage += `\n📋 Товары:\n`;
      
      newOrder.items.forEach(item => {
        orderMessage += `- ${item.name} x${item.quantity} = ${item.price * item.quantity} руб.\n`;
      });
      
      orderMessage += `\n💰 Итого: ${newOrder.totalPrice} руб.`;
      
      await bot.telegram.sendMessage(GROUP_ID, orderMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Отправить на сборку', callback_data: `assemble_${orderCounter}` }]
          ]
        }
      });
      
      await ctx.reply('✅ Ваш заказ успешно отправлен! Мы свяжемся с вами в ближайшее время.');
    }
  } catch (error) {
    console.error('Ошибка при обработке данных из Web App:', error);
    await ctx.reply('❌ Произошла ошибка при отправке заказа. Пожалуйста, попробуйте позже.');
  }
});

// Инициализация Redis и запуск бота
async function start() {
  try {
    await initRedis();
    await bot.launch();
    console.log('Бот запущен!');
  } catch (error) {
    console.error('Ошибка при запуске бота:', error);
  }
}

start();

// Обработка остановки бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
