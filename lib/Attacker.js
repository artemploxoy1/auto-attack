class Attacker {
    constructor(bot, settings) {
        this.bot = bot;
        this.settings = settings;
        this.log = bot.sendLog;
        this.isActive = false;
        this.isEating = false; // Флаг приостановки кликов во время еды
        this.loopTimeout = null;

        // Обработчики событий еды
        this.startEatListener = () => {
            this.isEating = true;
            this.log('[AutoAttack] Авто-атака временно приостановлена: бот начал есть.');
        };

        this.stopEatListener = () => {
            this.isEating = false;
            this.log('[AutoAttack] Авто-атака возобновлена: бот закончил есть.');
        };

        this.bot.events.on('autoEat:start', this.startEatListener);
        this.bot.events.on('autoEat:stop', this.stopEatListener);
        this.bot.on('autoEat:start', this.startEatListener);
        this.bot.on('autoEat:stop', this.stopEatListener);
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.log('[AutoAttack] Авто-кликер в одну точку запущен.');
        this._loop();
    }

    stop() {
        if (!this.isActive) return;
        this.isActive = false;
        if (this.loopTimeout) {
            clearTimeout(this.loopTimeout);
            this.loopTimeout = null;
        }
        this.log('[AutoAttack] Авто-кликер остановлен.');
    }

    cleanup() {
        this.stop();
        this.bot.events.removeListener('autoEat:start', this.startEatListener);
        this.bot.events.removeListener('autoEat:stop', this.stopEatListener);
        this.bot.removeListener('autoEat:start', this.startEatListener);
        this.bot.removeListener('autoEat:stop', this.stopEatListener);
    }

    async _loop() {
        if (!this.isActive) return;

        try {
            // Динамически получаем настройки из конфига бота
            const plugin = this.bot.config.plugins?.find(p => p.name === 'auto-attack');
            let currentSettings = this.settings;
            if (plugin && plugin.settings) {
                try {
                    currentSettings = typeof plugin.settings === 'string' 
                        ? JSON.parse(plugin.settings) 
                        : plugin.settings;
                } catch (e) {
                    // Оставляем дефолтные настройки
                }
            }

            const preset = currentSettings.actionsPreset || 'fast';
            let cooldown = 600;
            let range = 3.5;
            let clickType = 'lmb';
            let bestWeaponEnabled = false;
            let criteria = 'damage';

            if (preset === 'fast') {
                cooldown = 400;
                clickType = 'lmb';
            } else if (preset === 'slow') {
                cooldown = 1000;
                clickType = 'lmb';
            } else {
                cooldown = Number(currentSettings.enableAttackCooldown ?? 600);
                range = Number(currentSettings.enableAttackRange ?? 3.5);
                clickType = currentSettings.enableClickType || 'lmb';
                bestWeaponEnabled = !!currentSettings.enableBestWeaponSelect;
                criteria = currentSettings.enableWeaponCriteria || 'damage';
            }

            // Если бот ест — ждем
            if (this.isEating) {
                this.loopTimeout = setTimeout(() => this._loop(), cooldown);
                return;
            }

            // Логика выбора лучшего оружия или слота
            if (bestWeaponEnabled) {
                if (criteria === 'custom') {
                    const slot = Number(currentSettings.enableCustomSlot ?? 0);
                    if (slot >= 0 && slot <= 8) {
                        this.bot.setQuickBarSlot(slot);
                    }
                } else {
                    const items = this.bot.inventory.items();
                    let bestItem = null;
                    let maxScore = -1;

                    for (const item of items) {
                        const score = this._getWeaponScore(item, criteria);
                        if (score > maxScore) {
                            maxScore = score;
                            bestItem = item;
                        }
                    }

                    if (bestItem) {
                        // Ищем, есть ли уже этот предмет в быстром доступе (слоты быстрых клавиш 36-44)
                        const quickbarItem = this.bot.inventory.slots.slice(36, 45).find(slot => slot && slot.name === bestItem.name);
                        if (quickbarItem) {
                            // Если предмет уже в хотбаре, просто переключаем на него слот (без кликов в инвентаре)
                            const slotIndex = quickbarItem.slot - 36;
                            this.bot.setQuickBarSlot(slotIndex);
                        } else {
                            // Если предмета нет в быстрой панели, переносим его в руку
                            if (!this.bot.heldItem || this.bot.heldItem.name !== bestItem.name) {
                                try {
                                    await this.bot.equip(bestItem, 'hand');
                                } catch (e) {
                                    this.log(`[AutoAttack] Ошибка автоматического выбора оружия: ${e.message}`);
                                }
                            }
                        }
                    }
                }
            }

            // Логика клика
            const target = this.bot.entityAtCursor(range);

            if (clickType === 'lmb') {
                if (target) {
                    this.bot.attack(target);
                } else {
                    this.bot.swingArm('hand');
                }
            } else if (clickType === 'rmb') {
                if (target) {
                    this.bot.activateEntity(target);
                } else {
                    this.bot.activateItem();
                }
            }

            this.loopTimeout = setTimeout(() => this._loop(), cooldown);
        } catch (error) {
            this.log(`[AutoAttack] Ошибка в цикле кликера: ${error.message}`);
            this.loopTimeout = setTimeout(() => this._loop(), 1000);
        }
    }

    _getWeaponScore(item, criteria) {
        if (!item) return -1;
        
        const isWeapon = item.name.includes('sword') || item.name.includes('axe') || item.name === 'trident';
        if (!isWeapon && criteria !== 'durability') return -1;

        if (criteria === 'damage') {
            const weaponBaseDamage = {
                'netherite_axe': 10,
                'diamond_axe': 9,
                'iron_axe': 9,
                'stone_axe': 9,
                'netherite_sword': 8,
                'diamond_sword': 7,
                'trident': 9,
                'golden_axe': 7,
                'wooden_axe': 7,
                'iron_sword': 6,
                'stone_sword': 5,
                'golden_sword': 4,
                'wooden_sword': 4
            };
            
            const base = weaponBaseDamage[item.name] || 1;
            let sharpBonus = 0;

            if (item.enchants) {
                const sharp = item.enchants.find(e => e.name === 'sharpness' || e.name === 'minecraft:sharpness');
                if (sharp) {
                    sharpBonus = 0.5 * sharp.level + 0.5;
                }
            }
            return base + sharpBonus;
        }

        if (criteria === 'durability') {
            if (item.maxDurability === undefined) return -1;
            const currentDurability = item.maxDurability - (item.durabilityUsed || 0);
            return currentDurability;
        }

        if (criteria === 'enchantments') {
            let enchantSum = 0;
            if (item.enchants) {
                for (const ench of item.enchants) {
                    enchantSum += ench.level;
                }
            }
            return enchantSum;
        }

        return 0;
    }
}

module.exports = Attacker;