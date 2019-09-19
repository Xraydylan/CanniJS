const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Weapon = require('./weapon');
const Item = require('./item');
const Enemy = require('./enemy');
const Battle_PvE = require('./battle_pve');
const Shop = require('./shop');


module.exports = class Player {
    constructor(load, data) {
        this.name = data.name;
        this.id = data.id;
        if (load) {
            this.lv = data.lv;
            this.atk = data.atk;
            this.def = data.def;
            this.ini = data.ini;
            this.maxHP = data.maxHP;
            this.state = data.state;
            this.weapon = new Weapon(true, data.weapon);
            this.experiance = data.experiance;
            this.cc = data.cc;
            this.loadInventory(data.inventory);
            this.loadWeapon_Inventory(data.weapon_inventory)
        } else {
            this.lv = 1;
            this.atk = 1;
            this.def = 1;
            this.ini = 2;
            this.maxHP = 10;
            this.state = "alive";
            let random = Tools.getRandomIntFromInterval(0, AV.starter_weapons.length - 1);
            this.weapon = new Weapon(false, AV.starter_weapons[random]);
            this.experiance = 0;
            this.cc = 0;
            this.inventory = [];
            this.weapon_inventory = [this.weapon];
            this.battle_inventory = [];
        }
        this.curHP = this.maxHP;

        this.type = "player";
        this.battle_on = false;
        this.battle_id = undefined;
        this.battle = undefined;

        this.stat_select_on = false;
        this.stat_points = 0;

        this.stat_point_increase = 2;
        this.maxHP_increase = 5;

        this.inventory_on = false;
        this.shop_select_on = false;
        this.shop_on = false;
        this.shop_category = "n";
        this.curShop = undefined;
        this.equip_on = false;
        this.help_on = false;


        this.get_shops();
        this.item_selector();
        this.weapon_selector();
    }

    get_shops() {
        let pre = [];
        AV.shops.forEach(shop => {
           if (this.lv >= shop.lv)  {
               pre.push(new Shop(false, shop));
           }
        });
        this.shops = pre;
        this.shop_selector();
    }

    get_exp_ration() {
        return Math.floor(100 * (this.experiance/this.levelup_function()));
    }

    loadInventory(data) {
        let inventory = [];
        let battle_inventory = [];
        data.forEach(item => {
            let it = new Item(true, item);
            inventory.push(it);
            if (item.types.includes("battle-item")) {
                battle_inventory.push(it);
            }
        });
        this.inventory = inventory;
        this.battle_inventory = battle_inventory;
    }

    loadWeapon_Inventory(data) {
        let w;
        let w_inventory = [];
        data.forEach(weapon => {
            if (weapon.id === this.weapon.id) {
                w = this.weapon;
            } else {
                w = new Weapon(true, weapon);
            }
            w_inventory.push(w);
        });
        this.weapon_inventory = w_inventory;
    }

    stats() {
        return Tools.parseReply(AV.config.displayStats, [this.name,this.lv,this.experiance, this.levelup_function(),this.cc,this.maxHP,this.atk,this.def,this.ini,this.weapon.name,this.weapon.lv,this.weapon.atk,this.weapon.atk_P]);
    }

    info() {
        let message = Tools.parseReply(AV.config.info, [this.name]);
        if (this.stat_points) {
            message += Tools.parseReply(AV.config.info_available_stat_points, [this.stat_points])
        } else {
            message += Tools.parseReply(AV.config.info_normal)
        }
        return message;
    }

    receive_damage(dam) {
        let net = dam - this.def;
        if (net > 0) {
            this.curHP = this.curHP - net;
            return [net, this.curHP]
        } else {
            return [0, this.curHP]
        }
    }

    defeated_message(enemy) {
        let message = Tools.parseReply(AV.config.player_defeat, [this.name]);
        return message;
    }

    gain_exp(exp) {
        this.experiance += exp;
        let message = Tools.parseReply(AV.config.exp_gain, [this.name, exp]);

        message += this.check_levelup();
        return message;
    }

    gain_cc(cc) {
        this.cc += cc;
        let message = Tools.parseReply(AV.config.cc_gain, [this.name, cc]);
        return message;
    }

    check_levelup() {
        let message = "";
        if (this.experiance >= this.levelup_function()) {
            this.experiance -= this.levelup_function();
            this.do_levelup();
            message += Tools.parseReply(AV.config.levelup, [this.name, this.lv, this.experiance, this.levelup_function()]);
            message += this.check_levelup();
            this.get_shops();
            return message;
        }
        else {
            return message;
        }

    }

    do_levelup() {
        this.lv += 1;
        this.maxHP += this.maxHP_increase;
        this.stat_points += this.stat_point_increase;
    }

    levelup_function(x = 20) {
        return this.lv * x
    }

    heal(full = false, amount = 0) {
        let message = "";
        if (full) {
            this.curHP = this.maxHP;
            message += Tools.parseReply(AV.config.heal_player_full)
        } else {
            if (amount + this.curHP < this.maxHP) {
                this.curHP += amount;
                message += Tools.parseReply(AV.config.heal_player_part, [amount, this.curHP])
            } else {
                this.curHP = this.maxHP;
                message += Tools.parseReply(AV.config.heal_player_complete, [this.curHP])
            }
        }
        return message;
    }

    item_selector() {
        let sel = "";
        let sel_bat = "";
        let count = 1;
        let count_bat = 1;

        if (this.inventory.length === 0) {
            sel += Tools.parseReply(AV.config.selector_no_items, [this.name]);
            this.items_count = count - 1;
        } else {
            this.inventory.forEach(item => {
                sel += Tools.parseReply(AV.config.selector_pattern, [count, item.number, item.name]);
                count += 1;
            });
            this.items_count = count - 1;
        }

        if (this.battle_inventory.length === 0) {
            sel_bat += Tools.parseReply(AV.config.selector_no_items_battle, [this.name]);
            this.items_battle_count = count_bat - 1
        } else {
            this.battle_inventory.forEach(item => {
                sel_bat += Tools.parseReply(AV.config.selector_pattern, [count_bat, item.number, item.name]);
                count_bat += 1;
            });
            this.items_battle_count = count_bat - 1
        }

        this.selector = sel;
        this.selector_battle = sel_bat;
    }

    shop_selector() {
        let sel = "";
        let count = 1;

        if (this.shops.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_shops, [this.name]);
            this.shops_count = count - 1;
        } else {
            this.shops.forEach(shop => {
                sel += Tools.parseReply(AV.config.selector_pattern_shop, [count, shop.name]);
                count += 1;
            });
            this.shops_count = count - 1;
        }
        this.selector_shop = sel;
    }

    weapon_selector() {
        let sel = "";
        let count = 1;
        let equipped = "";

        if (this.weapon_inventory.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_weapons, [this.name]);
            this.weapon_count = count - 1;
        } else {
            this.weapon_inventory.forEach(weapon => {
                if (this.weapon === weapon) {
                    equipped = "  <--  Equipped";
                } else {
                    equipped = "";
                }
                sel += Tools.parseReply(AV.config.selector_pattern_weapons, [count, weapon.name, equipped]);
                count += 1;
            });
            this.weapon_count = count - 1;
        }
        this.selector_weapon = sel;
    }

    inventory_get_item(id) {
        let obj = undefined;
        this.inventory.forEach(item => {
            if (item.id === parseInt(id)) {
                obj = item;
            }
        });
        return obj;
    }

    inventory_get_weapon(id) {
        let obj = undefined;
        this.weapon_inventory.forEach(weapon => {
            if (weapon.id === parseInt(id)) {
                obj = weapon;
            }
        });
        return obj;
    }

    add_item(id, num = 1) {
        let item = this.inventory_get_item(id);
        if (item) {
            item.number += num;
        } else {
            item = new Item(true, Item.get_item_by_id(id));
            if (item) {
                item.number = num;
                this.inventory.push(item);
                if (item.types.includes("battle-item")) {
                    this.battle_inventory.push(item);
                }
            }
        }
        this.item_selector();
    }

    sub_item(id, num = 1) {
        let item = this.inventory_get_item(id);
        if (item) {
            item.number -= num;
            if (item.number <= 0) {
                let index = this.inventory.indexOf(item);
                if (index > -1) {
                    this.inventory.splice(index, 1);
                }
                index = this.battle_inventory.indexOf(item);
                if (index > -1) {
                    this.battle_inventory.splice(index, 1);
                }
            }
        }
        this.item_selector();
    }

    add_weapon(id) {
        if (!this.inventory_get_weapon(id)) {
            let weapon = Weapon.get_weapon_by_id(id);
            if (weapon) {
                this.weapon_inventory.push(new Weapon(false, weapon));
                this.weapon_selector();
            }
        }
    }

    sub_weapon(id) {
        let weapon = this.inventory_get_weapon(id);
        if (weapon) {
            let index = this.weapon_inventory.indexOf(item);
            if (index > -1) {
                this.weapon_inventory.splice(index, 1);
            }
            this.weapon_selector();
        }
    }
};