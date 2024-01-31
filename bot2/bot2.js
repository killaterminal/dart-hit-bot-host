const TelegramBot = require('node-telegram-bot-api');
const { connectToDatabase, getClient } = require('./database');

const botToken = '6404706952:AAGRRkrNxa_XODYZ8B6XkKnGaHkFNJEDlA4';
const bot2 = new TelegramBot(botToken, { polling: true });

connectToDatabase();

const userCollectionName = 'partners';
const dbClient = getClient();
const userCollection = dbClient.db().collection(userCollectionName);

const availableCommands = ['/addmamont', '/mymamonts'];

async function checkPartnerRegistration(userId) {
    const existingUser = await userCollection.findOne({ userId: userId });
    return existingUser !== null;
}

availableCommands.forEach(command => {
    bot2.onText(new RegExp(`^${command}$`), async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const isUserRegistered = await checkPartnerRegistration(userId);
        if (isUserRegistered) {
            switch (command) {
                case '/addmamont':
                    break;
                case '/mymamonts':
                    break;
                default:
                    break;
            }
        } else {
            bot2.sendMessage(chatId, 'Для доступа к командам необходимо зарегистрироваться. Используйте команду /start.');
        }
    });
});

async function contactListener(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const phoneNumber = msg.contact.phone_number;

    const isUserRegistered = await checkPartnerRegistration(userId);
    if (!isUserRegistered) {
        await userCollection.insertOne({
            userId: userId,
            phoneNumber: phoneNumber,
            username: msg.from.username,
            name: msg.from.first_name,
            referals: 0
        });
        bot2.sendMessage(chatId, `Спасибо за регистрацию, ${msg.from.first_name}! Теперь вы можете внести данные мамонта`, {
            reply_markup: {
                remove_keyboard: true
            }
        });
    } else {
        bot2.sendMessage(chatId, `Добро пожаловать обратно, ${msg.from.first_name}! Вы уже зарегистрированы.`);
    }
}

bot2.on('contact', contactListener);

const checkCollectionName = 'users';
const checkCollection = dbClient.db().collection(checkCollectionName);

async function checkAndUpdateReferals(userId, searchValue) {
    const user = await checkCollection.findOne({ phoneNumber: searchValue });

    if (!user) {
        return false;
    }
    if (user.hasBeenCounted) {
        return false;
    }

    console.log(`mamonttt ----  ${userId}`);
    await userCollection.updateOne(
        { userId: userId },
        { $inc: { referals: 1 } }
    );
    await checkCollection.updateOne(
        { phoneNumber: searchValue },
        { $set: { hasBeenCounted: true } }
    );
    return true;
}

async function search(userId, searchValue) {
    const isReferalUpdated = await checkAndUpdateReferals(userId, searchValue);
    if (isReferalUpdated) {
        console.log('Счетчик referals инкрементирован.');
        return true;
    } else {
        console.log('Объект не найден в таблице users.');
        return false;
    }
}

bot2.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const isUserRegistered = await checkPartnerRegistration(userId);

    if (!isUserRegistered) {
        bot2.sendMessage(chatId, 'Для завершения регистрации, укажите свои данные:', {
            reply_markup: {
                keyboard: [
                    [{
                        text: 'Отправить номер телефона',
                        request_contact: true
                    }]
                ],
                resize_keyboard: true,
                one_time_keyboard: true
            }
        });
    } else {
        bot2.sendMessage(chatId, 'Добро пожаловать обратно, вы уже зарегистрированы.');
    }
});

bot2.onText(/\/addmamont/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await userCollection.findOne({ userId: userId });

    if (user) {
        bot2.sendMessage(chatId, 'Введите номер телефона для поиска мамонта\nНапример:\nРоссия 🇷🇺 - *7*1234567890\nУзбекистан 🇺🇿 - *998*123456789\nКиргизия (Кыргызстан) 🇰🇬 - *996*123456789', {
            reply_markup: {
                force_reply: true,
            },
            parse_mode: 'Markdown'
        }).then(sentMessage => {
            bot2.on('message', async (msg) => {
                const receivedMessageChatId = msg.chat.id;
                const receivedMessageUserId = msg.from.id;

                if (
                    receivedMessageChatId === chatId &&
                    receivedMessageUserId === userId &&
                    msg.reply_to_message &&
                    msg.reply_to_message.message_id === sentMessage.message_id
                ) {
                    const searchValue = msg.text.trim();

                    if (await search(userId, searchValue) === true)
                        bot2.sendMessage(chatId, `Мамонт засчитан`);
                    else
                        bot2.sendMessage(chatId, 'Мамонт уже был засчитан');
                }
            });
        });
        bot2.sendMessage(chatId, '*ПРИМЕЧАНИЕ*\nВаш мамонт может быть не зарегистрирован', { parse_mode: 'Markdown' });

    } else {
        bot2.sendMessage(chatId, 'Вы не зарегистрированы.');
    }
});

bot2.onText(/\/mymamonts/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const user = await userCollection.findOne({ userId: userId });

    if (user) {
        bot2.sendMessage(chatId, `Количество приведённых мамонтов: ${user.referals}`);
    } else {
        bot2.sendMessage(chatId, 'Вы не зарегистрированы.');
    }
});