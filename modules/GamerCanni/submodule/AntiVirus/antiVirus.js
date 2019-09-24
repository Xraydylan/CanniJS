"use strict";

// @IMPORTS
const Application = require("../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../lib/Tools");
const fs = require('fs');
const Player = require('./classes/player');
const Enemy = require('./classes/enemy');
const Weapon = require('./classes/weapon');
const Item = require('./classes/item');
const Battle_PvE = require('./classes/battle_pve');
const Battle_PvE_Multi = require('./classes/battle_pve_multi');
const Shop = require('./classes/shop');
const Spawn = require('./classes/spawn');
const Help = require('./classes/help');
const AV = require('./antiVirus');


AV.av_path;
AV.config;
AV.player_data = [];
AV.weapons = [];
AV.starter_weapons = [];
AV.enemies = [];
AV.virus = [];
AV.worm = [];
AV.trojan =  [];
AV.items = [];
AV.shops = [];

AV.signup_on = {};
AV.signup_state = {};
AV.signup_name = {};

AV.multi_games = {};

AV.spawn;
AV.help;
AV.save;

AV.debug_on = false;
AV.dev = true;


//Debug "Application.modules.Discord.setMessageSent();" not yet implemented.
module.exports = class AntiVirus {
    static debug(val) {AV.debug_on = val; AV.dev = val;}

    static start() {
        if (AV.debug_on) {
            AV.av_path = ".";
        } else {
            AV.av_path = Application.config.rootDir + "/modules/GamerCanni/submodule/AntiVirus";
        }
        AV.save = AntiVirus.save_players;
        this.load();
    }

    static input(msg, input) {
        if (AV.signup_on[msg.author.id]) {
            return this.signup_manager(msg, input);
        }
        input = input.toLocaleLowerCase();

        if (this.check_player(msg)) {
            let p = this.get_player_by_id(msg.author.id);

            if (p.battle_on) {
                return this.battle_manager(msg, input, p)
            } else if (p.stat_select_on) {
                return this.point_manager(msg, input, p);
            } else if(p.inventory_on) {
                if (p.inventory.length) {
                    return this.inventory_manager(msg, input, p);
                } else {
                    p.inventory_on = false;
                }
            } else if (p.shop_on) {
                return this.shop_manager(msg, input, p);
            } else if (p.equip_on) {
                return this.equip_manager(msg, input, p);
            } else if (p.help_on) {
                return this.help_manager(msg, input, p);
            }

            if (AV.dev) {
                this.dev_manger(msg, p, input);
            }


            if(this.input_is_list(input,["stats","st"])) {
                this.displayStats(msg, p);
            } else if(this.input_is_list(input,["info", "i"])) {
                this.displayInfo(msg, p);
            } else if(this.input_is_list(input,["use points", "up"])) {
                this.point_start(msg,p);
            } else if(this.input_is_list(input,["inventory", "inv"])) {
                this.inventory_start(msg,p);
            } else if(this.input_is_list(input,["shop", "sh"])) {
                this.shop_start(msg,p);
            } else if(this.input_is_list(input,["weapons", "w", "equipment", "equip", "eq"])) {
                this.equip_start(msg,p);
            } else if (this.input_is_list(input,["scan","sc"])) {
                this.scan_for_enemy(msg,p,false);
            } else if (this.input_is_list(input,["grind","gr"])) {
                this.scan_for_enemy(msg,p,true);
            } else if (this.input_is_list(input,["help","h"])) {
                this.help_start(msg,p);
            } else if (this.input_is_list(input,["multi scan","msc"])) {
                this.multi_start(msg,p);
            } else if (this.input_is_list(input,["multi grind","mgr"])) {
                this.multi_start(msg,p, true);
            }


            if (this.input_is(input,"debug")) {
                this.battle_start(msg, p);
            }
        } else {
            if (this.input_is(input,"create new avs")) {

                this.signup_start(msg);
            } else {
                this.sender(msg,AV.config.DM_create_player_request);
            }
        }
    }


    static load() {
        this.loadConfig();
        this.loadWeapons();
        this.loadItems();
        this.loadEnemies();
        this.loadShops();
        this.loadPlayerData();
        this.loadSpawn();
        this.loadHelp();
    }

    static loadWeapons() {
        let path = AV.av_path + "/data/weapons.json";
        let data, tmp;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }

        if (data) {
            data.weapons.forEach(item => {
                tmp = new Weapon(true, item);
                AV.weapons.push(tmp);
                if (tmp.starter) {
                    AV.starter_weapons.push(tmp)
                }
            });
        }
    }

    static loadConfig() {
        let path = AV.av_path + "/data/config.json";
        try {
            AV.config = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }
    }

    static loadPlayerData() {
        let path = AV.av_path + "/data/data.json";
        let data;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            data = {};
        }

        if (data) {
            if (data.player_data) {
                data.player_data.forEach(item => {
                    AV.player_data.push(new Player(true,item))
                });
            }
        }
    }

    static loadEnemies() {
        let path = AV.av_path + "/data/enemies.json";
        let data, tmp;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }

        if (data) {
            data.virus.forEach(item => {
                tmp = new Enemy(true, item);
                AV.virus.push(tmp);
                AV.enemies.push(tmp);
            });
            data.worm.forEach(item => {
                tmp = new Enemy(true, item);
                AV.worm.push(tmp);
                AV.enemies.push(tmp);
            });
            data.trojan.forEach(item => {
                tmp = new Enemy(true, item);
                AV.trojan.push(tmp);
                AV.enemies.push(tmp);
            });
        }
    }

    static loadItems() {
        let path = AV.av_path + "/data/items.json";
        let data, tmp;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }

        if (data) {
            data.items.forEach(item => {
                tmp = new Item(true, item);
                AV.items.push(tmp);
            });
        }
    }

    static loadShops() {
        let path = AV.av_path + "/data/shops.json";
        let data, tmp;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }

        if (data) {
            data.shops.forEach(shop => {
                tmp = new Shop(true, shop);
                AV.shops.push(tmp);
            });
        }
    }

    static loadSpawn() {
        AV.spawn = new Spawn();
    }

    static loadHelp() {
        let txt_path = AV.av_path + "/data/text/help";
        AV.help = new Help(txt_path);
    }

    static save_players() {
        let path = AV.av_path + "/data/data.json";
        let save;
        let proc = this.process_player_data(AV.player_data);
        save = {"player_data": proc};
        fs.writeFile(path, JSON.stringify(save), function (err) {if (err) throw err;});
    }

    static process_player_data(data) {
        let p_list = [];
        let p_simple = {};
        data.forEach(player => {
            p_simple = {};
            p_simple.name = player.name;
            p_simple.id = player.id;
            p_simple.lv = player.lv;
            p_simple.atk = player.atk;
            p_simple.def = player.def;
            p_simple.ini = player.ini;
            p_simple.maxHP = player.maxHP;
            p_simple.state = player.state;
            p_simple.weapon = player.weapon;
            p_simple.experiance = player.experiance;
            p_simple.cc = player.cc;
            p_simple.inventory = player.inventory;
            p_simple.weapon_inventory = player.weapon_inventory;
            p_simple.stat_points = player.stat_points;
            p_list.push(p_simple);
        });
        return p_list;
    }

    static new_player(msg, name) {
        let data = {"name": name, "id": msg.author.id};
        AV.player_data.push(new Player(false, data));
        this.save_players();
    }

    static check_player(msg) {
        let cond = false;
        AV.player_data.forEach(player => {
            if (player.id.toString() === msg.author.id.toString()) {
                cond = true;
            }
        });
        return cond;
    }

    static get_player_by_id(id) {
        let player;
        AV.player_data.forEach(p => {
            if (p.id.toString() === id.toString()) {
                player = p;
            }
        });
        return player;
    }

    static input_includes(input, text) {
        return input.includes(text);
    }

    static input_includes_list(input, list) {
        let bool = false;
        list.forEach(text => {
            if (!bool) {
                bool = this.input_includes(input, text)
            }
        });
        return bool;
    }

    static input_is(input, text) {
        return input === text;
    }

    static input_is_list(input, list) {
        let bool = false;
        list.forEach(text => {
            if (!bool) {
                bool = this.input_is(input, text);
            }
        });
        return bool;
    }

    static input_starts_word(input, text) {
        let pre = input.split(" ");
        return pre[0] === text;
    }

    static input_starts_word_list(input, list) {
        let bool = false;
        list.forEach(text => {
            if (!bool) {
                bool = this.input_starts_word(input, text);
            }
        });
        return bool;
    }

    static signup_start(msg) {
        AV.signup_on[msg.author.id] = true;
        AV.signup_state[msg.author.id] = 0;
        this.senderDM(msg, AV.config.DM_signup_1)
    }

    static signup_manager(msg, input) {
        let state = AV.signup_state[msg.author.id];
        if (state === 0) {
            AV.signup_state[msg.author.id] = 1;
            AV.signup_name[msg.author.id] = input;
            this.senderDM(msg,Tools.parseReply(AV.config.DM_signup_2, [input]));
        } else if (state === 1) {
            input = input.toLocaleLowerCase();
            if (this.input_is_list(input, ["yes","y"])) {
                this.new_player(msg, AV.signup_name[msg.author.id]);
                this.senderDM(msg,AV.config.DM_signup_4);
                AV.signup_on[msg.author.id] = false;
                AV.signup_state[msg.author.id] = 2;
            } else if (this.input_is_list(input, ["no","n"])) {
                AV.signup_state[msg.author.id] = 0;
                this.senderDM(msg,Tools.parseReply(AV.config.DM_signup_3))
            }

        }
    }

    static displayStats(msg, p) {
    let content = p.stats();
    this.sender(msg, content);
}

    static displayInfo(msg,p) {
        let content = p.info();
        this.sender(msg, content);
    }



    static scan_for_enemy(msg,p,grind) {
        let message, enemy;
        [message, enemy] = AV.spawn.spawn(msg,p,grind);
        p.battle = new Battle_PvE(p, enemy, grind);
        this.sender(msg, Tools.parseReply(message));
    }

    static battle_start(msg, p) {
        let mon = new Enemy(false, AV.virus[0]);
        p.battle = new Battle_PvE(p, mon);
        this.sender(msg, Tools.parseReply(AV.config.startcombat,[mon.name]));
    }

    static battle_manager(msg, input, p) {
        input = input.toLocaleLowerCase();
        let battle = p.battle;
        if (battle.subtype === "pve-single") {
            this.battle_manager_single(msg, input, p, battle);
        } else if (battle.subtype === "pve-multi") {
            this.battle_manager_multi(msg, input, p, battle);
        }
    }

    static battle_manager_single(msg, input, p, battle) {
        if (battle.player.charge_on) {
            if (this.input_is_list(input, ["charge","ch"])) {
                this.sender(msg, battle.do_round("C"));
            } else if (this.input_is_list(input, ["release","re"])) {
                this.sender(msg, battle.do_round("R"));
            }
        } else if (p.battle_item_on) {
            this.battle_item_manager(msg, input, battle, p)
        } else {
            if (this.input_is_list(input, ["strike","st"])) {
                this.sender(msg, battle.do_round("S"));
            } else if (this.input_is_list(input, ["brute force","br"])) {
                this.sender(msg, battle.do_round("B"));
            } else if (this.input_is_list(input, ["charge","ch"])) {
                this.sender(msg, battle.do_round("C"));
            } else if (this.input_is_list(input, ["disrupt","dis"])) {
                this.sender(msg, battle.do_round("D"));
            } else if (this.input_is_list(input, ["item","i"])) {
                this.battle_item_use_start(msg, battle, p);
            } else if (this.input_is_list(input, ["data","d"])) {
                this.sender(msg, battle.data());
            }

            if (!p.battle) {
                this.save_players();
            }
        }
    }

    static battle_manager_multi(msg, input, p, battle) {
        let pre,num;
        if (battle.phase === 0) {
            if (this.input_is_list(input, ["start","s"])) {
                battle.phase = 1;
                this.sender(msg, Tools.parseReply(AV.config.multi_confirm_start));
            } else if (this.input_is_list(input, ["cancel","c"])) {
                this.sender(msg, battle.remove_player(p));
            }
        } else if (battle.phase === 1) {
            if (this.input_is_list(input, ["yes","y"])) {
                battle.phase = 2;
                this.sender(msg, battle.start_battle());
            } else if (this.input_is_list(input, ["no","n"])) {
                battle.phase = 1;
            }
        } else if (battle.phase === 2) {
            pre = input.split(" ");
            if (p.battle_item_on) {
                if (p.item_target_finder_on) {
                    this.battle_item_target_multi(msg, input, battle, p);
                } else {
                    this.battle_item_manager(msg, input, battle, p);
                }
            } else {
                if (pre.length >= 2) {
                    num = parseInt(pre[1]);
                    if (num) {
                        if (num <= battle.enemies_count) {
                            num -= 1;
                            if (p.charge_on) {
                                if (this.input_is_list(pre[0], ["release","re"])) {
                                    this.sender(msg, battle.attack_logger(p,"R", num));
                                }
                            } else {
                                if (this.input_is_list(pre[0], ["strike","st"])) {
                                    this.sender(msg, battle.attack_logger(p,"S", num));
                                } else if (this.input_includes_list(input, ["brute force","br"])) {
                                    this.sender(msg, battle.attack_logger(p,"B", num));
                                } else if (this.input_is_list(pre[0], ["disrupt","dis"])) {
                                    this.sender(msg, battle.attack_logger(p,"D", num));
                                }  else if (this.input_is_list(pre[0], ["data","d"])) {
                                    this.sender(msg, battle.data(p, num));
                                }
                            }
                        }
                    }
                }
                if (this.input_is_list(pre[0], ["charge","ch"])) {
                    this.sender(msg, battle.attack_logger(p,"C"));
                } else if (this.input_is_list(pre[0], ["item","i"])) {
                    this.battle_item_use_start(msg, battle, p);
                }

                if (!p.battle) {
                    this.save_players();
                }
            }
        }
    }


    static battle_item_use_start(msg, battle, p) {
        let message = "";
        if (p.state === "alive") {
            if (p.attack_is_logged) {
                message += Tools.parseReply(AV.config.multi_attack_already_selected, [p.name]);
            } else {
                if (p.items_battle_count === 0) {
                    message += p.selector_battle;
                } else {
                    p.battle_item_on = true;
                    message += Tools.parseReply(AV.config.startbattle_item);
                    message += p.selector_battle;
                }
            }
        } else {
            message += Tools.parseReply(AV.config.multi_defeated_can_not_attack, [p.name]);
        }

        this.sender(msg, message);
    }

    static battle_item_manager(msg, input, battle, p) {
        let num = parseInt(input);
        if (num) {
            if (num <= p.items_battle_count) {
                if (battle.subtype === "pve-single") {
                    this.sender(msg, battle.do_round("I", num - 1));
                    p.battle_item_on = false;
                } else if (battle.subtype === "pve-multi") {
                    this.sender(msg, battle.select_item(p, num - 1));
                }
            }
        } else {
            if (this.input_is_list(input, ["back","b"])) {
                p.battle_item_on = false;
                this.sender(msg, Tools.parseReply(AV.config.battle_choose_move,[p.name]))
            } else {
                this.sender(msg, Tools.parseReply(AV.config.battle_item_invalid, [p.name]))
            }
        }
    }

    static battle_item_target_multi(msg, input, battle, p) {
        let num = parseInt(input);
        if (num) {
            if (battle.item_target_resolve(p, num)) {
                this.sender(msg, battle.attack_logger(p,"I"));
                p.battle_item_on = false;
                p.selected_battle_item = undefined;
                p.item_target_finder_on = false;
            }
        } else {
            if (this.input_is_list(input, ["back","b"])) {
                p.battle_item_on = false;
                p.selected_battle_item = undefined;
                p.item_target_finder_on = false;
                this.sender(msg, Tools.parseReply(AV.config.battle_choose_move,[p.name]))
            } else {
                this.sender(msg, Tools.parseReply(AV.config.battle_item_invalid, [p.name]))
            }
        }
    }


    static point_start(msg, p) {
        let message = "";
        if (p.stat_points) {
            if (p.stat_points === 1) {
                message += Tools.parseReply(AV.config.points_available_point,[p.name, p.stat_points]);
            } else {
                message += Tools.parseReply(AV.config.points_available_points,[p.name, p.stat_points]);
            }
            message += Tools.parseReply(AV.config.points_stats,[p.atk,p.def,p.ini]);
            message += Tools.parseReply(AV.config.points_question);
            p.stat_select_on = true;
        } else {
            message = Tools.parseReply(AV.config.points_no_available_points,[p.name]);
        }
        this.senderDM(msg, message);
    }

    static point_manager(msg, input, p) {
        let message = "";
        if (this.input_is_list(input, ["attack","atk"])) {
            p.atk += 1;
            p.stat_points -= 1;
            this.save_players();
            message += Tools.parseReply(AV.config.increase_atk)
        } else if (this.input_is_list(input, ["defense","def"])) {
            p.def += 1;
            p.stat_points -= 1;
            this.save_players();
            message += Tools.parseReply(AV.config.increase_def)
        } else if (this.input_is_list(input, ["initiative","init"])) {
            p.ini += 1;
            p.stat_points -= 1;
            this.save_players();
            message += Tools.parseReply(AV.config.increase_ini)
        } else if (this.input_is_list(input, ["back","b"])) {
            p.stat_select_on = false;
            message += Tools.parseReply(AV.config.points_stop);
        }

        if(p.stat_points && p.stat_select_on) {
            if (p.stat_points === 1) {
                message += Tools.parseReply(AV.config.points_available_point,[p.name, p.stat_points]);
            } else {
                message += Tools.parseReply(AV.config.points_available_points,[p.name, p.stat_points]);
            }
            message += Tools.parseReply(AV.config.points_stats,[p.atk,p.def,p.ini]);
            message += Tools.parseReply(AV.config.points_question);
        } else {
            p.stat_select_on = false;
        }
        this.senderDM(msg, message);
    }


    static inventory_start(msg, p) {
        let message = "";
        if (p.items_count === 0) {
            message += p.selector;
        } else {
            p.inventory_on = true;
            message += Tools.parseReply(AV.config.startinventory);
            message += p.selector;
        }
        this.senderDM(msg, message);
    }

    static inventory_manager(msg, input, p) {
        let pre, num, item;
        let message = "";
        if (this.input_starts_word_list(input,["info", "i"])) {
            pre = input.split(" ");
            if (pre.length >= 2) {
                num = parseInt(pre[1]);
                if (num) {
                    if (num <= p.inventory.length) {
                        message += p.inventory[num - 1].info;
                        this.senderDM(msg, message);
                    }
                }
            }
        }
        if (this.input_starts_word_list(input,["use", "u"])) {
            pre = input.split(" ");
            if (pre.length >= 2) {
                num = parseInt(pre[1]);
                if (num) {
                    if (num <= p.inventory.length) {
                        item = p.inventory[num - 1];
                        if (item.types.includes("usable-item")) {
                            message += item.use([p], false);
                            this.save_players();
                        } else {
                            message += Tools.parseReply(AV.config.inventory_not_usable, [item.name]);
                        }
                        message += Tools.parseReply(AV.config.startinventory);
                        message += p.selector;
                        this.senderDM(msg, message);
                    }
                }
            }
        }
        if (this.input_is_list(input, ["back","b"])) {
            p.inventory_on = false;
        }
    }


    static shop_start(msg,p) {
        let message = "";
        if (p.shops_count === 0) {
            message += p.selector_shop;
        } else {
            p.shop_select_on = true;
            p.shop_on = true;
            message += Tools.parseReply(AV.config.startshop);
            message += p.selector_shop;
        }
        this.senderDM(msg, message);
    }

    static shop_manager(msg, input, p) {
        let pre, num, shop, item, amount, weapon;
        let message = "";
        if (p.shop_select_on) {
            pre = input.split(" ");
            num = parseInt(pre[0]);
            if (num) {
                if (num <= p.shops.length) {
                    p.curShop = p.shops[num-1];
                    message += Tools.parseReply(p.curShop.info_on_enter, [p.name]);
                    message += Tools.parseReply(AV.config.shop_cc, [p.cc]);
                    message += Tools.parseReply(AV.config.select_shop_category);
                    message += p.curShop.selector_category;
                    p.shop_category = "n";
                    p.shop_select_on = false;
                    this.senderDM(msg, message);
                }
            } else if (this.input_is_list(input, ["back","b", "exit", "e"])) {
                p.shop_select_on = false;
                p.shop_on = false;
            }
        } else {
            if (p.shop_category === "n") {
                pre = input.split(" ");
                num = parseInt(pre[0]);
                if (num <= p.curShop.category_count) {
                    p.shop_category = p.curShop.categories[num - 1].type;
                    message += Tools.parseReply(p.curShop.category_message(p.shop_category));
                    this.senderDM(msg, message);
                } else if (this.input_is_list(input, ["back","b"])) {
                    p.shop_select_on = true;
                    message += Tools.parseReply(AV.config.startshop);
                    message += p.selector_shop;
                    this.senderDM(msg, message);
                } else if (this.input_is_list(input,["exit", "e"])) {
                    message += Tools.parseReply(AV.config.shop_exit, [p.curShop.name]);
                    p.shop_select_on = false;
                    p.shop_on = false;
                    p.shop_category = "n";
                    p.curShop = undefined;
                    this.senderDM(msg, message);
                }
            } else if (p.shop_category === "i") {
                if (this.input_starts_word_list(input,["info", "i"])) {
                    pre = input.split(" ");
                    if (pre.length >= 2) {
                        num = parseInt(pre[1]);
                        if (num) {
                            if (num <= p.curShop.shopitems.length) {
                                message += p.curShop.shopitems[num - 1].info;
                                this.senderDM(msg, message);
                            }
                        }
                    }
                }

                if (this.input_starts_word_list(input,["buy", "bu"])) {
                    pre = input.split(" ");
                    if (pre.length >= 2) {
                        num = parseInt(pre[1]);
                        if (num) {
                            if (num <= p.curShop.shopitems.length) {
                                item = p.curShop.shopitems[num - 1];
                                if (p.cc >= item.value) {
                                    p.cc -= item.value;
                                    p.add_item(item.id);
                                    amount = p.inventory_get_item(item.id).number;
                                    this.save_players();
                                    message += Tools.parseReply(AV.config.shop_bought_item,[item.name, amount])
                                } else {
                                    message += Tools.parseReply(AV.config.shop_no_enough_cc_item,[item.name])
                                }
                                this.senderDM(msg, message);
                            }
                        }
                    }
                }

                if (this.input_is_list(input,["back", "b"])) {
                    message += Tools.parseReply(AV.config.select_shop_category);
                    message += p.curShop.selector_category;
                    p.shop_category = "n";
                    p.shop_select_on = false;
                    this.senderDM(msg, message);
                }

                if (this.input_is_list(input,["exit", "e"])) {
                    message += Tools.parseReply(AV.config.shop_exit, [p.curShop.name]);
                    p.shop_select_on = false;
                    p.shop_on = false;
                    p.shop_category = "n";
                    p.curShop = undefined;
                    this.senderDM(msg, message);
                }

            } else if (p.shop_category === "w") {
                if (this.input_starts_word_list(input,["info", "i"])) {
                    pre = input.split(" ");
                    if (pre.length >= 2) {
                        num = parseInt(pre[1]);
                        if (num) {
                            if (num <= p.curShop.shopweapons.length) {
                                message += p.curShop.shopweapons[num - 1].info;
                                this.senderDM(msg, message);
                            }
                        }
                    }
                }

                if (this.input_starts_word_list(input,["buy", "bu"])) {
                    pre = input.split(" ");
                    if (pre.length >= 2) {
                        num = parseInt(pre[1]);
                        if (num) {
                            if (num <= p.curShop.shopweapons.length) {
                                weapon = p.curShop.shopweapons[num - 1];
                                if (!p.inventory_get_weapon(weapon.id)) {
                                    if (p.cc >= weapon.value) {
                                        p.cc -= weapon.value;
                                        p.add_weapon(weapon.id);
                                        this.save_players();
                                        message += Tools.parseReply(AV.config.shop_bought_weapon,[weapon.name]);
                                    } else {
                                        message += Tools.parseReply(AV.config.shop_no_enough_cc_item,[weapon.name]);
                                    }
                                } else {
                                    message += Tools.parseReply(AV.config.shop_weapon_in_possession,[weapon.name])
                                }
                                this.senderDM(msg, message);
                            }
                        }
                    }
                }

                if (this.input_is_list(input,["back", "b"])) {
                    message += Tools.parseReply(AV.config.select_shop_category);
                    message += p.curShop.selector_category;
                    p.shop_category = "n";
                    p.shop_select_on = false;
                    this.senderDM(msg, message);
                }

                if (this.input_is_list(input,["exit", "e"])) {
                    message += Tools.parseReply(AV.config.shop_exit, [p.curShop.name]);
                    p.shop_select_on = false;
                    p.shop_on = false;
                    p.shop_category = "n";
                    p.curShop = undefined;
                    this.senderDM(msg, message);
                }
            }
        }
    }


    static equip_start(msg,p) {
        let message = "";
        p.weapon_selector();
        if (p.weapon_count === 0) {
            message += p.selector_weapon;
        } else {
            p.equip_on = true;
            message += Tools.parseReply(AV.config.startequip);
            message += p.selector_weapon;
        }
        this.senderDM(msg, message);
    }

    static equip_manager(msg, input, p) {
        let pre, num, weapon;
        let message = "";
        if (this.input_starts_word_list(input,["info", "i"])) {
            pre = input.split(" ");
            if (pre.length >= 2) {
                num = parseInt(pre[1]);
                if (num) {
                    if (num <= p.weapon_inventory.length) {
                        message += p.weapon_inventory[num - 1].info;
                        this.senderDM(msg, message);
                    }
                }
            }
        }
        if (this.input_starts_word_list(input,["use", "u", "equip", "eq"])) {
            pre = input.split(" ");
            if (pre.length >= 2) {
                num = parseInt(pre[1]);
                if (num) {
                    if (num <= p.weapon_inventory.length) {
                        weapon = p.weapon_inventory[num - 1];
                        if (weapon.id === p.weapon.id) {
                            message += Tools.parseReply(AV.config.weapon_already_equipped, [weapon.name]);
                        } else {
                            p.weapon = weapon;
                            p.weapon_selector();
                            this.save_players();
                            message += Tools.parseReply(AV.config.startequip);
                            message += p.selector_weapon;
                        }
                        this.senderDM(msg, message);
                    }
                }
            }
        }
        if (this.input_is_list(input, ["back","b"])) {
            p.equip_on = false;
        }
    }


    static help_start(msg,p) {
        let message = "";
        p.help_on = true;
        message += Tools.parseReply(AV.config.starthelp);
        message += AV.help.selector_help;
        this.senderDM(msg, message);
    }

    static help_manager(msg, input, p) {
        let pre, num, cat;
        let message = "";
        pre = input.split(" ");
        num = parseInt(pre[0]);
        if (num) {
            if (num <= AV.help.categories.length) {
                cat = AV.help.categories[num - 1];
                message += AV.help.get_help_info(cat);
                this.senderDM(msg, message);
            }
        }
        if (this.input_is_list(input, ["back","b"])) {
            p.help_on = false;
        }
    }

    static multi_start(msg, p, grind = false) {
        let multi, message, enemy;
        if (msg.channel.type === "dm") {
            this.senderDM(msg,Tools.parseReply(AV.config.multi_dm_channel));
        } else {
            message = "";
            multi = AV.multi_games[msg.channel.id];
            if (multi){
                if (multi.grind === grind) {
                    if (multi.phase) {
                        message = Tools.parseReply(AV.config.multi_join_not_possible, [p.name]);
                    } else {
                        if (p.battle) {
                            message = Tools.parseReply(AV.config.multi_already_in_battle, [p.name]);
                        } else {
                            [message, enemy] = AV.spawn.spawn(msg, p);
                            message = multi.new_player(p,enemy);
                            p.battle = multi;
                        }
                    }
                } else {
                    message = Tools.parseReply(AV.config.multi_already_different_type, [p.name]);
                }
            } else {
                [message, enemy] = AV.spawn.spawn(msg, p);
                multi = new Battle_PvE_Multi(p, enemy, msg.channel.id, grind);
                AV.multi_games[msg.channel.id] = multi;
                p.battle = multi;
                message = Tools.parseReply(AV.config.multi_start_player_search, [p.name]);
            }
            this.sender(msg,message);
        }
    }


    //Debug
    static sender(msg, content) {
        if (AV.debug_on) {
            console.log(content);
        } else {
            msg.channel.send(content);
            Application.modules.Discord.setMessageSent();
        }

    }

    static senderDM(msg, content) {
        if (AV.debug_on) {
            console.log("DM: " + content);
        } else {
            msg.author.send(content);
            Application.modules.Discord.setMessageSent();
        }

    }

    static dev_manger(msg, p, input) {
        let pre, num, message;
        if (this.input_includes(input, "gain_exp")) {
            pre = input.split(" ");
            if (pre.length > 1) {
                num = parseInt(pre[1]);
                if (num) {
                    message = p.gain_exp(num);
                    this.sender(msg, message);
                }
            }
        }
        if (this.input_includes(input, "gain_cc")) {
            pre = input.split(" ");
            if (pre.length > 1) {
                num = parseInt(pre[1]);
                if (num) {
                    message = p.gain_cc(num);
                    this.sender(msg, message);
                }
            }
        }
        if (this.input_includes(input, "get_item")) {
            pre = input.split(" ");
            if (pre.length > 1) {
                num = parseInt(pre[1]);
                if (num) {
                    p.add_item(num);
                }
            }
        }
        if (this.input_includes(input, "save")) {
            this.save_players();
        }
    }
};