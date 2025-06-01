const { Telegraf, Markup, session } = require('telegraf');
const { Redis } = require('@upstash/redis');
const axios = require('axios');

// Конфигурация
const BOT_TOKEN = process.env.BOT_TOKEN || '8111751981:AAGZZZzrOu2tdKWm6xhQvquBh2_viQRXCMk';
const GROUP_ID = process.env.GROUP_ID || '-1002665972722';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || 'https://gusc1-star-chow-30378.upstash.io';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || 'AXaqASQgYWMyNTUxZmMtMDYxZS00YTRlLThlNjAtYTc5YWY5MTMwY2QyMDdiNTM2NDc0ZTEzNDU2OTk5ZGFiNDY1MzA1N2E2MTQ=';

// URL веб-приложения (замени на свой URL с Netlify)
const WEBAPP_URL = 'https://jwd-psi.vercel.app/';

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
    // Получаем список админов из Redis
    const admins = await redis.get('admins') || [];
    // Проверяем, есть ли пользователь в списке админов
    return ADMIN_IDS.includes(userId) || admins.includes(userId);
  } catch (error) {
    console.error('Ошибка при проверке администратора:', error);
    // В случае ошибки проверяем только хардкод-список
    return ADMIN_IDS.includes(userId);
  }
}

// Инициализация данных в Redis
async function initRedis() {
  try {
    // Проверяем, есть ли список админов в Redis
    const admins = await redis.get('admins');
    if (!admins) {
      // Если нет, создаем его
      await redis.set('admins', ADMIN_IDS);
    }

    // Проверяем, есть ли минимальное количество товаров в Redis
    const minItems = await redis.get('minItems');
    if (!minItems) {
      // Если нет, устанавливаем значение по умолчанию
      await redis.set('minItems', 1);
    }

    // Проверяем, есть ли счетчик товаров в Redis
    const productCounter = await redis.get('productCounter');
    if (!productCounter) {
      // Если нет, устанавливаем значение по умолчанию
      await redis.set('productCounter', 0);
    }

    console.log('Redis инициализирован');
  } catch (error) {
    console.error('Ошибка при инициализации Redis:', error);
  }
}

// Функция для создания клавиатуры меню
function createMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Добавить товар', 'add_product')],
    [Markup.button.callback('Редактировать товар', 'edit_product')],
    [Markup.button.callback('Удалить товар', 'delete_product')],
    [Markup.button.callback('Список товаров', 'list_products')],
    [Markup.button.callback('Установить мин. количество', 'set_min_items')],
    [Markup.button.callback('Управление админами', 'manage_admins')],
  ]);
}

// Функция для создания клавиатуры управления админами
function createAdminManagementKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Добавить админа', 'add_admin')],
    [Markup.button.callback('Удалить админа', 'delete_admin')],
    [Markup.button.callback('Список админов', 'list_admins')],
    [Markup.button.callback('Назад', 'back_to_menu')],
  ]);
}

// Функция для создания клавиатуры редактирования товара
function createEditProductKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Название', 'edit_name')],
    [Markup.button.callback('Цена', 'edit_price')],
    [Markup.button.callback('Фото', 'edit_photo')],
    [Markup.button.callback('Акция', 'edit_promo')],
    [Markup.button.callback('Назад', 'back_to_menu')],
  ]);
}

// Функция для создания клавиатуры да/нет
function createYesNoKeyboard(action, id) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('Да', `${action}_yes_${id}`),
      Markup.button.callback('Нет', `${action}_no_${id}`),
    ],
  ]);
}

