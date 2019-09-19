const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Weapon = require('./weapon');
const Item = require('./item');
const Enemy = require('./enemy');
const Battle_PvE = require('./battle_pve');

module.exports = class Spawn {
    constructor() {
        this.enemies = AV.enemies;
        this.virus = AV.virus;
        this.worm = AV.worm;
        this.trojan = AV.trojan;

        this.enemies_lv_dict =  this.sort_enemies_by_lv(this.enemies);
    }

    sort_enemies_by_lv(enemies) {
        let dict = {};
        enemies.forEach(enemy => {
            if (dict[enemy.lv]) {
                dict[enemy.lv].push(enemy);
            } else {
                dict[enemy.lv] = [enemy];
            }
        });
        return dict;
    }

    spawn(msg, p) {
        let enemy;
        let message = "";
        enemy = this.get_enemy(p);
        message += this.spawn_message(msg, p, enemy);
        return [message,enemy];
    }

    get_enemy(p) {
        let random, lim_down, lim_up, lv, enemies, enemy;
        random = Tools.getRandomIntFromInterval(1,100);
        lv = p.lv;
        [lim_down, lim_up] = this.determine_limits(p);

        if (lim_down <= random) {
            lv -= 1;
            if (lv <= 0) {lv = 1;}
            enemies = this.enemies_lv_dict[lv];
        } else if (random <= lim_up) {
            enemies = this.enemies_lv_dict[lv];
        } else if (random > lim_up) {
            lv += 1;
            enemies = this.enemies_lv_dict[lv];
            if (!enemies) {
                lv -= 1;
                enemies = this.enemies_lv_dict[lv];
            }
        }
        enemy = new Enemy(false, enemies[Math.floor(Math.random()*enemies.length)]);
        return enemy;
    }

    determine_limits(p, soft = 20, lim_down_max = 20,lim_up_max = 100,lim_up_min = 80) {
        let rat, lim_down, lim_up, x, m;
        rat = p.get_exp_ration();

        if (rat > soft) {
            lim_down = lim_down_max;
            lim_up = lim_up_max;
        } else {
            x = (rat - soft);
            m = (lim_up_max - lim_up_min) / (100 - soft);
            lim_up = Math.ceil(lim_up_max - m * x);
            lim_down = lim_down_max - lim_up;
        }
        return [lim_down,lim_up];
    }

    spawn_message(msg, p, enemy) {
        let message = "";
        message += Tools.parseReply(AV.config.startcombat,[enemy.name]);
        return message
    }
};