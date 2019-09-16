const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Weapon = require('./weapon');
const Item = require('./item');
const Enemy = require('./enemy');

module.exports = class Battle_PvE{
    constructor(player, enemy) {
        player.battle_on = true;
        player.battle_id = player.id;

        enemy.curHP = enemy.maxHP;
        player.curHP = player.maxHP;

        enemy.charge_on = false;
        player.charge_on = false;
        enemy.charge_count = 0;
        player.charge_count = 0;
        player.battle_item_on = false;
        player.item_selector();

        this.id = player.id;
        this.player = player;
        this.enemy = enemy;

        this.type = "battle";

        this.end_battle = false;
    }

    do_round(p_attack, num = 0) {
        let first, second, p_init_mod, e_init_mod;

        this.message = "";

        this.update_attacks(p_attack);

        p_init_mod = this.pre_order_modifiers(this.player);
        e_init_mod = this.pre_order_modifiers(this.enemy);


        [first,second] = this.battle_order(p_init_mod, e_init_mod);

        this.attack_processor(first,second, num);
        if (!this.defeat_check(first,second)) {
            this.attack_processor(second,first, num);
            this.defeat_check(second, first);
        }

        if (this.end_battle) {
            this.player.curHP = this.player.maxHP;
            this.player.battle_on = false;
            this.player.battle_id = undefined;
            this.player.battle = undefined;
        }

        return this.message;
    }

    update_attacks(p_attack) {
        this.player.battle_attack = Battle_PvE.get_attack_from_char(p_attack);
        this.enemy.battle_attack = this.enemy.get_next_attack();
    }

    pre_order_modifiers(entity) {
        switch (entity.battle_attack) {
            case "disrupt": {
                return entity.lv;
            }
            case "brute": {
                return -1 * entity.lv;
            }
            default : {
                return 0;
            }
        }
    };

    attack_processor(attacker, defender, num) {

        switch (attacker.battle_attack) {
            case "strike":{
                this.strike(attacker, defender);
                break;
            }
            case "brute":{
                this.brute(attacker, defender);
                break;
            }
            case "charge":{
                this.charge(attacker);
                break;
            }
            case "release":{
                this.release(attacker, defender);
                break;
            }
            case "disrupt":{
                this.disrupt(attacker, defender);
                break;
            }
            case "item" : {
                this.item_use(attacker, defender, num);
                break;
            }
            default : {
                console.log("battle no attack error! ("+attacker.battle_attack+")");
            }
        }
    }

    defeat_check(attacker, defender) {
        let defeated = defender.curHP <= 0;
        if (defeated) {
            this.message += defender.defeated_message(attacker);
            this.end_battle = true;
        }
        return defeated;
    }



    strike(attacker, defender) {
        let dam, p, res;
        switch (attacker.type) {
            case "player": {
                p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                dam = attacker.atk + attacker.weapon.atk + p;
                break;
            }
            case "enemy" : {
                p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                dam = attacker.atk + p;
                break;
            }
            default : {
                console.log("battle strike type error!");
                dam = 0;
            }
        }

        res = defender.receive_damage(dam);

        this.strike_message(attacker, defender, res[0]);
    }

    brute(attacker, defender) {
        let dam, p, res;
        switch (attacker.type) {
            case "player": {
                p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                dam = (2*attacker.atk+1) + attacker.weapon.atk + p;
                break;
            }
            case "enemy" : {
                p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                dam = (2*attacker.atk+1) + p;
                break;
            }
            default : {
                console.log("battle brute type error!");
                dam = 0;
            }
        }

        res = defender.receive_damage(dam);

        this.brute_message(attacker, defender, res[0]);
    }

    charge(attacker) {
        if (attacker.charge_on) {
            attacker.charge_count += 1;
        } else {
            attacker.charge_on = true;
            attacker.charge_count = 1;
        }

        this.charge_message(attacker);
    }

    release(attacker, defender) {
        let dam, p, res;

        if (!attacker.charge_on) {
            this.strike(attacker, defender);
        } else {
            dam = this.release_attack_damage(attacker);

            res = defender.receive_damage(dam);

            attacker.charge_on = false;
            attacker.charge_count = 0;

            this.release_message(attacker, defender, res[0]);
        }
    }

    disrupt(attacker, defender) {
        let dam, p, res;
        switch (attacker.type) {
            case "player": {
                p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                dam = (attacker.atk - attacker.lv) + attacker.weapon.atk + p;
                break;
            }
            case "enemy" : {
                p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                dam = (attacker.atk - attacker.lv) + p;
                break;
            }
            default : {
                console.log("battle disrupt type error!");
                dam = 0;
            }
        }

        res = defender.receive_damage(dam);

        this.disrupt_message(attacker, defender, res[0]);

        if (defender.charge_on) {
            dam = Math.floor(this.release_attack_damage(defender) / 2);
            res = defender.receive_damage(dam);
            defender.charge_on = false;
            defender.charge_count = 0;

            this.release_fail_message(defender, res[0]);
        }


    }

    item_use(attacker, defender, num) {
        this.message += attacker.battle_inventory[num].use([this, attacker]);
    }


    strike_message(attacker, defender, damage) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_strike_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_strike_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
                break;
            }
            default : {
                console.log("battle strike message type error!");
            }
        }
    }

    brute_message(attacker, defender, damage) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_brute_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_brute_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
                break;
            }
            default : {
                console.log("battle brute message type error!");
            }
        }
    }

    charge_message(attacker) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_charge_message, [attacker.name, attacker.charge_count]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_charge_message, [attacker.name, attacker.charge_count]);
                break;
            }
            default : {
                console.log("battle charge message type error!");
            }
        }
    }

    release_message(attacker, defender, damage) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_release_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_release_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
                break;
            }
            default : {
                console.log("battle release message type error!");
            }
        }
    }

    disrupt_message(attacker, defender, damage) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_disrupt_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_disrupt_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
                break;
            }
            default : {
                console.log("battle disrupt message type error!");
            }
        }
    }

    release_fail_message(defender, damage) {
        switch (defender.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_release_fail_message, [damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_release_fail_message, [defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            default : {
                console.log("battle release_fail message type error!");
            }
        }
    }

    release_attack_damage(attacker) {
        let dam, p;
        dam = 0;
        switch (attacker.type) {
            case "player": {
                let i;
                for (i = 0; i <= attacker.charge_count; i++) {
                    p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                    dam += attacker.atk + attacker.weapon.atk + p + attacker.lv;
                }
                break;
            }
            case "enemy" : {
                let i;
                for (i = 0; i <= attacker.charge_count; i++) {
                    p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                    dam += attacker.atk + p + attacker.lv;
                }
                break;
            }
            default : {
                console.log("battle release type error!");
                dam = 0;
            }
        }
        return dam;
    }

    battle_order(p_mod = 0, e_mod = 0) {

        if (this.player.battle_attack === "item" && this.enemy.battle_attack !== "item") {
            return [this.player,this.enemy];
        } else if (this.player.battle_attack !== "item" && this.enemy.battle_attack === "item") {
            return [this.enemy,this.player];
        }
        if ((this.player.ini + p_mod) > (this.enemy.ini + e_mod)) {
            return [this.player, this.enemy];
        } else if ((this.player.ini + p_mod) < (this.enemy.ini + e_mod)) {
            return [this.enemy, this.player]
        } else if ((this.player.ini + p_mod) === (this.enemy.ini + e_mod)) {
            let ran = Tools.getRandomIntFromInterval(0,1);
            if (ran) {
                return [this.player, this.enemy];
            } else {
                return [this.enemy, this.player]
            }
        }
        console.log("battle order error!");
    }

    static get_attack_from_char(char) {
        switch (char) {
            case "S" : {
                return "strike";
            }
            case "B" : {
                return "brute";
            }
            case "C" : {
                return "charge";
            }
            case "R" : {
                return "release";
            }
            case "D" : {
                return "disrupt";
            }
            case "I" : {
                return "item";
            }
            default: {
                console.log("battle char match error!");
            }
        }
    }
};