// Инициализация Telegram Web App
if (window.Telegram && window.Telegram.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  console.log('Telegram WebApp инициализирован');
} else {
  console.error('Telegram WebApp API не найден');
}

let cart = [];

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    console.log('Response status:', res.status);
    const products = await res.json();
    console.log('Products from API:', products);

    if (!Array.isArray(products) || products.length === 0) {
      showError('Нет доступных товаров.');
      return;
    }

    renderProducts(products);
  } catch (e) {
    console.error('Ошибка загрузки:', e);
    showError('Ошибка при загрузке товаров. Пожалуйста, попробуйте позже.');
  }
}

function renderProducts(products) {
  const productsContainer = document.getElementById('products-list');
  productsContainer.innerHTML = '';
  
  products.forEach(product => {
    const item = document.createElement('div');
    item.className = 'product-item';
    item.innerHTML = `
      <div class="product-image">
        ${product.photo_url ? `<img src="${product.photo_url}" alt="${product.name}" />` : '<div class="no-image">Нет фото</div>'}
      </div>
      <div class="product-info">
        <div class="product-title">${product.name}</div>
        <div class="product-price">${product.price} руб.</div>
        <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${product.name.replace(/'/g, "\\'")}', ${product.price})">
          Добавить в корзину
        </button>
      </div>
    `;
    productsContainer.appendChild(item);
  });
}

function addToCart(id, name, price) {
  const existingItem = cart.find(item => item.id === id);
  
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      id: id,
      name: name,
      price: price,
      quantity: 1
    });
  }
  
  updateCartDisplay();
  showNotification(`${name} добавлен в корзину!`);
}

function removeFromCart(id) {
  const itemIndex = cart.findIndex(item => item.id === id);
  
  if (itemIndex !== -1) {
    if (cart[itemIndex].quantity > 1) {
      cart[itemIndex].quantity -= 1;
    } else {
      cart.splice(itemIndex, 1);
    }
    updateCartDisplay();
  }
}

function updateCartDisplay() {
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Обновляем общую сумму
  const cartTotalElement = document.getElementById('cart-total');
  if (cartTotalElement) {
    cartTotalElement.textContent = `Итого: ${cartTotal} руб.`;
  }

  // Обновляем список товаров в корзине
  const cartItemsElement = document.getElementById('cart-items');
  if (cartItemsElement) {
    if (cart.length === 0) {
      cartItemsElement.innerHTML = '<div class="empty-cart">Корзина пуста</div>';
    } else {
      cartItemsElement.innerHTML = cart.map(item =>
        `<div class="cart-item">
          <div class="cart-item-info">
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-price">${item.price} руб. x ${item.quantity}</span>
          </div>
          <div class="cart-item-controls">
            <button class="cart-btn" onclick="removeFromCart(${item.id})">-</button>
            <span class="cart-quantity">${item.quantity}</span>
            <button class="cart-btn" onclick="addToCart(${item.id}, '${item.name.replace(/'/g, "\\'")}', ${item.price})">+</button>
          </div>
          <div class="cart-item-total">${item.price * item.quantity} руб.</div>
        </div>`
      ).join('');
    }
  }

  // Делаем кнопку "Оформить заказ" активной, если корзина не пуста
  const orderButton = document.getElementById('order-button');
  if (orderButton) {
    orderButton.disabled = cart.length === 0;
  }
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  
  const backgroundColor = type === 'error' ? '#f44336' : '#4CAF50';
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${backgroundColor};
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    z-index: 1000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-weight: 500;
    max-width: 300px;
    word-wrap: break-word;
    animation: slideIn 0.3s ease;
  `;
  
  // Добавляем CSS анимацию, если её нет
  if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 300);
  }, 3000);
}

function showError(message) {
  const productsContainer = document.getElementById('products-list');
  productsContainer.innerHTML = `
    <div class="error" style="
      text-align: center;
      padding: 40px 20px;
      color: #666;
      font-size: 16px;
    ">
      ${message}
    </div>
  `;
}

function handleOrder() {
  console.log('handleOrder вызвана'); // Для отладки
  
  // Получаем данные покупателя
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const comment = document.getElementById('customer-comment').value.trim();

  console.log('Данные формы:', { name, phone, address, comment }); // Для отладки

  // Проверяем обязательные поля
  if (!name || !phone || !address) {
    showNotification('Пожалуйста, заполните все обязательные поля!', 'error');
    return;
  }

  if (cart.length === 0) {
    showNotification('Корзина пуста!', 'error');
    return;
  }

  // Вычисляем общую стоимость
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Формируем данные для отправки в бота
  const orderData = {
    items: cart,
    totalPrice: totalPrice,
    customerName: name,
    customerPhone: phone,
    customerAddress: address,
    customerComment: comment
  };

  console.log("Данные перед отправкой в Telegram:", JSON.stringify(orderData)); // Для отладки

  try {
    // Проверяем доступность Telegram WebApp API
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.sendData) {
      console.log('Отправляем данные через Telegram WebApp API'); // Для отладки
      
      // Отправляем данные в Telegram бота
      window.Telegram.WebApp.sendData(JSON.stringify(orderData));
      
      // Очищаем корзину и форму после отправки
      cart = [];
      updateCartDisplay();
      document.getElementById('customer-name').value = '';
      document.getElementById('customer-phone').value = '';
      document.getElementById('customer-address').value = '';
      document.getElementById('customer-comment').value = '';
      
      showNotification('Заказ отправлен! Ожидайте подтверждения.');
      
      // Закрываем WebApp через небольшую задержку
      setTimeout(() => {
        if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.close) {
          window.Telegram.WebApp.close();
        }
      }, 2000);
      
    } else {
      console.error('Telegram WebApp API недоступен или метод sendData не найден');
      console.log('window.Telegram:', window.Telegram);
      if (window.Telegram) {
        console.log('window.Telegram.WebApp:', window.Telegram.WebApp);
      }
      
      // Fallback для тестирования вне Telegram
      showNotification('Тестовый режим: заказ сформирован, но не отправлен', 'error');
      console.log('Заказ (тестовый режим):', orderData);
    }
  } catch (error) {
    console.error('Ошибка при отправке заказа:', error);
    showNotification('Ошибка при отправке заказа!', 'error');
  }
}

// Инициализация при загрузке страницы
window.addEventListener('DOMContentLoaded', function() {
  console.log('DOM загружен, инициализируем приложение');
  
  // Загружаем товары
  loadProducts();
  
  // Инициализируем отображение корзины
  updateCartDisplay();
  
  // Привязываем обработчик к кнопке заказа
  const orderButton = document.getElementById('order-button');
  if (orderButton) {
    orderButton.addEventListener('click', handleOrder);
    console.log('Обработчик кнопки заказа привязан');
  } else {
    console.error('Кнопка order-button не найдена');
  }
});

// Дополнительные функции для работы с Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  // Настраиваем главную кнопку Telegram
  window.Telegram.WebApp.MainButton.setText('Оформить заказ');
  window.Telegram.WebApp.MainButton.onClick(handleOrder);
  
  // Показываем главную кнопку только когда корзина не пуста
  function updateMainButton() {
    if (cart.length > 0) {
      window.Telegram.WebApp.MainButton.show();
    } else {
      window.Telegram.WebApp.MainButton.hide();
    }
  }
  
  // Переопределяем updateCartDisplay для работы с главной кнопкой
  const originalUpdateCartDisplay = updateCartDisplay;
  updateCartDisplay = function() {
    originalUpdateCartDisplay();
    updateMainButton();
  };
}
