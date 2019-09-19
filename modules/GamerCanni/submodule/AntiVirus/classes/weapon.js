const Application = require("../../../../../lib/Application");
const Promise = require("bluebird");
const Tools = require("../../../../../lib/Tools");
const fs = require('fs');
const AV = require('../antiVirus');
const Player = require('./player');
const Item = require('./item');
const Enemy = require('./enemy');
const Battle_PvE = require('./battle_pve');

module.exports = class Weapon {
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
            this.value = data.value;
            this.type = "weapon";
            this.loadinfo(data.info);
        } else {
            this.name = data.name;
            this.id = data.id;
            this.lv = data.lv;
            this.atk = data.atk;
            this.atk_P = data.atk_P;
            this.def = data.def;
            this.def_P = data.def_P;
            this.starter = data.starter;
            this.value = data.value;
            this.type = data.type;
            this.info = data.info;
        }
    }

    loadinfo(pre) {
        let text = "";
        text = Tools.parseReply(pre, [this.name, this.atk, this.atk_P]);
        this.info = text;
    }

    static get_weapon_by_id(id) {
        let weapon = undefined;
        AV.weapons.forEach(i => {
            if (i.id === parseInt(id)) {
                weapon = i;
            }
        });
        return weapon;
    }
};