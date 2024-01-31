const TelegramBot = require('node-telegram-bot-api');
const { connectToDatabase, getClient } = require('./database');

const token = '6927474264:AAFRSj-B9Knl-ejfsOKm_S0fLgpS8rA1-Ng';
const bot = new TelegramBot(token, { polling: true });

connectToDatabase();

const userCollectionName = 'users';
const dbClient = getClient('test');
const userCollection = dbClient.db().collection(userCollectionName);

async function checkUserRegistration(userId) {
    const existingUser = await userCollection.findOne({ userId: userId });
    return existingUser !== null;
}

async function contactListener(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const phoneNumber = msg.contact.phone_number;

    const isUserRegistered = await checkUserRegistration(userId);

    // setting_id: userResult.insertedId, 
    // luck_percentage: 10, 
    // min_withdrawal_amount: 10, 
    // withdrawal_message: 'Ваш запрос на вывод принят', 
    // deposit_amounts: [10, 20, 50], 
    // conversion_rates: { USD: 1, EUR: 0.85 } 

    if (!isUserRegistered) {
        await userCollection.insertOne({
            userId: userId,
            phoneNumber: phoneNumber,
            username: msg.from.username,
            name: msg.from.first_name,
            balance: 0,
            luck: 50,
            min_balance_to_payout: 100,
            deposit_amounts: [10, 20, 50],
            hasBeenCounted: false
        });

        bot.sendMessage(chatId, `Спасибо за регистрацию, ${msg.from.first_name}! Теперь вы можете использовать доступные команды.`, {
            reply_markup: {
                remove_keyboard: true
            }
        });
    } else {
        bot.sendMessage(chatId, `Добро пожаловать обратно, ${msg.from.first_name}! Вы уже зарегистрированы.`);
    }
}

bot.on('contact', contactListener);

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Добро пожаловать! Для завершения регистрации, укажите свои данные:', {
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
});

const availableCommands = ['/play', '/help', '/deposit', '/payout', '/rules', '/support'];

let bet = 0;
let activeKeyboard = null;
let userSelectedDartType = null;

//play command
async function handlePlayCommand(chatId, userId) {
    const user = await userCollection.findOne({ userId: userId });
    const inlineKeyboard = {
        inline_keyboard: [
            [{ text: 'Мимо мишени', callback_data: 'dart_0' }],
            [{ text: 'Внешний круг мишени', callback_data: 'dart_2' }],
            [{ text: 'Внутренний круг мишени', callback_data: 'dart_1' }],
            [{ text: 'В яблочко', callback_data: 'dart_jackpot' }]
        ]
    };
    const inlineMessageOptions = {
        reply_markup: JSON.stringify(inlineKeyboard),
    };

    const keyboard = {
        keyboard: [
            [{ text: '🎯 Бросить дротик' }],
            [{ text: `💸 Ставка [${bet} 💎]` }, { text: `🚀 Множитель [x${k}]` }],
            [{ text: `💰 Баланс [${user.balance} 💎]` }, { text: '🏧 Валюта [💎]' }],
        ],
        resize_keyboard: true,
    };
    const messageOptions = {
        reply_markup: JSON.stringify(keyboard),
    };
    activeKeyboard = messageOptions.reply_markup;

    await bot.sendMessage(chatId, `Игра началась`, messageOptions);
    await bot.sendMessage(chatId, `Выберите вариант броска дротика:`, inlineMessageOptions);
    if (userSelectedDartType !== null) {
        await handleThrowDart(chatId, userId, userSelectedDartType);
        userSelectedDartType = null;
        return;
    }
}
//help command
async function handleHelpCommand(chatId) {
    activeKeyboard = null;
    bot.sendMessage(chatId, 'Как заработать? Щас расскажу', { reply_markup: { remove_keyboard: true } });
}
//depo command
async function handleDepositCommand(chatId, userId) {
    const user = await userCollection.findOne({ userId: userId });
    bot.sendMessage(chatId, 'Пополнение Вашего баланса', { reply_markup: { remove_keyboard: true } });
    if (user) {
        const depositButtons = user.deposit_amounts.map(amount => ({
            text: `${amount} USD`,
            callback_data: `deposit_${amount}`
        }));
        const keyboard = {
            inline_keyboard: [depositButtons]
        };
        bot.sendMessage(chatId, 'Выберите сумму для пополнения:', {
            reply_markup: keyboard
        });
    } else {
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, повторите попытку или обратитесь к поддержке.', { reply_markup: { remove_keyboard: true } });
    }
}
//payout command
async function handlePayoutCommand(chatId, userId) {
    const user = await userCollection.findOne({ userId: userId });
    bot.sendMessage(chatId, 'Вывод средств с Вашего баланса', { reply_markup: { remove_keyboard: true } });
    if (user) {
        bot.sendMessage(chatId, `Ваш текущий баланс: ${user.balance} USD. Для вывода средств обратитесь к вашему менеджеру для дальнейшей поддержки.\nМинимальная сумма для вывода: ${user.min_balance_to_payout} USD.`);
    } else {
        bot.sendMessage(chatId, 'Произошла ошибка. Пожалуйста, повторите попытку или обратитесь к поддержке.');
    }
}
//rules command
async function handleRulesCommand(chatId) {
    bot.sendMessage(chatId, 'Правила игры..', { reply_markup: { remove_keyboard: true } });
}
//support command
async function handleSupportCommand(chatId) {
    bot.sendMessage(chatId, 'С тобой бог!', { reply_markup: { remove_keyboard: true } });
}

