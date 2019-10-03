const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Weapon = require('./weapon');
const Item = require('./item');
const Battle_PvE = require('./battle_pve');

module.exports = class Enemy {
    constructor(load, data) {
        if(load) {
            this.name = data.name;
            this.id = data.id;
            this.subtype = data.type;
            this.lv = data.lv;
            this.maxHP = data.maxHP;
            this.atk_base = data.atk_base;
            this.atk_P = data.atk_P;
            this.def_base = data.def_base;
            this.ini_base = data.ini_base;
            this.exp_gain = data.exp_gain;
            this.cc_gain = data.cc_gain;

            if (data.autolv) {
                this.auto_leveler(data.autolv_data);
            }

            if (data.items) {
                this.loaditems(data.items);
            }

            this.attack_patterns = data.attack_patterns;
        } else {
            this.name = data.name;
            this.id = data.id;
            this.subtype = data.subtype;
            this.lv = data.lv;
            this.maxHP = data.maxHP;
            this.atk_base = data.atk_base;
            this.atk_P = data.atk_P;
            this.def_base = data.def_base;
            this.ini_base = data.ini_base;
            this.exp_gain = data.exp_gain;
            this.cc_gain = data.cc_gain;
            this.items = data.items;
            this.attack_patterns = data.attack_patterns;
        }
        this.curPattern = undefined;
        this.curPatternMoveNum = 0;
        this.charge_on = false;
        this.charge_count = 0;
        this.def_bonus = false;
        this.def_bonus_val = 0.4;

        this.d_rest = "";

        this.battle_duration_itmes = [];

        this.type = "enemy";
        this.curHP = this.maxHP;

        this.target = undefined;
        this.state = "alive";
        this.set_to_base();
    }

    set_to_base() {
        this.atk = this.atk_base ;
        this.def = this.def_base;
        this.ini = this.ini_base;
    }

    loaditems(list) {
        let i;
        let items = [];
        list.forEach(id => {
            i = Item.get_item_by_id(id);
            items.push(new Item(true, i));
        });
        this.items = items;
    }

    auto_leveler(auto) {
        let mod = this.lv - 1;
        this.maxHP += Math.floor(auto.hp * mod);
        this.atk_base += Math.floor(auto.atk * mod);
        this.atk_P += Math.floor(auto.atk_P * mod);
        this.def_base += Math.floor(auto.def * mod);
        this.ini_base += Math.floor(auto.ini * mod);

        this.exp_gain += Math.floor(auto.experience * mod) + auto.experience_add;
        this.cc_gain += Math.floor(auto.cc * mod) + auto.cc_add;
    }

    get_next_attack() {
        if (this.curPatternMoveNum) {
            let short = this.curPattern.shift();

            if(short === "R" && !this.charge_on) {
                this.charge_count = 0;
                short = this.curPattern.shift();
            }

            this.curPatternMoveNum = this.curPattern.length;
            return Battle_PvE.get_attack_from_char(short);

        } else {
            this.curPattern = this.attack_patterns[Math.floor(Math.random() * this.attack_patterns.length)].split("");
            this.curPatternMoveNum = this.curPattern.length;
            return this.get_next_attack();
        }
    }

    get_new_target(players) {
        let p;
        switch (this.subtype) {
            case "virus": {
                p = this.get_next_stronger(players);
                this.target = p;
                return p;
            }
            case "worm": {
                p = this.get_next_weaker(players);
                this.target = p;
                return p;
            }
            case "trojan": {
                p = this.get_random();
                this.target = p;
                return p;
            }
            default : {
                this.target = players[0];
                return players[0];
            }
        }
    }

    get_random(players) {
        return players[Math.floor(Math.random()*players.length)];
    }

    get_next_stronger(players) {
        let player = undefined;
        let cond = false;
        players.sort(Enemy.compare_lv);
        players.forEach(p => {
            if (!cond) {
                player = p;
                if (p.lv >= this.lv) {
                    cond = true;
                }
            }
        });
        return player;
    }

    get_next_weaker(players) {
        let player = undefined;
        let cond = false;
        players.sort(Enemy.compare_lv);
        players = players.reverse();
        players.forEach(p => {
            if (!cond) {
                player = p;
                if (p.lv <= this.lv) {
                    cond = true;
                }
            }
        });
        return player;
    }

    static compare_lv( a, b ) {
        if ( a.lv < b.lv ){
            return -1;
        }
        if ( a.lv > b.lv ){
            return 1;
        }
        return 0;
    }

    receive_damage(dam, use_d_item = true) {
        let net, dam_multi, def, return_damage;
        dam_multi = this.get_dam_multiplicator();

        [def,return_damage] = this.get_def();

        net = Math.round(dam * dam_multi - def);
        if (use_d_item) {
            this.d_pass("use", "def");
        }
        if (net > 0) {
            this.curHP = this.curHP - net;
            return [net, this.curHP,return_damage]
        } else {
            return [0, this.curHP,return_damage]
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
            return Math.ceil(this.def * this.def_bonus_val)
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

    defeated_message(player, grind = false) {
        let message = Tools.parseReply(AV.config.enemy_defeat, [player.name, this.name]);
        if (!grind) {
            message += player.gain_exp(this.exp_gain);
        }
        message += player.gain_cc(this.cc_gain);
        return message;
    }

    heal(full = false, amount = 0) {
        let message = "";
        if (full) {
            this.curHP = this.maxHP;
            message += Tools.parseReply(AV.config.heal_enemy_full)
        } else {
            if (amount + this.curHP < this.maxHP) {
                this.curHP += amount;
                message += Tools.parseReply(AV.config.heal_enemy_part, [amount, this.curHP])
            } else {
                this.curHP = this.maxHP;
                message += Tools.parseReply(AV.config.heal_enemy_complete, [this.curHP])
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
            message += Tools.parseReply(AV.config.rivive_enemy_full, [this.name])
        } else {
            message += Tools.parseReply(AV.config.revive_enemy_part, [this.name, amount])
        }
        return message;
    }

    sub_item(id) {
        let cond = true;
        let count = 0;
        this.items.forEach(item => {
        if (cond) {
            if (item.id.toString() === id.toString()) {
                this.items.splice(count, 1);
                cond = false;
            }
            count += 1;
        }
    })

    }

    add_duration_item(item) {
        this.battle_duration_itmes.push(item);
        return "";
    }

    d_item_bonus(type) {
        let mul, add, return_damage;
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