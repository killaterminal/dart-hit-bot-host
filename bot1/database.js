const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://dart-hit:qwerty123zxc34@cluster0.ap1ucz1.mongodb.net/?retryWrites=true&w=majority';
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Успешное подключение к базе данных');
  } catch (err) {
    console.error('Ошибка подключения к базе данных:', err);
  }
}

function getClient() {
  return client;
}

module.exports = { connectToDatabase, getClient };