availableCommands.forEach(command => {
    bot.onText(new RegExp(`^${command}$`), async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from.id;

        const isUserRegistered = await checkUserRegistration(userId);
        if (isUserRegistered) {
            switch (command) {
                case '/play':
                    await handlePlayCommand(chatId, userId);
                    break;
                case '/help':
                    await handleHelpCommand(chatId);
                    break;
                case '/deposit':
                    await handleDepositCommand(chatId, userId);
                    break;
                case '/payout':
                    await handlePayoutCommand(chatId, userId);
                    break;
                case '/rules':
                    await handleRulesCommand(chatId);
                    break;
                case '/support':
                    await handleSupportCommand(chatId);
                    break;
                default:
                    break;
            }
        } else {
            bot.sendMessage(chatId, 'Для доступа к командам необходимо зарегистрироваться. Используйте команду /start.');
        }
    });
});

let k = 1;
let wins = 0;
let awaitingMultiplierInput = null;

bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const user = await userCollection.findOne({ userId: userId });
    if (user) {
        switch (msg.text) {
            case '🎯 Бросить дротик':
                if (userSelectedDartType !== null) {
                    await handleThrowDart(chatId, userId, userSelectedDartType);
                    userSelectedDartType = null;
                    return;
                } else {
                    userSelectedDartType == 'dart_0';
                }
                break;
            case `💸 Ставка [${bet} 💎]`:
                bot.sendMessage(chatId, 'Введите вашу ставку:');
                global.awaitingBetInput = userId;
                break;
            case `🚀 Множитель [x${k}]`:
                bot.sendMessage(chatId, 'Введите новое значение множителя (не больше 100):');
                awaitingMultiplierInput = userId;
                break;
            case `💰 Баланс [${user.balance} 💎]`:
                await handleBalanceCommand(chatId);
                break;
            case '🏧 Валюта [💎]':
                // Обработка нажатия кнопки "Валюта"
                // Ваш код для работы с валютой
                break;
            default:
                break;
        }
    } else {
        bot.sendMessage(chatId, 'Пользователь не зарегистрирован');
    }
});
bot.on('text', async (msg) => {
    const userId = msg.from.id;
    if (global.awaitingBetInput === userId) {
        const betAmount = parseFloat(msg.text);
        if (!isNaN(betAmount) && betAmount >= 0 && betAmount <= 200) {
            bet = betAmount;
            bot.sendMessage(msg.chat.id, `Ваша ставка: ${bet}💎`);
        } else {
            bot.sendMessage(msg.chat.id, 'Пожалуйста, введите корректное число от 1 до 200.');
        }
        global.awaitingBetInput = null;
    }
});

async function handleMultiplyCommand(chatId, inputText) {
    const multiplierValue = parseFloat(inputText);
    if (!isNaN(multiplierValue) && multiplierValue > 0 && multiplierValue <= 100) {
        k = multiplierValue;
        bot.sendMessage(chatId, `Множитель успешно установлен: x${k}`);
    } else {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректное положительное число для множителя (не больше 100).');
    }
    activeKeyboard = null;
}

bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (awaitingMultiplierInput === userId) {
        await handleMultiplyCommand(chatId, userId, msg.text);
        awaitingMultiplierInput = null;
    }
});

async function handleBalanceCommand(chatId) {
    const keyboard = {
        inline_keyboard: [
            [{ text: 'Вывести средства', callback_data: 'payout_dollars' }],
            [{ text: 'Пополнить баланс', callback_data: 'deposit_dollars' }]
        ]
    };
    const messageOptions = {
        reply_markup: JSON.stringify(keyboard),
    };
    await bot.sendMessage(chatId, 'Выберите действие:', messageOptions);
}

function calculateDartResult(dartType) {
    switch (dartType) {
        case 'dart_1':
            return 1;
        case 'dart_2':
            return 1;
        case 'dart_0':
            return 1;
        case 'dart_jackpot':
            return 1;
        default:
            return 1;
    }
}

async function handleThrowDart(chatId, userId, userSelectedDartType) {
    const user = await userCollection.findOne({ userId: userId });
    if (!user) {
        bot.sendMessage(chatId, 'Пользователь не найден. Пожалуйста, зарегистрируйтесь.');
        return;
    }
    if (user.balance < bet) {
        bot.sendMessage(chatId, 'У вас недостаточно средств для броска дротика. Пополните баланс и попробуйте снова.');
        return;
    }
    if (bet == 0 || bet < 0) {
        bot.sendMessage(chatId, 'Минимальная ставка 1');
        return;
    }

    let dartType;
    if (user.luck === 50) {
        // Алгоритм для удачи 50%
        const dartOptions = ['dart_0', 'dart_2', 'dart_jackpot', 'dart_2', 'dart_1', 'dart_1'];
        dartType = dartOptions.shift();
        dartOptions.push(dartType);
    } else {
        // Алгоритм для других уровней удачи
        const dartOptions = ['dart_0', 'dart_1', 'dart_2', 'dart_jackpot'];
        dartType = dartOptions[Math.floor(Math.random() * dartOptions.length)];
    }
    const isWin = dartType === userSelectedDartType;

    console.log(`rand dart - ${dartType}\tuser dart - ${userSelectedDartType}`);
    const dartResult = calculateDartResult(dartType);

    const winnings = isWin ? Math.ceil(bet * dartResult * k) : 0;

    const newBalance = isWin ? user.balance + winnings : user.balance - bet;
    await userCollection.updateOne({ userId: userId }, {
        $set: { balance: newBalance }
    });

    if (isWin) {
        wins++;
        if (wins === 3) {
            k = 1.5;
        } else if (wins === 6) {
            k = 2;
        } else if (wins === 10) {
            k = 5;
        }
    } else {
        wins = 0;
        k = 1;
    }

    const resultMessage = isWin
        ? `Поздравляем! Вы выиграли ${winnings}💎\nВаш баланс: ${user.balance + winnings}💎`
        : `Увы, вы проиграли ${bet}💎\nВаш баланс: ${user.balance - bet}💎`;

    bot.sendMessage(chatId, resultMessage);
    const inlineKeyboard = {
        inline_keyboard: [
            [{ text: 'Мимо мишени', callback_data: 'dart_0' }],
            [{ text: 'Внешний круг мишени', callback_data: 'dart_2' }],
            [{ text: 'Внутренний круг мишени', callback_data: 'dart_1' }],
            [{ text: 'В яблочко', callback_data: 'dart_jackpot' }]
        ]
    };
    const inlineMessageOptions = {
        reply_markup: JSON.stringify(inlineKeyboard),
    };
    await bot.sendMessage(chatId, `Выберите вариант броска дротика:`, inlineMessageOptions);
}

bot.on('callback_query', async (query) => {
    const userId = query.from.id;
    const chatId = query.message.chat.id;

    switch (query.data) {
        case 'dart_1':
            userSelectedDartType = query.data;
            break;
        case 'dart_2':
            userSelectedDartType = query.data;
            break;
        case 'dart_0':
            userSelectedDartType = query.data;
            break;
        case 'dart_jackpot':
            userSelectedDartType = query.data;
            break;
        case 'payout_dollars':
            handlePayoutCommand(chatId, userId);
            break;
        case 'deposit_dollars':
            handleDepositCommand(chatId, userId);
            break;
    }
});