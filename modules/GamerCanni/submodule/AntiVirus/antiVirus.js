"use strict";

// @IMPORTS
const Application = require("../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../lib/Tools");
const fs = require('fs');
const Player = require('./classes/player');
const Weapon = require('./classes/weapon');
const Item = require('./classes/item');
const Enemy = require('./classes/enemy');
const Battle_PvE = require('./classes/battle_pve');
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

AV.signup_on = {};
AV.signup_state = {};
AV.signup_name = {};

AV.debug_on = false;
AV.dev = false;


//Debug "Application.modules.Discord.setMessageSent();" not yet implemented.
module.exports = class AntiVirus {
    static debug(val) {AV.debug_on = val; AV.dev = val;}

    static start() {
        if (AV.debug_on) {
            AV.av_path = ".";
        } else {
            AV.av_path = Application.config.rootDir + "/modules/GamerCanni/submodule/AntiVirus";
        }

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

            }

            if (AV.dev) {
                this.dev_manger(msg, p, input);
            }


            if(this.input_is_list(input,["stats","st"])) {
                this.displayStats(msg, p);
            } else if(this.input_is_list(input,["info", "i"])) {
                this.displayInfo(msg, p)
            } else if(this.input_is_list(input,["use points", "up"])) {
                this.point_start(msg,p)
            } else if(this.input_is_list(input,["inventory", "inv"])) {
                this.inventory_start(msg,p)
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
        this.loadPlayerData();
        this.loadEnemies();

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

    static save_players() {
        let path = AV.av_path + "/data/data.json";
        let save;
        save = {"player_data": AV.player_data};
        fs.writeFile(path, JSON.stringify(save), function (err) {if (err) throw err;});
    }

    static new_player(msg, name) {
        let data = {"name": name, "id": msg.author.id};
        AV.player_data.push(new Player(false, data));
        this.save_players();
    }

    static check_player(msg) {
        let cond = false;
        AV.player_data.forEach(player => {
            if (player.id === msg.author.id) {
                cond = true;
            }
        });
        return cond;
    }

    static get_player_by_id(id) {
        let player;
        AV.player_data.forEach(p => {
            if (p.id === parseInt(id)) {
                player = p;
            }
        });
        return player;
    }

    //obsolete
    static get_item_by_id(id) {
        let item = undefined;
        AV.items.forEach(i => {
            if (i.id === parseInt(id)) {
                item = i;
            }
        });
        return item;
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



    static battle_start(msg, p) {
        let mon = new Enemy(true, AV.virus[0]);
        p.battle = new Battle_PvE(p, mon);
        this.sender(msg, Tools.parseReply(AV.config.startcombat,[mon.name]));
    }

    static battle_manager(msg, input, p) {
        input = input.toLocaleLowerCase();
        let battle = p.battle;
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
            }
        }
    }


    static battle_item_use_start(msg, battle, p) {
        let message = "";
        if (p.items_battle_count === 0) {
            message += p.selector_battle;
        } else {
            p.battle_item_on = true;
            message += Tools.parseReply(AV.config.startbattle_item);
            message += p.selector_battle;
        }
        this.sender(msg, message);
    }

    static battle_item_manager(msg, input, battle, p) {
        let num = parseInt(input);
        if (num) {
            if (num <= p.items_battle_count) {
                this.sender(msg, battle.do_round("I", num - 1));
                p.battle_item_on = false;
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
            message += Tools.parseReply(AV.config.increase_atk)
        } else if (this.input_is_list(input, ["defense","def"])) {
            p.def += 1;
            p.stat_points -= 1;
            message += Tools.parseReply(AV.config.increase_def)
        } else if (this.input_is_list(input, ["initiative","init"])) {
            p.ini += 1;
            p.stat_points -= 1;
            message += Tools.parseReply(AV.config.increase_ini)
        } else if (this.input_is_list(input, ["stop","s"])) {
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