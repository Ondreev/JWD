let cart = [];

async function loadProducts() {
  try {
    const res = await fetch('/.netlify/functions/products');
    console.log('Response status:', res.status); // <--- Добавьте эту строку
    const products = await res.json();
    console.log('Products from API:', products); // <--- Добавьте эту строку

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
        <button class="add-to-cart-btn" onclick="addToCart(${product.id}, '${product.name}', ${product.price})">
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
  
  // Показываем уведомление (без внешних библиотек)
  showNotification(`${name} добавлен в корзину!`);
}

function updateCartDisplay() {
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Обновляем счетчик корзины
  const cartCountElement = document.getElementById('cart-count');
  if (cartCountElement) {
    cartCountElement.textContent = cartCount;
  }
  
  // Обновляем общую сумму
  const cartTotalElement = document.getElementById('cart-total');
  if (cartTotalElement) {
    cartTotalElement.textContent = `${cartTotal} руб.`;
  }
}

function showNotification(message) {
  // Простое уведомление без внешних библиотек
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
