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
            this.type = data.type;
            this.lv = data.lv;
            this.maxHP = data.maxHP;
            this.atk = data.atk;
            this.atk_P = data.atk_P;
            this.def = data.def;
            this.ini = data.ini;

            if (data.autolv) {
                this.auto_leveler(data.autolv_data);
            }

            this.exp_gain = data.exp_gain;
            this.cc_gain = data.cc_gain;

            this.attack_patterns = data.attack_patterns;
            this.curPattern = undefined;
            this.curPatternMoveNum = 0;
            this.charge_on = false;
            this.charge_count = 0;

            this.type = "enemy";
            this.curHP = this.maxHP;
        }
    }

    auto_leveler(auto) {
        let mod = this.lv - 1;
        this.maxHP += Math.floor(auto.hp * mod);
        this.atk += Math.floor(auto.atk * mod);
        this.atk_P += Math.floor(auto.atk_P * mod);
        this.def += Math.floor(auto.def * mod);
        this.ini += Math.floor(auto.ini * mod);
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

    receive_damage(dam) {
        let net = dam - this.def;
        if (net > 0) {
            this.curHP = this.curHP - net;
            return [net, this.curHP]
        } else {
            return [0, this.curHP]
        }
    }

    defeated_message(player) {
        let message = Tools.parseReply(AV.config.enemy_defeat, [player.name, this.name]);
        message += player.gain_exp(this.exp_gain);
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

};