// Команда /start
bot.start(async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (isUserAdmin) {
      await ctx.reply('Привет! Я бот для управления товарами в твоем мини-магазине.', createMenuKeyboard());
    } else {
      await ctx.reply(
        'Привет! Нажмите кнопку ниже, чтобы заказать товары:',
        Markup.inlineKeyboard([
          Markup.button.webApp('🛒 Заказать товары', WEBAPP_URL)
        ])
      );
    }
  } catch (error) {
    console.error('Ошибка при обработке команды /start:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Команда /menu для отображения кнопки "Заказать товары"
bot.command('menu', async (ctx) => {
  try {
    await ctx.reply('Нажмите кнопку ниже, чтобы заказать товары:', {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '🛒 Заказать товары',
              web_app: { url: WEBAPP_URL }
            }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('Ошибка при обработке команды /menu:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Настройка меню бота для группы
bot.telegram.setChatMenuButton({
  menu_button: {
    type: 'web_app',
    text: '🛒 Заказать товары',
    web_app: {
      url: WEBAPP_URL
    }
  }
}).catch(console.error);

// Обработка нажатий на кнопки
bot.action('add_product', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    ctx.session = { action: 'add_product' };
    await ctx.reply('Введите название товара:');
  } catch (error) {
    console.error('Ошибка при обработке кнопки add_product:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('edit_product', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    // Получаем список товаров из Redis
    const products = await redis.get('products') || [];
    
    if (products.length === 0) {
      await ctx.reply('Список товаров пуст. Сначала добавьте товары.');
      return;
    }
    
    let message = 'Выберите ID товара для редактирования:\n\n';
    products.forEach(product => {
      message += `ID: ${product.id} - ${product.name} - ${product.price} руб.\n`;
    });
    
    ctx.session = { action: 'edit_product' };
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки edit_product:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('delete_product', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    // Получаем список товаров из Redis
    const products = await redis.get('products') || [];
    
    if (products.length === 0) {
      await ctx.reply('Список товаров пуст. Сначала добавьте товары.');
      return;
    }
    
    let message = 'Выберите ID товара для удаления:\n\n';
    products.forEach(product => {
      message += `ID: ${product.id} - ${product.name} - ${product.price} руб.\n`;
    });
    
    ctx.session = { action: 'delete_product' };
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки delete_product:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('list_products', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    // Получаем список товаров из Redis
    const products = await redis.get('products') || [];
    
    if (products.length === 0) {
      await ctx.reply('Список товаров пуст.');
      return;
    }
    
    let message = 'Список товаров:\n\n';
    products.forEach(product => {
      message += `ID: ${product.id}\n`;
      message += `Название: ${product.name}\n`;
      message += `Цена: ${product.price} руб.\n`;
      message += `Акция: ${product.promo ? 'Да' : 'Нет'}\n\n`;
    });
    
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки list_products:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('set_min_items', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    // Получаем текущее минимальное количество товаров из Redis
    const minItems = await redis.get('minItems') || 1;
    
    ctx.session = { action: 'set_min_items' };
    await ctx.reply(`Текущее минимальное количество товаров: ${minItems}\nВведите новое значение:`);
  } catch (error) {
    console.error('Ошибка при обработке кнопки set_min_items:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('manage_admins', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.reply('Управление администраторами:', createAdminManagementKeyboard());
  } catch (error) {
    console.error('Ошибка при обработке кнопки manage_admins:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('add_admin', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    ctx.session = { action: 'add_admin' };
    await ctx.reply('Введите ID нового администратора:');
  } catch (error) {
    console.error('Ошибка при обработке кнопки add_admin:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('delete_admin', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    // Получаем список админов из Redis
    const admins = await redis.get('admins') || [];
    
    if (admins.length === 0) {
      await ctx.reply('Список администраторов пуст.');
      return;
    }
    
    let message = 'Выберите ID администратора для удаления:\n\n';
    admins.forEach(admin => {
      message += `ID: ${admin}\n`;
    });
    
    ctx.session = { action: 'delete_admin' };
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки delete_admin:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('list_admins', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    // Получаем список админов из Redis
    const admins = await redis.get('admins') || [];
    
    if (admins.length === 0) {
      await ctx.reply('Список администраторов пуст.');
      return;
    }
    
    let message = 'Список администраторов:\n\n';
    admins.forEach(admin => {
      message += `ID: ${admin}\n`;
    });
    
    await ctx.reply(message);
  } catch (error) {
    console.error('Ошибка при обработке кнопки list_admins:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

bot.action('back_to_menu', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    await ctx.reply('Главное меню:', createMenuKeyboard());
  } catch (error) {
    console.error('Ошибка при обработке кнопки back_to_menu:', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка кнопок редактирования товара
bot.action(/edit_(name|price|photo|promo)/, async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const field = ctx.match[1];
    
    if (!ctx.session.productId) {
      await ctx.reply('Сначала выберите товар для редактирования.');
      return;
    }
    
    ctx.session.editField = field;
    
    switch (field) {
      case 'name':
        await ctx.reply('Введите новое название товара:');
        break;
      case 'price':
        await ctx.reply('Введите новую цену товара:');
        break;
      case 'photo':
        await ctx.reply('Отправьте новую фотографию товара:');
        break;
      case 'promo':
        await ctx.reply('Сделать товар акционным?', createYesNoKeyboard('promo', ctx.session.productId));
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
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const answer = ctx.match[1];
    const productId = parseInt(ctx.match[2]);
    
    // Получаем список товаров из Redis
    const products = await redis.get('products') || [];
    
    // Находим товар по ID
    const productIndex = products.findIndex(product => product.id === productId);
    
    if (productIndex === -1) {
      await ctx.reply('Товар не найден.');
      return;
    }
    
    // Обновляем поле promo
    products[productIndex].promo = answer === 'yes';
    
    // Сохраняем обновленный список товаров в Redis
    await redis.set('products', products);
    
    await ctx.reply(`Товар ${products[productIndex].name} ${answer === 'yes' ? 'теперь акционный' : 'больше не акционный'}.`);
    await ctx.reply('Главное меню:', createMenuKeyboard());
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
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery();
    
    const answer = ctx.match[1];
    const productId = parseInt(ctx.match[2]);
    
    if (answer === 'no') {
      await ctx.reply('Удаление отменено.');
      await ctx.reply('Главное меню:', createMenuKeyboard());
      return;
    }
    
    // Получаем список товаров из Redis
    const products = await redis.get('products') || [];
    
    // Находим товар по ID
    const productIndex = products.findIndex(product => product.id === productId);
    
    if (productIndex === -1) {
      await ctx.reply('Товар не найден.');
      return;
    }
    
    // Удаляем товар из списка
    const deletedProduct = products.splice(productIndex, 1)[0];
    
    // Сохраняем обновленный список товаров в Redis
    await redis.set('products', products);
    
    await ctx.reply(`Товар ${deletedProduct.name} успешно удален.`);
    await ctx.reply('Главное меню:', createMenuKeyboard());
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
      await ctx.answerCbQuery('У вас нет доступа к этой функции.');
      return;
    }

    await ctx.answerCbQuery('Заказ отправлен на сборку!');
    
    const orderId = ctx.match[1];
    
    // Получаем заказ из Redis
    const order = await redis.get(`order:${orderId}`);
    
    if (!order) {
      await ctx.reply('Заказ не найден.');
      return;
    }
    
    // Обновляем статус заказа
    order.status = 'assembling';
    
    // Сохраняем обновленный заказ в Redis
    await redis.set(`order:${orderId}`, order);
    
    // Обновляем сообщение с заказом
    await ctx.editMessageText(ctx.update.callback_query.message.text + '\n\n🟢 Заказ отправлен на сборку!');
  } catch (error) {
    console.error('Ошибка при обработке кнопки "Отправить на сборку":', error);
    await ctx.answerCbQuery('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// Обработка получения фотографии
bot.on('photo', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.reply('У вас нет доступа к админ-панели.');
      return;
    }

    // Добавление товара
    if (ctx.session?.action === 'add_product' && ctx.session.product && ctx.session.product.price) {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      
      // Получаем счетчик товаров из Redis
      let productCounter = await redis.get('productCounter') || 0;
      
      // Увеличиваем счетчик
      productCounter++;
      
      // Создаем новый товар
      const newProduct = {
        id: productCounter,
        name: ctx.session.product.name,
        price: ctx.session.product.price,
        photo: fileId,
        promo: false,
      };
      
      // Получаем список товаров из Redis
      const products = await redis.get('products') || [];
      
      // Добавляем новый товар в список
      products.push(newProduct);
      
      // Сохраняем обновленный список товаров в Redis
      await redis.set('products', products);
      
      // Сохраняем обновленный счетчик товаров в Redis
      await redis.set('productCounter', productCounter);
      
      await ctx.reply(`Товар "${newProduct.name}" успешно добавлен.`);
      ctx.session = null;
      await ctx.reply('Главное меню:', createMenuKeyboard());
      return;
    }
    
    // Редактирование товара
    if (ctx.session?.action === 'edit_product' && ctx.session.productId && ctx.session.editField === 'photo') {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileId = photo.file_id;
      
      // Получаем список товаров из Redis
      const products = await redis.get('products') || [];
      
      // Находим товар по ID
      const productIndex = products.findIndex(product => product.id === ctx.session.productId);
      
      if (productIndex === -1) {
        await ctx.reply('Товар не найден.');
        ctx.session = null;
        return;
      }
      
      // Обновляем фото товара
      products[productIndex].photo = fileId;
      
      // Сохраняем обновленный список товаров в Redis
      await redis.set('products', products);
      
      await ctx.reply('Фотография товара успешно обновлена.');
      ctx.session = null;
      await ctx.reply('Главное меню:', createMenuKeyboard());
      return;
    }
  } catch (error) {
    console.error('Ошибка при обработке фотографии:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// ОБЪЕДИНЕННЫЙ обработчик сообщений
bot.on('message', async (ctx) => {
  try {
    // СНАЧАЛА проверяем, есть ли данные из WebApp
    if (ctx.message.web_app_data) {
      console.log('Получены данные из WebApp:', ctx.message.web_app_data.data);
      
      const data = JSON.parse(ctx.message.web_app_data.data);
      console.log('Распарсенные данные заказа:', data);
      
      // Получаем счетчик заказов из Redis
      let orderCounter = await redis.get('orderCounter') || 0;
      
      // Увеличиваем счетчик
      orderCounter++;
      
      // Создаем новый заказ
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

      // Сохраняем заказ в Redis
      await redis.set(`order:${orderCounter}`, newOrder);
      
      // Сохраняем обновленный счетчик заказов в Redis
      await redis.set('orderCounter', orderCounter);
      
      // Формируем сообщение с заказом
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
      
      console.log('Отправляем заказ в группу:', GROUP_ID);
      
      // Отправляем заказ в группу
      await bot.telegram.sendMessage(GROUP_ID, orderMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Отправить на сборку', callback_data: `assemble_${orderCounter}` }]
          ]
        }
      });
      
      // Отправляем подтверждение пользователю
      await ctx.reply('Ваш заказ успешно отправлен! Мы свяжемся с вами в ближайшее время.');
      
      return; // Важно! Выходим из функции, чтобы не обрабатывать как обычное текстовое сообщение
    }

    // ЕСЛИ это НЕ WebApp данные, то обрабатываем как обычное сообщение
    const userId = ctx.from.id;
    const isUserAdmin = await isAdmin(userId);

    if (!isUserAdmin) {
      await ctx.reply('У вас нет доступа к админ-панели.');
      return;
    }

    const text = ctx.message.text;
    
    // Добавление товара
    if (ctx.session?.action === 'add_product' && !ctx.session.product) {
      ctx.session.product = { name: text };
      await ctx.reply('Введите цену товара (руб.):');
      return;
    }
    
    if (ctx.session?.action === 'add_product' && ctx.session.product && !ctx.session.product.price) {
      const price = parseFloat(text);
      
      if (isNaN(price) || price <= 0) {
        await ctx.reply('Пожалуйста, введите корректную цену (положительное число):');
        return;
      }
      
      ctx.session.product.price = price;
      await ctx.reply('Отправьте фотографию товара:');
      return;
    }
    
    // Редактирование товара
    if (ctx.session?.action === 'edit_product' && !ctx.session.productId) {
      const productId = parseInt(text);
      
      if (isNaN(productId)) {
        await ctx.reply('Пожалуйста, введите корректный ID товара (число):');
        return;
      }
      
      // Получаем список товаров из Redis
      const products = await redis.get('products') || [];
      
      // Находим товар по ID
      const product = products.find(product => product.id === productId);
      
      if (!product) {
        await ctx.reply('Товар с таким ID не найден. Попробуйте еще раз:');
        return;
      }
      
      ctx.session.productId = productId;
      await ctx.reply(`Выбран товар: ${product.name}\nЧто вы хотите изменить?`, createEditProductKeyboard());
      return;
    }
    
    if (ctx.session?.action === 'edit_product' && ctx.session.productId && ctx.session.editField) {
      // Получаем список товаров из Redis
      const products = await redis.get('products') || [];
      
      // Находим товар по ID
      const productIndex = products.findIndex(product => product.id === ctx.session.productId);
      
      if (productIndex === -1) {
        await ctx.reply('Товар не найден.');
        ctx.session = null;
        return;
      }
      
      switch (ctx.session.editField) {
        case 'name':
          products[productIndex].name = text;
          await ctx.reply(`Название товара изменено на "${text}".`);
          break;
        case 'price':
          const price = parseFloat(text);
          
          if (isNaN(price) || price <= 0) {
            await ctx.reply('Пожалуйста, введите корректную цену (положительное число):');
            return;
          }
          
          products[productIndex].price = price;
          await ctx.reply(`Цена товара изменена на ${price} руб.`);
          break;
      }
      
      // Сохраняем обновленный список товаров в Redis
      await redis.set('products', products);
      
      ctx.session = null;
      await ctx.reply('Главное меню:', createMenuKeyboard());
      return;
    }
    
    // Удаление товара
    if (ctx.session?.action === 'delete_product' && !ctx.session.productId) {
      const productId = parseInt(text);
      
      if (isNaN(productId)) {
        await ctx.reply('Пожалуйста, введите корректный ID товара (число):');
        return;
      }
      
      // Получаем список товаров из Redis
      const products = await redis.get('products') || [];
      
      // Находим товар по ID
      const product = products.find(product => product.id === productId);
      
      if (!product) {
        await ctx.reply('Товар с таким ID не найден. Попробуйте еще раз:');
        return;
      }
      
      ctx.session.productId = productId;
      await ctx.reply(`Вы уверены, что хотите удалить товар "${product.name}"?`, createYesNoKeyboard('delete', productId));
      return;
    }
    
    // Установка минимального количества товаров
    if (ctx.session?.action === 'set_min_items') {
      const minItems = parseInt(text);
      
      if (isNaN(minItems) || minItems <= 0) {
        await ctx.reply('Пожалуйста, введите корректное значение (положительное число):');
        return;
      }
      
      // Сохраняем минимальное количество товаров в Redis
      await redis.set('minItems', minItems);
      
      await ctx.reply(`Минимальное количество товаров установлено: ${minItems}`);
      ctx.session = null;
      await ctx.reply('Главное меню:', createMenuKeyboard());
      return;
    }
    
    // Добавление администратора
    if (ctx.session?.action === 'add_admin') {
      const adminId = parseInt(text);
      
      if (isNaN(adminId)) {
        await ctx.reply('Пожалуйста, введите корректный ID администратора (число):');
        return;
      }
      
      // Получаем список админов из Redis
      const admins = await redis.get('admins') || [];
      
      // Проверяем, есть ли уже такой админ в списке
      if (admins.includes(adminId)) {
        await ctx.reply('Этот пользователь уже является администратором.');
        ctx.session = null;
        await ctx.reply('Главное меню:', createMenuKeyboard());
        return;
      }
      
      // Добавляем нового админа в список
      admins.push(adminId);
      
      // Сохраняем обновленный список админов в Redis
      await redis.set('admins', admins);
      
      await ctx.reply(`Администратор с ID ${adminId} успешно добавлен.`);
      ctx.session = null;
      await ctx.reply('Главное меню:', createMenuKeyboard());
      return;
    }
    
    // Удаление администратора
    if (ctx.session?.action === 'delete_admin') {
      const adminId = parseInt(text);
      
      if (isNaN(adminId)) {
        await ctx.reply('Пожалуйста, введите корректный ID администратора (число):');
        return;
      }
      
      // Получаем список админов из Redis
      const admins = await redis.get('admins') || [];
      
      // Находим админа в списке
      const adminIndex = admins.indexOf(adminId);
      
      if (adminIndex === -1) {
        await ctx.reply('Администратор с таким ID не найден.');
        ctx.session = null;
        await ctx.reply('Главное меню:', createMenuKeyboard());
        return;
      }
      
      // Проверяем, не пытается ли админ удалить сам себя
      if (adminId === userId) {
        await ctx.reply('Вы не можете удалить сами себя из списка администраторов.');
        ctx.session = null;
        await ctx.reply('Главное меню:', createMenuKeyboard());
        return;
      }
      
      // Удаляем админа из списка
      admins.splice(adminIndex, 1);
      
      // Сохраняем обновленный список админов в Redis
      await redis.set('admins', admins);
      
      await ctx.reply(`Администратор с ID ${adminId} успешно удален.`);
      ctx.session = null;
      await ctx.reply('Главное меню:', createMenuKeyboard());
      return;
    }
    
    // Если нет активной сессии или действия, показываем меню
    if (!ctx.session || !ctx.session.action) {
      await ctx.reply('Главное меню:', createMenuKeyboard());
    }
  } catch (error) {
    console.error('Ошибка при обработке сообщения:', error);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
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
