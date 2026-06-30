module.exports = (Command) => {
    return class HeadCommand extends Command {
        constructor() {
            super({
                name: 'head',
                description: 'Поворот головы бота на заданный угол относительно текущего взгляда (налево, направо, вверх, вниз).',
                aliases: ['голова'],
                permissions: 'autoattack.head',
                owner: 'plugin:auto-attack',
                args: [
                    {
                        name: 'direction',
                        type: 'string',
                        required: true,
                        description: 'Направление: налево, направо, вверх, вниз'
                    },
                    {
                        name: 'degrees',
                        type: 'number',
                        required: true,
                        description: 'Угол поворота в градусах'
                    }
                ],
                allowedChatTypes: ['chat', 'private', 'clan']
            });
        }

        async handler(bot, typeChat, user, { direction, degrees }) {
            const angleRad = parseFloat(degrees) * (Math.PI / 180);
            if (isNaN(angleRad)) {
                // Ошибки формата всё еще логируются в ЛС или консоль для отладки
                bot.api.sendMessage('private', 'Ошибка: Угол должен быть числовым значением.', user.username);
                return;
            }

            let yaw = bot.entity.yaw;
            let pitch = bot.entity.pitch;
            const dir = direction.toLowerCase();

            // Корректируем направление (знаки вертикального наклона изменены)
            if (dir === 'налево') {
                yaw += angleRad;
            } else if (dir === 'направо') {
                yaw -= angleRad;
            } else if (dir === 'вверх') {
                pitch += angleRad; // Изменено
            } else if (dir === 'вниз') {
                pitch -= angleRad; // Изменено
            } else {
                bot.api.sendMessage('private', 'Ошибка: Направление должно быть одним из: налево, направо, вверх, вниз.', user.username);
                return;
            }

            // Предотвращаем переворот камеры
            pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

            try {
                await bot.look(yaw, pitch, true);
                
                // Расчет значений для записи во внутренний лог панели
                const currentYawDeg = Math.round((yaw * (180 / Math.PI)) % 360);
                const currentPitchDeg = Math.round(pitch * (180 / Math.PI));
                
                bot.sendLog(`[AutoAttack] Взгляд изменен (${dir} на ${degrees}°). Yaw=${currentYawDeg}°, Pitch=${currentPitchDeg}°`);
            } catch (error) {
                bot.sendLog(`[AutoAttack] Ошибка при регулировании взгляда: ${error.message}`);
            }
        }
    }
};