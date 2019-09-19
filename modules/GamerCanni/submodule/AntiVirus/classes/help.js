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

module.exports = class help {
    constructor(path) {
        this.categories = [];
        this.info = {};
        this.loadtxtdata(path);
        this.help_selector();
    }

    loadtxtdata(path) {
        let pre,key,value;
        let prep = this.prepare_help;
        let files = fs.readdirSync(path);
        if (files) {
            files.forEach(file => {
                let buf = fs.readFileSync(path + "/" + file);
                [key, value] = prep(buf.toString());
                this.categories.push(key);
                this.info[key] = value;
            });
        }
    }

    prepare_help(pre) {
        let key,value;
        let pre_val = "";
        pre = pre.split("\n");
        key = pre.shift().split("\r")[0];
        pre.forEach(string => {
            pre_val += string + "\n";
        });
        value = pre_val;
        return [key,value]
    }

    help_selector() {
        let sel = "";
        let count = 1;

        if (this.categories.length <= 0) {
            sel += Tools.parseReply(AV.config.selector_no_help);
            this.help_count = count - 1;
        } else {
            this.categories.forEach(cat => {
                sel += Tools.parseReply(AV.config.selector_pattern_help, [count, cat]);
                count += 1;
            });
            this.help_count = count - 1;
        }
        this.selector_help = sel;
    }

    get_help_info(key) {
        return this.info[key];
    }
};