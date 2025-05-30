exports.handler = async function(event, context) {
  const url = process.env.UPSTASH_REDIS_REST_URL + '/get/products';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const botToken = process.env.BOT_TOKEN;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    console.log('Data from Redis:', data); // <--- Добавьте эту строку

    let products = data.result ? JSON.parse(data.result) : [];

    // Добавляем ссылку на фото, если есть file_id
    for (let product of products) {
      if (product.photo) {
        try {
          // Получаем информацию о файле
          const fileResponse = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${product.photo}`);
          const fileData = await fileResponse.json();
          
          if (fileData.ok) {
            product.photo_url = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
          }
        } catch (error) {
          console.error('Ошибка получения фото:', error);
        }
      }
    }

    console.log('Products:', products); // <--- Добавьте эту строку

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(products),
    };
  } catch (error) {
    console.error('Ошибка в products.js:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Ошибка при загрузке товаров' }),
    };
  }
};
