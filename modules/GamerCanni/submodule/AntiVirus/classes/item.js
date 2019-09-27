const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Weapon = require('./weapon');

module.exports = class Item {
    constructor(load, data) {
        if (load) {
            this.name = data.name;
            this.id = data.id;
            this.value = data.value;
            this.types = data.types;
            this.subtype = data.subtype;
            this.reusable = data.reusable;

            this.restoreHP = data.restoreHP;
            this.heal_full = data.heal_full;
            this.damage = data.damage;
            this.conversion = data.conversion;
            this.experience = data.experience;
            this.range = data.range;
            this.bonus = data.bonus;
            if (!this.bonus) {
                this.bonus = [];
            }

            this.number = data.number;
            this.loadinfo(data.info);
        }
    }

    loadinfo(pre) {
        let text = "";
        if (this.subtype === "heal") {
            text = Tools.parseReply(pre, [this.name, this.restoreHP])
        } else if (this.subtype === "revive") {
            text = Tools.parseReply(pre, [this.name, this.restoreHP])
        } else if (this.subtype === "damage") {
            text = Tools.parseReply(pre, [this.name, this.damage])
        } else if (this.subtype === "drain") {
            text = Tools.parseReply(pre, [this.name, this.damage, this.conversion])
        } else if (this.subtype === "exp") {
            text = Tools.parseReply(pre, [this.name, this.experience + this.range])
        } else {
            text = "No Info Available";
        }

        this.info = text;
    }

    static get_item_by_id(id) {
        let item = undefined;
        AV.items.forEach(i => {
            if (i.id === parseInt(id)) {
                item = i;
            }
        });
        return item;
    }

    use(pass, battle_on = true) {
        let message = "";
        if (battle_on) {
            if (this.types.includes("battle-item")) {
                message += this.battle_use(pass);
            }
        } else {
            if (this.types.includes("usable-item")) {
                message += this.normal_use(pass);
            }
        }

        message += "\n";
        return message;
    }

    consume(user) {
        if (!this.reusable) {
            user.sub_item(this.id, 1);
        }
    }

    normal_use([user]) {
        let message = "";

        message += Tools.parseReply(AV.config.use_item, [user.name, this.name]);

        if (this.subtype === "exp") {
            message += this.gain_exp(user);
        }

        this.consume(user);
        return message;
    }

    battle_use([battle, user, target = user]) {
        let message = "";

        message += Tools.parseReply(AV.config.use_item, [user.name, this.name]);

        if (battle.subtype === "pve-multi") {
            target = user.target;
        }

        if (this.subtype === "heal") {
            message += this.heal(target);
        }
        if (this.subtype === "damage") {
            message += this.apply_damage(battle, user, target);
        }
        if (this.subtype === "drain") {
            message += this.apply_drain(battle, user, target);
        }
        if (this.subtype === "revive") {
            message += this.apply_revive(battle, user, target);
        }


        this.consume(user);
        return message;
    }

    static auto_select_target(battle,user) {
        if (battle.subtype === "pve-single") {
            if (user.type === "player") {
                return battle.enemy;
            } else if (user.type === "enemy") {
                return battle.player;
            } else {
                console.log("auto select target type error!");
            }
        }
    }

    heal(target) {
        return target.heal(this.heal_full, this.restoreHP);
    }

    apply_damage(battle, user, target) {
        let message = "";

        if (user === target) {
            target = Item.auto_select_target(battle, user);
        }

        this.check_for_bonus(target.subtype);

        this.dealt_damage = target.receive_damage(this.damage)[0];

        if (target.type === "enemy") {
            message += Tools.parseReply(AV.config.item_damage_enemy, [target.name, this.dealt_damage, target.curHP])
        } else if (target.type === "player") {
            message += Tools.parseReply(AV.config.item_damage_player, [target.name, this.dealt_damage, target.curHP])
        } else {
            console.log("apply damage type error!");
        }
        return message;
    }

    apply_drain(battle, user, target) {
        let message = "";
        if (user === target) {
            target = Item.auto_select_target(battle, user);
        }
        message += this.apply_damage(battle,user,target);
        this.restoreHP = Math.ceil(this.dealt_damage*this.conversion);
        message += this.heal(user);
        return message;
    }

    apply_revive(battle, user, target) {
        let message = "";
        if (target.state = "alive") {
            message += Tools.parseReply(AV.config.revive_target_alive, [user.name, this.name]);
        } else {
            message += target.revive(this.heal_full, this.restoreHP);
        }
        return message;
    }

    gain_exp(user) {
        let ran = Tools.getRandomIntFromInterval(-this.range,this.range);
        return user.gain_exp(this.experience + ran);
    }

    check_for_bonus(type) {
        if (this.bonus.includes(type)) {
            this.damage += Math.ceil(this.damage * 0.6)
        }
    }

};
