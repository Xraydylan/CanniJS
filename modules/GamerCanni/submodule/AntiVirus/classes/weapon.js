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

            this.type = "weapon";
        }
    }
};