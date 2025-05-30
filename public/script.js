function renderProducts(products) {
  const productsContainer = document.getElementById('products');
  productsContainer.innerHTML = '';
  products.forEach(product => {
    const item = document.createElement('div');
    item.className = 'product-item';
    item.innerHTML = `
      <div class="product-title">${product.name}</div>
      <div class="product-price">${product.price} руб.</div>
      ${product.photo_url ? `<img src="${product.photo_url}" alt="${product.name}" />` : ''}
    `;
    productsContainer.appendChild(item);
  });
}

function showError(message) {
  const productsContainer = document.getElementById('products');
  productsContainer.innerHTML = `<div class="error">${message}</div>`;
}
