const Attacker = require('./lib/Attacker.js');
const createHeadCommand = require('./commands/HeadCommand.js');

const PLUGIN_OWNER_ID = 'plugin:auto-attack';
const PERMISSION_NAME = 'autoattack.head';

const attackers = new Map();

async function onLoad(bot, options) {
    const log = bot.sendLog;
    const Command = bot.api.Command;
    const settings = options.settings || {};

    if (attackers.has(bot.config.id)) {
        attackers.get(bot.config.id).cleanup(); // Вызываем очистку для старого инстанса
    }

    const attackerInstance = new Attacker(bot, settings);
    attackers.set(bot.config.id, attackerInstance);

    const HeadCommand = createHeadCommand(Command);

    try {
        await bot.api.registerPermissions([{
            name: PERMISSION_NAME,
            description: 'Разрешает настраивать взгляд бота командой @head',
            owner: PLUGIN_OWNER_ID
        }]);

        await bot.api.registerCommand(new HeadCommand());

        // Автоматический запуск кликера при инициализации плагина
        attackerInstance.start();

        log(`[${PLUGIN_OWNER_ID}] Плагин авто-клика успешно загружен.`);
    } catch (error) {
        log(`[${PLUGIN_OWNER_ID}] Ошибка инициализации плагина: ${error.message}`);
    }
}

async function onUnload({ botId, prisma }) {
    if (attackers.has(botId)) {
        attackers.get(botId).cleanup(); // Корректная очистка всех слушателей и остановка таймеров
        attackers.delete(botId);
    }
    try {
        await prisma.command.deleteMany({ where: { botId, owner: PLUGIN_OWNER_ID } });
        await prisma.permission.deleteMany({ where: { botId, owner: PLUGIN_OWNER_ID } });
        console.log(`[${PLUGIN_OWNER_ID}] Ресурсы плагина для бота ${botId} очищены.`);
    } catch (error) {
        console.error(`[${PLUGIN_OWNER_ID}] Ошибка очистки ресурсов:`, error);
    }
}

module.exports = {
    onLoad,
    onUnload
};