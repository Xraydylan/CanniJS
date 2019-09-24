const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Weapon = require('./weapon');
const Item = require('./item');
const Enemy = require('./enemy');

module.exports = class Battle_PvE_Multi{
    constructor(players, enemies, id, grind = false, load_all = false) {
        this.battle_id = id;
        if (load_all) {
            this.setup_players(players);
            this.setup_enemies(enemies);
        } else {
            this.setup_players([players]);
            this.setup_enemies([enemies]);

        }
        this.assign_target(enemies, players);
        this.grind = grind;
        this.type = "battle";
        this.subtype = "pve-multi";

        this.phase = 0;
        this.defeated_players = [];
        this.defeated_enemies = [];
        this.loot_bonus = 0.4;
    }

    new_player(player, enemy) {
        this.add_player(player);
        this.add_enemy(enemy);
        this.assign_target(enemy, player);
        return this.new_player_message();
    }

    setup_players(players) {
        this.players = [];
        players.forEach(player => {
            this.add_player(player);
        });
    }

    setup_enemies(enemies) {
        this.enemies = [];
        enemies.forEach(enemy => {
            this.add_enemy(enemy);
        });
    }

    add_player(player) {
        player.state = "alive";
        player.battle_on = true;
        player.battle_id = this.battle_id;
        player.curHP = player.maxHP;
        player.charge_on = false;
        player.charge_count = 0;
        player.battle_item_on = false;
        player.item_target_finder_on = false;
        this.selected_battle_item = undefined;
        player.item_selector();
        this.players.push(player);
    }

    add_enemy(enemy) {
        enemy.curHP = enemy.maxHP;
        enemy.charge_on = false;
        enemy.charge_count = 0;
        this.enemies.push(enemy);
    }

    assign_target(enemies, players) {
        let count = 0;
        if (!Array.isArray(enemies)) {
            enemies = [enemies];
        }
        if (!Array.isArray(players)) {
            players = [players];
        }

        enemies.forEach(enemy => {
            enemy.target = players[count];
            count += 1;
        })
    }

    remove_player(player) {
        let index, enemy;
        index = this.players.indexOf(player);
        if (index > -1) {
            this.players.splice(index, 1);
        }
        enemy = this.get_enemy_from_player(player);
        index = this.enemies.indexOf(enemy);
        if (index > -1) {
            this.enemies.splice(index, 1);
        }
        player.battle = undefined;
        player.battle_on = false;
        player.battle_id = undefined;
        return this.remove_player_message(player);
    }


    start_battle() {
        let message = "";
        this.all_players = this.players.concat(this.defeated_players);
        this.all_enemies = this.enemies.concat(this.defeated_enemies);
        this.enemy_selector();
        this.player_selector();
        this.attack_count = this.players.length;
        this.attack_log_setter(false);
        message += Tools.parseReply(AV.config.multi_start_combat);
        message += this.selector_enemies;
        message += Tools.parseReply(AV.config.multi_start_combat_2);
        return message;
    }

    attack_log_setter(bool) {
        this.players.forEach(p => {
            p.attack_is_logged = bool;
        })
    }

    attack_logger(player, p_attack, tar_num) {
        this.message = "";
        if (player.state === "alive") {
            if (player.attack_is_logged) {
                this.message += Tools.parseReply(AV.config.multi_attack_already_selected, [player.name]);
            } else {
                player.attack_is_logged = true;
                this.attack_count -= 1;
                if (p_attack !== "I" && p_attack !== "C") {
                    player.target = this.enemies[tar_num];
                }
                player.battle_attack = Battle_PvE_Multi.get_attack_from_char(p_attack);
                this.message += Tools.parseReply(AV.config.multi_attack_lock, [player.name]);
                if (this.attack_count <= 0) {
                    this.execute_round();
                }
            }
        } else {
            this.message += Tools.parseReply(AV.config.multi_defeated_can_not_attack, [player.name]);
        }
        let tmp = this.message;
        this.message = "";
        return tmp;
    }

    execute_round() {
        let order;
        this.update_attacks_enemies();
        order = this.get_battle_order();

        order.forEach(entity => {
            if (entity.state === "alive") {
                this.attack_processor(entity, entity.target);
                if (this.defeat_check(entity, entity.target)) {
                    entity.target.state = "defeated";
                }
            }
        });

        this.update_players_state();
        this.update_enemies_state();

        if (!this.check_win()) {
            this.enemy_selector();
            this.player_selector();
            this.message += Tools.parseReply(AV.config.new_round_message);
            this.message += this.selector_enemies;
            this.update_targets_enemies();
            this.unlock_player_attacks();
        }
    }

    get_battle_order() {
        let entities = this.players.concat(this.enemies);
        return this.organizer(entities);
    }

    organizer(entities) {
        let num, order;
        let pre_order = [];
        let residue = [];
        let count = "n";
        entities.forEach(entity => {
            num = entity.ini + this.pre_order_modifiers(entity);
            if (count === "n") {
                pre_order.push(entity);
                count = num;
            } else {
                if (num === count) {
                    pre_order.push(entity);
                } else if (num > count) {
                    residue = residue.concat(pre_order);
                    pre_order = [entity];
                    count = num;
                } else {
                    residue.push(entity);
                }
            }
        });
        order = Tools.shuffle(pre_order);
        if (residue.length === 0) {
            return order
        } else {
            return order.concat(this.organizer(residue));
        }
    }

    check_win() {
        if (this.enemies.length === 0) {
            let cc,experience;
            [cc,experience] = this.get_loot();
            this.message += Tools.parseReply(AV.config.multi_won);
            this.all_players.forEach(player => {
                if (!this.grind) {
                    this.message += player.gain_exp(experience);
                }
                this.message += player.gain_cc(cc);
            });
            this.end_battle_player_reset();
            return true;
        } else if (this.players.length === 0) {
            this.message += Tools.parseReply(AV.config.multi_lost);
            this.end_battle_player_reset();
            return true;
        }
        return false;
    }

    get_loot() {
        let cc,experience;
        cc = 0;
        experience = 0;
        this.all_enemies.forEach(enemy => {
            cc += enemy.cc_gain;
            experience += enemy.exp_gain;
        });

        if (this.grind) {
            experience = 0;
        } else {
            experience += Math.ceil(experience*this.loot_bonus*(this.all_players.length-1));
            cc = Math.ceil(experience/this.all_players.length);
        }
        cc += Math.ceil(cc*this.loot_bonus*(this.all_players.length-1));
        cc = Math.ceil(cc/this.all_players.length);
        return [cc,experience];
    }

    end_battle_player_reset() {
        this.attack_log_setter(false);
        this.all_players.forEach(player => {
            player.battle_on = false;
            player.battle = undefined;
            player.battle_id = undefined;
            player.curHP = player.maxHP;
            player.charge_on = false;
            player.charge_count = 0;
            player.battle_item_on = false;
        });
        AV.multi_games[this.battle_id] = undefined;
    }

    update_players_state() {
        let alive = [];
        let defeated = [];
        this.all_players.forEach(p => {
            if (p.state === "alive") {
                alive.push(p);
            } else {
                defeated.push(p);
            }
        });

        this.players = alive;
        this.defeated_players = defeated;
    }

    update_enemies_state() {
        let alive = [];
        let defeated = [];
        this.enemies.forEach(e => {
           if (e.state === "alive") {
               alive.push(e);
           } else {
               defeated.push(e);
           }
        });
        this.enemies = alive;
        this.defeated_enemies = defeated;
    }

    update_targets_enemies() {
        let target;
        this.message += "\n";
        this.enemies.forEach(enemy => {
            if (enemy.target.state === "defeated") {
                target = enemy.get_new_target(this.players);
                this.message += Tools.parseReply(AV.config.multi_new_target, [enemy.name, target.name])
            }
        });
    }

    update_attacks_enemies() {
        let target;
        this.enemies.forEach(enemy => {
            enemy.battle_attack = enemy.get_next_attack();
        });
    }

    unlock_player_attacks() {
        this.attack_count = this.players.length;
        this.attack_log_setter(false);
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

    attack_processor(attacker, defender) {
        attacker.def_bonus = false;
        if (defender.state === "alive") {
            switch (attacker.battle_attack) {
                case "strike":{
                    this.strike(attacker, defender);
                    attacker.def_bonus = true;
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
                    this.item_use(attacker, defender);
                    break;
                }
                default : {
                    console.log("battle no attack error! ("+attacker.battle_attack+")");
                }
            }
        } else {
            //Currently no reanimation item            V
            if (attacker.battle_attack === "item" && false) {
                this.item_use(attacker, defender);
            } else {
                this.defeated_target(attacker, defender);
            }
        }


    }

    defeat_check(attacker, defender) {
        return defender.curHP <= 0;
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
            dam = this.release_attack_damage(attacker,defender);

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
            dam = Math.floor(this.release_attack_damage(defender, defender) / 2);
            res = defender.receive_damage(dam);
            defender.charge_on = false;
            defender.charge_count = 0;

            this.release_fail_message(defender, res[0]);
        }


    }

    item_use(attacker, defender) {
        if (attacker.type === "player") {
            this.message += attacker.selected_battle_item.use([this, attacker]);
        } else if (attacker.type === "enemy") {
            if (attacker.items.length === 0) {
                this.strike(attacker, defender);
            } else {
                this.message += attacker.items[Math.floor(Math.random()*attacker.items.length)].use([this, attacker]);
            }
        }

    }

    defeated_target(attacker, defender) {
        this.defeated_target_message(attacker, defender);
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

    new_player_message() {
        let message = "";
        message += Tools.parseReply(AV.config.multi_new_player);
        this.players.forEach(player => {
           message += Tools.parseReply(AV.config.multi_new_player_pattern, [player.name]);
        });
        return message;
    }

    remove_player_message(player) {
        let message = "";
        message += Tools.parseReply(AV.config.multi_remove_player, [player.name]);
        this.players.forEach(player => {
            message += Tools.parseReply(AV.config.multi_new_player_pattern, [player.name]);
        });
        return message;
    }

    defeated_target_message(attacker, defender) {
        switch (attacker.type) {
            case "player": {
                this.message += Tools.parseReply(AV.config.player_defeated_target_message, [attacker.name, defender.name]);
                break;
            }
            case "enemy" : {
                this.message += Tools.parseReply(AV.config.enemy_defeated_target_message, [attacker.name, defender.name]);
                break;
            }
            default : {
                console.log("defeated target message type error!");
            }
        }
    }


    release_attack_damage(attacker, defender) {
        let dam, p, def;
        def = Math.floor(defender.def/2);
        dam = def;
        switch (attacker.type) {
            case "player": {
                let i;
                for (i = 0; i <= attacker.charge_count; i++) {
                    p = Tools.getRandomIntFromInterval(0, attacker.weapon.atk_P);
                    dam += attacker.atk + attacker.weapon.atk + p + attacker.lv - def;
                }
                break;
            }
            case "enemy" : {
                let i;
                for (i = 0; i <= attacker.charge_count; i++) {
                    p = Tools.getRandomIntFromInterval(0, attacker.atk_P);
                    dam += attacker.atk + p + attacker.lv - def;
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

    get_enemy_from_player(player) {
        let e;
        this.enemies.forEach(enemy => {
            if (enemy.target.id === player.id) {
                e = enemy;
            }
        });
        return e;
    }

    enemy_selector() {
        let sel = "";
        let count = 1;

        if (this.enemies.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_enemies);
            this.enemies_count = count - 1;
        } else {
            this.enemies.forEach(enemy => {
                sel += Tools.parseReply(AV.config.selector_pattern_enemies, [count, enemy.name, enemy.lv]);
                count += 1;
            });
            this.enemies_count = count - 1;
        }
        this.selector_enemies = sel;
    }

    player_selector() {
        let sel = "";
        let count = 1;

        if (this.players.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_players);
            this.players_count = count - 1;
        } else {
            this.players.forEach(player => {
                sel += Tools.parseReply(AV.config.selector_pattern_players, [count, player.name, player.lv]);
                count += 1;
            });
            this.players_count = count - 1;
        }
        this.selector_players = sel;
    }

    data(player, tar_num) {
        let message = "";
        let enemy = this.enemies[tar_num];
        message += Tools.parseReply(AV.config.battle_data, [player.name, enemy.name]);
        message += this.data_stats(player,enemy);


        return message;
    }

    data_stats(player,enemy) {
        let message = "";
        message += this.data_stats_generate("Level", player.lv, enemy.lv);
        message += this.data_stats_generate("Initiative", player.ini, enemy.ini);
        message += this.data_stats_generate("Direct Attack", player.atk + player.weapon.atk, enemy.atk);
        message += this.data_stats_generate("Hit Attack", player.weapon.atk_P, enemy.atk_P);
        message += this.data_stats_generate("Defense", player.def, enemy.def);

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

    select_item(player, item_num) {
        let item, message;
        message = "";
        item = player.battle_inventory[item_num];
        player.selected_battle_item = item;
        player.item_target_finder_on = true;

        if(item.subtype === "heal") {
            message += Tools.parseReply(AV.config.choose_target_player, [player.name]);
            message += this.selector_players;
        } else {
            message += Tools.parseReply(AV.config.choose_target_enemy, [player.name])
        }
        return message;
    }

    item_target_resolve(player, tar_num) {
        let message = "";
        if (player.selected_battle_item.subtype === "heal") {
            if (tar_num <= this.players_count) {
                player.target = this.players[tar_num-1];
                return true;

            }
        } else {
            if (tar_num <= this.enemies_count) {
                player.target = this.enemies[tar_num-1];
                return true;
            }
        }
        return false;
    }
};