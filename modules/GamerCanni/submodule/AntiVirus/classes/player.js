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
            this.atk_base  = data.atk_base ;
            this.def_base  = data.def_base ;
            this.ini_base  = data.ini_base ;
            this.maxHP = data.maxHP;
            this.state = data.state;
            this.weapon = new Weapon(true, data.weapon);
            this.experiance = data.experiance;
            this.cc = data.cc;
            this.stat_points = data.stat_points;
            this.loadInventory(data.inventory);
            this.loadWeapon_Inventory(data.weapon_inventory)
        } else {
            this.lv = 1;
            this.atk_base = 1;
            this.def_base = 1;
            this.ini_base = 2;
            this.maxHP = 10;
            this.state = "alive";
            let random = Tools.getRandomIntFromInterval(0, AV.starter_weapons.length - 1);
            this.weapon = new Weapon(false, AV.starter_weapons[random]);
            this.experiance = 0;
            this.cc = 0;
            this.inventory = [];
            this.weapon_inventory = [this.weapon];
            this.battle_inventory = [];
            this.stat_points = 0;
        }
        this.curHP = this.maxHP;

        this.type = "player";
        this.battle_on = false;
        this.battle_id = undefined;
        this.battle = undefined;
        this.def_bonus = false;
        this.def_bonus_val = 0.5;
        this.attack_is_logged = false;
        this.battle_duration_itmes = [];
        this.d_rest = "";

        this.selected_battle_item = undefined;
        this.alive_rounds = 0;
        this.item_target_finder_on = false;

        this.stat_select_on = false;

        this.stat_point_increase = 2;
        this.maxHP_increase = 5;

        this.inventory_on = false;
        this.shop_select_on = false;
        this.shop_on = false;
        this.shop_category = "n";
        this.curShop = undefined;
        this.equip_on = false;
        this.help_on = false;

        this.set_to_base();
        this.get_shops();
        this.item_selector();
        this.weapon_selector();
    }

    set_to_base() {
        this.atk = this.atk_base ;
        this.def = this.def_base;
        this.ini = this.ini_base;
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
        return Tools.parseReply(AV.config.displayStats, [this.name,this.lv,this.experiance, this.levelup_function(),this.cc,this.maxHP,this.atk_base,this.def_base,this.ini_base,this.weapon.name,this.weapon.lv,this.weapon.atk,this.weapon.atk_P]);
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

    receive_damage(dam,use_d_item = true) {
        let net, dam_multi,def, return_damage;
        dam_multi = this.get_dam_multiplicator();
        [def,return_damage] = this.get_def();

        net = Math.round(dam * dam_multi - def);
        if (use_d_item) {
            this.d_pass("use", "def");
        }
        if (net > 0) {
            this.curHP = this.curHP - net;
            return [net, this.curHP, return_damage]
        } else {
            return [0, this.curHP, return_damage]
        }
    }

    get_def() {
        let def, mul, add, return_damage;
        [mul, add, return_damage] = this.d_item_bonus("def");
        def = mul*this.def + add + this.get_def_bonus();
        if (def < 0) {
            return [0,return_damage];
        } else {
            return [def,return_damage];
        }
    }

    get_def_bonus() {
        if (this.def_bonus) {
            return Math.ceil(this.def * this.def_bonus_val);
        } else {
            return 0;
        }
    }

    get_dam_multiplicator() {
        let base;
        base = 1;
        if (this.ini <= 0) {
            base += -0.2 * this.ini + 0.3;
        }
        return base;
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
            message += Tools.parseReply(AV.config.heal_player_full, [this.name])
        } else {
            if (amount + this.curHP < this.maxHP) {
                this.curHP += amount;
                message += Tools.parseReply(AV.config.heal_player_part, [this.name, amount, this.curHP])
            } else {
                this.curHP = this.maxHP;
                message += Tools.parseReply(AV.config.heal_player_complete, [this.name, this.curHP])
            }
        }
        return message;
    }

    revive(full = false, amount = 0) {
        let message = "";
        this.state = "alive";
        this.curHP = 0;
        this.heal(full, amount);
        if (full) {
            message += Tools.parseReply(AV.config.rivive_player_full, [this.name])
        } else {
            message += Tools.parseReply(AV.config.revive_player_part, [this.name, amount])
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

    add_duration_item(item) {
        this.battle_duration_itmes.push(item);
        return "";
    }

    d_item_bonus(type) {
        let mul, add,return_damage;
        mul = 1;
        add = 0;
        return_damage = 0;
        this.battle_duration_itmes.forEach(item => {
            switch (type) {
                case "def" : {
                    if (item.def_bonus) {
                        add += item.def_bonus.add;
                        mul += item.def_bonus.mul;
                    }
                    break;
                }
                case "atk": {
                    if (item.atk_bonus) {
                        add += item.atk_bonus.add;
                        mul += item.atk_bonus.mul;
                    }
                    break;
                }
                case "init" : {
                    if (item.init_bonus) {
                        add += item.init_bonus.add;
                        mul += item.init_bonus.mul;
                    }
                    break;
                }
            }
            if (item.subtype === "offensive-shield") {
                return_damage += item.damage;
            }
        });
        return [mul,add,return_damage]
    }

    d_pass(type, subtype = "", store = false) {
        let tmp, message, info;
        tmp = [];
        message = "";

        this.battle_duration_itmes.forEach(item => {
            info = item.check_duration(type, this, subtype);
            if (info[0]) {
                message += info[1];
            } else {
                tmp.push(item);
            }
        });
        this.battle_duration_itmes = tmp;
        if (store) {
            this.d_rest += message;
            return "";
        } else {
            return message;
        }
    }

    d_pass_rest() {
        let tmp = this.d_rest;
        this.d_rest = "";
        return tmp;
    }
};