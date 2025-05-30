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
          <span>${item.name} x${item.quantity}</span>
          <span>${item.price * item.quantity} руб.</span>
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

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px;
    border-radius: 5px;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function showError(message) {
  const productsContainer = document.getElementById('products-list');
  productsContainer.innerHTML = `<div class="error">${message}</div>`;
}

window.addEventListener('DOMContentLoaded', loadProducts);
document.getElementById('order-button').addEventListener('click', handleOrder);

function handleOrder() {
  // Получаем данные покупателя
  const name = document.getElementById('customer-name').value.trim();
  const phone = document.getElementById('customer-phone').value.trim();
  const address = document.getElementById('customer-address').value.trim();
  const comment = document.getElementById('customer-comment').value.trim();

  // Проверяем обязательные поля
  if (!name || !phone || !address) {
    showNotification('Пожалуйста, заполните все обязательные поля!');
    return;
  }

  if (cart.length === 0) {
    showNotification('Корзина пуста!');
    return;
  }

  // Формируем заказ
  const order = {
    customer: { name, phone, address, comment },
    items: cart
  };

  // Отправляем заказ на сервер (пример: POST /api/order)
  fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showNotification('Заказ успешно отправлен!');
        cart = [];
        updateCartDisplay();
        // Можно очистить форму
        document.getElementById('customer-name').value = '';
        document.getElementById('customer-phone').value = '';
        document.getElementById('customer-address').value = '';
        document.getElementById('customer-comment').value = '';
      } else {
        showNotification('Ошибка при отправке заказа!');
      }
    })
    .catch(() => {
      showNotification('Ошибка при отправке заказа!');
    });
}
