const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Weapon = require('./weapon');
const Item = require('./item');
const Enemy = require('./enemy');
const Attack = require('./attack');

module.exports = class Battle_PvE{
    constructor(player, enemy, grind) {
        player.battle_on = true;
        player.battle_id = player.id;

        enemy.curHP = enemy.maxHP;
        player.curHP = player.maxHP;

        this.grind = grind;

        enemy.target = player;
        player.target = enemy;

        enemy.charge_on = false;
        player.charge_on = false;
        enemy.charge_count = 0;
        player.charge_count = 0;
        player.battle_item_on = false;
        player.item_selector();
        player.set_to_base();
        player.state = "alive";
        player.battle_duration_itmes = [];
        player.d_rest = "";

        this.id = player.id;
        this.player = player;
        this.enemy = enemy;

        this.type = "battle";
        this.subtype = "pve-single";

        this.end_battle = false;
    }

    do_round(p_attack, num = 0) {
        let order;

        this.message = "";

        this.update_attacks(p_attack);

        this.modifiers(this.player);
        this.modifiers(this.enemy);

        order = this.get_battle_order();

        order.forEach(entity => {
            if (entity.state === "alive") {
                this.attack_processor(entity, entity.target, num);
                if (this.defeat_check(entity, entity.target, num)) {
                    entity.target.state = "defeated";
                }
            }
        });

        if (this.end_battle) {
            this.player.curHP = this.player.maxHP;
            this.player.battle_on = false;
            this.player.battle_id = undefined;
            this.player.battle = undefined;
            this.player.state = "alive";
        } else {
            this.message += this.check_d_items();

        }

        return this.message;
    }

    update_attacks(p_attack) {
        this.player.battle_attack = Battle_PvE.get_attack_from_char(p_attack);
        this.enemy.battle_attack = this.enemy.get_next_attack();
    }

    modifiers(entity) {
        entity.def_bonus = false;
        switch (entity.battle_attack) {
            case "disrupt": {
                entity.ini += 1;
                break;
            }
            case "brute": {
                entity.ini -= 1;
                break;
            }
            case "strike": {
                entity.def_bonus = true;
                break;
            }
            default : {
                break;
            }
        }
    }

    get_battle_order() {
        if (this.player.battle_attack === "item" && this.enemy.battle_attack !== "item") {
            return [this.player,this.enemy];
        } else if (this.player.battle_attack !== "item" && this.enemy.battle_attack === "item") {
            return [this.enemy,this.player];
        }
        return Tools.sort_with_ramdonise([this.player,this.enemy], Battle_PvE.compare_init);
    }

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
            this.message += defender.defeated_message(attacker, this.grind);
            this.end_battle = true;
        }
        return defeated;
    }



    strike(attacker, defender) {
        let res;

        res = Attack.strike(attacker, defender);

        this.strike_message(attacker, defender, res[0]);

        if (res[2]) {
            this.return_damage(attacker, defender, res[2]);
        }
    }

    brute(attacker, defender) {
        let res;

        res = Attack.brute(attacker, defender);

        this.brute_message(attacker, defender, res[0]);

        if (res[2]) {
            this.return_damage(attacker, defender, res[2]);
        }
    }

    charge(attacker) {
        Attack.charge(attacker);
        this.charge_message(attacker);
    }

    release(attacker, defender) {
        let res;

        res = Attack.release(attacker, defender);

        if (!res[1]) {
            this.strike_message(attacker, defender, res[0][0]);
        } else {
            this.release_message(attacker, defender, res[0][0]);
        }
        if (res[0][2]) {
            this.return_damage(attacker, defender, res[0][2]);
        }
    }

    disrupt(attacker, defender) {
        let res;

        res = Attack.disrupt(attacker, defender);

        this.disrupt_message(attacker, defender, res[0][0], res[1]);

        if (res[2]) {
            this.release_fail_message(defender, res[3][0]);
        }
        if (res[0][2]) {
            this.return_damage(attacker, defender, res[0][2]);
        }
    }

    item_use(attacker, defender, num) {
        if (attacker.type === "player") {
            this.message += attacker.battle_inventory[num].use([this, attacker]);
        } else if (attacker.type === "enemy") {
            if (attacker.items.length === 0) {
                this.strike(attacker, defender);
            } else {
                this.message += attacker.items[Math.floor(Math.random()*attacker.items.length)].use([this, attacker]);
            }
        }

    }

    check_d_items() {
        let message = "";
        message += this.player.d_pass("round");
        message += this.player.d_pass_rest();
        message += this.enemy.d_pass("round");
        message += this.enemy.d_pass_rest();


        if (message === "") {
            return message;
        }
        return "\n" + message;
    }

    return_damage(attacker, defender, dam) {
        let res;
        res = attacker.receive_damage(dam, false);

        this.return_damage_message(attacker, defender, res[0]);
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

    disrupt_message(attacker, defender, damage, hp) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_disrupt_message, [attacker.name, defender.name, damage, defender.name, hp]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_disrupt_message, [defender.name, attacker.name, damage, defender.name, hp]);
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

    return_damage_message(attacker, defender, dam) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_return_damage_message, [attacker.name, defender.name, damage, attacker.name, attacker.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_return_damage_message, [defender.name, attacker.name, damage, attacker.name, attacker.curHP]);
                break;
            }
            default : {
                console.log("battle strike message type error!");
            }
        }
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

    //higher first
    static compare_init( a, b ) {
        if ( a.ini > b.ini ){
            return -1;
        }
        if ( a.ini < b.ini ){
            return 1;
        }
        return 0;
    }

    data() {
        let message = "";

        message += Tools.parseReply(AV.config.battle_data, [this.player.name, this.enemy.name]);
        message += this.data_stats();


        return message;
    }

    data_stats() {
        let message = "";
        message += this.data_stats_generate("Level", this.player.lv, this.enemy.lv);
        message += this.data_stats_generate("Initiative", this.player.ini, this.enemy.ini);
        message += this.data_stats_generate("Direct Damage", this.player.atk + this.player.weapon.atk, this.enemy.atk);
        message += this.data_stats_generate("Hit Damage", this.player.weapon.atk_P, this.enemy.atk_P);
        message += this.data_stats_generate("Defense", this.player.def, this.enemy.def);

        return message;
    }

    data_stats_generate(type, p_dat, e_dat) {
        let separator = "";
        if (e_dat > p_dat) {
            separator = ">";
        } else if (e_dat < p_dat) {
            separator = "<";
        } else {
            separator = "=";
        }

        return Tools.parseReply(AV.config.battle_data_pattern, [type, e_dat, separator, p_dat]);
    }
};