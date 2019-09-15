"use strict";

// @IMPORTS
const Application = require("../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../lib/Tools");
const fs = require('fs');
var av_path;
var config;
var player_data = [];
var weapons = [];
var starter_weapons = [];
var enemies = [];
var virus = [];
var worm = [];
var trojan =  [];

var signup_on = {};
var signup_state = {};
var signup_name = {};


var debug = false;
var dev = false;
//Debug "Application.modules.Discord.setMessageSent();" not yet implemented.
module.exports = class AntiVirus {
    static debug(val) {debug = val; dev = val;}
    static start() {
        if (debug) {
            av_path = ".";
        } else {
            av_path = Application.config.rootDir + "/modules/GamerCanni/submodule/AntiVirus";
        }

        this.load();
    }

    static input(msg, input) {
        if (signup_on[msg.author.id]) {
            return this.signup_manager(msg, input);
        }

        input = input.toLocaleLowerCase();

        if (this.check_player(msg)) {
            let p = this.get_player_by_id(msg.author.id);

            if (p.battle_on) {
                return this.battle_manager(msg, input, p)
            } else if (p.stat_select_on) {
                return this.point_manager(msg, input, p)
            }

            if (dev) {
                this.dev_manger(msg, p, input);
            }


            if(this.input_is_list(input,["stats","st"])) {
                this.displayStats(msg, p);
            } else if(this.input_is_list(input,["info", "i"])) {
                this.displayInfo(msg, p)
            } else if(this.input_is_list(input,["use points", "up"])) {
                this.point_start(msg,p)
            }


            if (this.input_is(input,"debug")) {
                this.battle_start(msg, p);
            }
        } else {
            if (this.input_is(input,"create new avs")) {
                this.signup_start(msg);
            } else {
                this.sender(msg,config.DM_create_player_request);
            }
        }


    }


    static load() {
        this.loadConfig();
        this.loadWeapons();
        this.loadPlayerData();
        this.loadEnemies();

    }

    static loadWeapons() {
        let path = av_path + "/data/weapons.json";
        let data, tmp;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }

        if (data) {
            data.weapons.forEach(item => {
                tmp = new Weapon(true, item);
                weapons.push(tmp);
                if (tmp.starter) {
                    starter_weapons.push(tmp)
                }
            });
        }
    }

    static loadConfig() {
        let path = av_path + "/data/config.json";
        try {
            config = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }
    }

    static loadPlayerData() {
        let path = av_path + "/data/data.json";
        let data;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }

        if (data) {
            if (data.player_data) {
                data.player_data.forEach(item => {
                    player_data.push(new Player(true,item))
                });
            }
        }
    }

    static loadEnemies() {
        let path = av_path + "/data/enemies.json";
        let data, tmp;
        try {
            data = Tools.loadCommentedConfigFile(path);
        } catch (e) {
            throw new Error("config of module ... contains invalid json data: " + e.toString());
        }

        if (data) {
            data.virus.forEach(item => {
                tmp = new Enemy(true, item);
                virus.push(tmp);
                enemies.push(tmp);
            });
            data.worm.forEach(item => {
                tmp = new Enemy(true, item);
                worm.push(tmp);
                enemies.push(tmp);
            });
            data.trojan.forEach(item => {
                tmp = new Enemy(true, item);
                trojan.push(tmp);
                enemies.push(tmp);
            });
        }
    }

    static save_players() {
        let path = av_path + "/data/data.json";
        let save;
        save = {"player_data":player_data};
        fs.writeFile(path, JSON.stringify(save), function (err) {if (err) throw err;});
    }

    static new_player(msg, name) {
        let data = {"name": name, "id": msg.author.id};
        player_data.push(new Player(false, data));
        this.save_players();
    }

    static check_player(msg) {
        let cond = false;
        player_data.forEach(player => {
            if (player.id === msg.author.id) {
                cond = true;
            }
        });
        return cond;
    }

    static get_player_by_id(id) {
        let player;
        player_data.forEach(p => {
            if (p.id === id) {
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

    static signup_start(msg) {
        signup_on[msg.author.id] = true;
        signup_state[msg.author.id] = 0;
        this.senderDM(msg, config.DM_signup_1)
    }

    static signup_manager(msg, input) {
        let state = signup_state[msg.author.id];
        if (state === 0) {
            signup_state[msg.author.id] = 1;
            signup_name[msg.author.id] = input;
            this.senderDM(msg,Tools.parseReply(config.DM_signup_2, [input]));
        } else if (state === 1) {
            input = input.toLocaleLowerCase();
            if (input === "yes") {
                this.new_player(msg, signup_name[msg.author.id]);
                this.senderDM(msg,config.DM_signup_4);
                signup_on[msg.author.id] = false;
                signup_state[msg.author.id] = 2;
            } else if (input === "no") {
                signup_state[msg.author.id] = 0;
                this.senderDM(msg,Tools.parseReply(config.DM_signup_3))
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
    let mon = new Enemy(true, trojan[1]);
    p.battle = new Battle_PvE(p, mon);
    this.sender(msg, Tools.parseReply(config.startcombat,[mon.name]))
}

static battle_manager(msg, input, p) {
    input = input.toLocaleLowerCase();
    let battle = p.battle;
    if (battle.player.charge_on) {
        if (input === "charge" || input === "ch") {
            this.sender(msg, battle.do_round("C"));
        } else if (input === "release" || input === "re") {
            this.sender(msg, battle.do_round("R"));
        }
    } else {
        if (input === "strike" || input === "s") {
            this.sender(msg, battle.do_round("S"));
        } else if (input === "brute force" || input === "br") {
            this.sender(msg, battle.do_round("B"));
        } else if (input === "charge" || input === "ch") {
            this.sender(msg, battle.do_round("C"));
        } else if (input === "disrupt" || input === "dis") {
            this.sender(msg, battle.do_round("D"));
        }
    }
}

static point_start(msg, p) {
    let message = "";
    if (p.stat_points) {
        if (p.stat_points === 1) {
            message += Tools.parseReply(config.points_available_point,[p.name, p.stat_points]);
        } else {
            message += Tools.parseReply(config.points_available_points,[p.name, p.stat_points]);
        }
        message += Tools.parseReply(config.points_stats,[p.atk,p.def,p.ini]);
        message += Tools.parseReply(config.points_question);
        p.stat_select_on = true;
    } else {
        message = Tools.parseReply(config.points_no_available_points,[p.name]);
    }
    this.senderDM(msg, message);
}

static point_manager(msg, input, p) {
    let message = "";
    if (this.input_is_list(input, ["attack","atk"])) {
        p.atk += 1;
        p.stat_points -= 1;
        message += Tools.parseReply(config.increase_atk)
    } else if (this.input_is_list(input, ["defense","def"])) {
        p.def += 1;
        p.stat_points -= 1;
        message += Tools.parseReply(config.increase_def)
    } else if (this.input_is_list(input, ["initiative","init"])) {
        p.ini += 1;
        p.stat_points -= 1;
        message += Tools.parseReply(config.increase_ini)
    } else if (this.input_is_list(input, ["stop","s"])) {
        p.stat_select_on = false;
        message += Tools.parseReply(config.points_stop);
    }

    if(p.stat_points && p.stat_select_on) {
        if (p.stat_points === 1) {
            message += Tools.parseReply(config.points_available_point,[p.name, p.stat_points]);
        } else {
            message += Tools.parseReply(config.points_available_points,[p.name, p.stat_points]);
        }
        message += Tools.parseReply(config.points_stats,[p.atk,p.def,p.ini]);
        message += Tools.parseReply(config.points_question);
    } else {
        p.stat_select_on = false;
    }
    this.senderDM(msg, message);
}

//Debug
static sender(msg, content) {
    if (debug) {
        console.log(content);
    } else {
        msg.channel.send(content);
        Application.modules.Discord.setMessageSent();
    }

}

static senderDM(msg, content) {
    if (debug) {
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
            num = Math.abs(pre[1]);
            if (num) {
                message = p.gain_exp(num);
                this.sender(msg, message);
            }
        }
    } else if (this.input_includes(input, "gain_cc")) {
        pre = input.split(" ");
        if (pre.length > 1) {
            num = Math.abs(pre[1]);
            if (num) {
                message = p.gain_cc(num);
                this.sender(msg, message);
            }
        }
    }
}
};


class Player {
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
            this.weapon = new Weapon(true,data.weapon);
            this.experiance = data.experiance;
            this.cc = data.cc;
        } else {
            this.lv = 1;
            this.atk = 1;
            this.def = 1;
            this.ini = 2;
            this.maxHP = 10;
            this.state = "alive";
            let random = Tools.getRandomIntFromInterval(0, starter_weapons.length - 1);
            this.weapon = starter_weapons[random];
            this.experiance = 0;
            this.cc = 0;
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
    }

    stats() {
        return Tools.parseReply(config.displayStats, [this.name,this.lv,this.experiance, this.levelup_function(),this.cc,this.maxHP,this.atk,this.def,this.ini,this.weapon.name,this.weapon.lv,this.weapon.atk,this.weapon.atk_P]);
    }

    info() {
        let message = Tools.parseReply(config.info, [this.name]);
        if (this.stat_points) {
            message += Tools.parseReply(config.info_available_stat_points, [this.stat_points])
        } else {
            message += Tools.parseReply(config.info_normal)
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
        let message = Tools.parseReply(config.player_defeat, [this.name]);
        return message;
    }

    gain_exp(exp) {
        this.experiance += exp;
        let message = Tools.parseReply(config.exp_gain, [this.name, exp]);

        message += this.check_levelup();
        return message;
    }

    gain_cc(cc) {
        this.cc += cc;
        let message = Tools.parseReply(config.cc_gain, [this.name, cc]);
        return message;
    }

    check_levelup() {
        let message = "";
        if (this.experiance >= this.levelup_function()) {
            this.experiance -= this.levelup_function();
            this.do_levelup();
            message += Tools.parseReply(config.levelup, [this.name, this.lv, this.experiance, this.levelup_function()]);
            message += this.check_levelup();
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
}

class Weapon {
    constructor(load, data) {
        if(load) {
            this.name = data.name;
            this.id = data.id;
            this.lv = data.lv;
            this.atk = data.atk;
            this.atk_P = data.atk_P;
            this.def = data.def;
            this.def_P = data.def_P;
            this.starter = data.starter;

            this.type = "weapon";
        }
    }
}

class Enemy {
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
        let message = Tools.parseReply(config.enemy_defeat, [player.name, this.name]);
        message += player.gain_exp(this.exp_gain);
        message += player.gain_cc(this.cc_gain);
        return message;
    }

}

class Battle_PvE{
    constructor(player, enemy) {
        player.battle_on = true;
        player.battle_id = player.id;

        enemy.curHP = enemy.maxHP;
        player.curHP = player.maxHP;

        enemy.charge_on = false;
        player.charge_on = false;
        enemy.charge_count = 0;
        player.charge_count = 0;

        this.id = player.id;
        this.player = player;
        this.enemy = enemy;

        this.end_battle = false;
    }

    do_round(p_attack) {
        let first, second, p_init_mod, e_init_mod;

        this.message = "";

        this.update_attacks(p_attack);

        p_init_mod = this.pre_order_modifiers(this.player);
        e_init_mod = this.pre_order_modifiers(this.enemy);


        [first,second] = this.battle_order(p_init_mod, e_init_mod);

        this.attack_processor(first,second);
        if (!this.defeat_check(first,second)) {
            this.attack_processor(second,first);
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
        }
    };

    attack_processor(attacker, defender) {

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


    strike_message(attacker, defender, damage) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(config.player_strike_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(config.enemy_strike_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
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
                this.message += Tools.parseReply(config.player_brute_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(config.enemy_brute_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
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
                this.message += Tools.parseReply(config.player_charge_message, [attacker.name, attacker.charge_count]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(config.enemy_charge_message, [attacker.name, attacker.charge_count]);
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
                this.message += Tools.parseReply(config.player_release_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(config.enemy_release_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
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
                this.message += Tools.parseReply(config.player_disrupt_message, [attacker.name, defender.name, damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(config.enemy_disrupt_message, [defender.name, attacker.name, damage, defender.name, defender.curHP]);
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
                this.message += Tools.parseReply(config.player_release_fail_message, [damage, defender.name, defender.curHP]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(config.enemy_release_fail_message, [defender.name, damage, defender.name, defender.curHP]);
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
            default: {
                console.log("battle char match error!");
            }
        }
    }
}